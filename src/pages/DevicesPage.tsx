import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { GlassSelect } from "@/components/ui/glass-select";
import { api, type Camera, type CameraSetting } from "@/lib/api";
import { CameraThumbnail } from "@/components/CameraThumbnail";
import { useT } from "@/lib/i18n";
import {
  Check,
  Loader2,
  Wifi,
  BatteryFull,
  Cpu,
  ShieldCheck,
  ShieldOff,
  Thermometer,
} from "lucide-react";

interface DevicesPageProps {
  cameras: Camera[];
  isMock: (id: string) => boolean;
}

// Etichetta leggibile per il tipo di prodotto Blink.
function modelLabel(productType?: string | null): string {
  switch (productType) {
    case "chickadee":
      return "Blink Mini 2";
    case "owl":
      return "Blink Mini";
    case "sedona":
      return "Blink Outdoor 4";
    case "catalina":
      return "Blink Outdoor";
    case "lotus":
      return "Blink Doorbell";
    default:
      return productType ? productType : "Camera";
  }
}

export function DevicesPage({ cameras, isMock }: DevicesPageProps) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(
    cameras[0]?.id ?? null
  );
  const selected = cameras.find((c) => c.id === selectedId) ?? null;

  return (
    <main className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
      {/* Lista dispositivi */}
      <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/60 p-3 backdrop-blur-xl">
        <Text as="p" size="xs" weight="semibold" shadow="sm" className="mb-2 px-1 uppercase tracking-wide text-muted-foreground">
          {t("devices.list")} · {cameras.length}
        </Text>
        <div className="flex flex-col gap-1">
          {cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => setSelectedId(cam.id)}
              className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-all ${
                selectedId === cam.id
                  ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10 backdrop-blur-md"
                  : "border-transparent hover:border-white/10 hover:bg-white/5"
              }`}
            >
              <CameraThumbnail
                cameraName={cam.name}
                mock={isMock(cam.id)}
                className="h-11 w-16 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <Text
                  as="p"
                  size="base"
                  weight="medium"
                  shadow="none"
                  className="truncate text-foreground"
                >
                  {cam.name}
                </Text>
                <Text
                  as="p"
                  size="xs"
                  shadow="none"
                  className="truncate text-muted-foreground"
                >
                  {modelLabel(cam.product_type)}
                </Text>
              </div>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  cam.armed ? "bg-primary" : "bg-muted-foreground/40"
                }`}
                title={cam.armed ? t("camera.armed") : t("camera.disarmed")}
              />
            </button>
          ))}
        </div>
      </aside>

      {/* Pannello dettaglio */}
      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-secondary/60 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <DeviceDetail camera={selected} mock={isMock(selected.id)} />
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Text shadow="none" className="text-muted-foreground">
                {t("devices.selectDevice")}
              </Text>
            </div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

type SettingValue = string | number | boolean;

// Pannello dettaglio del dispositivo selezionato.
function DeviceDetail({ camera, mock }: { camera: Camera; mock: boolean }) {
  const t = useT();
  const [settings, setSettings] = useState<CameraSetting[]>([]);
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Carica le impostazioni (le mock non hanno config reale)
  useEffect(() => {
    if (mock) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getSettings(camera.name)
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        const initial: Record<string, SettingValue> = {};
        data.settings.forEach((s) => (initial[s.key] = s.value));
        setValues(initial);
      })
      .catch((e) => !cancelled && setError(e.message || t("camera.loadError")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [camera.name, mock]);

  // Rileva quali valori sono cambiati rispetto agli originali
  const changes: Record<string, SettingValue> = {};
  settings.forEach((s) => {
    if (values[s.key] !== s.value) changes[s.key] = values[s.key];
  });
  const hasChanges = Object.keys(changes).length > 0;

  function handleReset() {
    const original: Record<string, SettingValue> = {};
    settings.forEach((s) => (original[s.key] = s.value));
    setValues(original);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.updateSettings(camera.name, changes);
      setSettings((prev) =>
        prev.map((s) => (s.key in changes ? { ...s, value: changes[s.key] } : s))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("camera.saveError"));
    } finally {
      setSaving(false);
    }
  }

  // Raggruppa le impostazioni per gruppo
  const groups = settings.reduce<Record<string, CameraSetting[]>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      {/* Header con thumbnail + Salva */}
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-white/10 bg-secondary/80 backdrop-blur-xl">
        <div className="flex items-center gap-4 p-6">
          <CameraThumbnail
            cameraName={camera.name}
            mock={mock}
            className="h-20 w-32 shrink-0 rounded-xl border border-white/15 shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Text as="h2" size="2xl" weight="bold" shadow="none" className="truncate text-foreground">
                {camera.name}
              </Text>
              <span
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur-md ${
                  camera.armed
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-white/15 bg-white/10 text-muted-foreground"
                }`}
              >
                {camera.armed ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <ShieldOff className="h-3 w-3" />
                )}
                {camera.armed ? t("camera.armed") : t("camera.disarmed")}
              </span>
            </div>
            <Text as="p" size="sm" shadow="none" className="text-muted-foreground">
              {modelLabel(camera.product_type)}
              {mock && ` · ${t("devices.demo")}`}
            </Text>
            {/* Badge di stato */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {camera.battery && (
                <StatBadge icon={<BatteryFull className="h-3.5 w-3.5" />} label={camera.battery} />
              )}
              {camera.wifi_strength != null && (
                <StatBadge icon={<Wifi className="h-3.5 w-3.5" />} label={`${camera.wifi_strength} dBm`} />
              )}
              {camera.temperature != null && (
                <StatBadge icon={<Thermometer className="h-3.5 w-3.5" />} label={`${camera.temperature}°`} />
              )}
              {camera.firmware && (
                <StatBadge icon={<Cpu className="h-3.5 w-3.5" />} label={`fw ${camera.firmware}`} />
              )}
            </div>
          </div>

          {/* Azioni salva */}
          {!mock && (
            <div className="flex shrink-0 items-center gap-2">
              <AnimatePresence>
                {saved && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1 text-sm text-primary"
                  >
                    <Check className="h-4 w-4" /> {t("devices.saved")}
                  </motion.span>
                )}
              </AnimatePresence>
              {hasChanges && (
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-md transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40"
                >
                  {t("devices.cancel")}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/80 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-md transition-all hover:bg-primary disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("devices.save")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Corpo impostazioni */}
      <div className="mx-auto max-w-2xl p-6">
        {mock ? (
          <Text as="p" shadow="none" className="text-muted-foreground">
            {t("devices.demoDevice")}
          </Text>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <Text shadow="none">{t("devices.loadingSettings")}</Text>
          </div>
        ) : error ? (
          <Text shadow="none" className="text-destructive">{error}</Text>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <Text
                  as="p"
                  size="xs"
                  weight="semibold"
                  shadow="none"
                  className="mb-2 px-1 uppercase tracking-wide text-muted-foreground"
                >
                  {group}
                </Text>
                <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                  {items.map((s) => (
                    <SettingControl
                      key={s.key}
                      setting={s}
                      value={values[s.key]}
                      changed={s.key in changes}
                      onChange={(v) =>
                        setValues((prev) => ({ ...prev, [s.key]: v }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
      {icon}
      {label}
    </span>
  );
}

// Renderizza il controllo giusto per ogni tipo di impostazione.
function SettingControl({
  setting,
  value,
  changed,
  onChange,
}: {
  setting: CameraSetting;
  value: SettingValue;
  changed: boolean;
  onChange: (v: SettingValue) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3.5 transition-colors last:border-0 hover:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <Text size="base" shadow="none" className="text-foreground">
          {setting.label}
        </Text>
        {changed && <span className="h-1.5 w-1.5 rounded-full bg-primary" title={t("devices.modified")} />}
      </div>

      {setting.type === "toggle" && (
        <Switch checked={Boolean(value)} onToggle={() => onChange(!value)} />
      )}

      {setting.type === "text" && (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-48 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-foreground backdrop-blur-sm transition-colors focus:border-primary/50 focus:bg-white/10 focus:outline-none"
        />
      )}

      {setting.type === "select" && (
        <GlassSelect
          value={String(value ?? "")}
          options={setting.options ?? []}
          onChange={(v) => onChange(v)}
        />
      )}

      {setting.type === "slider" && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={setting.min ?? 0}
            max={setting.max ?? 10}
            value={Number(value ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-40 accent-primary"
          />
          <Text size="sm" weight="medium" shadow="none" className="w-6 text-right text-foreground">
            {Number(value ?? 0)}
          </Text>
        </div>
      )}
    </div>
  );
}
