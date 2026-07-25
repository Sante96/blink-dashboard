import { useEffect, useRef, useState } from "react";
import { WS_BASE, getLocalToken } from "@/lib/api";

export type LiveStreamStatus = "idle" | "loading" | "live" | "reconnecting" | "error";

interface UseLiveStreamOptions {
  /** false per le camere mock: nessuna connessione, stato fisso "idle". */
  enabled: boolean;
  /** Invocato su errore del WebSocket (per il toast/overlay del chiamante). */
  onSocketError?: () => void;
}

/**
 * Gestisce lo stream live di una camera: WebSocket dal backend → coda di
 * chunk fMP4 → MediaSource agganciato al <video> ritornato in videoRef.
 * Si occupa di riconnessione automatica (la sessione Blink scade ~5 min),
 * eviction del buffer per le sessioni lunghe e pulizia allo smontaggio.
 */
export function useLiveStream(name: string, { enabled, onSocketError }: UseLiveStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Object URL del MediaSource corrente: va revocato a ogni riconnessione,
  // altrimenti ogni sessione ne lascia uno vivo in memoria.
  const objectUrlRef = useRef<string | null>(null);
  const queueRef = useRef<Uint8Array[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  // Se true la riconnessione automatica è sospesa (es. comando luce in volo:
  // riaprire il liveview ri-occuperebbe il device durante il comando REST).
  const suspendReconnectRef = useRef(false);
  // Callback impostato dall'effect per far ripartire la connessione on-demand.
  const reconnectNowRef = useRef<(() => void) | null>(null);
  // onSocketError via ref: la sua identità non deve riavviare l'effect.
  const onSocketErrorRef = useRef(onSocketError);
  onSocketErrorRef.current = onSocketError;

  const [status, setStatus] = useState<LiveStreamStatus>("idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    // Tentativi consecutivi falliti senza mai ricevere dati. Un reconnect dopo
    // una sessione riuscita azzera il contatore: lo scadere periodico (~5 min)
    // è normale e non deve contare come fallimento.
    let failedAttempts = 0;
    const MAX_FAILED_ATTEMPTS = 5;
    // Sessioni che muoiono entro SHORT_SESSION_MS contano come "quasi-fallimento":
    // dopo MAX_SHORT_DEATHS consecutive applichiamo un backoff lungo.
    let shortDeaths = 0;
    const SHORT_SESSION_MS = 15_000;
    const MAX_SHORT_DEATHS = 3;
    let sessionStartTime = 0;

    async function startStream() {
      if (!videoRef.current || cancelled) return;
      setStatus("loading");
      queueRef.current = [];
      sessionStartTime = Date.now();

      // Token anti-CSRF per il WebSocket (query param).
      const token = await getLocalToken();
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";

      // Connetti PRIMA il WebSocket senza toccare videoRef.src: così l'ultimo
      // frame del feed precedente resta visibile finché non arrivano dati nuovi.
      const ws = new WebSocket(
        `${WS_BASE}/ws/cameras/${encodeURIComponent(name)}/live${tokenParam}`
      );
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      let hasData = false;
      let sourceBuffer: SourceBuffer | null = null;

      function flushQueue() {
        if (!sourceBuffer || sourceBuffer.updating) return;

        // Eviction: il live non fa seek all'indietro, quindi teniamo solo gli
        // ultimi ~30s. Senza remove() il buffer cresce per tutta la sessione.
        const v = videoRef.current;
        try {
          if (v && sourceBuffer.buffered.length > 0) {
            const start = sourceBuffer.buffered.start(0);
            if (v.currentTime - start > 60) {
              sourceBuffer.remove(start, v.currentTime - 30);
              return; // updateend richiamerà flushQueue per l'append
            }
          }
        } catch {
          // buffered non leggibile (MediaSource chiuso): prosegui con l'append
        }

        const next = queueRef.current.shift();
        if (next) {
          try {
            sourceBuffer.appendBuffer(next.buffer as ArrayBuffer);
          } catch (err) {
            if ((err as DOMException)?.name === "QuotaExceededError") {
              // Buffer pieno: rimetti il chunk in coda e libera spazio dietro
              // la posizione di riproduzione; updateend riproverà l'append.
              queueRef.current.unshift(next);
              try {
                if (v && sourceBuffer.buffered.length > 0) {
                  const start = sourceBuffer.buffered.start(0);
                  sourceBuffer.remove(start, Math.max(start + 1, v.currentTime - 5));
                }
              } catch {
                // impossibile liberare: il chunk resta in coda per il prossimo giro
              }
            }
            // Altri errori (buffer chiuso): chunk scartato, la riconnessione
            // ricreerà MediaSource e coda da zero.
          }
        }
      }

      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data);

        // Al PRIMO chunk: crea il MediaSource e aggancialo al video ora (non
        // prima), così lo switch dal vecchio all'ultimo frame è istantaneo.
        if (!hasData && !cancelled) {
          hasData = true;
          failedAttempts = 0;

          const mediaSource = new MediaSource();
          if (videoRef.current) {
            // Revoca l'object URL della sessione precedente prima di crearne
            // uno nuovo, altrimenti resta vivo (con il suo buffer) per sempre.
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = URL.createObjectURL(mediaSource);
            videoRef.current.src = objectUrlRef.current;
          }
          mediaSource.addEventListener("sourceopen", () => {
            if (cancelled) return;
            sourceBuffer = mediaSource.addSourceBuffer(
              'video/mp4; codecs="avc1.640029, mp4a.40.2"'
            );
            sourceBuffer.addEventListener("updateend", flushQueue);
            setStatus("live");
            flushQueue();
          });
        }

        queueRef.current.push(data);
        flushQueue();

        // Auto-play
        if (videoRef.current && videoRef.current.paused && videoRef.current.buffered.length > 0) {
          videoRef.current.play().catch(() => {});
        }
      };

      ws.onerror = () => {
        if (!cancelled) {
          onSocketErrorRef.current?.();
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;

        if (!hasData) {
          // Non siamo mai andati live: conta come fallimento.
          failedAttempts += 1;
          if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            setStatus("error");
            return; // stop: probabilmente la camera è offline
          }
          setStatus("error");
        } else {
          // Sessione morta dopo aver ricevuto dati.
          const lived = Date.now() - sessionStartTime;
          if (lived < SHORT_SESSION_MS) {
            // Sessione brevissima: la camera non regge il live (batteria,
            // occupata, 523). Backoff per non martellare l'API.
            shortDeaths += 1;
            if (shortDeaths >= MAX_SHORT_DEATHS) {
              setStatus("error");
              return; // stop: la camera non è raggiungibile ora
            }
          } else {
            // Sessione lunga (scadenza naturale ~5 min): resetta il contatore.
            shortDeaths = 0;
          }
          setStatus("reconnecting");
        }
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimerRef.current !== null) return;
      if (suspendReconnectRef.current) return;
      // Backoff: 2s normale, 10s dopo sessioni brevi consecutive.
      const delay = shortDeaths >= 2 ? 10_000 : 2000;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        startStream();
      }, delay);
    }

    // Permette al chiamante di far ripartire lo stream on-demand
    // (senza aspettare il timer o un onclose).
    reconnectNowRef.current = () => {
      if (cancelled) return;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (!wsRef.current) startStream();
    };

    // Ritardo per evitare il doppio-mount di React StrictMode in dev:
    // il primo mount "fantasma" viene annullato dal cleanup prima di aprire
    // davvero il WebSocket, così Blink riceve una sola sessione liveview.
    const startTimer = window.setTimeout(startStream, 100);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      reconnectNowRef.current = null;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      queueRef.current = [];
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      // Sgancia il MediaSource dal <video> così il browser può liberarlo.
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [name, enabled]);

  return {
    videoRef,
    status,
    /** Riavvia subito la connessione se non attiva (annulla il timer di retry). */
    reconnectNow: () => reconnectNowRef.current?.(),
    /** Chiude e riapre lo stream: la camera rinegozia la modalità IR/colori. */
    restart: () => {
      if (wsRef.current) {
        wsRef.current.close(); // onclose farà scheduleReconnect
      } else {
        reconnectNowRef.current?.();
      }
    },
    /** Sospende/riattiva la riconnessione automatica. */
    setSuspendReconnect: (suspended: boolean) => {
      suspendReconnectRef.current = suspended;
    },
  };
}
