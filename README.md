# Blink Dashboard

App desktop per gestire le telecamere Blink (Amazon): livestream, arm/disarm, clip cloud, notifiche di movimento.

Costruita con **Tauri** (Rust) + **React/TypeScript** + backend **Python FastAPI** che dialoga con l'API Blink via [blinkpy](https://github.com/fronzbot/blinkpy).

## Funzionalità

- 🎥 **Livestream** in tempo reale (Blink Mini, Mini 2, Outdoor) via IMMIS → ffmpeg → MSE
- 🛡️ **Arm/disarm** globale e per camera
- 🔔 **Notifiche di movimento** anche con l'app nella system tray
- 📼 **Clip cloud**: feed eventi, player video, merge multi-camera a griglia, download
- 💡 **Controllo luce** (Blink Mini 2)
- ⚙️ Impostazioni per camera (sensibilità, qualità video, visione notturna…)
- 🌍 Italiano / English
- 🔄 Autoupdate via GitHub Releases

## Requisiti (sviluppo)

- Node.js 18+
- Rust (stable)
- Python 3.14+ con [uv](https://docs.astral.sh/uv/)
- ffmpeg nel PATH

## Sviluppo

```bash
npm install
cd backend && uv sync && cd ..
npm run tauri dev
```

Il backend Python viene avviato automaticamente da Tauri su `127.0.0.1:8000`.

## Build di distribuzione

```bash
# 1. Compila il backend in un exe standalone (PyInstaller)
python build_backend.py

# 2. Build Tauri con firma updater
$env:TAURI_PRIVATE_KEY = "$env:USERPROFILE\.tauri\blink-dashboard.key"
npm run tauri build
```

L'installer risultante è in `src-tauri/target/release/bundle/`.

## Architettura

```
┌─────────────┐  IPC   ┌──────────────┐  HTTP/WS   ┌───────────────┐
│  React SPA  │ ◄────► │  Tauri (Rust)│            │ FastAPI (py)  │
│  (WebView2) │ ◄──────┼──────────────┼──────────► │  + blinkpy    │
└─────────────┘ fetch  └──────────────┘  :8000     └───────┬───────┘
                                                           │ HTTPS/IMMIS
                                                    ┌──────▼───────┐
                                                    │  Blink Cloud │
                                                    └──────────────┘
```

- Il frontend parla col backend solo via `127.0.0.1:8000` (+ token anti-CSRF in release)
- Il livestream passa per un proxy TCP locale: IMMIS → ffmpeg (fMP4) → WebSocket → MediaSource
- Le credenziali sono cifrate a riposo con DPAPI di Windows; la password non viene mai salvata

## Licenza

Progetto personale, non affiliato ad Amazon/Blink.
