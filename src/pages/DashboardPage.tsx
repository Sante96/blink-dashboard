import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Text } from "@/components/ui/text";
import { useNotifications, requestOsNotificationPermission } from "@/components/Notifications";
import { LiveCamera } from "@/components/LiveCamera";
import { CameraGrid } from "@/components/CameraGrid";
import { CameraDrawer } from "@/components/CameraDrawer";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DroppableCard } from "@/components/DroppableCard";
import { StatusBar } from "@/components/StatusBar";
import { SettingsPage } from "@/pages/SettingsPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { MediaPage } from "@/pages/MediaPage";
import { ChangelogPage } from "@/pages/ChangelogPage";
import { api, type Camera } from "@/lib/api";
import { handleApiError } from "@/components/ConnectionGuard";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { checkForUpdateNotice } from "@/lib/updateNotice";
import type { AppView } from "@/App";
import { Camera as CameraIcon } from "lucide-react";

// Camere fittizie per valutare il layout con più camere (max 4).
// Solo per sviluppo: NON deve mai arrivare a true in una release.
const MOCK_CAMERAS = false;
const mkMock = (id: string, name: string, armed = false, motion = false, light = false): Camera => ({
  name, id, armed, motion_detected: motion,
  temperature: null, battery: null, wifi_strength: null, thumbnail: "", last_motion: null,
  capabilities: { light },
});
const mockCameras: Camera[] = [
  mkMock("mock-1", "Salotto"),
  mkMock("mock-2", "Ingresso", true, true),
  mkMock("mock-3", "Garage", true),
  mkMock("mock-4", "Giardino"),
  mkMock("mock-5", "Cantina", true),
  mkMock("mock-6", "Terrazzo"),
];

// Numero massimo di camere mostrate live nella dashboard; le altre stanno
// nel cassetto laterale con la sola thumbnail.
const DASH_LIMIT = 4;
const ORDER_KEY = "blink_camera_order";

interface DashboardPageProps {
  email: string;
  onLogout: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
}

export function DashboardPage({
  email,
  onLogout,
  view,
  onViewChange,
}: DashboardPageProps) {
  const t = useT();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  // Ultimo esito delle chiamate al backend, per la spia della status bar.
  const [backendOk, setBackendOk] = useState(true);
  const [systemBusy, setSystemBusy] = useState(false);
  const [liveCameras, setLiveCameras] = useState<Set<string>>(new Set());
  // Ordine persistente degli ID camera: i primi DASH_LIMIT vanno in dashboard,
  // il resto nel cassetto. Salvato in localStorage.
  const [order, setOrder] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    } catch {
      return [];
    }
  });
  // Timestamp fino al quale il refetch periodico è sospeso: dopo una mutazione
  // diamo a Blink il tempo di propagare lo stato prima di rileggerlo, così il
  // poll non sovrascrive l'update ottimistico con dati stale.
  const suppressRefetchUntil = useRef(0);

  // Tutte le camere armate? Stato derivato per il toggle globale.
  const allArmed = cameras.length > 0 && cameras.every((c) => c.armed);

  // Notifiche di movimento
  const { notify } = useNotifications();
  const prevMotionRef = useRef<Set<string>>(new Set());
  const updateCheckedRef = useRef(false);
  // `t` e `notify` cambiano identità a ogni render: tenerli tra le dipendenze
  // del polling resetterebbe il timer di continuo. Li leggiamo via ref.
  const tRef = useRef(t);
  tRef.current = t;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Notifica di aggiornamento: se l'app è stata aggiornata dall'ultimo avvio,
  // mostra un toast/notifica OS cliccabile che apre le novità (changelog).
  useEffect(() => {
    if (updateCheckedRef.current) return;
    updateCheckedRef.current = true;
    const res = checkForUpdateNotice();
    if (res) {
      notify({
        title: t("changelog.updateTitle"),
        message: t("changelog.updateMessage", { version: res.updatedTo }),
        type: "update",
        duration: 12000,
        onClick: () => onViewChange("changelog"),
      });
    }
  }, [notify, t, onViewChange]);

  // Carica lista telecamere all'avvio
  useEffect(() => {
    // Richiedi permesso notifiche OS (non-blocking)
    requestOsNotificationPermission();
    api
      .getCameras()
      .then((data) => {
        const cams = data.cameras || [];
        setCameras(cams);
        setBackendOk(true);
        // Inizializza lo stato motion così non notifichiamo movimenti già attivi
        prevMotionRef.current = new Set(
          cams.filter((c) => c.motion_detected).map((c) => c.name)
        );
      })
      .catch((err) => {
        setBackendOk(false);
        handleApiError(err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Intervallo di polling dalle impostazioni, reattivo ai cambi senza reload.
  const pollingMs = useSettings().pollingInterval * 1000;

  // Refetch periodico per riallinearsi a cambi fatti altrove (es. app Blink),
  // saltando i secondi successivi a una mutazione locale.
  useEffect(() => {
    const id = setInterval(async () => {
      if (Date.now() < suppressRefetchUntil.current) return;
      try {
        const data = await api.getCameras();
        const newCameras = data.cameras || [];
        setCameras(newCameras);
        setBackendOk(true);

        // Rileva nuovi movimenti: camera che passa da non-motion a motion
        const newMotion = new Set(
          newCameras.filter((c) => c.motion_detected).map((c) => c.name)
        );
        for (const name of newMotion) {
          if (!prevMotionRef.current.has(name)) {
            notifyRef.current({
              title: tRef.current("notif.motionDetected"),
              message: name,
              type: "motion",
            });
          }
        }
        prevMotionRef.current = newMotion;
      } catch (err) {
        // rete giù o backend non pronto: riproviamo al prossimo tick
        setBackendOk(false);
        handleApiError(err);
      }
    }, pollingMs);
    return () => clearInterval(id);
  }, [pollingMs]);

  // Arma/disarma singola camera (aggiornamento ottimistico)
  async function handleToggleArm(name: string, armed: boolean) {
    suppressRefetchUntil.current = Date.now() + 8000;
    setCameras((prev) =>
      prev.map((c) => (c.name === name ? { ...c, armed } : c))
    );
    try {
      if (armed) await api.armCamera(name);
      else await api.disarmCamera(name);
    } catch (err) {
      // Rollback in caso di errore
      setCameras((prev) =>
        prev.map((c) => (c.name === name ? { ...c, armed: !armed } : c))
      );
      handleApiError(err);
    }
  }

  // Arma/disarma tutte le camere (aggiornamento ottimistico, come il singolo).
  // Non rifacciamo getCameras subito dopo: lo stato config della Mini impiega
  // qualche secondo a propagarsi e un refetch immediato leggerebbe dati stale.
  async function handleToggleSystem() {
    const target = !allArmed;
    const prevCameras = cameras;
    suppressRefetchUntil.current = Date.now() + 8000;
    setSystemBusy(true);
    setCameras((prev) => prev.map((c) => ({ ...c, armed: target })));
    try {
      if (target) await api.armSystem();
      else await api.disarmSystem();
    } catch (e) {
      // Il server Blink può rifiutare (409 "Sistema occupato"): annulla il
      // toggle ottimistico e avvisa, invece di mostrare uno stato falso.
      setCameras(prevCameras);
      if (!handleApiError(e)) {
        notify({
          title: target ? t("nav.armAll") : t("nav.disarmAll"),
          message: e instanceof Error ? e.message : t("system.busy"),
          type: "error",
        });
      }
    } finally {
      setSystemBusy(false);
    }
  }

  // Scatta una foto (snapshot)
  async function handleSnapshot(name: string) {
    try {
      await api.snapCamera(name);
    } catch (err) {
      handleApiError(err);
    }
  }

  // Accende/spegne la luce; ritorna lo stato reale letto dal device.
  // Propaga l'errore (es. 409) per il rollback ottimistico nel componente.
  async function handleToggleLight(name: string, on: boolean): Promise<boolean> {
    const res = on ? await api.lightOn(name) : await api.lightOff(name);
    return res.light;
  }

  // Traccia quali camere stanno streammando (per la status bar)
  const handleLiveChange = useCallback((name: string, isLive: boolean) => {
    setLiveCameras((prev) => {
      const next = new Set(prev);
      if (isLive) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  // Camere reali + eventuali mock.
  const isMock = (id: string) => id.startsWith("mock-");
  const allCameras = MOCK_CAMERAS ? [...cameras, ...mockCameras] : cameras;

  // Ordina secondo l'ordine salvato; le camere nuove (non nell'ordine) vanno
  // in coda. Persistiamo l'ordine effettivo così resta stabile.
  const orderedCameras: Camera[] = [
    ...order
      .map((id) => allCameras.find((c) => c.id === id))
      .filter((c): c is Camera => !!c),
    ...allCameras.filter((c) => !order.includes(c.id)),
  ];

  const dashCameras = orderedCameras.slice(0, DASH_LIMIT);
  const drawerCameras = orderedCameras.slice(DASH_LIMIT);

  // Sposta la camera `fromId` (dal cassetto) al posto di `toId` (in dashboard).
  // Scambio 1:1: quella sostituita finisce dove stava fromId.
  function swapCameras(fromId: string, toId: string) {
    const ids = orderedCameras.map((c) => c.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    [ids[fromIdx], ids[toIdx]] = [ids[toIdx], ids[fromIdx]];
    // Side effect fuori dall'updater: con StrictMode l'updater può girare
    // due volte e non deve scrivere su localStorage.
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    setOrder(ids);
  }

  // Drag & drop dal cassetto verso le card della dashboard
  const [draggingCamera, setDraggingCamera] = useState<Camera | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(e: DragStartEvent) {
    const cam = orderedCameras.find((c) => c.id === e.active.id);
    setDraggingCamera(cam ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingCamera(null);
    const fromId = e.active.id as string;
    const toId = e.over?.id as string | undefined;
    if (toId && fromId !== toId) swapCameras(fromId, toId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <DashboardHeader
        email={email}
        view={view}
        onViewChange={onViewChange}
        onLogout={onLogout}
        showSystemToggle={cameras.length > 0}
        allArmed={allArmed}
        systemBusy={systemBusy}
        onToggleSystem={handleToggleSystem}
      />

      <AnimatePresence mode="wait">
        {view === "devices" ? (
          <motion.div
            key="devices"
            className="flex min-h-0 flex-1 overflow-hidden"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22 }}
          >
            <DevicesPage cameras={allCameras} isMock={isMock} />
          </motion.div>
        ) : view === "media" ? (
          <motion.div
            key="media"
            className="flex min-h-0 flex-1 overflow-hidden"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22 }}
          >
            <MediaPage />
          </motion.div>
        ) : view === "changelog" ? (
          <motion.div
            key="changelog"
            className="flex min-h-0 flex-1 overflow-hidden"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22 }}
          >
            <ChangelogPage />
          </motion.div>
        ) : view === "settings" ? (
          <motion.div
            key="settings"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22 }}
          >
            <SettingsPage />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            className="flex min-h-0 flex-1 flex-col overflow-hidden p-3"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22 }}
          >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <main className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-secondary/60 p-3 backdrop-blur-xl">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : dashCameras.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
                <Text as="p" size="base" shadow="none" className="text-muted-foreground">
                  Nessuna telecamera trovata
                </Text>
              </div>
            ) : (
              <CameraGrid count={dashCameras.length}>
                {dashCameras.map((camera, i) => {
                  const mock = isMock(camera.id);
                  return (
                    <DroppableCard
                      key={camera.id}
                      id={camera.id}
                      isDragging={draggingCamera !== null}
                    >
                      <motion.div
                        className="h-full w-full"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut", delay: i * 0.08 }}
                      >
                        <LiveCamera
                          name={camera.name}
                          armed={camera.armed}
                          motionDetected={camera.motion_detected}
                          hasLight={camera.capabilities?.light ?? false}
                          mock={mock}
                          onToggleArm={(armed) =>
                            mock ? undefined : handleToggleArm(camera.name, armed)
                          }
                          onSnapshot={() =>
                            mock ? undefined : handleSnapshot(camera.name)
                          }
                          onToggleLight={(on) =>
                            mock
                              ? Promise.resolve(on)
                              : handleToggleLight(camera.name, on)
                          }
                          onLiveChange={(isLive) =>
                            mock ? undefined : handleLiveChange(camera.name, isLive)
                          }
                        />
                      </motion.div>
                    </DroppableCard>
                  );
                })}
              </CameraGrid>
            )}

            {/* Cassetto laterale con le camere non in dashboard */}
            <CameraDrawer cameras={drawerCameras} isMock={isMock} />
          </main>

          {/* Anteprima trascinamento */}
          <DragOverlay>
            {draggingCamera && (
              <div className="flex aspect-video w-48 items-center justify-center rounded-lg border border-primary/50 bg-card shadow-2xl">
                <div className="flex flex-col items-center gap-1 text-primary">
                  <CameraIcon className="h-6 w-6" />
                  <Text size="sm" weight="medium">{draggingCamera.name}</Text>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
          </motion.div>
        )}
      </AnimatePresence>

      <StatusBar
        connected={backendOk}
        cameraCount={dashCameras.length}
        liveCount={liveCameras.size}
        allArmed={allArmed}
        hasCameras={dashCameras.length > 0}
        onOpenChangelog={() => onViewChange("changelog")}
      />
    </div>
  );
}
