"""WebSocket endpoint per notifiche eventi in background.

Fa polling interno delle camere ogni 15s e invia un messaggio JSON al client
quando rileva un nuovo movimento (motion_detected passa da false a true).
Mantiene la connessione viva con ping/pong.
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from local_auth import verify_ws_token
from state import state

router = APIRouter()
logger = logging.getLogger("blink.events")

# Intervallo di polling interno (secondi)
_POLL_INTERVAL = 15
# Intervallo ping per tenere viva la connessione (secondi)
_PING_INTERVAL = 30


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """Stream di eventi motion via WebSocket per notifiche in background."""
    await websocket.accept()

    # Verifica token anti-CSRF
    if not verify_ws_token(websocket):
        await websocket.close(code=1008, reason="Token non valido")
        return

    blink = state.blink
    if not blink or not blink.available:
        await websocket.close(code=1008, reason="Non connesso")
        return

    # Stato iniziale: registra quali camere hanno già motion attivo
    # così non notifichiamo movimenti pre-esistenti alla connessione.
    prev_motion: set[str] = set()
    try:
        for name, camera in blink.cameras.items():
            if camera.motion_detected:
                prev_motion.add(name)
    except Exception:
        pass

    async def poll_loop():
        """Polling interno: refresh camere e rileva nuovi movimenti."""
        nonlocal prev_motion

        while True:
            await asyncio.sleep(_POLL_INTERVAL)

            blink = state.blink
            if not blink or not blink.available:
                continue

            try:
                await blink.refresh()
            except Exception as e:
                logger.debug("Refresh fallito in events poll: %s", e)
                continue

            # Rileva nuovi movimenti
            current_motion: set[str] = set()
            for name, camera in blink.cameras.items():
                if camera.motion_detected:
                    current_motion.add(name)

            # Invia evento per ogni camera che passa da non-motion a motion
            for name in current_motion:
                if name not in prev_motion:
                    event = {
                        "type": "motion",
                        "camera": name,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        await websocket.send_json(event)
                    except Exception:
                        return  # Connessione persa

            prev_motion = current_motion

    async def ping_loop():
        """Invia ping periodico per mantenere la connessione viva."""
        while True:
            await asyncio.sleep(_PING_INTERVAL)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                return

    async def receive_loop():
        """Riceve messaggi dal client (pong, close)."""
        while True:
            try:
                msg = await websocket.receive_text()
                # Il client può inviare "pong" o qualsiasi messaggio; li ignoriamo.
            except (WebSocketDisconnect, Exception):
                return

    # Avvia le tre coroutine in parallelo; quando una termina, cancelliamo le altre.
    poll_task = asyncio.create_task(poll_loop())
    ping_task = asyncio.create_task(ping_loop())
    recv_task = asyncio.create_task(receive_loop())

    try:
        done, pending = await asyncio.wait(
            [poll_task, ping_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        for task in [poll_task, ping_task, recv_task]:
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
