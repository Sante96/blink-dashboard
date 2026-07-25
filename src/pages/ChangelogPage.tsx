import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Text } from "@/components/ui/text";
import { changelog, type ChangeType, type Release } from "@/lib/changelog";
import { useT } from "@/lib/i18n";

// Tipologia → label minimo senza icona.
const TYPE_LABELS: Record<ChangeType, string> = {
  feature: "Novità",
  improvement: "Miglioramento",
  fix: "Fix",
};

const TYPE_ORDER: ChangeType[] = ["feature", "improvement", "fix"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChangelogPage() {
  const t = useT();
  const [selected, setSelected] = useState(changelog[0].version);
  const release = changelog.find((r) => r.version === selected) ?? changelog[0];

  return (
    <main className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      {/* Sidebar versioni */}
      <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-secondary/60 backdrop-blur-xl">
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <Text as="p" size="sm" weight="bold" className="text-foreground">
            {t("changelog.title")}
          </Text>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="flex flex-col gap-0.5">
            {changelog.map((r, idx) => {
              const active = r.version === selected;
              return (
                <button
                  key={r.version}
                  onClick={() => setSelected(r.version)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Text as="span" size="sm" weight="medium" shadow="none">
                      v{r.version}
                    </Text>
                    {idx === 0 && (
                      <span className="rounded bg-white/10 px-1 text-[10px] font-medium text-muted-foreground">
                        latest
                      </span>
                    )}
                  </div>
                  <Text as="span" size="xs" shadow="none" className="text-muted-foreground">
                    {r.changes.length}
                  </Text>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Dettaglio release */}
      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/60 p-6 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={release.version}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
          >
            <ReleaseDetail release={release} />
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}

function ReleaseDetail({ release }: { release: Release }) {
  const t = useT();

  // Raggruppa le modifiche per tipo, mantenendo l'ordine feature→improvement→fix.
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: release.changes.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 border-b border-white/10 pb-4">
        <Text as="h1" size="2xl" weight="bold" shadow="none" className="text-foreground">
          v{release.version}
        </Text>
        <Text as="p" size="sm" shadow="none" className="mt-1 text-muted-foreground">
          {fmtDate(release.date)}
        </Text>
      </div>

      {/* Sezioni per tipo */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.type}>
            <Text
              as="p"
              size="xs"
              weight="semibold"
              shadow="none"
              className="mb-2 uppercase tracking-wide text-muted-foreground"
            >
              {t(`changelog.type.${group.type}`) || TYPE_LABELS[group.type]}
            </Text>
            <ul className="space-y-1.5 pl-1">
              {group.items.map((change, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  <Text as="span" size="sm" shadow="none" className="text-foreground/90">
                    {change.text}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
