// Changelog dell'app. Ogni voce descrive una release; la prima è la più recente.
// Aggiornare questo file a ogni nuova versione: è la fonte usata sia dalla rotta
// Changelog sia (in futuro) dalla notifica di aggiornamento automatico.
//
// I testi sono bilingui { it, en }: la rotta Changelog mostra quello della
// lingua attiva (vedi ChangelogPage).

export type ChangeType = "feature" | "fix" | "improvement";

/** Testo di una modifica, in italiano e inglese. */
export interface LocalizedText {
  it: string;
  en: string;
}

export interface ChangeEntry {
  type: ChangeType;
  text: LocalizedText;
}

export interface Release {
  version: string;
  date: string; // ISO YYYY-MM-DD
  changes: ChangeEntry[];
}

export const changelog: Release[] = [
  {
    version: "0.5.3",
    date: "2026-07-26",
    changes: [
      {
        type: "fix",
        text: {
          it: "Livestream e unione clip non funzionavano: ffmpeg incluso non era il binario completo",
          en: "Live streaming and clip merging didn't work: the bundled ffmpeg wasn't the full binary",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Log del backend salvato in %APPDATA%/BlinkDashboard/backend.log per la diagnostica",
          en: "Backend log saved to %APPDATA%/BlinkDashboard/backend.log for diagnostics",
        },
      },
    ],
  },
  {
    version: "0.5.2",
    date: "2026-07-26",
    changes: [
      {
        type: "fix",
        text: {
          it: "Il backend crashava all'avvio sull'app installata (stream console assenti)",
          en: "The backend crashed on startup in the installed app (missing console streams)",
        },
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-07-26",
    changes: [
      {
        type: "fix",
        text: {
          it: "L'app installata non trovava backend.exe (path risorse errato)",
          en: "The installed app couldn't find backend.exe (wrong resource path)",
        },
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-09",
    changes: [
      {
        type: "feature",
        text: {
          it: "Configurazione backend via TOML (config.toml)",
          en: "Backend configuration via TOML (config.toml)",
        },
      },
      {
        type: "feature",
        text: {
          it: "Token anti-CSRF: protezione POST e WebSocket da pagine esterne",
          en: "Anti-CSRF token: protects POST and WebSocket from external pages",
        },
      },
      {
        type: "feature",
        text: {
          it: "Eviction LRU automatica della cache clip temporanei",
          en: "Automatic LRU eviction of the temporary clip cache",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Livestream: timeout su feed morto, cleanup robusto, niente più zombie ffmpeg",
          en: "Live stream: timeout on dead feeds, robust cleanup, no more zombie ffmpeg",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Token OAuth persistiti a ogni refresh — stop ai PIN 2FA impossibili",
          en: "OAuth tokens persisted on every refresh — no more impossible 2FA PINs",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Eliminazione clip cloud: body JSON corretto, ora funziona davvero",
          en: "Cloud clip deletion: correct JSON body, now actually works",
        },
      },
      {
        type: "improvement",
        text: {
          it: "CORS configurato per Windows (WebView2) e macOS",
          en: "CORS configured for Windows (WebView2) and macOS",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Arm/disarm: stato reale dopo il comando, supporto sistemi solo-Mini",
          en: "Arm/disarm: real state after the command, support for Mini-only systems",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Risposta API None gestita ovunque (errori di rete non mascherati)",
          en: "None API responses handled everywhere (network errors no longer masked)",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Sessioni HTTP chiuse allo shutdown e al logout (niente leak aiohttp)",
          en: "HTTP sessions closed on shutdown and logout (no aiohttp leaks)",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Modello impostazioni centralizzato (lib/settings.ts)",
          en: "Centralized settings model (lib/settings.ts)",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Logica live stream estratta in useLiveStream (eviction buffer, revoke URL)",
          en: "Live stream logic extracted into useLiveStream (buffer eviction, URL revoke)",
        },
      },
      {
        type: "improvement",
        text: {
          it: "MediaPage, DashboardPage e LiveCamera spacchettati in componenti",
          en: "MediaPage, DashboardPage and LiveCamera split into smaller components",
        },
      },
      {
        type: "improvement",
        text: {
          it: "CameraThumbnail condiviso con polling e cleanup",
          en: "Shared CameraThumbnail with polling and cleanup",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Scorciatoie video solo con il player a fuoco (non più globali)",
          en: "Video shortcuts only when the player is focused (no longer global)",
        },
      },
      {
        type: "fix",
        text: {
          it: "Crash in MediaPage eliminando la clip del tab attivo",
          en: "Crash in MediaPage when deleting the active tab's clip",
        },
      },
      {
        type: "fix",
        text: {
          it: "Polling dashboard non partiva (dipendenza `t` instabile)",
          en: "Dashboard polling didn't start (unstable `t` dependency)",
        },
      },
      {
        type: "fix",
        text: {
          it: "Download clip: base64 via IPC (~1.3x) invece di array JSON (~5x)",
          en: "Clip download: base64 over IPC (~1.3x) instead of JSON array (~5x)",
        },
      },
      {
        type: "fix",
        text: {
          it: "Backend ucciso all'uscita con taskkill /T (niente più uvicorn orfani)",
          en: "Backend killed on exit with taskkill /T (no more orphaned uvicorn)",
        },
      },
      {
        type: "fix",
        text: {
          it: "Notifiche OS via API Tauri (prima non funzionavano nel pacchetto)",
          en: "OS notifications via Tauri API (previously broken in the packaged app)",
        },
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-04",
    changes: [
      {
        type: "feature",
        text: {
          it: "Nuova rotta Eventi: clip cloud con feed, player e filtri",
          en: "New Events route: cloud clips with feed, player and filters",
        },
      },
      {
        type: "feature",
        text: {
          it: "Eventi multi-camera uniti in un unico video a griglia",
          en: "Multi-camera events merged into a single grid video",
        },
      },
      {
        type: "feature",
        text: {
          it: "Player video con controlli glassmorph e scorciatoie da tastiera",
          en: "Video player with glassmorphic controls and keyboard shortcuts",
        },
      },
      {
        type: "feature",
        text: {
          it: "Rotta Impostazioni con avvio automatico, tray e lingua",
          en: "Settings route with auto-start, tray and language",
        },
      },
      {
        type: "feature",
        text: {
          it: "Sistema multilingua Italiano / English",
          en: "Multilingual system: Italian / English",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Sfondo shader dinamico con dithering",
          en: "Dynamic shader background with dithering",
        },
      },
      {
        type: "fix",
        text: {
          it: "Seek dei video ora fluido (supporto Range lato backend)",
          en: "Video seeking now smooth (backend Range support)",
        },
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-28",
    changes: [
      {
        type: "feature",
        text: {
          it: "Sistema di notifiche globali per il rilevamento movimento",
          en: "Global notification system for motion detection",
        },
      },
      {
        type: "feature",
        text: {
          it: "Barra di stato in basso in stile VSCode",
          en: "VSCode-style bottom status bar",
        },
      },
      {
        type: "feature",
        text: {
          it: "Titlebar personalizzata e finestra senza decorazioni native",
          en: "Custom titlebar and window without native decorations",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Estetica glassmorphism su tutta l'interfaccia",
          en: "Glassmorphism aesthetic across the whole UI",
        },
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-20",
    changes: [
      {
        type: "feature",
        text: {
          it: "Rotta Dispositivi con impostazioni per telecamera",
          en: "Devices route with per-camera settings",
        },
      },
      {
        type: "feature",
        text: {
          it: "Supporto Blink Outdoor 4 (sedona)",
          en: "Blink Outdoor 4 support (sedona)",
        },
      },
      {
        type: "improvement",
        text: {
          it: "Controlli camera dinamici in base alle capacità",
          en: "Dynamic camera controls based on capabilities",
        },
      },
      {
        type: "fix",
        text: {
          it: "Conflitti 409 durante il toggle della luce",
          en: "409 conflicts when toggling the light",
        },
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-10",
    changes: [
      {
        type: "feature",
        text: {
          it: "Livestream delle telecamere Blink Mini",
          en: "Live streaming for Blink Mini cameras",
        },
      },
      {
        type: "feature",
        text: {
          it: "Login con supporto 2FA",
          en: "Login with 2FA support",
        },
      },
      {
        type: "feature",
        text: {
          it: "Dashboard con griglia telecamere e cassetto",
          en: "Dashboard with camera grid and drawer",
        },
      },
    ],
  },
];

export const currentVersion = changelog[0].version;
