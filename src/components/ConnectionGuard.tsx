import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, RefreshCw, LogIn } from "lucide-react";
import { Text } from "@/components/ui/text";
import { api, NetworkError, SessionExpiredError } from "@/lib/api";
import { useT } from "@/lib/i18n";

type GuardState = "ok" | "disconnected" | "session-expired";

interface ConnectionGuardProps {
  children: React.ReactNode;
  onSessionExpired: () => void;
}

/**
 * Overlay globale che gestisce:
 * - Backend completamente giù: overlay bloccante con retry e health-check ogni 10s
 * - Sessione scaduta (401): overlay con bottone per tornare al login
 *
 * Ascolta errori globali tramite un event bus leggero (CONNECTION_ERROR_EVENT).
 * Il componente si monta attorno all'area autenticata.
 */

// Event bus per segnalare errori di connessione da qualsiasi punto dell'app
export const CONNECTION_ERROR_EVENT = "blink:connection-error";
export const SESSION_EXPIRED_EVENT = "blink:session-expired";

export function reportConnectionError() {
  window.dispatchEvent(new CustomEvent(CONNECTION_ERROR_EVENT));
}

export function reportSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/**
 * Helper da usare nei catch delle chiamate API: notifica automaticamente
 * il ConnectionGuard se l'errore è di rete o sessione scaduta.
 * Ritorna true se l'errore è stato gestito (non servono toast aggiuntivi per rete/sessione).
 */
export function handleApiError(err: unknown): boolean {
  if (err instanceof NetworkError) {
    reportConnectionError();
    return true;
  }
  if (err instanceof SessionExpiredError) {
    reportSessionExpired();
    return true;
  }
  return false;
}

export function ConnectionGuard({ children, onSessionExpired }: ConnectionGuardProps) {
  const t = useT();
  const [state, setState] = useState<GuardState>("ok");
  const [retrying, setRetrying] = useState(false);
  const healthInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Avvia health-check periodico quando siamo in stato "disconnected"
  const startHealthCheck = useCallback(() => {
    if (healthInterval.current) return;
    healthInterval.current = setInterval(async () => {
      const ok = await api.healthCheck();
      if (ok) {
        setState("ok");
        stopHealthCheck();
      }
    }, 10_000);
  }, []);

  const stopHealthCheck = useCallback(() => {
    if (healthInterval.current) {
      clearInterval(healthInterval.current);
      healthInterval.current = null;
    }
  }, []);

  // Retry manuale
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    const ok = await api.healthCheck();
    if (ok) {
      setState("ok");
      stopHealthCheck();
    }
    setRetrying(false);
  }, [stopHealthCheck]);

  // Ascolta eventi di errore
  useEffect(() => {
    function onConnectionError() {
      setState((prev) => {
        if (prev === "session-expired") return prev; // sessione ha priorità
        return "disconnected";
      });
    }

    function onSessionExpiredEvt() {
      setState("session-expired");
      stopHealthCheck();
    }

    window.addEventListener(CONNECTION_ERROR_EVENT, onConnectionError);
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpiredEvt);

    return () => {
      window.removeEventListener(CONNECTION_ERROR_EVENT, onConnectionError);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpiredEvt);
    };
  }, [stopHealthCheck]);

  // Gestisci start/stop health-check in base allo stato
  useEffect(() => {
    if (state === "disconnected") {
      startHealthCheck();
    } else {
      stopHealthCheck();
    }
    return () => stopHealthCheck();
  }, [state, startHealthCheck, stopHealthCheck]);

  // Gestisci click "torna al login"
  const handleGoToLogin = useCallback(() => {
    setState("ok");
    onSessionExpired();
  }, [onSessionExpired]);

  return (
    <>
      {children}

      <AnimatePresence>
        {state === "disconnected" && (
          <motion.div
            key="disconnected-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-secondary/80 p-8 text-center shadow-2xl backdrop-blur-xl"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
                <WifiOff className="h-7 w-7 text-destructive" />
              </div>

              <div className="space-y-2">
                <Text as="h2" size="lg" weight="semibold" shadow="none" className="text-foreground">
                  {t("guard.disconnectedTitle")}
                </Text>
                <Text as="p" size="sm" shadow="none" className="text-muted-foreground">
                  {t("guard.disconnectedMessage")}
                </Text>
              </div>

              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                {retrying ? t("guard.retrying") : t("guard.retry")}
              </button>

              <Text as="p" size="xs" shadow="none" className="text-muted-foreground/60">
                {t("guard.autoRetry")}
              </Text>
            </motion.div>
          </motion.div>
        )}

        {state === "session-expired" && (
          <motion.div
            key="session-expired-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-secondary/80 p-8 text-center shadow-2xl backdrop-blur-xl"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <LogIn className="h-7 w-7 text-primary" />
              </div>

              <div className="space-y-2">
                <Text as="h2" size="lg" weight="semibold" shadow="none" className="text-foreground">
                  {t("guard.sessionExpiredTitle")}
                </Text>
                <Text as="p" size="sm" shadow="none" className="text-muted-foreground">
                  {t("guard.sessionExpiredMessage")}
                </Text>
              </div>

              <button
                onClick={handleGoToLogin}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-primary/15 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
              >
                <LogIn className="h-4 w-4" />
                {t("guard.goToLogin")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
