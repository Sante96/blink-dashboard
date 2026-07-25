import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPill, GlassPillButton } from "@/components/ui/glass-pill";
import { Text } from "@/components/ui/text";
import { NotificationBell } from "@/components/NotificationBell";
import { useT } from "@/lib/i18n";
import type { AppView } from "@/App";
import {
  ShieldCheck,
  ShieldOff,
  LogOut,
  Camera as CameraIcon,
  LayoutGrid,
  Film,
  Settings,
} from "lucide-react";

interface DashboardHeaderProps {
  email: string;
  view: AppView;
  onViewChange: (view: AppView) => void;
  onLogout: () => void;
  /** Mostra il toggle arma/disarma tutte (nascosto senza camere). */
  showSystemToggle: boolean;
  allArmed: boolean;
  systemBusy: boolean;
  onToggleSystem: () => void;
}

// Header della dashboard: pill di navigazione centrale + toggle sistema,
// campanella notifiche e dropdown account a destra.
export function DashboardHeader({
  email,
  view,
  onViewChange,
  onLogout,
  showSystemToggle,
  allArmed,
  systemBusy,
  onToggleSystem,
}: DashboardHeaderProps) {
  const t = useT();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="px-3 py-2">
      <div className="flex items-center justify-between">
        {/* Spacer sinistra */}
        <div className="flex flex-1 items-center" />

        {/* Pill centrale: navigazione rotte + toggle armate */}
        <GlassPill className="border-border bg-secondary/60">
          {/* Navigazione (rotte) */}
          <GlassPillButton
            active={view === "dashboard"}
            onClick={() => onViewChange("dashboard")}
            className="text-foreground/90"
            title={t("nav.dashboard")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t("nav.dashboard")}
          </GlassPillButton>
          <GlassPillButton
            active={view === "devices"}
            onClick={() => onViewChange("devices")}
            className="text-foreground/90"
            title={t("nav.devices")}
          >
            <CameraIcon className="h-3.5 w-3.5" />
            {t("nav.devices")}
          </GlassPillButton>
          <GlassPillButton
            active={view === "media"}
            onClick={() => onViewChange("media")}
            className="text-foreground/90"
            title={t("nav.media")}
          >
            <Film className="h-3.5 w-3.5" />
            {t("nav.media")}
          </GlassPillButton>
          <GlassPillButton
            active={view === "settings"}
            onClick={() => onViewChange("settings")}
            className="text-foreground/90"
            title={t("nav.settings")}
          >
            <Settings className="h-3.5 w-3.5" />
            {t("nav.settings")}
          </GlassPillButton>

          {/* Separatore rotte | azione */}
          {showSystemToggle && (
            <>
              <span className="mx-0.5 h-5 w-px bg-white/15" />
              {/* Azione: arma/disarma tutte */}
              <GlassPillButton
                active={allArmed}
                disabled={systemBusy}
                onClick={onToggleSystem}
                className="text-foreground/90"
                title={allArmed ? t("nav.disarmAll") : t("nav.armAll")}
              >
                {allArmed ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
                {allArmed ? t("nav.allArmed") : t("nav.allDisarmed")}
              </GlassPillButton>
            </>
          )}
        </GlassPill>

        {/* Azioni a destra */}
        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Notifiche */}
          <NotificationBell />

          {/* Avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-medium text-primary backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {email.charAt(0).toUpperCase()}
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/15 bg-secondary/90 p-1.5 shadow-xl backdrop-blur-xl"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <div className="px-3 py-2">
                    <Text as="p" size="base" weight="medium" shadow="none" className="text-foreground">{t("nav.account")}</Text>
                    <Text as="p" size="sm" shadow="none" className="truncate text-muted-foreground">
                      {email}
                    </Text>
                  </div>
                  <div className="my-1 h-px bg-white/10" />
                  <button
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-destructive transition-colors hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <Text size="base" weight="medium" shadow="none">{t("nav.disconnect")}</Text>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
