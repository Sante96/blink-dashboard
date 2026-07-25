"""WebSocket livestream: proxy IMMIS di blinkpy -> ffmpeg -> fMP4 -> browser."""

import asyncio
import subprocess

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from local_auth import verify_ws_token
from state import state

router = APIRouter()

# Timeout (secondi) per la read da ffmpeg stdout.
# Il primo chunk può impiegare parecchio (negoziazione IMMIS, startup encoder):
# le camere a batteria con segnale debole possono arrivare a 30-40s.
# Una volta avviato il flusso, se non arriva nulla entro il timeout ongoing
# consideriamo il feed morto (sessione scaduta, camera disconnessa).
_INITIAL_READ_TIMEOUT = 45.0
_ONGOING_READ_TIMEOUT = 15.0

# Lock per camera: serializza open/close dello stream così un close/reopen
# veloce (React StrictMode, doppio click) non produce la race dove il primo
# cleanup deregistra lo stream del secondo.
_stream_locks: dict[str, asyncio.Lock] = {}


def _lock_for(camera_name: str) -> asyncio.Lock:
    lock = _stream_locks.get(camera_name)
    if lock is None:
        lock = asyncio.Lock()
        _stream_locks[camera_name] = lock
    return lock


@router.websocket("/ws/cameras/{camera_name}/live")
async def websocket_livestream(websocket: WebSocket, camera_name: str):
    """Streamma il liveview della camera al browser via WebSocket."""
    await websocket.accept()

    # Verifica token anti-CSRF (CORS non protegge WebSocket).
    if not verify_ws_token(websocket):
        await websocket.close(code=1008, reason="Token non valido")
        return

    blink = state.blink
    if not blink or not blink.available:
        await websocket.close(code=1008, reason="Non connesso")
        return

    if camera_name not in blink.cameras:
        await websocket.close(code=1008, reason="Telecamera non trovata")
        return

    camera = blink.cameras[camera_name]

    # init_livestream crea un BlinkLiveStream che apre un proxy TCP locale
    try:
        livestream = await camera.init_livestream()
    except NotImplementedError:
        await websocket.close(code=1008, reason="Livestream non supportato")
        return
    except Exception as e:
        await websocket.close(code=1008, reason=f"Errore liveview: {e}")
        return

    # Avvia il proxy TCP locale (in ascolto) PRIMA del feed da Blink
    await livestream.start()
    sockname = livestream.socket.getsockname()
    local_url = f"tcp://{sockname[0]}:{sockname[1]}"

    # ffmpeg si collega subito al proxy e si registra come client: così
    # riceve l'SPS/PPS (parametri H264) dal primissimo pacchetto, evitando
    # gli errori "non-existing PPS 0 referenced".
    ffmpeg_proc: subprocess.Popen | None = None
    feed_task: asyncio.Task | None = None

    try:
        ffmpeg_proc = subprocess.Popen(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel", "error",
                "-fflags", "+genpts",
                "-f", "mpegts",
                "-i", local_url,
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c:v", "copy",
                "-c:a", "aac",
                "-ac", "1",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "-f", "mp4",
                "pipe:1",
            ],
            stdout=subprocess.PIPE,
        )
    except (FileNotFoundError, OSError):
        # ffmpeg non installato o non nel PATH
        livestream.stop()
        await websocket.close(code=1011, reason="ffmpeg non disponibile")
        return

    # Breve attesa per far registrare la connessione TCP di ffmpeg come client
    await asyncio.sleep(0.3)

    # Ora avvia il feed: l'auth verso Blink dà tempo a ffmpeg di essere pronto,
    # e i primi pacchetti (SPS/PPS inclusi) vengono inoltrati a ffmpeg.
    feed_task = asyncio.create_task(livestream.feed())

    # Registra lo stream attivo così il comando luce può interromperlo.
    # Usa un ID univoco per evitare che il cleanup di una sessione precedente
    # deregistri questa (race condition su close/reopen veloce).
    stream_id = id(livestream)
    state.active_streams[camera_name] = livestream

    assert ffmpeg_proc.stdout is not None

    try:
        loop = asyncio.get_event_loop()
        first_chunk = True
        while True:
            timeout = _INITIAL_READ_TIMEOUT if first_chunk else _ONGOING_READ_TIMEOUT
            data = await asyncio.wait_for(
                loop.run_in_executor(None, ffmpeg_proc.stdout.read, 8192),
                timeout=timeout,
            )
            if not data:
                break
            first_chunk = False
            await websocket.send_bytes(data)
    except asyncio.TimeoutError:
        # Feed morto: ffmpeg non produce più dati (IMMIS disconnesso, camera offline)
        pass
    except (WebSocketDisconnect, ConnectionError, RuntimeError):
        # Client disconnesso: cleanup normale
        pass
    except Exception:
        # Errore inatteso: log e cleanup
        pass
    finally:
        # Deregistra SOLO se siamo ancora noi il proprietario dello slot.
        if state.active_streams.get(camera_name) is livestream:
            state.active_streams.pop(camera_name, None)

        # Termina ffmpeg per primo: la chiusura di stdout sblocca eventuali read
        # ancora in coda nell'executor.
        if ffmpeg_proc:
            ffmpeg_proc.terminate()
            try:
                ffmpeg_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                ffmpeg_proc.kill()
                ffmpeg_proc.wait()

        # Attendi il feed task per dare a blinkpy la possibilità di chiamare
        # request_command_done (libera il device lato server).
        if feed_task and not feed_task.done():
            # Diamo un po' di tempo per il cleanup interno, poi cancelliamo.
            try:
                await asyncio.wait_for(asyncio.shield(feed_task), timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
                feed_task.cancel()
                try:
                    await feed_task
                except (asyncio.CancelledError, Exception):
                    pass

        # stop() chiude il socket del proxy locale.
        livestream.stop()
