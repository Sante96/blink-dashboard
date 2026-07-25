import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPillButton } from "@/components/ui/glass-pill";
import { Text } from "@/components/ui/text";
import { useLiveStream } from "@/lib/useLiveStream";
import { useT } from "@/lib/i18n";
import {
  ShieldCheck,
  ShieldOff,
  Camera as CameraIcon,
  Volume2,
  VolumeX,
  Lightbulb,
  LightbulbOff,
  RefreshCw,
} from "lucide-react";

interface LiveCameraProps {
  name: string;
  armed: boolean;
  motionDetected: boolean;
  /** La camera ha la luce integrata (solo Blink Mini 2). */
  hasLight?: boolean;
  onToggleArm: (armed: boolean) => void;
  onSnapshot: () => void;
  onToggleLight: (on: boolean) => Promise<boolean>;
  onLiveChange?: (isLive: boolean) => void;
  onError?: (error: string) => void;
  /** Camera fittizia per test di layout: mostra un placeholder, niente stream. */
  mock?: boolean;
}

export function LiveCamera({
  name,
  armed,
  motionDetected,
  hasLight = false,
  onToggleArm,
  onSnapshot,
  onToggleLight,
  onLiveChange,
  onError,
  mock = false,
}: LiveCameraProps) {
  const t = useT();
  // Tutta la meccanica WebSocket + MediaSource vive nell'hook: qui restano
  // solo lo stato UI e i controlli.
  const { videoRef, status, reconnectNow, restart, setSuspendReconnect } =
    useLiveStream(name, {
      enabled: !mock,
      onSocketError: () => onError?.(t("camera.wsError")),
    });
  const [muted, setMuted] = useState(true);
  const [flash, setFlash] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const [lightBusy, setLightBusy] = useState(false);
  const lightWaitingReconnect = useRef(false);

  // Quando lo stream torna live (o va in errore) dopo un toggle luce,
  // sblocca lightBusy così l'overlay normale può tornare visibile.
  useEffect(() => {
    if (lightWaitingReconnect.current && (status === "live" || status === "error")) {
      lightWaitingReconnect.current = false;
      setLightBusy(false);
    }
  }, [status]);

  // Notifica il parent quando lo stato live cambia (per la status bar).
  useEffect(() => {
    onLiveChange?.(status === "live");
    return () => onLiveChange?.(false);
  }, [status === "live"]);

  async function toggleLight() {
    const next = !lightOn;
    setLightBusy(true);
    setLightOn(next); // ottimistico
    // Blocca la riconnessione automatica mentre il comando luce è in volo:
    // altrimenti il frontend ri-apre il liveview e ri-occupa il device
    // mentre il backend prova a mandare il comando REST → 409.
    setSuspendReconnect(true);
    try {
      // Il backend ritorna lo stato REALE della luce: lo usiamo per riallineare
      const real = await onToggleLight(next);
      setLightOn(real);
      // Il backend ha finito e liberato il device: ora possiamo riconnettere.
      lightWaitingReconnect.current = true;
      setSuspendReconnect(false);
      reconnectNow();
    } catch {
      setLightOn(!next); // rollback: comando fallito (es. 409)
      setLightBusy(false);
      setSuspendReconnect(false);
      reconnectNow();
    }
  }

  // Riavvia lo stream: utile quando il feed resta bloccato in bianco/nero (IR)
  // dopo che la stanza si è illuminata. La camera decide la modalità IR/colori
  // all'apertura dello stream, quindi riconnettere la fa ricommutare.
  function refreshStream() {
    // Mantieni l'ultimo frame visibile durante il refresh (come per la luce)
    lightWaitingReconnect.current = true;
    setLightBusy(true);
    restart();
  }

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
      // Sbloccare l'audio richiede spesso una nuova chiamata a play()
      if (!next) videoRef.current.play().catch(() => {});
    }
  }

  function handleSnapshot() {
    // Flash visivo come feedback dello scatto
    setFlash(true);
    window.setTimeout(() => setFlash(false), 250);
    onSnapshot();
  }

  return (
    <div
      className="group relative h-full w-full overflow-hidden rounded-lg border border-white/10 bg-card/80 backdrop-blur-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header card — solo badge di stato (il nome è in basso per non
          sovrapporsi al watermark Blink in alto a sinistra) */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-end px-3 py-3">
        <AnimatePresence>
          {armed && motionDetected && (
            <motion.span
              key="motion"
              className="mr-auto flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-1 backdrop-blur-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <Text size="xs" weight="medium" className="text-primary">{t("camera.motion")}</Text>
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {status === "live" && (
            <motion.span
              key="live"
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <Text size="xs" weight="medium" className="text-white/90">{t("camera.live")}</Text>
            </motion.span>
          )}
          {status === "reconnecting" && (
            <motion.span
              key="reconnecting"
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
              <Text size="xs" weight="medium" className="text-white/90">{t("camera.reconnecting")}</Text>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-cover"
        muted
        playsInline
        autoPlay
      />

      {/* Nome camera in basso a sinistra (pill glass) */}
      <div className="absolute bottom-3 left-3 z-10">
        <Text
          size="sm"
          weight="medium"
          shadow="md"
          className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white backdrop-blur-md"
        >
          {name}
        </Text>
      </div>

      {/* Controlli on-hover (glassmorphism).
          opacity e backdrop-blur stanno sullo STESSO elemento (il motion.div
          è esso stesso la pill glass): così l'opacity animata non azzera il
          backdrop-filter, che rimane sfocato per tutta la transizione. */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute bottom-3 left-1/2 z-20 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 shadow-lg backdrop-blur-md"
            style={{ x: "-50%" }}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
              <GlassPillButton
                active={armed}
                onClick={() => onToggleArm(!armed)}
                title={armed ? t("camera.disarm") : t("camera.arm")}
              >
                {armed ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
                {armed ? t("camera.armed") : t("camera.disarmed")}
              </GlassPillButton>
              <GlassPillButton
                active={!muted}
                onClick={toggleMuted}
                title={muted ? t("camera.unmuteAudio") : t("camera.muteAudio")}
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </GlassPillButton>
              {hasLight && (
                <GlassPillButton
                  active={lightOn}
                  disabled={lightBusy}
                  onClick={toggleLight}
                  title={lightOn ? t("camera.lightOff") : t("camera.lightOn")}
                >
                  {lightOn ? (
                    <Lightbulb className="h-3.5 w-3.5" />
                  ) : (
                    <LightbulbOff className="h-3.5 w-3.5" />
                  )}
                </GlassPillButton>
              )}
              <GlassPillButton onClick={handleSnapshot} title={t("camera.snapshot")}>
                <CameraIcon className="h-3.5 w-3.5" />
              </GlassPillButton>
              <GlassPillButton
                onClick={refreshStream}
                disabled={lightBusy}
                title={t("camera.refresh")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </GlassPillButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash bianco di feedback allo scatto */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 bg-white"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Overlay stati */}
      <AnimatePresence>
        {status === "loading" && !lightBusy && (
          <motion.div
            key="loading"
            className="absolute inset-0 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <Text size="sm" shadow="none" className="text-muted-foreground">{t("camera.connecting")}</Text>
            </div>
          </motion.div>
        )}

        {status === "reconnecting" && !lightBusy && (
          <motion.div
            key="reconnecting"
            className="absolute inset-0 flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
              <Text size="sm" shadow="none" className="text-yellow-400">{t("camera.reconnectingDots")}</Text>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            className="absolute inset-0 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Text size="sm" shadow="none" className="text-destructive">{t("camera.streamUnavailable")}</Text>
          </motion.div>
        )}

        {status === "idle" && (
          <motion.div
            key="idle"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/80 to-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {mock ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                <CameraIcon className="h-8 w-8" />
                <Text size="sm" weight="medium" shadow="none">{t("camera.demo")}</Text>
              </div>
            ) : (
              <Text size="sm" shadow="none" className="text-muted-foreground">{t("camera.waiting")}</Text>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
