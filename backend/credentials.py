"""
Salvataggio e caricamento delle credenziali Blink.

- File in %APPDATA%/BlinkDashboard (path stabile anche da app impacchettata).
- Token cifrati a riposo con la DPAPI di Windows (CryptProtectData): la chiave
  è legata all'account utente Windows, niente segreti da gestire.
- La password NON viene salvata: dopo il primo login bastano i token OAuth
  (token + refresh_token) per rinnovare la sessione.
"""

import os
import json
import ctypes
from ctypes import wintypes

APP_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "BlinkDashboard")
CREDENTIALS_FILE = os.path.join(APP_DIR, "credentials.enc")

# Campi sensibili da non persistere mai su disco.
_DROP_KEYS = ("password",)


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _blob(data: bytes) -> _DataBlob:
    buf = ctypes.create_string_buffer(data, len(data))
    return _DataBlob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))


def _blob_to_bytes(blob: _DataBlob) -> bytes:
    raw = ctypes.string_at(blob.pbData, blob.cbData)
    ctypes.windll.kernel32.LocalFree(blob.pbData)
    return raw


def _dpapi_encrypt(data: bytes) -> bytes:
    out = _DataBlob()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(_blob(data)), None, None, None, None, 0, ctypes.byref(out)
    ):
        raise OSError("CryptProtectData fallita")
    return _blob_to_bytes(out)


def _dpapi_decrypt(data: bytes) -> bytes:
    out = _DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(_blob(data)), None, None, None, None, 0, ctypes.byref(out)
    ):
        raise OSError("CryptUnprotectData fallita")
    return _blob_to_bytes(out)


def save_credentials(login_data: dict) -> None:
    """Cifra e salva i dati di login, rimuovendo i campi sensibili."""
    safe = {k: v for k, v in login_data.items() if k not in _DROP_KEYS}
    os.makedirs(APP_DIR, exist_ok=True)
    encrypted = _dpapi_encrypt(json.dumps(safe).encode("utf-8"))
    with open(CREDENTIALS_FILE, "wb") as f:
        f.write(encrypted)


def load_credentials() -> dict | None:
    """Carica e decifra le credenziali salvate, oppure None se assenti/illeggibili."""
    if not os.path.exists(CREDENTIALS_FILE):
        return None
    try:
        with open(CREDENTIALS_FILE, "rb") as f:
            encrypted = f.read()
        return json.loads(_dpapi_decrypt(encrypted).decode("utf-8"))
    except (OSError, ValueError):
        return None


def delete_credentials() -> None:
    """Elimina il file delle credenziali (logout)."""
    if os.path.exists(CREDENTIALS_FILE):
        os.remove(CREDENTIALS_FILE)
