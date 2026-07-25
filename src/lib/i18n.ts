import { useSyncExternalStore } from "react";
import { readSettings, SETTINGS_EVENT } from "@/lib/settings";

// Sistema i18n leggero, senza dipendenze esterne. La lingua vive nelle
// impostazioni (lib/settings) e cambia live tramite SETTINGS_EVENT.

export type Lang = "it" | "en";

type Dict = Record<string, string>;

const it: Dict = {
  // Login
  "login.brandSubtitle": "Gestisci le tue telecamere Blink",
  "login.signIn": "Accedi",
  "login.verify2fa": "Verifica 2FA",
  "login.useCredentials": "Usa le credenziali del tuo account Blink",
  "login.enterPin": "Inserisci il PIN ricevuto via SMS",
  "login.email": "Email",
  "login.password": "Password",
  "login.pin": "PIN",
  "login.connecting": "Connessione...",
  "login.wait": "Attendi {time}",
  "login.retryIn": "Riprova tra",
  "login.loginFailed": "Login fallito",
  "login.connectionError": "Errore di connessione",
  "login.invalidPin": "PIN non valido",
  "login.verifying": "Verifica...",
  "login.confirmPin": "Conferma PIN",
  "login.tagline": "Monitora e gestisci le tue telecamere in un unico posto",

  // Nav
  "nav.dashboard": "Dashboard",
  "nav.devices": "Dispositivi",
  "nav.media": "Eventi",
  "nav.settings": "Impostazioni",
  "nav.changelog": "Novità",
  "nav.armed": "Armato",
  "nav.disarmed": "Disarmato",
  "nav.allArmed": "Tutte armate",
  "nav.allDisarmed": "Tutte disarmate",
  "nav.armAll": "Arma tutte",
  "nav.disarmAll": "Disarma tutte",
  "system.busy": "Sistema Blink occupato, riprova tra poco",
  "nav.account": "Account",
  "nav.disconnect": "Disconnetti",
  "nav.logout": "Esci",

  // Changelog / novità
  "changelog.title": "Novità",
  "changelog.subtitle": "Cronologia degli aggiornamenti",
  "changelog.current": "Attuale",
  "changelog.type.feature": "Novità",
  "changelog.type.fix": "Correzione",
  "changelog.type.improvement": "Miglioramento",
  "changelog.updateTitle": "Aggiornamento installato",
  "changelog.updateMessage": "Aggiornato alla versione {version}. Tocca per le novità.",

  // Notifiche
  "notif.motionDetected": "Movimento rilevato",
  "notif.title": "Notifiche",
  "notif.empty": "Nessuna notifica",
  "notif.clear": "Cancella",
  "notif.clearAll": "Cancella tutto",

  // Impostazioni
  "settings.title": "Impostazioni",
  "settings.general": "Generale",
  "settings.appearance": "Aspetto",
  "settings.notifications": "Notifiche",
  "settings.cameras": "Telecamere",
  "settings.info": "Info",
  "settings.autoStart": "Avvio automatico",
  "settings.autoStartDesc": "Avvia Blink all'accensione del PC",
  "settings.minimizeToTray": "Minimizza nella tray",
  "settings.minimizeToTrayDesc": "Alla chiusura l'app resta nella system tray",
  "settings.language": "Lingua",
  "settings.bgIntensity": "Intensità sfondo",
  "settings.animSpeed": "Velocità animazione",
  "settings.pattern": "Pattern",
  "settings.soundAlert": "Suono alert",
  "settings.soundAlertDesc": "Riproduce un suono al rilevamento movimento",
  "settings.osNotifications": "Notifiche sistema",
  "settings.osNotificationsDesc": "Mostra notifiche native del sistema operativo",
  "settings.toastDuration": "Durata toast",
  "settings.toastDurationSecs": "{n} secondi",
  "settings.pollingInterval": "Intervallo polling",
  "settings.pollingIntervalDesc": "Aggiorna stato ogni {n}s",
  "settings.version": "Versione",
  "settings.createdBy": "Creato da",

  // Media / eventi
  "media.title": "Eventi",
  "media.empty": "Nessun evento",
  "media.emptyHint": "I clip di movimento salvati nel cloud appariranno qui.",
  "media.loading": "Caricamento eventi…",
  "media.loadMore": "Carica altri",
  "media.download": "Scarica",
  "media.downloading": "Download…",
  "media.delete": "Elimina",
  "media.deleting": "Eliminazione…",
  "media.confirmDelete": "Eliminare questo evento dal cloud? L'azione è irreversibile.",
  "media.deleted": "Evento eliminato",
  "media.downloaded": "Clip salvato",
  "media.downloadError": "Errore durante il download",
  "media.deleteError": "Errore durante l'eliminazione",
  "media.allCameras": "Tutte le telecamere",
  "media.today": "Oggi",
  "media.yesterday": "Ieri",
  "media.devicesCount": "{n} telecamere",
  "media.clipsCount": "{n} clip",
  "media.eventsCount": "{n} eventi",
  "media.motion": "Movimento",
  "media.close": "Chiudi",
  "media.merging": "Unione dei clip in corso…",
  "media.mergeError": "Impossibile unire i clip",
  "media.allTogether": "Tutte insieme",

  // Devices page
  "devices.list": "Dispositivi",
  "devices.selectDevice": "Seleziona un dispositivo",
  "devices.saved": "Salvato",
  "devices.cancel": "Annulla",
  "devices.save": "Salva",
  "devices.demoDevice": "Dispositivo demo: nessuna impostazione reale.",
  "devices.loadingSettings": "Caricamento impostazioni…",
  "devices.modified": "Modificato",
  "devices.demo": "demo",

  // Camera / LiveCamera
  "camera.motion": "MOVIMENTO",
  "camera.live": "LIVE",
  "camera.reconnecting": "RICONNESSIONE",
  "camera.connecting": "Connessione...",
  "camera.reconnectingDots": "Riconnessione...",
  "camera.streamUnavailable": "Stream non disponibile",
  "camera.demo": "Demo",
  "camera.waiting": "In attesa...",
  "camera.arm": "Arma",
  "camera.disarm": "Disarma",
  "camera.armed": "Armata",
  "camera.disarmed": "Disarmata",
  "camera.muteAudio": "Disattiva audio",
  "camera.unmuteAudio": "Attiva audio",
  "camera.lightOn": "Accendi luce",
  "camera.lightOff": "Spegni luce",
  "camera.snapshot": "Scatta foto",
  "camera.refresh": "Aggiorna feed (es. se resta in bianco/nero)",
  "camera.wsError": "Errore connessione WebSocket",
  "camera.defaultName": "Camera",
  "camera.loadError": "Errore caricamento",
  "camera.saveError": "Errore salvataggio",

  // Status bar
  "status.connected": "Connesso",
  "status.disconnected": "Disconnesso",
  "status.camera": "camera",
  "status.cameras": "camere",
  "status.live": "live",
  "status.allArmed": "Tutte armate",
  "status.notAllArmed": "Non tutte armate",
  "status.createdBy": "Creato da Sante",

  // Connection guard
  "guard.disconnectedTitle": "Backend non raggiungibile",
  "guard.disconnectedMessage": "Impossibile comunicare col backend. Verifica che il servizio sia attivo e riprova.",
  "guard.retry": "Riprova",
  "guard.retrying": "Riprovo...",
  "guard.autoRetry": "Nuovo tentativo automatico ogni 10 secondi",
  "guard.sessionExpiredTitle": "Sessione scaduta",
  "guard.sessionExpiredMessage": "La sessione Blink è scaduta. Effettua nuovamente il login per continuare.",
  "guard.goToLogin": "Torna al login",

  // Comuni
  "common.online": "Connesso",
  "common.offline": "Non connesso",
};

const en: Dict = {
  // Login
  "login.brandSubtitle": "Manage your Blink cameras",
  "login.signIn": "Sign in",
  "login.verify2fa": "2FA Verification",
  "login.useCredentials": "Use your Blink account credentials",
  "login.enterPin": "Enter the PIN received via SMS",
  "login.email": "Email",
  "login.password": "Password",
  "login.pin": "PIN",
  "login.connecting": "Connecting...",
  "login.wait": "Wait {time}",
  "login.retryIn": "Retry in",
  "login.loginFailed": "Login failed",
  "login.connectionError": "Connection error",
  "login.invalidPin": "Invalid PIN",
  "login.verifying": "Verifying...",
  "login.confirmPin": "Confirm PIN",
  "login.tagline": "Monitor and manage all your cameras in one place",

  // Nav
  "nav.dashboard": "Dashboard",
  "nav.devices": "Devices",
  "nav.media": "Events",
  "nav.settings": "Settings",
  "nav.changelog": "What's new",
  "nav.armed": "Armed",
  "nav.disarmed": "Disarmed",
  "nav.allArmed": "All armed",
  "nav.allDisarmed": "All disarmed",
  "nav.armAll": "Arm all",
  "nav.disarmAll": "Disarm all",
  "system.busy": "Blink system busy, try again shortly",
  "nav.account": "Account",
  "nav.disconnect": "Disconnect",
  "nav.logout": "Log out",

  // Changelog / novità
  "changelog.title": "What's new",
  "changelog.subtitle": "Update history",
  "changelog.current": "Current",
  "changelog.type.feature": "New",
  "changelog.type.fix": "Fix",
  "changelog.type.improvement": "Improvement",
  "changelog.updateTitle": "Update installed",
  "changelog.updateMessage": "Updated to version {version}. Tap to see what's new.",

  // Notifiche
  "notif.motionDetected": "Motion detected",
  "notif.title": "Notifications",
  "notif.empty": "No notifications",
  "notif.clear": "Clear",
  "notif.clearAll": "Clear all",

  // Impostazioni
  "settings.title": "Settings",
  "settings.general": "General",
  "settings.appearance": "Appearance",
  "settings.notifications": "Notifications",
  "settings.cameras": "Cameras",
  "settings.info": "Info",
  "settings.autoStart": "Auto-start",
  "settings.autoStartDesc": "Launch Blink when the PC turns on",
  "settings.minimizeToTray": "Minimize to tray",
  "settings.minimizeToTrayDesc": "On close, the app stays in the system tray",
  "settings.language": "Language",
  "settings.bgIntensity": "Background intensity",
  "settings.animSpeed": "Animation speed",
  "settings.pattern": "Pattern",
  "settings.soundAlert": "Alert sound",
  "settings.soundAlertDesc": "Plays a sound when motion is detected",
  "settings.osNotifications": "System notifications",
  "settings.osNotificationsDesc": "Shows native operating system notifications",
  "settings.toastDuration": "Toast duration",
  "settings.toastDurationSecs": "{n} seconds",
  "settings.pollingInterval": "Polling interval",
  "settings.pollingIntervalDesc": "Refresh status every {n}s",
  "settings.version": "Version",
  "settings.createdBy": "Created by",

  // Media / eventi
  "media.title": "Events",
  "media.empty": "No events",
  "media.emptyHint": "Motion clips saved to the cloud will appear here.",
  "media.loading": "Loading events…",
  "media.loadMore": "Load more",
  "media.download": "Download",
  "media.downloading": "Downloading…",
  "media.delete": "Delete",
  "media.deleting": "Deleting…",
  "media.confirmDelete": "Delete this event from the cloud? This cannot be undone.",
  "media.deleted": "Event deleted",
  "media.downloaded": "Clip saved",
  "media.downloadError": "Download error",
  "media.deleteError": "Delete error",
  "media.allCameras": "All cameras",
  "media.today": "Today",
  "media.yesterday": "Yesterday",
  "media.devicesCount": "{n} cameras",
  "media.clipsCount": "{n} clips",
  "media.eventsCount": "{n} events",
  "media.motion": "Motion",
  "media.close": "Close",
  "media.merging": "Merging clips…",
  "media.mergeError": "Could not merge the clips",
  "media.allTogether": "All together",

  // Devices page
  "devices.list": "Devices",
  "devices.selectDevice": "Select a device",
  "devices.saved": "Saved",
  "devices.cancel": "Cancel",
  "devices.save": "Save",
  "devices.demoDevice": "Demo device: no real settings.",
  "devices.loadingSettings": "Loading settings…",
  "devices.modified": "Modified",
  "devices.demo": "demo",

  // Camera / LiveCamera
  "camera.motion": "MOTION",
  "camera.live": "LIVE",
  "camera.reconnecting": "RECONNECTING",
  "camera.connecting": "Connecting...",
  "camera.reconnectingDots": "Reconnecting...",
  "camera.streamUnavailable": "Stream unavailable",
  "camera.demo": "Demo",
  "camera.waiting": "Waiting...",
  "camera.arm": "Arm",
  "camera.disarm": "Disarm",
  "camera.armed": "Armed",
  "camera.disarmed": "Disarmed",
  "camera.muteAudio": "Mute audio",
  "camera.unmuteAudio": "Unmute audio",
  "camera.lightOn": "Turn on light",
  "camera.lightOff": "Turn off light",
  "camera.snapshot": "Take photo",
  "camera.refresh": "Refresh feed (e.g. if it stays black & white)",
  "camera.wsError": "WebSocket connection error",
  "camera.defaultName": "Camera",
  "camera.loadError": "Loading error",
  "camera.saveError": "Save error",

  // Status bar
  "status.connected": "Connected",
  "status.disconnected": "Disconnected",
  "status.camera": "camera",
  "status.cameras": "cameras",
  "status.live": "live",
  "status.allArmed": "All armed",
  "status.notAllArmed": "Not all armed",
  "status.createdBy": "Created by Sante",

  // Connection guard
  "guard.disconnectedTitle": "Backend unreachable",
  "guard.disconnectedMessage": "Unable to communicate with the backend. Make sure the service is running and try again.",
  "guard.retry": "Retry",
  "guard.retrying": "Retrying...",
  "guard.autoRetry": "Automatic retry every 10 seconds",
  "guard.sessionExpiredTitle": "Session expired",
  "guard.sessionExpiredMessage": "Your Blink session has expired. Please log in again to continue.",
  "guard.goToLogin": "Back to login",

  // Comuni
  "common.online": "Connected",
  "common.offline": "Disconnected",
};

const dicts: Record<Lang, Dict> = { it, en };

function readLang(): Lang {
  return readSettings().language;
}

// --- Store esterno per useSyncExternalStore ---

let currentLang: Lang = readLang();
const listeners = new Set<() => void>();

function emit() {
  const next = readLang();
  if (next !== currentLang) {
    currentLang = next;
    listeners.forEach((l) => l());
  }
}

if (typeof window !== "undefined") {
  window.addEventListener(SETTINGS_EVENT, emit);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentLang;
}

/** Traduce una chiave nella lingua corrente, con interpolazione {placeholder}. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let str = dicts[lang][key] ?? dicts.it[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

/** Hook: restituisce la funzione di traduzione, reattiva ai cambi di lingua. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

/** Hook: restituisce la lingua corrente, reattiva ai cambi. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
