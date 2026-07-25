"""Endpoint per le telecamere: lista, thumbnail, impostazioni, azioni, luce."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from blinkpy.blinkpy import Blink
from blinkpy import api

import camera_settings
from state import state, require_blink, require_camera

router = APIRouter(prefix="/cameras")


class SettingsUpdate(BaseModel):
    changes: dict


def _effective_armed(camera) -> bool:
    """
    Stato "armato" effettivo di una camera (registra davvero eventi?).

    Una camera collegata a un sync module registra solo se il network è armato
    E la sua motion detection è attiva. Le Mini davvero standalone (sync senza
    stato di arm) dipendono solo dalla motion detection.
    """
    motion = bool(camera.motion_enabled)
    sync = getattr(camera, "sync", None)
    sync_arm = getattr(sync, "arm", None) if sync else None
    if sync_arm is None:
        # Nessun network armabile: conta solo la motion detection della camera.
        return motion
    return bool(sync_arm) and motion


@router.get("")
async def get_cameras(blink: Blink = Depends(require_blink)):
    """Lista tutte le telecamere."""
    await blink.refresh()
    cameras = []

    for name, camera in blink.cameras.items():
        product_type = camera.product_type
        last_motion = getattr(camera, "last_motion", None)
        cameras.append({
            "name": name,
            "id": camera.camera_id,
            "product_type": product_type,
            # Stato "armato" EFFETTIVO (registra eventi): una camera sotto un
            # sync module registra solo se il network è armato E la sua motion
            # detection è attiva. Le Mini standalone (sync senza arm) dipendono
            # solo dalla motion detection. Vedi routers/system.py.
            "armed": _effective_armed(camera),
            "motion_detected": camera.motion_detected,
            "temperature": getattr(camera, "temperature", None),
            "battery": getattr(camera, "battery", None),
            "wifi_strength": getattr(camera, "wifi_strength", None),
            "thumbnail": camera.thumbnail,
            "last_motion": str(last_motion) if last_motion else None,
            "serial": getattr(camera, "serial", None),
            "firmware": getattr(camera, "version", None),
            # Capabilities per mostrare/nascondere i controlli lato frontend.
            # La luce integrata è presente solo sulle Blink Mini 2 (chickadee).
            "capabilities": {
                "light": product_type == "chickadee",
            },
        })

    return {"cameras": cameras}


@router.get("/{camera_name}/thumbnail")
async def get_camera_thumbnail(camera_name: str, blink: Blink = Depends(require_blink)):
    """Proxy il thumbnail della telecamera attraverso la sessione autenticata."""
    camera = require_camera(blink, camera_name)
    url = camera.thumbnail
    if not url:
        raise HTTPException(status_code=404, detail="Thumbnail non disponibile")

    try:
        async with blink.auth.session.get(url, headers=blink.auth.header) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=502, detail="Errore fetch thumbnail")
            image_data = await resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return Response(content=image_data, media_type=content_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/{camera_name}/settings")
async def get_settings(camera_name: str, blink: Blink = Depends(require_blink)):
    """Impostazioni configurabili (curate) della camera."""
    camera = require_camera(blink, camera_name)
    try:
        return await camera_settings.get_camera_settings(blink, camera)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.patch("/{camera_name}/settings")
async def patch_settings(
    camera_name: str, update: SettingsUpdate, blink: Blink = Depends(require_blink)
):
    """Applica modifiche alle impostazioni della camera."""
    camera = require_camera(blink, camera_name)
    try:
        await camera_settings.update_camera_settings(blink, camera, update.changes)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/{camera_name}/snap")
async def snap_camera(camera_name: str, blink: Blink = Depends(require_blink)):
    """Scatta una nuova foto dalla telecamera."""
    camera = require_camera(blink, camera_name)
    await camera.snap_picture()
    await blink.refresh()
    return {"success": True, "thumbnail": camera.thumbnail}


@router.post("/{camera_name}/arm")
async def arm_camera(camera_name: str, blink: Blink = Depends(require_blink)):
    """
    Attiva la telecamera: abilita la sua motion detection e — se sta dietro un
    sync module disarmato — arma anche il network, altrimenti la camera non
    registrerebbe nulla nonostante la motion detection attiva.
    """
    camera = require_camera(blink, camera_name)
    sync = getattr(camera, "sync", None)
    if sync is not None and getattr(sync, "arm", None) is False:
        await sync.async_arm(True)
    await camera.async_arm(True)
    return {"success": True, "armed": True}


@router.post("/{camera_name}/disarm")
async def disarm_camera(camera_name: str, blink: Blink = Depends(require_blink)):
    """
    Disattiva la telecamera disabilitando solo la sua motion detection. Non
    tocca il network (le altre camere sotto lo stesso sync restano attive).
    """
    camera = require_camera(blink, camera_name)
    await camera.async_arm(False)
    return {"success": True, "armed": False}


# --- Luce integrata (solo Blink Mini 2) ---


async def _read_light_status(blink: Blink, camera) -> bool | None:
    """
    Legge lo stato reale della luce dal config della camera (Mini 2 / owl).

    Ritorna True/False, oppure None se non leggibile (device occupato o non owl).
    """
    url = (
        f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}"
        f"/networks/{camera.network_id}/owls/{camera.camera_id}/config"
    )
    try:
        cfg = await api.http_get(blink, url)
        if isinstance(cfg, dict):
            status = cfg.get("light_status")
            if status in ("on", "off"):
                return status == "on"
    except Exception:
        pass
    return None


async def _set_camera_light(blink: Blink, camera, on: bool) -> None:
    """
    Accende/spegne la luce integrata della camera (Blink Mini 2 / owl).

    Usa il comando REST `/owls/{id}/lights/{on|off}`. Se c'è un liveview attivo
    lo interrompe brevemente (il frontend riconnette automaticamente), perché il
    server Blink rifiuta comandi REST mentre il device è occupato dallo stream.
    """
    action = "on" if on else "off"
    url = (
        f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}"
        f"/networks/{camera.network_id}/owls/{camera.camera_id}/lights/{action}"
    )

    # Se c'è un liveview attivo per questa camera, fermalo prima del comando.
    livestream = state.active_streams.get(camera.name)
    if livestream:
        livestream.stop()
        await asyncio.sleep(2)

    # Invia il comando (con retry in caso il device non si sia ancora liberato)
    for _ in range(5):
        last = await api.http_post(blink, url)
        if last is None:
            # Rete giù: non mascherare come successo.
            raise HTTPException(status_code=502, detail="Nessuna risposta dal server Blink")
        if isinstance(last, dict) and last.get("code") == 307:
            await asyncio.sleep(2)
            continue
        # Comando accettato — attendi che il device si liberi prima
        # che il frontend riconnetta il liveview
        await asyncio.sleep(1.5)
        return
    raise HTTPException(status_code=409, detail="Dispositivo occupato, riprova")


@router.get("/{camera_name}/light")
async def get_light(camera_name: str, blink: Blink = Depends(require_blink)):
    """Legge lo stato reale della luce dal device."""
    camera = require_camera(blink, camera_name)
    status = await _read_light_status(blink, camera)
    return {"light": status}


@router.post("/{camera_name}/light/on")
async def light_on(camera_name: str, blink: Blink = Depends(require_blink)):
    """Accende la luce della telecamera."""
    camera = require_camera(blink, camera_name)
    await _set_camera_light(blink, camera, True)
    real = await _read_light_status(blink, camera)
    return {"success": True, "light": real if real is not None else True}


@router.post("/{camera_name}/light/off")
async def light_off(camera_name: str, blink: Blink = Depends(require_blink)):
    """Spegne la luce della telecamera."""
    camera = require_camera(blink, camera_name)
    await _set_camera_light(blink, camera, False)
    real = await _read_light_status(blink, camera)
    return {"success": True, "light": real if real is not None else False}
