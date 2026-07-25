import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Trash2, AlertTriangle } from "lucide-react";
import { Text } from "@/components/ui/text";
import { useNotifications } from "@/components/Notifications";
import { useT } from "@/lib/i18n";

export function NotificationBell() {
  const t = useT();
  const { history, unreadCount, markAllRead, clearHistory } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Chiudi cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Segna lette all'apertura
  useEffect(() => {
    if (open && unreadCount > 0) markAllRead();
  }, [open, unreadCount, markAllRead]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-muted-foreground backdrop-blur-md transition-colors hover:bg-white/20 hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-white/15 bg-secondary/90 shadow-xl backdrop-blur-xl"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <Text as="p" size="sm" weight="semibold" shadow="none" className="text-foreground">
                {t("notif.title")}
              </Text>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                  title={t("notif.clearAll")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-72 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Text size="sm" shadow="none" className="text-muted-foreground">
                    {t("notif.empty")}
                  </Text>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 border-b border-white/5 px-3 py-2.5 last:border-0"
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                        item.type === "motion"
                          ? "bg-primary/15 text-primary"
                          : item.type === "error"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Text as="p" size="xs" weight="medium" shadow="none" className="text-foreground">
                        {item.title}
                      </Text>
                      {item.message && (
                        <Text as="p" size="xs" shadow="none" className="mt-0.5 truncate text-muted-foreground">
                          {item.message}
                        </Text>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
