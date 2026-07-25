"""
Risoluzione del path di ffmpeg.

In sviluppo ffmpeg sta nel PATH di sistema. Nell'app distribuita è incluso
accanto a backend.exe (stessa cartella onedir di PyInstaller): lo cerchiamo
prima lì, poi nel PATH come fallback.
"""

import os
import shutil
import subprocess
import sys


def get_ffmpeg() -> str:
    """Ritorna il path di ffmpeg (bundled se presente, altrimenti dal PATH)."""
    # PyInstaller: sys.frozen è True e l'exe sta in sys.executable.
    if getattr(sys, "frozen", False):
        bundled = os.path.join(os.path.dirname(sys.executable), "ffmpeg.exe")
        if os.path.exists(bundled):
            return bundled

    # Sviluppo (o bundled mancante): usa il PATH.
    found = shutil.which("ffmpeg")
    if found:
        return found

    # Ultimo tentativo: nome puro (fallirà con FileNotFoundError chiaro).
    return "ffmpeg"


# Flag Windows per non aprire una finestra console a ogni lancio di ffmpeg.
# 0 su altri OS (nessun effetto).
NO_WINDOW_FLAGS = 0x0800_0000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW


def popen_kwargs() -> dict:
    """kwargs comuni per subprocess.Popen/run di ffmpeg: nasconde la console
    su Windows (l'app è --noconsole, altrimenti spunta un cmd a ogni stream)."""
    return {"creationflags": NO_WINDOW_FLAGS} if sys.platform == "win32" else {}
