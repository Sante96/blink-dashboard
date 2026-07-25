# Blink Dashboard

Desktop app for managing Blink (Amazon) cameras: live streaming, arm/disarm, cloud clips, motion notifications.

Built with **Tauri** (Rust) + **React/TypeScript** + a **Python FastAPI** backend that talks to the Blink API through [blinkpy](https://github.com/fronzbot/blinkpy).

![Version](https://img.shields.io/github/v/release/Sante96/blink-dashboard)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🎥 **Live streaming** in real time (Blink Mini, Mini 2, Outdoor) via IMMIS → ffmpeg → MSE
- 🛡️ **Arm/disarm** system-wide and per camera
- 🔔 **Motion notifications**, including while the app sits in the system tray
- 📼 **Cloud clips**: event feed, video player, multi-camera grid merge, download
- 💡 **Light control** (Blink Mini 2)
- ⚙️ Per-camera settings (motion sensitivity, video quality, night vision…)
- 🌍 Italian / English
- 🔄 Auto-update via GitHub Releases

## Installation

Download the latest `.msi` installer from [Releases](https://github.com/Sante96/blink-dashboard/releases/latest) and run it. Everything is bundled — no Python, no ffmpeg to install.

The app auto-updates: when a new version is published it will offer to install it at startup.

## Development

Requirements: Node.js 18+, Rust (stable), Python 3.14+ with [uv](https://docs.astral.sh/uv/), ffmpeg in PATH.

```bash
npm install
cd backend && uv sync && cd ..
npm run tauri dev
```

The Python backend is started automatically by Tauri on `127.0.0.1:8000`.

## Building for distribution

```powershell
# 1. Compile the backend into a standalone exe (PyInstaller, bundles ffmpeg)
python build_backend.py

# 2. Signed Tauri build
$env:TAURI_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\blink-dashboard.key" -Raw
npm run tauri build
```

The installer ends up in `src-tauri/target/release/bundle/`. See [RELEASING.md](RELEASING.md) for the full release process (CI does this automatically on version tags).

## Architecture

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

- The frontend talks to the backend only on `127.0.0.1:8000` (+ anti-CSRF token in release builds)
- Live streams flow through a local TCP proxy: IMMIS → ffmpeg (fMP4) → WebSocket → MediaSource
- Credentials are encrypted at rest with Windows DPAPI; the password is never persisted, only OAuth tokens

## License

[MIT](LICENSE). Personal project, not affiliated with Amazon or Blink.
