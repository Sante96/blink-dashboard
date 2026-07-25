/**
 * Hook per eventi in background via WebSocket.
 *
 * Si connette a /ws/events e resta attivo SEMPRE (anche con finestra nascosta
 * nella tray). Quando riceve un evento "motion", mostra una notifica OS via
 * Tauri API e suona l'alert se abilitato nelle impostazioni.
 *
 * Riconnette automaticamente con backoff esponenziale.
 */

import { useEffect, useRef } from "react";
import { WS_BASE, getLocalToken } from "@/lib/api";
import { readSettings } from "@/lib/settings";
import { useNotifications } from "@/components/Notifications";
import { useT } from "@/lib/i18n";

/** Backoff: min 2s, max 30s, raddoppio a ogni tentativo fallito. */
const MIN_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 30000;

interface MotionEvent {
  type: "motion";
  camera: string;
  timestamp: string;
}

export function useBackgroundEvents(enabled: boolean) {
  const { notify } = useNotifications();
  const t = useT();

  // Ref stabili per evitare di ricreare il WebSocket a ogni render
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let backoff = MIN_RECONNECT_MS;
    let disposed = false;

    async function connect() {
      if (disposed) return;

      const token = await getLocalToken();
      const url = `${WS_BASE}/ws/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;

      ws = new WebSocket(url);

      ws.onopen = () => {
        // Connessione stabilita: reset backoff
        backoff = MIN_RECONNECT_MS;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "motion") {
            handleMotionEvent(data as MotionEvent);
          }
          // "ping" → ignoriamo, serve solo a tenere viva la connessione
        } catch {
          // JSON non valido: ignora
        }
      };

      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onerror è sempre seguito da onclose; non serve fare nulla qui.
      };
    }

    function handleMotionEvent(event: MotionEvent) {
      const settings = readSettings();
      if (!settings.osNotifications && !settings.soundEnabled) return;

      notifyRef.current({
        title: tRef.current("notif.motionDetected"),
        message: event.camera,
        type: "motion",
      });
    }

    function scheduleReconnect() {
      if (disposed) return;
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, MAX_RECONNECT_MS);
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimeout !== null) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.onclose = null; // Evita riconnessione durante il cleanup
        ws.close();
        ws = null;
      }
    };
  }, [enabled]);
}
