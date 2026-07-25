"""Endpoint di sistema: arma/disarma tutte le camere, moduli sync."""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from blinkpy.blinkpy import Blink

from state import require_blink

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_busy(resp) -> bool:
    """True se il server Blink ha rifiutato il comando con 307 'System is busy'."""
    return isinstance(resp, dict) and resp.get("code") == 307


async def _raw_arm_network(blink: Blink, network_id: int, arm: bool) -> dict | None:
    """
    Chiama direttamente l'endpoint di arm/disarm del network senza passare per
    il meccanismo di polling /command/{id}/done di blinkpy.

    Il polling su /done è la causa dei 307: se fallisce (e lo fa spesso quando
    ci sono più comandi in volo), il server resta nello stato "busy" perché
    nessuno ha segnalato la fine del comando precedente. Facendo la raw call
    evitiamo del tutto quel polling — ci limitiamo a mandare il comando e ad
    aspettare che lo stato si propaghi leggendo /homescreen.
    """
    action = "arm" if arm else "disarm"
    url = f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}/networks/{network_id}/state/{action}"

    try:
        async with blink.auth.session.post(url, headers=blink.auth.header) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data
            elif resp.status == 409:
                # Il server rifiuta: un comando è in volo. Ritorniamo un dict
                # con code=307 per la logica di retry.
                return {"code": 307}
            else:
                text = await resp.text()
                logger.warning("arm_network %s returned %d: %s", action, resp.status, text[:200])
                return None
    except Exception as e:
        logger.warning("arm_network %s failed: %s", action, e)
        return None


async def _raw_arm_camera(blink: Blink, camera, enable: bool) -> None:
    """
    Abilita/disabilita la motion detection di una singola camera via raw call.
    Equivalente a camera.async_arm() ma senza il polling /done.
    """
    network_id = camera.network_id
    camera_id = camera.camera_id
    action = "enable" if enable else "disable"

    # Le Mini usano un endpoint diverso dalle camere a batteria.
    if camera.camera_type == "mini":
        url = (
            f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}"
            f"/networks/{network_id}/owls/{camera_id}/config"
        )
        # Per le Mini la motion detection si toglie dal config owl.
        import json
        body = json.dumps({"enabled": enable})
        try:
            async with blink.auth.session.post(url, headers=blink.auth.header, data=body) as resp:
                pass
        except Exception:
            pass
    else:
        url = (
            f"{blink.urls.base_url}/network/{network_id}/camera/{camera_id}/{action}"
        )
        try:
            async with blink.auth.session.post(url, headers=blink.auth.header) as resp:
                pass
        except Exception:
            pass


async def _set_all_cameras_arm(blink: Blink, value: bool) -> bool:
    """
    Arma/disarma l'intero sistema Blink con raw API calls.

    Due livelli:
    1. Sync module (network): /state/arm o /state/disarm. È questo che abilita
       la registrazione degli eventi per le camere sotto un sync module.
    2. Camera (motion detection): necessario per le Mini standalone.

    Usa raw calls per evitare il polling /command/done che causa i 307 a catena.
    """
    # Livello 1 — network
    for sync in blink.sync.values():
        for attempt in range(6):
            resp = await _raw_arm_network(blink, sync.network_id, value)
            if resp is None:
                # Errore non-307: non recuperabile, passa al prossimo sync
                break
            if not _is_busy(resp):
                # Successo (o errore non-busy): procedi
                break
            # 307 = busy: il comando precedente è ancora in volo.
            # Aspetta con backoff crescente — più lungo dei vecchi 1.5s perché
            # il server impiega tempo a liberarsi senza la chiamata /done.
            delay = 3.0 + attempt * 2.0
            logger.info("Network %s busy, retry in %.1fs (attempt %d/6)", sync.name, delay, attempt + 1)
            await asyncio.sleep(delay)

    # Livello 2 — motion detection per ogni camera (necessario per le Mini).
    tasks = [_raw_arm_camera(blink, cam, value) for cam in blink.cameras.values()]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Il server propaga lo stato con ritardo: attendi prima di rileggere.
    await asyncio.sleep(3.0)
    await blink.refresh(force=True)

    # Stato network effettivo dopo il comando.
    armed_states = [s.arm for s in blink.sync.values() if s.arm is not None]
    if not armed_states:
        # Sistema solo-Mini: non possiamo verificare dallo stato sync.
        return True
    return any(armed_states) if value else not any(armed_states)


@router.post("/system/arm")
async def arm_system(blink: Blink = Depends(require_blink)):
    """Arma tutte le telecamere. 409 se il sistema Blink resta occupato."""
    ok = await _set_all_cameras_arm(blink, True)
    if not ok:
        raise HTTPException(status_code=409, detail="Sistema Blink occupato, riprova tra poco")
    return {"success": True, "armed": True}


@router.post("/system/disarm")
async def disarm_system(blink: Blink = Depends(require_blink)):
    """Disarma tutte le telecamere. 409 se il sistema Blink resta occupato."""
    ok = await _set_all_cameras_arm(blink, False)
    if not ok:
        raise HTTPException(status_code=409, detail="Sistema Blink occupato, riprova tra poco")
    return {"success": True, "armed": False}


@router.get("/sync")
async def get_sync_modules(blink: Blink = Depends(require_blink)):
    """Lista i moduli sync."""
    modules = []
    for name, sync in blink.sync.items():
        modules.append({
            "name": name,
            "id": sync.sync_id,
            "armed": sync.arm,
            "cameras": list(sync.cameras.keys()),
        })
    return {"sync_modules": modules}
