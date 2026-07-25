import { useState, useEffect } from "react";
import { Text } from "@/components/ui/text";
import { api, type MediaEvent } from "@/lib/api";
import { GlassVideoPlayer } from "@/components/GlassVideoPlayer";
import { useT } from "@/lib/i18n";
import {
  Download,
  Trash2,
  Loader2,
  Camera as CameraIcon,
  Layers,
  LayoutGrid,
} from "lucide-react";
import type { Cluster } from "./clusters";

// Pannello dettaglio (detail) di un cluster: player + tab dei clip + azioni.
export function EventDetail({
  cluster,
  busyIds,
  onDownload,
  onDelete,
}: {
  cluster: Cluster;
  busyIds: Set<number>;
  onDownload: (e: MediaEvent) => void;
  onDelete: (e: MediaEvent) => void;
}) {
  const t = useT();
  const multi = cluster.events.length > 1;
  const devices = Array.from(new Set(cluster.events.map((e) => e.device_name)));
  const fullTime = new Date(cluster.time).toLocaleString();

  // Tab attivo: "all" (griglia unita) o l'id di un singolo clip.
  const [tab, setTab] = useState<"all" | number>(multi ? "all" : cluster.events[0].id);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState(false);

  // Reset del tab quando cambia cluster.
  useEffect(() => {
    setTab(multi ? "all" : cluster.events[0].id);
  }, [cluster, multi]);

  // Merge dei clip quando serve la vista "all" di un cluster multiplo.
  useEffect(() => {
    if (!multi || tab !== "all") return;
    let url: string | null = null;
    let cancelled = false;
    setMerging(true);
    setMergeError(false);
    setMergedUrl(null);
    api
      .mergeEvents(cluster.events.map((e) => e.media))
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setMergedUrl(u);
      })
      .catch(() => !cancelled && setMergeError(true))
      .finally(() => !cancelled && setMerging(false));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cluster, multi, tab]);

  // Il tab può puntare a un clip appena eliminato per il render che precede
  // l'effect di reset: fallback sul primo clip invece di crashare.
  const activeEvent =
    (tab === "all" ? cluster.events[0] : cluster.events.find((e) => e.id === tab)) ??
    cluster.events[0];
  const busy = busyIds.has(activeEvent.id);

  // Sorgente video: griglia unita per "all", clip singolo altrimenti.
  const showMergedLoader = tab === "all" && multi && merging;
  const videoSrc =
    tab === "all"
      ? multi
        ? mergedUrl
        : api.eventVideoUrl(cluster.events[0].media)
      : api.eventVideoUrl(activeEvent.media);

  function handleDetailDownload() {
    // Per la griglia unita scarica il merge in memoria; altrimenti il clip.
    if (tab === "all" && multi && mergedUrl) {
      const name = `${devices.join("-")}-${cluster.events[0].created_at.slice(0, 19).replace(/[:T]/g, "-")}.mp4`;
      const a = document.createElement("a");
      a.href = mergedUrl;
      a.download = name;
      a.click();
    } else {
      onDownload(activeEvent);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text as="h2" size="lg" weight="bold" shadow="none" className="truncate text-foreground">
              {multi ? devices.join(" · ") : cluster.events[0].device_name}
            </Text>
            {multi && (
              <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                <Layers className="h-3 w-3" />
                {cluster.events.length}
              </span>
            )}
          </div>
          <Text as="p" size="sm" shadow="none" className="text-muted-foreground">
            {fullTime}
          </Text>
        </div>

        {/* Azioni */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onDelete(activeEvent)}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-md transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {t("media.delete")}
          </button>
          <button
            onClick={handleDetailDownload}
            disabled={busy || showMergedLoader || (tab === "all" && multi && !mergedUrl)}
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/80 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-md transition-all hover:bg-primary disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("media.download")}
          </button>
        </div>
      </div>

      {/* Player — riempie lo spazio disponibile e si adatta (object-contain) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black">
          {showMergedLoader ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <Text size="sm" shadow="none">{t("media.merging")}</Text>
            </div>
          ) : mergeError && tab === "all" ? (
            <Text size="sm" shadow="none" className="text-destructive">{t("media.mergeError")}</Text>
          ) : (
            videoSrc && (
              <GlassVideoPlayer
                videoKey={`${cluster.key}-${tab}`}
                src={videoSrc}
                className="h-full w-full"
              />
            )
          )}
        </div>

        {/* Tab dei clip (solo multi) */}
        {multi && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <TabButton
              active={tab === "all"}
              onClick={() => setTab("all")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label={t("media.allTogether")}
            />
            {cluster.events.map((ev) => (
              <TabButton
                key={ev.id}
                active={tab === ev.id}
                onClick={() => setTab(ev.id)}
                icon={<CameraIcon className="h-3.5 w-3.5" />}
                label={ev.device_name}
                thumbnail={api.eventThumbnailUrl(ev.thumbnail)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  thumbnail,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  thumbnail?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
      }`}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="h-6 w-9 rounded object-cover"
          draggable={false}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      )}
      <span className="max-w-[10rem] truncate">{label}</span>
    </button>
  );
}
