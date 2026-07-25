import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { appWindow } from "@tauri-apps/api/window";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotificationsProvider } from "@/components/Notifications";
import { ConnectionGuard } from "@/components/ConnectionGuard";
import { ShaderBackground } from "@/components/ShaderBackground";
import { Titlebar } from "@/components/Titlebar";
import { initSystemSettings } from "@/lib/systemSettings";
import { BackgroundEvents } from "@/components/BackgroundEvents";
import { api } from "@/lib/api";

export type AppView = "dashboard" | "devices" | "media" | "settings" | "changelog";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("dashboard");
  const [isMaximized, setIsMaximized] = useState(true);

  // Applica avvio automatico + minimizza in tray dalle impostazioni salvate
  useEffect(() => {
    initSystemSettings();
  }, []);

  // Ascolta stato maximized per togliere bordi stondati
  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Controlla se siamo già connessi al backend
  useEffect(() => {
    api
      .getStatus()
      .then((data) => {
        if (data.connected) {
          setIsLoggedIn(true);
          setEmail(data.email || localStorage.getItem("blink_email") || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (userEmail: string) => {
    localStorage.setItem("blink_email", userEmail);
    setEmail(userEmail);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Backend irraggiungibile: procedi comunque col logout locale,
      // altrimenti l'utente resta bloccato sulla dashboard.
    }
    localStorage.removeItem("blink_email");
    setIsLoggedIn(false);
    setEmail("");
  };

  // Sessione scaduta: logout locale senza chiamare il backend (che ha già invalidato la sessione)
  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem("blink_email");
    setIsLoggedIn(false);
    setEmail("");
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <BackgroundEvents enabled={isLoggedIn} />
      <div className={`flex h-screen flex-col overflow-hidden bg-background ${isMaximized ? "" : "rounded-xl border border-white/10"}`}>
        <Titlebar />
        <ShaderBackground />
        <AnimatePresence mode="wait">
        {isLoggedIn ? (
          <motion.div
            key="dashboard"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ConnectionGuard onSessionExpired={handleSessionExpired}>
              <DashboardPage
                email={email}
                onLogout={handleLogout}
                view={view}
                onViewChange={setView}
              />
            </ConnectionGuard>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </NotificationsProvider>
  );
}

export default App;
