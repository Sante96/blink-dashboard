import { ShieldCheck, ShieldOff, Video } from "lucide-react";
import { Text } from "@/components/ui/text";
import { useT } from "@/lib/i18n";
import { currentVersion } from "@/lib/changelog";

interface StatusBarProps {
  connected: boolean;
  cameraCount: number;
  liveCount: number;
  allArmed: boolean;
  hasCameras: boolean;
  onOpenChangelog?: () => void;
}

// Barra di stato in fondo alla finestra, stile VSCode.
export function StatusBar({
  connected,
  cameraCount,
  liveCount,
  allArmed,
  hasCameras,
  onOpenChangelog,
}: StatusBarProps) {
  const t = useT();
  const version = import.meta.env.VITE_APP_VERSION ?? currentVersion;

  return (
    <footer className="mx-3 mb-3 flex h-6 items-center justify-between rounded-xl border border-white/10 bg-secondary/70 px-3 text-[11px] text-muted-foreground select-none backdrop-blur-xl">
      {/* Sinistra — stato sistema */}
      <div className="flex items-center gap-3">
        {/* Connessione */}
        <Text className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected ? "bg-primary" : "bg-destructive"
            }`}
          />
          {connected ? t("status.connected") : t("status.disconnected")}
        </Text>

        {hasCameras && (
          <>
            <Text className="text-border">|</Text>

            {/* Camere + stream live */}
            <Text className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              {cameraCount} {cameraCount === 1 ? t("status.camera") : t("status.cameras")}
              {liveCount > 0 && (
                <Text as="span" className="text-primary"> · {liveCount} {t("status.live")}</Text>
              )}
            </Text>

            <Text className="text-border">|</Text>

            {/* Stato armato (solo info) */}
            <Text className="flex items-center gap-1">
              {allArmed ? (
                <ShieldCheck className="h-3 w-3 text-primary" />
              ) : (
                <ShieldOff className="h-3 w-3" />
              )}
              {allArmed ? t("status.allArmed") : t("status.notAllArmed")}
            </Text>
          </>
        )}
      </div>

      {/* Destra — meta */}
      <div className="flex items-center gap-3">
        <Text>{t("status.createdBy")}</Text>
        <Text className="text-border">|</Text>
        <button
          onClick={onOpenChangelog}
          title={t("nav.changelog")}
          className="-mx-1.5 -my-0.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          v{version}
        </button>
      </div>
    </footer>
  );
}
