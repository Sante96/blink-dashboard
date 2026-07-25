import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/api/notification";
import { Text } from "@/components/ui/text";
import { readSettings } from "@/lib/settings";
import { AlertTriangle, X, Sparkles } from "lucide-react";

// --- Tipi ---

interface Toast {
  id: string;
  title: string;
  message?: string;
  type?: "motion" | "info" | "error" | "update";
  /** ms prima dell'auto-dismiss (default 6000) */
  duration?: number;
  /** Se presente, il toast diventa cliccabile e invoca questa azione. */
  onClick?: () => void;
}

interface NotificationsContextValue {
  notify: (toast: Omit<Toast, "id">) => void;
  history: Toast[];
  clearHistory: () => void;
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notify: () => {},
  history: [],
  clearHistory: () => {},
  unreadCount: 0,
  markAllRead: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

// --- Suono alert (generato via Web Audio API, nessun file esterno) ---

let audioCtx: AudioContext | null = null;

function playAlertSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio non disponibile, ignora silenziosamente
  }
}

// --- Notifica nativa OS ---

/** Richiede (se serve) il permesso notifiche OS, dentro e fuori Tauri. */
export async function requestOsNotificationPermission() {
  if ("__TAURI__" in window) {
    try {
      if (!(await isPermissionGranted())) await requestPermission();
    } catch {
      // API non disponibile: ignora
    }
    return;
  }
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

async function sendOsNotification(title: string, body?: string, onClick?: () => void) {
  // Finestra a fuoco: il toast in-app basta, niente notifica OS.
  // (document.hidden non copre "visibile ma non a fuoco".)
  if (document.hasFocus()) return;

  // Dentro Tauri: usa l'API notification ufficiale (il Notification web del
  // WebView non mostra nulla nel pacchetto). Niente onClick: non supportato.
  if ("__TAURI__" in window) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) sendNotification({ title, body });
    } catch {
      // API non disponibile: ignora
    }
    return;
  }

  // Fallback browser (dev)
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    const n = new Notification(title, { body, icon: "/blink-icon.svg" });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// --- Provider ---

let idCounter = 0;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setUnreadCount(0);
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++idCounter}`;

    const { soundEnabled, osNotifications, toastDuration } = readSettings();
    const duration = toast.duration ?? toastDuration * 1000;

    const full = { ...toast, id };
    setToasts((prev) => [...prev.slice(-4), full]); // max 5 visibili
    setHistory((prev) => [full, ...prev].slice(0, 50)); // max 50 in storico
    setUnreadCount((c) => c + 1);

    // Auto-dismiss
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);

    // Suono e notifica OS
    if (toast.type === "motion") {
      if (soundEnabled) playAlertSound();
      if (osNotifications) sendOsNotification(toast.title, toast.message);
    } else if (toast.type === "update") {
      // La notifica di aggiornamento è sempre inviata a livello OS (cliccabile,
      // apre il changelog), indipendentemente dall'impostazione movimento.
      sendOsNotification(toast.title, toast.message, toast.onClick);
    }
  }, [dismiss]);

  return (
    <NotificationsContext.Provider value={{ notify, history, clearHistory, unreadCount, markAllRead }}>
      {children}

      {/* Toast container */}
      <div className="pointer-events-none fixed bottom-14 right-4 z-[200] flex flex-col-reverse items-end gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-white/15 bg-secondary/80 p-3 shadow-2xl backdrop-blur-xl ${
                toast.onClick ? "cursor-pointer transition-colors hover:bg-secondary/90" : ""
              }`}
              onClick={
                toast.onClick
                  ? () => {
                      toast.onClick!();
                      dismiss(toast.id);
                    }
                  : undefined
              }
            >
              {/* Icona */}
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toast.type === "motion"
                  ? "bg-primary/15 text-primary"
                  : toast.type === "error"
                    ? "bg-destructive/15 text-destructive"
                    : toast.type === "update"
                      ? "bg-primary/15 text-primary"
                      : "bg-white/10 text-muted-foreground"
              }`}>
                {toast.type === "update" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>

              {/* Contenuto */}
              <div className="min-w-0 flex-1">
                <Text as="p" size="sm" weight="medium" shadow="none" className="text-foreground">
                  {toast.title}
                </Text>
                {toast.message && (
                  <Text as="p" size="xs" shadow="none" className="mt-0.5 text-muted-foreground">
                    {toast.message}
                  </Text>
                )}
              </div>

              {/* Chiudi */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(toast.id);
                }}
                className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationsContext.Provider>
  );
}
