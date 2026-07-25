import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Text } from "@/components/ui/text";
import { GlassSelect } from "@/components/ui/glass-select";
import { api, type MediaEvent } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { useT } from "@/lib/i18n";
import { useNotifications } from "@/components/Notifications";
import { FeedRow } from "@/components/media/FeedRow";
import { EventDetail } from "@/components/media/EventDetail";
import { type Cluster, clusterEvents, dayKey } from "@/components/media/clusters";
import { Film, Loader2 } from "lucide-react";

export function MediaPage() {
  const t = useT();
  const { notify } = useNotifications();
  const [events, setEvents] = useState<MediaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [cameraFilter, setCameraFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const PAGES_PER_LOAD = 3;

  // NB: non mettere `t` tra le dipendenze — useT() restituisce una nuova
  // funzione a ogni render, che renderebbe `load` instabile e farebbe ripartire
  // l'effetto di caricamento a ogni render (loop infinito di fetch).
  const load = useCallback(async (startPage: number, replace: boolean) => {
    try {
      const data = await api.getEvents(startPage, PAGES_PER_LOAD);
      const incoming = data.events || [];
      setHasMore(incoming.length > 0);
      setEvents((prev) => {
        if (replace) return incoming;
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...incoming.filter((e) => !seen.has(e.id))];
      });
    } catch (e) {
      notify({
        title: "Errore",
        message: e instanceof Error ? e.message : String(e),
        type: "error",
      });
      setHasMore(false);
    }
  }, [notify]);

  useEffect(() => {
    setLoading(true);
    load(1, true).finally(() => setLoading(false));
  }, [load]);

  async function handleLoadMore() {
    const next = page + PAGES_PER_LOAD;
    setLoadingMore(true);
    await load(next, false);
    setPage(next);
    setLoadingMore(false);
  }

  const cameraOptions = useMemo(() => {
    const names = Array.from(new Set(events.map((e) => e.device_name))).sort();
    return [
      { value: "all", label: t("media.allCameras") },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  }, [events, t]);

  const filtered = useMemo(
    () =>
      cameraFilter === "all"
        ? events
        : events.filter((e) => e.device_name === cameraFilter),
    [events, cameraFilter]
  );

  // Cluster raggruppati per giorno.
  const days = useMemo(() => {
    const clusters = clusterEvents(filtered);
    const map = new Map<string, Cluster[]>();
    for (const c of clusters) {
      const k = dayKey(c.time);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const allClusters = useMemo(() => days.flatMap(([, cs]) => cs), [days]);

  // Seleziona automaticamente il primo cluster (o riallinea se sparisce).
  useEffect(() => {
    if (allClusters.length === 0) {
      setSelectedKey(null);
    } else if (!allClusters.some((c) => c.key === selectedKey)) {
      setSelectedKey(allClusters[0].key);
    }
  }, [allClusters, selectedKey]);

  const selected = useMemo(
    () => allClusters.find((c) => c.key === selectedKey) ?? null,
    [allClusters, selectedKey]
  );

  function dayLabel(ms: number): string {
    const now = new Date();
    const d = new Date(ms);
    const today = dayKey(now.getTime());
    const yest = dayKey(now.getTime() - 86400000);
    const k = dayKey(ms);
    if (k === today) return t("media.today");
    if (k === yest) return t("media.yesterday");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  async function handleDownload(ev: MediaEvent) {
    setBusyIds((s) => new Set(s).add(ev.id));
    try {
      const name = `${ev.device_name}-${ev.created_at.slice(0, 19).replace(/[:T]/g, "-")}.mp4`;
      const ok = await downloadFile(api.eventVideoUrl(ev.media), name);
      if (ok) notify({ title: t("media.downloaded"), message: ev.device_name, type: "info" });
    } catch (e) {
      notify({
        title: t("media.downloadError"),
        message: e instanceof Error ? e.message : String(e),
        type: "error",
      });
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(ev.id);
        return n;
      });
    }
  }

  async function handleDelete(ev: MediaEvent) {
    if (!window.confirm(t("media.confirmDelete"))) return;
    setBusyIds((s) => new Set(s).add(ev.id));
    try {
      await api.deleteEvents([ev.id]);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      notify({ title: t("media.deleted"), message: ev.device_name, type: "info" });
    } catch (e) {
      notify({
        title: t("media.deleteError"),
        message: e instanceof Error ? e.message : String(e),
        type: "error",
      });
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(ev.id);
        return n;
      });
    }
  }

  return (
    <main className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      {/* Feed eventi (master) */}
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-secondary/60 backdrop-blur-xl">
        {/* Header feed */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Film className="h-4 w-4 text-primary" />
            <Text as="h2" size="base" weight="bold" className="text-foreground">
              {t("media.title")}
            </Text>
          </div>
          {events.length > 0 && (
            <GlassSelect
              value={cameraFilter}
              options={cameraOptions}
              onChange={setCameraFilter}
            />
          )}
        </div>

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <Text shadow="none" size="sm">{t("media.loading")}</Text>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              <Film className="h-9 w-9 opacity-30" />
              <Text weight="medium" size="sm" className="text-foreground">{t("media.empty")}</Text>
              <Text size="xs" shadow="none">{t("media.emptyHint")}</Text>
            </div>
          ) : (
            <div className="space-y-4">
              {days.map(([k, clusters]) => (
                <div key={k}>
                  <Text
                    as="p"
                    size="xs"
                    weight="semibold"
                    shadow="none"
                    className="mb-1.5 px-2 uppercase tracking-wide text-muted-foreground first-letter:uppercase"
                  >
                    {dayLabel(clusters[0].time)}
                  </Text>
                  <div className="flex flex-col gap-1">
                    {clusters.map((cluster) => (
                      <FeedRow
                        key={cluster.key}
                        cluster={cluster}
                        selected={cluster.key === selectedKey}
                        onSelect={() => setSelectedKey(cluster.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="px-1 pb-1 pt-1">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-medium text-muted-foreground backdrop-blur-md transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                  >
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("media.loadMore")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Dettaglio (detail) */}
      <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-secondary/60 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.key}
              className="flex h-full flex-col"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <EventDetail
                cluster={selected}
                busyIds={busyIds}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            </motion.div>
          ) : (
            !loading && (
              <div className="flex h-full items-center justify-center">
                <Text shadow="none" className="text-muted-foreground">
                  {t("media.empty")}
                </Text>
              </div>
            )
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
