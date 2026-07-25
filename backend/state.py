"""
Stato condiviso dell'applicazione.

L'istanza `Blink` viene creata al login e riassegnata a logout/re-login, quindi
non può essere una semplice variabile importata (le import catturano il valore,
non il riferimento). La incapsuliamo in un oggetto `AppState` mutabile che tutti
i router condividono, più una dependency FastAPI per ottenere un'istanza già
verificata come "connessa".
"""

from fastapi import HTTPException
from blinkpy.blinkpy import Blink


class AppState:
    """Contiene l'istanza Blink corrente e gli stream attivi."""

    def __init__(self) -> None:
        self.blink: Blink | None = None
        # camera_name -> BlinkLiveStream attivo (per interromperlo su comandi REST)
        self.active_streams: dict = {}


# Singleton condiviso da tutti i moduli.
state = AppState()


def require_blink() -> Blink:
    """
    Dependency: restituisce l'istanza Blink connessa, o solleva 401.

    Centralizza il check "Non connesso" che prima era ripetuto in ogni endpoint.
    Dopo questo check `blink.urls` e `blink.auth.session` sono garantiti non-None.
    """
    if not state.blink or not state.blink.available:
        raise HTTPException(status_code=401, detail="Non connesso")
    assert state.blink.urls is not None
    return state.blink


def require_camera(blink: Blink, camera_name: str):
    """Restituisce la camera per nome, o solleva 404."""
    if camera_name not in blink.cameras:
        raise HTTPException(status_code=404, detail="Telecamera non trovata")
    return blink.cameras[camera_name]
