import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPillButton } from "@/components/ui/glass-pill";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
} from "lucide-react";

interface GlassVideoPlayerProps {
  src: string;
  /** Cambia per forzare il remount del <video> (es. cambio clip). */
  videoKey?: string | number;
  autoPlay?: boolean;
  className?: string;
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Player video con controlli custom glassmorphism, in linea con i controlli
// on-hover del liveview. Nasconde i controlli nativi e li rimpiazza con una
// barra glass che si auto-nasconde durante la riproduzione.
export function GlassVideoPlayer({
  src,
  videoKey,
  autoPlay = true,
  className,
}: GlassVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [ended, setEnded] = useState(false);

  // --- Sync stato dal <video> ---
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onPlay = () => { setPlaying(true); setEnded(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setEnded(true); setControlsVisible(true); };
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onVol = () => { setMuted(v.muted); setVolume(v.volume); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("progress", onProgress);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("volumechange", onVol);
    };
  }, [src]);

  // --- Fullscreen listener ---
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // --- Auto-hide controlli durante il play ---
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    showControls();
  }, [showControls]);

  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const onVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const seek = useCallback((clientX: number, bar: HTMLElement) => {
    const v = videoRef.current;
    if (!v) return;
    // Legge la durata live dal video: lo stato React può essere indietro e un
    // valore 0/NaN manderebbe currentTime a 0 (riavvio da capo).
    const dur = v.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const target = ratio * dur;
    if (Number.isFinite(target)) {
      v.currentTime = target;
      setCurrent(target);
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta));
    setCurrent(v.currentTime);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);

  // --- Scorciatoie tastiera (solo con il player a fuoco: agganciarle a window
  //     ruberebbe Space/frecce al resto della pagina, es. lo scroll del feed) ---
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ignora se l'utente sta interagendo con un input (es. slider volume).
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        skip(5);
        showControls();
        break;
      case "ArrowLeft":
        e.preventDefault();
        skip(-5);
        showControls();
        break;
      case "ArrowUp":
        e.preventDefault();
        onVolume(Math.min(1, v.volume + 0.1));
        showControls();
        break;
      case "ArrowDown":
        e.preventDefault();
        onVolume(Math.max(0, v.volume - 0.1));
        showControls();
        break;
      case "m":
        toggleMute();
        showControls();
        break;
      case "f":
        toggleFullscreen();
        break;
      default:
        return;
    }
  }, [togglePlay, skip, onVolume, toggleMute, toggleFullscreen, showControls]);

  // Dai il focus al player quando (ri)monta, così le scorciatoie funzionano
  // subito senza doverci cliccare sopra.
  useEffect(() => {
    containerRef.current?.focus();
  }, [src]);

  const progress = duration ? (current / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`group relative flex items-center justify-center overflow-hidden bg-black outline-none ${className ?? ""}`}
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
    >
      <video
        ref={videoRef}
        key={videoKey}
        src={src}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        className="max-h-full max-w-full cursor-pointer"
      />

      {/* Overlay play centrale (in pausa o a fine video) */}
      <AnimatePresence>
        {(!playing || ended) && (
          <motion.button
            onClick={ended ? replay : togglePlay}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60"
          >
            {ended ? (
              <RotateCcw className="h-7 w-7 text-white" />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5 text-white" fill="currentColor" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Barra controlli glass */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-3 left-3 right-3 flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-xl"
          >
            {/* Timeline — seek su mousedown+drag (un solo handler per evitare
                il doppio-fire click+mousedown che rimandava il video a capo) */}
            <div
              className="group/bar relative h-1.5 cursor-pointer rounded-full bg-white/20"
              onMouseDown={(e) => {
                e.preventDefault();
                const bar = e.currentTarget;
                seek(e.clientX, bar);
                const move = (ev: MouseEvent) => seek(ev.clientX, bar);
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* Progress */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
                style={{ left: `${progress}%` }}
              />
            </div>

            {/* Riga bottoni */}
            <div className="flex items-center gap-1">
              <GlassPillButton onClick={ended ? replay : togglePlay} className="px-2">
                {ended ? (
                  <RotateCcw className="h-4 w-4" />
                ) : playing ? (
                  <Pause className="h-4 w-4" fill="currentColor" />
                ) : (
                  <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
                )}
              </GlassPillButton>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <GlassPillButton onClick={toggleMute} className="px-2">
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </GlassPillButton>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolume(Number(e.target.value))}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  style={{
                    background: `linear-gradient(to right, hsl(82 85% 55%) ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.25) ${(muted ? 0 : volume) * 100}%)`,
                  }}
                />
              </div>

              {/* Tempo */}
              <span className="ml-1 select-none font-mono text-xs text-white/90 text-shadow-sm">
                {fmtTime(current)} / {fmtTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Fullscreen */}
              <GlassPillButton onClick={toggleFullscreen} className="px-2">
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </GlassPillButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
