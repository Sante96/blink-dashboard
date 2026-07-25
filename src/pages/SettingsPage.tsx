import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { GlassSelect } from "@/components/ui/glass-select";
import { useT } from "@/lib/i18n";
import { type AppSettings, readSettings, writeSettings } from "@/lib/settings";
import {
  Monitor,
  Bell,
  Palette,
  Info,
  Power,
} from "lucide-react";

// --- Sezioni ---

interface SectionDef {
  id: string;
  labelKey: string;
  icon: React.ElementType;
}

const sections: SectionDef[] = [
  { id: "general", labelKey: "settings.general", icon: Monitor },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette },
  { id: "notifications", labelKey: "settings.notifications", icon: Bell },
  { id: "cameras", labelKey: "settings.cameras", icon: Power },
  { id: "info", labelKey: "settings.info", icon: Info },
];

// --- Slider ---

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, hsl(82 85% 55%) ${percent}%, rgba(255,255,255,0.15) ${percent}%)`,
      }}
      className="h-1.5 w-40 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow"
    />
  );
}

// --- Setting Row ---

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <Text as="p" size="base" weight="medium" className="text-foreground">
          {label}
        </Text>
        {description && (
          <Text as="p" size="sm" className="mt-0.5 text-muted-foreground">
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
}

// --- Pagina ---

export function SettingsPage() {
  const t = useT();
  const [settings, setSettings] = useState<AppSettings>(readSettings);
  const [activeSection, setActiveSection] = useState("general");

  // Persiste e notifica (SETTINGS_EVENT) a ogni modifica.
  useEffect(() => {
    writeSettings(settings);
  }, [settings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const version = import.meta.env.VITE_APP_VERSION ?? "0.1.0";

  return (
    <main className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      {/* Sidebar sezioni */}
      <aside className="w-56 shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/60 p-2 backdrop-blur-xl">
        <Text as="p" size="xs" weight="semibold" shadow="sm" className="mb-2 px-2 uppercase tracking-wide text-muted-foreground">
          {t("settings.title")}
        </Text>
        <div className="flex flex-col gap-0.5">
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                  activeSection === sec.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <Text size="sm" weight="medium">{t(sec.labelKey)}</Text>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Pannello dettaglio */}
      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/60 p-6 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeSection === "general" && (
              <div>
                <Text as="h2" size="xl" weight="bold" className="mb-4 text-foreground">{t("settings.general")}</Text>
                <div className="divide-y divide-white/5">
                  <SettingRow label={t("settings.autoStart")} description={t("settings.autoStartDesc")}>
                    <Switch checked={settings.autoStart} onToggle={() => update("autoStart", !settings.autoStart)} />
                  </SettingRow>
                  <SettingRow label={t("settings.minimizeToTray")} description={t("settings.minimizeToTrayDesc")}>
                    <Switch checked={settings.minimizeToTray} onToggle={() => update("minimizeToTray", !settings.minimizeToTray)} />
                  </SettingRow>
                  <SettingRow label={t("settings.language")}>
                    <GlassSelect
                      value={settings.language}
                      options={[
                        { value: "it", label: "Italiano" },
                        { value: "en", label: "English" },
                      ]}
                      onChange={(v) => update("language", v as "it" | "en")}
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeSection === "appearance" && (
              <div>
                <Text as="h2" size="xl" weight="bold" className="mb-4 text-foreground">{t("settings.appearance")}</Text>
                <div className="divide-y divide-white/5">
                  <SettingRow label={t("settings.bgIntensity")} description={`${settings.shaderOpacity}%`}>
                    <Slider value={settings.shaderOpacity} min={0} max={40} step={1} onChange={(v) => update("shaderOpacity", v)} />
                  </SettingRow>
                  <SettingRow label={t("settings.animSpeed")} description={`${settings.shaderSpeed.toFixed(1)}x`}>
                    <Slider value={settings.shaderSpeed} min={0} max={2} step={0.1} onChange={(v) => update("shaderSpeed", v)} />
                  </SettingRow>
                  <SettingRow label={t("settings.pattern")}>
                    <GlassSelect
                      value={settings.shaderShape}
                      options={[
                        { value: "simplex", label: "Simplex" },
                        { value: "warp", label: "Warp" },
                        { value: "dots", label: "Dots" },
                        { value: "wave", label: "Wave" },
                        { value: "ripple", label: "Ripple" },
                        { value: "swirl", label: "Swirl" },
                        { value: "sphere", label: "Sphere" },
                      ]}
                      onChange={(v) => update("shaderShape", v)}
                    />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div>
                <Text as="h2" size="xl" weight="bold" className="mb-4 text-foreground">{t("settings.notifications")}</Text>
                <div className="divide-y divide-white/5">
                  <SettingRow label={t("settings.soundAlert")} description={t("settings.soundAlertDesc")}>
                    <Switch checked={settings.soundEnabled} onToggle={() => update("soundEnabled", !settings.soundEnabled)} />
                  </SettingRow>
                  <SettingRow label={t("settings.osNotifications")} description={t("settings.osNotificationsDesc")}>
                    <Switch checked={settings.osNotifications} onToggle={() => update("osNotifications", !settings.osNotifications)} />
                  </SettingRow>
                  <SettingRow label={t("settings.toastDuration")} description={t("settings.toastDurationSecs", { n: settings.toastDuration })}>
                    <Slider value={settings.toastDuration} min={2} max={15} step={1} onChange={(v) => update("toastDuration", v)} />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeSection === "cameras" && (
              <div>
                <Text as="h2" size="xl" weight="bold" className="mb-4 text-foreground">{t("settings.cameras")}</Text>
                <div className="divide-y divide-white/5">
                  <SettingRow label={t("settings.pollingInterval")} description={t("settings.pollingIntervalDesc", { n: settings.pollingInterval })}>
                    <Slider value={settings.pollingInterval} min={5} max={60} step={5} onChange={(v) => update("pollingInterval", v)} />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeSection === "info" && (
              <div>
                <Text as="h2" size="xl" weight="bold" className="mb-4 text-foreground">{t("settings.info")}</Text>
                <div className="divide-y divide-white/5">
                  <SettingRow label={t("settings.version")}>
                    <Text size="sm" className="text-muted-foreground">v{version}</Text>
                  </SettingRow>
                  <SettingRow label={t("settings.createdBy")}>
                    <Text size="sm" className="text-muted-foreground">Sante</Text>
                  </SettingRow>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}
