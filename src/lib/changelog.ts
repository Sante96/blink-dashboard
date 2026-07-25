// Changelog dell'app. Ogni voce descrive una release; la prima è la più recente.
// Aggiornare questo file a ogni nuova versione: è la fonte usata sia dalla rotta
// Changelog sia (in futuro) dalla notifica di aggiornamento automatico.

export type ChangeType = "feature" | "fix" | "improvement";

export interface ChangeEntry {
  type: ChangeType;
  text: string;
}

export interface Release {
  version: string;
  date: string; // ISO YYYY-MM-DD
  changes: ChangeEntry[];
}

export const changelog: Release[] = [
  {
    version: "0.5.0",
    date: "2026-07-09",
    changes: [
      { type: "feature", text: "Configurazione backend via TOML (config.toml)" },
      { type: "feature", text: "Token anti-CSRF: protezione POST e WebSocket da pagine esterne" },
      { type: "feature", text: "Eviction LRU automatica della cache clip temporanei" },
      { type: "improvement", text: "Livestream: timeout su feed morto, cleanup robusto, niente più zombie ffmpeg" },
      { type: "improvement", text: "Token OAuth persistiti a ogni refresh — stop ai PIN 2FA impossibili" },
      { type: "improvement", text: "Eliminazione clip cloud: body JSON corretto, ora funziona davvero" },
      { type: "improvement", text: "CORS configurato per Windows (WebView2) e macOS" },
      { type: "improvement", text: "Arm/disarm: stato reale dopo il comando, supporto sistemi solo-Mini" },
      { type: "improvement", text: "Risposta API None gestita ovunque (errori di rete non mascherati)" },
      { type: "improvement", text: "Sessioni HTTP chiuse allo shutdown e al logout (niente leak aiohttp)" },
      { type: "improvement", text: "Modello impostazioni centralizzato (lib/settings.ts)" },
      { type: "improvement", text: "Logica live stream estratta in useLiveStream (eviction buffer, revoke URL)" },
      { type: "improvement", text: "MediaPage, DashboardPage e LiveCamera spacchettati in componenti" },
      { type: "improvement", text: "CameraThumbnail condiviso con polling e cleanup" },
      { type: "improvement", text: "Scorciatoie video solo con il player a fuoco (non più globali)" },
      { type: "fix", text: "Crash in MediaPage eliminando la clip del tab attivo" },
      { type: "fix", text: "Polling dashboard non partiva (dipendenza `t` instabile)" },
      { type: "fix", text: "Download clip: base64 via IPC (~1.3x) invece di array JSON (~5x)" },
      { type: "fix", text: "Backend ucciso all'uscita con taskkill /T (niente più uvicorn orfani)" },
      { type: "fix", text: "Notifiche OS via API Tauri (prima non funzionavano nel pacchetto)" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-04",
    changes: [
      { type: "feature", text: "Nuova rotta Eventi: clip cloud con feed, player e filtri" },
      { type: "feature", text: "Eventi multi-camera uniti in un unico video a griglia" },
      { type: "feature", text: "Player video con controlli glassmorph e scorciatoie da tastiera" },
      { type: "feature", text: "Rotta Impostazioni con avvio automatico, tray e lingua" },
      { type: "feature", text: "Sistema multilingua Italiano / English" },
      { type: "improvement", text: "Sfondo shader dinamico con dithering" },
      { type: "fix", text: "Seek dei video ora fluido (supporto Range lato backend)" },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-28",
    changes: [
      { type: "feature", text: "Sistema di notifiche globali per il rilevamento movimento" },
      { type: "feature", text: "Barra di stato in basso in stile VSCode" },
      { type: "feature", text: "Titlebar personalizzata e finestra senza decorazioni native" },
      { type: "improvement", text: "Estetica glassmorphism su tutta l'interfaccia" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-20",
    changes: [
      { type: "feature", text: "Rotta Dispositivi con impostazioni per telecamera" },
      { type: "feature", text: "Supporto Blink Outdoor 4 (sedona)" },
      { type: "improvement", text: "Controlli camera dinamici in base alle capacità" },
      { type: "fix", text: "Conflitti 409 durante il toggle della luce" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-10",
    changes: [
      { type: "feature", text: "Livestream delle telecamere Blink Mini" },
      { type: "feature", text: "Login con supporto 2FA" },
      { type: "feature", text: "Dashboard con griglia telecamere e cassetto" },
    ],
  },
];

export const currentVersion = changelog[0].version;
