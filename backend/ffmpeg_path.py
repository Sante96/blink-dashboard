"""
Risoluzione del path di ffmpeg.

In sviluppo ffmpeg sta nel PATH di sistema. Nell'app distribuita è incluso
accanto a backend.exe (stessa cartella onedir di PyInstaller): lo cerchiamo
prima lì, poi nel PATH come fallback.
"""

import os
import shutil
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
