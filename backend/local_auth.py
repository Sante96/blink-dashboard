"""
Middleware di autenticazione locale (anti-CSRF).

Il backend gira su 127.0.0.1 ma senza un segreto condiviso qualsiasi pagina
web aperta nello stesso browser può fare richieste POST (CORS blocca solo la
LETTURA delle risposte, non l'invio per i "simple requests") e aprire WebSocket
(CORS non si applica a WS).

Il flusso:
1. Tauri genera un token casuale e lo passa come env BLINK_LOCAL_TOKEN allo spawn
   di uvicorn.
2. Il backend lo legge qui e lo verifica su ogni richiesta mutante (POST/PATCH/DELETE)
   e sulle connessioni WebSocket.
3. Il frontend lo ottiene da Tauri via comando IPC e lo invia come header
   X-Blink-Token (HTTP) o query param ?token= (WebSocket).

In modalità dev (nessun token impostato) il middleware è disattivato: consente
di testare con curl/browser senza complicazioni.
"""

import os

from fastapi import Request, WebSocket
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

LOCAL_TOKEN: str | None = os.environ.get("BLINK_LOCAL_TOKEN")

# Metodi che non mutano stato: li lasciamo passare senza token.
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Path esenti dal check token (pre-autenticazione, non target CSRF utile).
_EXEMPT_PATHS = {"/auth/login", "/auth/verify-pin"}


class LocalTokenMiddleware(BaseHTTPMiddleware):
    """Controlla X-Blink-Token su richieste mutanti (POST/PATCH/DELETE)."""

    async def dispatch(self, request: Request, call_next):
        # Se il token non è configurato (dev mode): tutto permesso.
        if not LOCAL_TOKEN:
            return await call_next(request)

        # Metodi safe non richiedono il token.
        if request.method in _SAFE_METHODS:
            return await call_next(request)

        # Endpoint di autenticazione esenti (servono prima che il frontend
        # abbia il token, e non sono target CSRF utile).
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        # Verifica il token.
        provided = request.headers.get("X-Blink-Token")
        if provided != LOCAL_TOKEN:
            return JSONResponse(
                status_code=403,
                content={"detail": "Token locale mancante o non valido"},
            )

        return await call_next(request)


def verify_ws_token(websocket: WebSocket) -> bool:
    """Verifica il token su una connessione WebSocket (query param `token`).

    Ritorna True se il token è valido (o se non è configurato = dev mode).
    """
    if not LOCAL_TOKEN:
        return True
    return websocket.query_params.get("token") == LOCAL_TOKEN
