"""
Monkey-patch per blinkpy che vanno applicati a runtime, così sopravvivono
a `uv sync` senza dover modificare i file dentro .venv.

Da rimuovere quando le rispettive fix entrano nella versione pinnata di blinkpy.
"""

import logging
import re
from blinkpy import api
from blinkpy.auth import Auth
from blinkpy.helpers.constants import OAUTH_SIGNIN_URL

_LOGGER = logging.getLogger(__name__)

# Build dell'app Blink che gli endpoint liveview/owls richiedono. Senza questo
# header rispondono "An app update is required" (HTTP 426). blinkpy attualmente
# non lo invia (è commentato in Auth.header).
APP_BUILD_HEADER = "ANDROID_29292032"

# "Insufficient data ...: 0 bytes" = il server ha chiuso pulito a fine sessione
# (EOF netto), non è un errore. Con N>0 byte invece è un frame troncato davvero.
_CLEAN_EOF_RE = re.compile(r"Insufficient data for (?:header|payload): 0 bytes")


class _LivestreamEofFilter(logging.Filter):
    """Sopprime la chiusura pulita del livestream (0 byte); tiene i troncamenti reali (N>0)."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Ritornare False scarta il record: lo facciamo solo per l'EOF pulito.
        return not (
            record.levelno == logging.WARNING
            and _CLEAN_EOF_RE.search(record.getMessage())
        )


class RateLimitError(Exception):
    """Sollevata quando i server Blink limitano l'invio dei codici 2FA."""

    def __init__(self, retry_after_secs: int = 600):
        self.retry_after_secs = retry_after_secs
        super().__init__(
            f"Rate limit 2FA superato. Riprova tra {retry_after_secs} secondi."
        )


async def _oauth_signin_with_202(auth, email, password, csrf_token):
    """
    Variante di api.oauth_signin che riconosce anche la risposta 202.

    Il branch di blinkpy che usiamo (PR #1232) gestisce il 2FA solo sullo
    status 412, ma i server Blink ora rispondono 202 con i campi tsv_*.
    Questa versione (allineata al branch dev più recente) gestisce entrambi.
    """
    headers = {
        "User-Agent": "blink",
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://api.oauth.blink.com",
        "Referer": OAUTH_SIGNIN_URL,
    }
    data = {
        "username": email,
        "password": password,
        "csrf-token": csrf_token,
    }

    response = await auth.session.post(
        OAUTH_SIGNIN_URL, headers=headers, data=data, allow_redirects=False
    )

    if response.status == 412:
        return "2FA_REQUIRED"

    if response.status == 202:
        try:
            response_json = await response.json()
        except Exception:
            response_json = {}
        if (
            response_json.get("tsv_state")
            or response_json.get("tsv_methods")
            or response_json.get("next_time_in_secs")
        ):
            return "2FA_REQUIRED"

    if response.status == 429:
        # Rate limit 2FA — propaga il tempo d'attesa al chiamante
        try:
            response_json = await response.json()
        except Exception:
            response_json = {}
        wait = response_json.get("next_time_in_secs", 600)
        raise RateLimitError(wait)

    if response.status in [301, 302, 303, 307, 308]:
        return "SUCCESS"

    return None


def _header_with_app_build(self):
    """Variante di Auth.header che include sempre l'header APP-BUILD."""
    if self.token is None:
        return None
    return {
        "APP-BUILD": APP_BUILD_HEADER,
        "Authorization": f"Bearer {self.token}",
        "Content-Type": "application/json",
    }


def _patch_liveview_endpoints():
    """
    Corregge gli endpoint liveview per i vari tipi di camera.

    Il branch di blinkpy che usiamo costruisce URL con versioni API sbagliate
    che i server rifiutano ("An app update is required"):
    - mini/doorbell: usa v1, serve v2
    - default (camere a batteria, es. Outdoor 4 'sedona'): usa v5, serve v6
    """
    patterns = api._CAMERA_ACTION_PATTERNS
    patterns["mini"]["actions"]["liveview"] = {
        "full_path": True,
        "path": (
            "/api/v2/accounts/{account_id}"
            "/networks/{network}/owls/{camera_id}/liveview"
        ),
        "data": {"intent": "liveview", "motion_event_start_time": None},
    }
    patterns["doorbell"]["actions"]["liveview"] = {
        "full_path": True,
        "path": (
            "/api/v2/accounts/{account_id}"
            "/networks/{network}/doorbells/{camera_id}/liveview"
        ),
        "data": {"intent": "liveview", "motion_event_start_time": None},
    }
    patterns["default"]["actions"]["liveview"] = {
        "full_path": True,
        "path": (
            "/api/v6/accounts/{account_id}"
            "/networks/{network}/cameras/{camera_id}/liveview"
        ),
        "data": {"intent": "liveview", "motion_event_start_time": None},
    }


def apply_patches():
    """Applica tutti i monkey-patch a blinkpy."""
    api.oauth_signin = _oauth_signin_with_202
    Auth.header = property(_header_with_app_build)
    _patch_liveview_endpoints()
    logging.getLogger("blinkpy.livestream").addFilter(_LivestreamEofFilter())
    _LOGGER.info(
        "blinkpy patches applicate "
        "(oauth_signin 202, APP-BUILD header, liveview v2, EOF filter)"
    )
