"""
Normalizzazione delle impostazioni camera Blink.

Il config grezzo ha decine di campi (molti diagnostici). Qui definiamo un set
curato di impostazioni utili, con:
- come leggerle dal config (chiave nel JSON)
- il tipo di controllo per il frontend (toggle/select/slider/text)
- le opzioni/limiti
- come scriverle (chiave + endpoint di update)

Gestisce le differenze tra modelli: owl/mini (chickadee) usano un config e un
endpoint diversi dalle camere a batteria (sedona, catalina = "default").
"""

from blinkpy import api


def _is_mini(camera) -> bool:
    """La camera usa il config 'owl' (Blink Mini/Mini 2)."""
    return camera.camera_type == "mini"


async def _get_config(blink, camera) -> dict:
    """Legge il config grezzo della camera, gestendo owl vs default."""
    if _is_mini(camera):
        url = (
            f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}"
            f"/networks/{camera.network_id}/owls/{camera.camera_id}/config"
        )
    else:
        url = f"{blink.urls.base_url}/network/{camera.network_id}/camera/{camera.camera_id}/config"
    cfg = await api.http_get(blink, url)
    # Auth.query ritorna None su errori di rete (timeout, connessione rifiutata):
    # solleviamo un errore chiaro invece di mascherarlo come "config vuoto".
    if cfg is None:
        raise ConnectionError("Impossibile leggere il config della camera (rete non disponibile)")
    if isinstance(cfg, dict) and "camera" in cfg:
        return cfg["camera"][0]
    return cfg if isinstance(cfg, dict) else {}


def _build_settings(camera, cfg: dict) -> list[dict]:
    """
    Costruisce la lista di impostazioni normalizzate dal config grezzo.

    Ogni impostazione: {key, label, type, value, options?, min?, max?, group}
    """
    mini = _is_mini(camera)
    settings: list[dict] = []

    def add(key, label, type_, value, group, **extra):
        if value is None:
            return
        settings.append(
            {"key": key, "label": label, "type": type_, "value": value, "group": group, **extra}
        )

    # --- Generale ---
    add("name", "Nome", "text", cfg.get("name"), "Generale")

    # --- Rilevamento movimento ---
    add(
        "motion_sensitivity",
        "Sensibilità movimento",
        "slider",
        cfg.get("motion_sensitivity"),
        "Rilevamento",
        min=1,
        max=9,
    )

    # --- Video ---
    vq = cfg.get("video_quality")
    vq_opts = cfg.get("video_quality_support") or ["saver", "standard", "best"]
    if vq is not None:
        add(
            "video_quality",
            "Qualità video",
            "select",
            vq,
            "Video",
            options=[{"value": o, "label": o.capitalize()} for o in vq_opts],
        )
    add("record_audio_enable", "Registra audio", "toggle", cfg.get("record_audio_enable"), "Video")

    if mini:
        # --- Impostazioni specifiche Mini ---
        nv = cfg.get("illuminator_enable")
        if nv is not None:
            add(
                "illuminator_enable",
                "Visione notturna",
                "select",
                nv,
                "Video",
                options=[
                    {"value": "off", "label": "Spenta"},
                    {"value": "on", "label": "Sempre accesa"},
                    {"value": "auto", "label": "Automatica"},
                ],
            )
        add("volume_control", "Volume", "slider", cfg.get("volume_control"), "Audio", min=0, max=10)
        add("led_enabled", "LED di stato", "toggle", cfg.get("led_enabled"), "Generale")
    else:
        # --- Impostazioni specifiche camere a batteria (sedona) ---
        add("siren_enable", "Sirena", "toggle", cfg.get("siren_enable"), "Sirena")
        add(
            "video_length",
            "Durata clip (s)",
            "slider",
            cfg.get("video_length"),
            "Video",
            min=5,
            max=60,
        )

    return settings


async def get_camera_settings(blink, camera) -> dict:
    """Restituisce le impostazioni normalizzate + meta della camera."""
    cfg = await _get_config(blink, camera)
    return {
        "name": camera.name,
        "product_type": camera.product_type,
        "settings": _build_settings(camera, cfg),
    }


async def update_camera_settings(blink, camera, changes: dict) -> None:
    """
    Applica le modifiche alle impostazioni.

    `changes` è un dict {key: value}. Le scriviamo nel config della camera
    tramite l'endpoint di update appropriato (owl vs default).
    """
    from json import dumps

    if not changes:
        return

    if _is_mini(camera):
        url = (
            f"{blink.urls.base_url}/api/v1/accounts/{blink.account_id}"
            f"/networks/{camera.network_id}/owls/{camera.camera_id}/config"
        )
    else:
        url = (
            f"{blink.urls.base_url}/network/{camera.network_id}"
            f"/camera/{camera.camera_id}/update"
        )

    resp = await api.http_post(blink, url, data=dumps(changes), json=False)
    if resp is None:
        raise ConnectionError("Impossibile aggiornare le impostazioni (rete non disponibile)")
