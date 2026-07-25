"""Endpoint di autenticazione e stato connessione."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from blinkpy.blinkpy import Blink, BlinkTwoFARequiredError
from blinkpy.auth import Auth

import blinkpy_patches
import credentials
from state import state

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class PinRequest(BaseModel):
    pin: str


def _token_refresh_callback(auth: Auth) -> None:
    """Chiamata da blinkpy quando il token OAuth viene rinnovato in-memory.

    Persiste i nuovi token su disco così al riavvio non serve un nuovo 2FA.
    Senza questo callback il refresh_token in-memory si aggiorna ma quello
    su disco rimane stale, e dopo la sua scadenza l'app chiede un PIN che
    non può mai funzionare (nessun flusso 2FA realmente pendente).
    """
    credentials.save_credentials(auth.login_attributes)


@router.get("/status")
async def get_status():
    """Verifica se siamo connessi a Blink."""
    blink = state.blink
    if blink and blink.available:
        email = blink.auth.data.get("username", "")
        return {"connected": True, "requires_pin": False, "email": email}
    if blink and not blink.available:
        # Blink inizializzato ma non completamente connesso (token scaduto, 2FA)
        email = blink.auth.data.get("username", "")
        return {"connected": False, "requires_pin": True, "email": email}
    return {"connected": False, "requires_pin": False, "email": None}


@router.post("/auth/login")
async def login(request: LoginRequest):
    """Login all'account Blink."""
    # Salva la sessione precedente: la sovrascriviamo SOLO dopo aver validato
    # il nuovo login, così un tentativo fallito non distrugge la sessione attiva.
    prev_blink = state.blink
    try:
        blink = Blink()
        auth = Auth(
            {"username": request.email, "password": request.password},
            no_prompt=True,
        )
        # Registra il callback PRIMA di start(), così anche il primo refresh
        # che avviene internamente viene catturato.
        auth.callback = _token_refresh_callback
        blink.auth = auth
        await blink.start()

        # Se arriviamo qui senza eccezioni, login completato
        state.blink = blink
        # Chiudi la sessione HTTP precedente se diversa dalla nuova
        if prev_blink and prev_blink.auth.session:
            await prev_blink.auth.session.close()
        credentials.save_credentials(blink.auth.login_attributes)
        return {"success": True, "requires_pin": False}

    except BlinkTwoFARequiredError:
        # 2FA richiesto — il client deve inviare il PIN.
        # Sostituiamo ora perché blink è in uno stato valido (attende PIN).
        state.blink = blink
        if prev_blink and prev_blink.auth.session:
            await prev_blink.auth.session.close()
        return {"success": True, "requires_pin": True}
    except blinkpy_patches.RateLimitError as e:
        # Rate limit: NON sovrascrivere la sessione precedente.
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Troppi tentativi 2FA.",
                "retry_after_secs": e.retry_after_secs,
            },
        )
    except Exception as e:
        # Login fallito: NON sovrascrivere la sessione precedente.
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/auth/verify-pin")
async def verify_pin(request: PinRequest):
    """Verifica il PIN 2FA ricevuto via email/SMS."""
    blink = state.blink
    if not blink:
        raise HTTPException(status_code=400, detail="Devi prima fare il login")

    try:
        result = await blink.send_2fa_code(request.pin)
        if not result:
            raise HTTPException(status_code=401, detail="PIN non valido")

        credentials.save_credentials(blink.auth.login_attributes)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/auth/logout")
async def logout():
    """Disconnetti dall'account Blink."""
    blink = state.blink
    state.blink = None
    # Chiudi la sessione HTTP per non leakare risorse.
    if blink and blink.auth.session:
        await blink.auth.session.close()
    credentials.delete_credentials()
    return {"success": True}
