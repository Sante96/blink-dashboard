"""
Blink Dashboard API — punto di ingresso.

Configura l'app FastAPI, i monkey-patch a blinkpy, il CORS, il login automatico
allo startup, e include i router modulari (auth, cameras, system, livestream).
"""

import os
import sys

# Sotto PyInstaller in modalità --noconsole non c'è console allegata, quindi
# sys.stdout/stderr sono None. Uvicorn (e altre librerie) chiamano stdout.isatty()
# durante la configurazione del logging → crash immediato. Rimpiazziamo gli
# stream mancanti con un sink su devnull PRIMA di qualsiasi altro import.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from blinkpy.blinkpy import Blink, BlinkTwoFARequiredError
from blinkpy.auth import Auth

import blinkpy_patches
import credentials
from config import config
from local_auth import LocalTokenMiddleware
from state import state
from routers import auth, cameras, system, livestream, media, events
from routers.auth import _token_refresh_callback

# Applica i monkey-patch a blinkpy (gestione 2FA 202, APP-BUILD, endpoint liveview)
blinkpy_patches.apply_patches()

logger = logging.getLogger("blink")
logging.basicConfig(level=getattr(logging, config.logging.level.upper(), logging.INFO))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: login automatico; shutdown: chiudi sessione e stream."""
    # --- Startup ---
    saved = credentials.load_credentials()
    if saved:
        try:
            blink = Blink()
            blink.auth = Auth(saved, no_prompt=True)
            blink.auth.callback = _token_refresh_callback
            state.blink = blink
            await blink.start()
            logger.info("Login automatico riuscito")
        except BlinkTwoFARequiredError:
            # Token scaduto, serve ri-autenticazione con 2FA.
            # Manteniamo blink attivo così il frontend sa che serve il PIN.
            logger.info("Sessione scaduta: PIN 2FA richiesto")
        except Exception as e:
            logger.warning("Login automatico fallito: %s", e)
            state.blink = None

    yield

    # --- Shutdown ---
    # Interrompi tutti gli stream attivi
    for _, ls in list(state.active_streams.items()):
        try:
            ls.stop()
        except Exception:
            pass
    state.active_streams.clear()

    # Chiudi la sessione HTTP di blinkpy
    if state.blink and state.blink.auth.session:
        try:
            await state.blink.auth.session.close()
        except Exception:
            pass
    state.blink = None
    logger.info("Shutdown completato")


app = FastAPI(title="Blink Dashboard API", version="0.5.0", lifespan=lifespan)

# Token anti-CSRF: protegge POST/PATCH/DELETE da richieste cross-origin.
app.add_middleware(LocalTokenMiddleware)

# CORS per comunicare con il frontend Tauri.
# - tauri://localhost → macOS/Linux
# - https://tauri.localhost → Windows (Tauri v1 su WebView2)
# - http://localhost:1420 → dev (vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "tauri://localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router modulari
app.include_router(auth.router)
app.include_router(cameras.router)
app.include_router(system.router)
app.include_router(livestream.router)
app.include_router(media.router)
app.include_router(events.router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "Blink Dashboard API"}


if __name__ == "__main__":
    import uvicorn
    # log_config=None: usa il logging già configurato con basicConfig() sopra,
    # evitando che uvicorn ricrei da zero la sua config (che sotto --noconsole
    # tocca gli stream e può fallire anche con stdout/stderr sostituiti).
    uvicorn.run(
        app,
        host=config.server.host,
        port=config.server.port,
        log_config=None,
    )
