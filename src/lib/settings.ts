import { useSyncExternalStore } from "react";

// Modello unico delle impostazioni dell'app, persistite in localStorage.
// Tutte le letture/scritture passano da qui: ogni scrittura emette
// SETTINGS_EVENT, a cui i consumer si agganciano (o usano useSettings()).

export interface AppSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  language: "it" | "en";
  shaderOpacity: number;
  shaderSpeed: number;
  shaderShape: string;
  soundEnabled: boolean;
  osNotifications: boolean;
  toastDuration: number;
  pollingInterval: number;
}

export const defaultSettings: AppSettings = {
  autoStart: false,
  minimizeToTray: true,
  language: "it",
  shaderOpacity: 12,
  shaderSpeed: 0.4,
  shaderShape: "simplex",
  soundEnabled: true,
  osNotifications: true,
  toastDuration: 6,
  // Il polling fa un refresh completo verso l'API Blink: intervalli troppo
  // brevi contribuiscono al rate-limit "System is busy" del server.
  pollingInterval: 15,
};

const STORAGE_KEY = "blink_settings";
export const SETTINGS_EVENT = "blink-settings-change";

export function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSettings };
}

export function writeSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: s }));
}

// --- Store esterno per useSettings() ---

let snapshot: AppSettings | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener(SETTINGS_EVENT, () => {
    snapshot = readSettings();
    listeners.forEach((l) => l());
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): AppSettings {
  if (snapshot === null) snapshot = readSettings();
  return snapshot;
}

/** Hook reattivo: impostazioni correnti, aggiornate a ogni scrittura. */
export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
