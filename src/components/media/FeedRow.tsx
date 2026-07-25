import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Layers } from "lucide-react";
import { type Cluster, toMs, hhmm } from "./clusters";

// Riga del feed eventi (master): evento singolo o cluster multiplo.
export function FeedRow({
  cluster,
  selected,
  onSelect,
}: {
  cluster: Cluster;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const multi = cluster.events.length > 1;

  if (!multi) {
    // Evento singolo: thumbnail + camera + ora (come le righe semplici mobile).
    const ev = cluster.events[0];
    return (
      <button
        onClick={onSelect}
        className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-all ${
          selected
            ? "border-primary/40 bg-primary/10 shadow-sm shadow-primary/10"
            : "border-transparent hover:border-white/10 hover:bg-white/5"
        }`}
      >
        <div className="h-12 w-[72px] shrink-0 overflow-hidden rounded-lg bg-black/40">
          <img
            src={api.eventThumbnailUrl(ev.thumbnail)}
            alt={ev.device_name}
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
            onError={(e) => (e.currentTarget.style.opacity = "0")}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Text as="p" size="sm" weight="medium" shadow="none" className="truncate text-foreground">
            {ev.device_name}
          </Text>
          <Text as="p" size="xs" shadow="none" className="text-muted-foreground">
            {t("media.motion")} · {hhmm(cluster.time)}
          </Text>
        </div>
      </button>
    );
  }

  // Cluster multiplo: intervallo orario + striscia thumbnail con "+N" + conteggio.
  const times = cluster.events.map((e) => toMs(e.created_at));
  const start = hhmm(Math.min(...times));
  const end = hhmm(Math.max(...times));
  const range = start === end ? start : `${start} - ${end}`;
  const MAX_THUMBS = 3;
  const shown = cluster.events.slice(0, MAX_THUMBS);
  const extra = cluster.events.length - shown.length;

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-all ${
        selected
          ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
          : "border-primary/20 hover:border-primary/40 hover:bg-white/5"
      }`}
    >
      {/* Riga titolo: intervallo orario + badge multi */}
      <div className="flex items-center justify-between">
        <Text as="p" size="sm" weight="semibold" shadow="none" className="text-foreground">
          {range}
        </Text>
        <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          <Layers className="h-3 w-3" />
          {cluster.events.length}
        </span>
      </div>

      {/* Striscia thumbnail con overflow "+N" */}
      <div className="flex gap-1">
        {shown.map((ev, i) => (
          <div
            key={ev.id}
            className="relative h-11 flex-1 overflow-hidden rounded-md bg-black/40"
          >
            <img
              src={api.eventThumbnailUrl(ev.thumbnail)}
              alt={ev.device_name}
              className="h-full w-full object-cover"
              draggable={false}
              loading="lazy"
              onError={(e) => (e.currentTarget.style.opacity = "0")}
            />
            {/* Overlay "+N" sull'ultima thumbnail visibile */}
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white">
                +{extra}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Conteggio eventi */}
      <Text as="p" size="xs" shadow="none" className="text-muted-foreground">
        {t("media.eventsCount", { n: cluster.events.length })}
      </Text>
    </button>
  );
}
