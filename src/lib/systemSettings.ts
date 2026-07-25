import { invoke } from "@tauri-apps/api/tauri";
import { readSettings, SETTINGS_EVENT } from "@/lib/settings";

// Thin wrapper sui comandi di tauri-plugin-autostart (v1). La JS API ufficiale
// è solo uno strato su invoke, quindi la inliniamo per evitare la dipendenza
// npm da git (che non risolve in modo affidabile).
const isEnabled = () => invoke<boolean>("plugin:autostart|is_enabled");
const enable = () => invoke<void>("plugin:autostart|enable");
const disable = () => invoke<void>("plugin:autostart|disable");

// Applica le impostazioni di sistema (avvio automatico + minimizza in tray).
// È idempotente: può essere chiamata all'avvio e a ogni cambio impostazioni
// senza effetti collaterali.

async function applyAutoStart(desired: boolean) {
  try {
    const current = await isEnabled();
    if (desired && !current) await enable();
    else if (!desired && current) await disable();
  } catch {
    // Fuori da Tauri (es. dev browser) il plugin non è disponibile: ignora.
  }
}

async function applyMinimizeToTray(desired: boolean) {
  try {
    await invoke("set_minimize_to_tray", { enabled: desired });
  } catch {
    // Comando non disponibile fuori da Tauri: ignora.
  }
}

export async function applySystemSettings() {
  const s = readSettings();
  await applyAutoStart(s.autoStart);
  await applyMinimizeToTray(s.minimizeToTray);
}

// Registra i listener: applica all'avvio e a ogni cambio impostazioni.
export function initSystemSettings() {
  applySystemSettings();
  window.addEventListener(SETTINGS_EVENT, () => {
    applySystemSettings();
  });
}
