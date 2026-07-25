"""
Endpoint per i media cloud (clip di movimento / eventi).

Blink salva nel cloud i clip registrati agli eventi di movimento. L'API
`/media/changed` li restituisce paginati; ogni item contiene il path del .mp4
(`media`), il thumbnail, il device e il timestamp. Qui li normalizziamo per il
frontend, proxiamo video e thumbnail attraverso la sessione autenticata (come
già facciamo per le thumbnail delle camere), e permettiamo l'eliminazione dal
cloud.
"""

import asyncio
import hashlib
import json
import os
import subprocess
import tempfile
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from blinkpy.blinkpy import Blink
from blinkpy import api

from config import config
from state import require_blink

router = APIRouter(prefix="/media")

# Cache dei video uniti (griglia multi-camera), per non rifare il merge ffmpeg
# a ogni apertura dello stesso cluster.
_MERGE_CACHE_DIR = config.storage.temp_dir or os.path.join(tempfile.gettempdir(), "blink_merge")
os.makedirs(_MERGE_CACHE_DIR, exist_ok=True)

# Limite cache in byte (0 = illimitato).
_MAX_CACHE_BYTES = config.storage.max_cache_mb * 1024 * 1024

# Lock per-chiave: due richieste concorrenti sullo stesso cluster (es. il doppio
# mount di React StrictMode) devono serializzarsi, così la seconda trova il
# risultato già in cache invece di correre sugli stessi file temporanei.
_merge_locks: dict[str, asyncio.Lock] = {}


def _lock_for(key: str) -> asyncio.Lock:
    lock = _merge_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _merge_locks[key] = lock
    return lock


def _evict_cache() -> None:
    """Rimuove i file più vecchi dalla cache se supera _MAX_CACHE_BYTES (LRU)."""
    if _MAX_CACHE_BYTES <= 0:
        return
    try:
        entries = []
        total = 0
        for name in os.listdir(_MERGE_CACHE_DIR):
            path = os.path.join(_MERGE_CACHE_DIR, name)
            if not os.path.isfile(path):
                continue
            stat = os.stat(path)
            entries.append((stat.st_mtime, stat.st_size, path))
            total += stat.st_size

        if total <= _MAX_CACHE_BYTES:
            return

        # Ordina per mtime ascendente (più vecchi prima) e rimuovi fino a rientrare.
        entries.sort()
        for _mtime, size, path in entries:
            if total <= _MAX_CACHE_BYTES:
                break
            try:
                os.remove(path)
                total -= size
            except OSError:
                pass
    except OSError:
        pass


class DeleteRequest(BaseModel):
    ids: list[int]


class MergeRequest(BaseModel):
    paths: list[str]  # path relativi dei .mp4 da unire (in ordine)


def _normalize_item(item: dict) -> dict:
    """Estrae i campi utili da un item grezzo di /media/changed."""
    return {
        "id": item.get("id"),
        "created_at": item.get("created_at"),
        "device_name": item.get("device_name"),
        "device_id": item.get("device_id"),
        "network_id": item.get("network_id"),
        "network_name": item.get("network_name"),
        "type": item.get("type"),
        "source": item.get("source"),
        "deleted": item.get("deleted", False),
        "watched": item.get("watched", False),
        "media": item.get("media"),
        "thumbnail": item.get("thumbnail"),
        # Collegamento multi-device: l'app mobile unisce in un'unica card gli
        # eventi correlati registrati insieme su più telecamere.
        "additional_devices": item.get("additional_devices") or [],
    }


@router.get("")
async def list_media(
    page: int = 1,
    pages: int = 3,
    blink: Blink = Depends(require_blink),
):
    """
    Lista i clip cloud (eventi di movimento), dai più recenti.

    Scorre da `page` per `pages` pagine (~25 item ciascuna). `since` è implicito:
    l'API restituisce i media modificati dopo l'epoch 0 se non filtrato, quindi
    partiamo dall'inizio dei tempi e ci limitiamo alle pagine richieste.
    """
    items: list[dict] = []
    for p in range(page, page + pages):
        try:
            # since=0 → tutti i media; l'API ordina dai più recenti per pagina.
            response = await api.request_videos(blink, time=0, page=p)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

        # Auth.query ritorna None su errori di rete: segnala al frontend.
        if response is None:
            raise HTTPException(status_code=502, detail="Nessuna risposta dal server Blink")

        media = response.get("media") if isinstance(response, dict) else None
        if not media:
            break
        items.extend(_normalize_item(m) for m in media if not m.get("deleted"))

    # Ordina per timestamp discendente (più recenti prima).
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"events": items, "page": page, "pages": pages}


async def _proxy(blink: Blink, path: str, default_type: str):
    """Proxa un asset Blink (video o thumbnail) via sessione autenticata."""
    if not path:
        raise HTTPException(status_code=404, detail="Media non disponibile")
    # I path tornati dall'API sono relativi al base_url.
    url = path if path.startswith("http") else f"{blink.urls.base_url}{path}"
    try:
        async with blink.auth.session.get(url, headers=blink.auth.header) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=502, detail=f"Errore fetch media ({resp.status})")
            data = await resp.read()
            content_type = resp.headers.get("Content-Type", default_type)
            return Response(content=data, media_type=content_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# I path video/thumbnail arrivano dall'item di /media/changed e vengono passati
# dal frontend come query param `path`, così evitiamo una seconda chiamata di
# lookup. Validiamo che sia un path relativo Blink per non trasformarci in un
# open proxy verso host arbitrari.
def _validate_path(path: str) -> str:
    if not path:
        raise HTTPException(status_code=400, detail="path mancante")
    if not path.startswith("/"):
        raise HTTPException(status_code=400, detail="path non valido")
    return path


_clip_locks: dict[str, asyncio.Lock] = {}


async def _cache_clip(blink: Blink, path: str) -> str:
    """
    Scarica il clip nel disco (una volta) e ne restituisce il path locale.

    Il CDN Blink ignora l'header Range e risponde sempre con l'intero file, così
    un seek nel player rimanderebbe il video a capo. Servendo invece dalla cache
    locale via FileResponse, Starlette gestisce il Range (206) e lo scrubbing
    funziona. I clip sono piccoli (~1MB), quindi la cache è economica.
    """
    key = hashlib.sha1(path.encode()).hexdigest()[:16]
    local = os.path.join(_MERGE_CACHE_DIR, f"clip_{key}.mp4")

    lock = _clip_locks.setdefault(key, asyncio.Lock())
    async with lock:
        if not os.path.exists(local):
            url = path if path.startswith("http") else f"{blink.urls.base_url}{path}"
            async with blink.auth.session.get(url, headers=blink.auth.header) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=502, detail=f"Errore fetch media ({resp.status})")
                data = await resp.read()
            with open(local, "wb") as f:
                f.write(data)
            _evict_cache()
    return local


@router.get("/video")
async def get_media_video(path: str, blink: Blink = Depends(require_blink)):
    """
    Proxa il file .mp4 del clip. Cacha su disco e serve via FileResponse, che
    supporta il Range (seek) nativamente — cosa che il CDN Blink non fa.
    """
    local = await _cache_clip(blink, _validate_path(path))
    return FileResponse(local, media_type="video/mp4")


@router.get("/thumbnail")
async def get_media_thumbnail(path: str, blink: Blink = Depends(require_blink)):
    """Proxa il thumbnail del clip (path relativo passato dal frontend)."""
    return await _proxy(blink, _validate_path(path), "image/jpeg")


async def _download_clip(blink: Blink, path: str, dest: str) -> None:
    """Scarica un singolo clip dal cloud sul filesystem locale."""
    url = f"{blink.urls.base_url}{path}"
    async with blink.auth.session.get(url, headers=blink.auth.header) as resp:
        if resp.status != 200:
            raise HTTPException(status_code=502, detail=f"Download clip fallito ({resp.status})")
        data = await resp.read()
    with open(dest, "wb") as f:
        f.write(data)


def _grid_dims(n: int) -> tuple[int, int]:
    """Colonne/righe per una griglia il più quadrata possibile per n clip."""
    if n <= 1:
        return 1, 1
    if n == 2:
        return 2, 1
    if n <= 4:
        return 2, 2
    if n <= 6:
        return 3, 2
    if n <= 9:
        return 3, 3
    cols = 4
    rows = (n + cols - 1) // cols
    return cols, rows


async def _merge_clips(clip_paths: list[str], out_path: str) -> None:
    """
    Unisce più clip in un'unica griglia affiancata (come l'app mobile), usando
    ffmpeg xstack. Ogni cella è normalizzata a 640x360; le durate vengono
    pareggiate riempiendo con l'ultimo frame (tpad) così i clip più corti non
    spariscono a metà video.
    """
    n = len(clip_paths)
    cols, rows = _grid_dims(n)
    cell_w, cell_h = 640, 360

    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", p]

    # Normalizza ogni input: scala + pad a cella fissa, congela l'ultimo frame.
    filters = []
    for i in range(n):
        filters.append(
            f"[{i}:v]scale={cell_w}:{cell_h}:force_original_aspect_ratio=decrease,"
            f"pad={cell_w}:{cell_h}:(ow-iw)/2:(oh-ih)/2,setsar=1,"
            f"tpad=stop_mode=clone:stop_duration=30[v{i}]"
        )

    # Layout xstack: posizione x|y di ogni cella nella griglia.
    layout_parts = []
    for i in range(n):
        c = i % cols
        r = i // cols
        x = "+".join(["0"] + [f"{cell_w}"] * c) if c else "0"
        y = "+".join(["0"] + [f"{cell_h}"] * r) if r else "0"
        layout_parts.append(f"{x}_{y}")
    layout = "|".join(layout_parts)

    stack_inputs = "".join(f"[v{i}]" for i in range(n))
    # Le celle vuote della griglia (se n < cols*rows) restano nere: xstack
    # richiede esattamente cols*rows input, quindi limitiamo la griglia a n
    # celle usando fill. Con grid non-pieno usiamo xstack con inputs=n e layout.
    filters.append(
        f"{stack_inputs}xstack=inputs={n}:layout={layout}:fill=black[out]"
    )

    filter_complex = ";".join(filters)

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        # Prendi l'audio dal primo clip (se presente).
        "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac",
        "-shortest",
        "-movflags", "+faststart",
        out_path,
    ]

    # Nota: su Windows l'event loop di uvicorn è un SelectorEventLoop, che non
    # supporta i subprocess async (create_subprocess_exec -> NotImplementedError).
    # Usiamo quindi subprocess.run sincrono in un thread separato.
    def _run() -> subprocess.CompletedProcess:
        return subprocess.run(cmd, capture_output=True)

    proc = await asyncio.to_thread(_run)
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Merge ffmpeg fallito: {proc.stderr.decode(errors='ignore')[:300]}",
        )


@router.post("/merge")
async def merge_media(req: MergeRequest, blink: Blink = Depends(require_blink)):
    """
    Unisce i clip di un cluster multi-camera in un unico video a griglia.

    Restituisce l'MP4 risultante. Il risultato è cachato su disco per chiave
    derivata dai path, così riaperture successive sono immediate.
    """
    paths = [_validate_path(p) for p in req.paths]
    if len(paths) < 2:
        raise HTTPException(status_code=400, detail="Servono almeno 2 clip")

    key = hashlib.sha1("|".join(paths).encode()).hexdigest()[:16]
    out_path = os.path.join(_MERGE_CACHE_DIR, f"{key}.mp4")

    # Serializza le richieste sullo stesso cluster: la prima produce il file, le
    # altre lo trovano già in cache uscendo subito dal blocco protetto.
    async with _lock_for(key):
        if not os.path.exists(out_path):
            tmp_dir = os.path.join(_MERGE_CACHE_DIR, key)
            os.makedirs(tmp_dir, exist_ok=True)
            try:
                # Scarica i clip in parallelo.
                local_paths = [os.path.join(tmp_dir, f"{i}.mp4") for i in range(len(paths))]
                await asyncio.gather(
                    *(_download_clip(blink, p, lp) for p, lp in zip(paths, local_paths))
                )
                await _merge_clips(local_paths, out_path)
                _evict_cache()
            finally:
                # Pulisci i clip sorgente, tieni solo il risultato.
                for i in range(len(paths)):
                    fp = os.path.join(tmp_dir, f"{i}.mp4")
                    if os.path.exists(fp):
                        os.remove(fp)
                if os.path.isdir(tmp_dir):
                    try:
                        os.rmdir(tmp_dir)
                    except OSError:
                        pass

    return FileResponse(out_path, media_type="video/mp4", filename=f"{key}.mp4")


@router.post("/delete")
async def delete_media(req: DeleteRequest, blink: Blink = Depends(require_blink)):
    """
    Elimina uno o più clip dal cloud Blink.

    Endpoint ufficiale: POST /api/v1/accounts/{account_id}/media/delete
    con body JSON {"media_list": [id, ...]}.
    """
    if not req.ids:
        raise HTTPException(status_code=400, detail="Nessun id fornito")
    url = f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}/media/delete"
    # http_post con json=False accetta un body già serializzato come stringa:
    # il dict passato come `data=` verrebbe form-encoded da aiohttp, che è
    # sbagliato. Serializziamo manualmente e passiamo json=False così blinkpy
    # invia il body come-è con il Content-Type: application/json dell'header auth.
    body = json.dumps({"media_list": req.ids})
    try:
        resp = await api.http_post(blink, url, data=body, json=False)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    # Con json=False, http_post ritorna il dict parsato o None su errore di rete.
    if resp is None:
        raise HTTPException(status_code=502, detail="Nessuna risposta dal server Blink")
    return {"success": True, "deleted": req.ids}
