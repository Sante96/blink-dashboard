"""
Build script: compila il backend Python in un eseguibile standalone con PyInstaller.

Uso:
    python build_backend.py

Produce: src-tauri/resources/backend/ (cartella onedir con backend.exe + dipendenze)

Requisiti:
    - Python 3.14+ nel PATH (o l'interprete del venv del backend)
    - uv installato (per risolvere le dipendenze)
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND_DIR = ROOT / "backend"
RESOURCES_DIR = ROOT / "src-tauri" / "resources" / "backend"
DIST_DIR = ROOT / "build" / "pyinstaller_dist"
WORK_DIR = ROOT / "build" / "pyinstaller_work"
SPEC_DIR = ROOT / "build"


def run(cmd: list[str], **kwargs) -> None:
    """Esegue un comando, esce se fallisce."""
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        print(f"ERRORE: comando fallito con codice {result.returncode}")
        sys.exit(1)


def main() -> None:
    print("=== Build backend (PyInstaller --onedir) ===\n")

    # 1. Assicura che il venv del backend sia sincronizzato
    print("[1/4] Sincronizzazione dipendenze con uv...")
    run(["uv", "sync"], cwd=str(BACKEND_DIR))

    # 2. Installa PyInstaller nel venv del backend (se non presente)
    print("\n[2/4] Installazione PyInstaller nel venv...")
    run(["uv", "pip", "install", "pyinstaller>=6.0"], cwd=str(BACKEND_DIR))

    # 3. Pulisci la cartella di output precedente
    print("\n[3/4] Pulizia build precedente...")
    if RESOURCES_DIR.exists():
        shutil.rmtree(RESOURCES_DIR)
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)

    # 4. Esegui PyInstaller
    print("\n[4/4] Esecuzione PyInstaller...")

    # Trova il python del venv
    venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        # Fallback per Linux/macOS
        venv_python = BACKEND_DIR / ".venv" / "bin" / "python"
    if not venv_python.exists():
        print("ERRORE: venv del backend non trovato. Esegui 'uv sync' nel backend/")
        sys.exit(1)

    # Raccogli i moduli del backend che PyInstaller deve includere
    hidden_imports = [
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "websockets",
        "websockets.legacy",
        "websockets.legacy.server",
        "multipart",
        "blinkpy",
        "blinkpy.blinkpy",
        "blinkpy.auth",
        "blinkpy.camera",
        "blinkpy.sync_module",
        "blinkpy.helpers.util",
        "aiohttp",
        "aiofiles",
        "dotenv",
        "pydantic",
        "pydantic_core",
    ]

    # File sorgenti del backend da includere come data
    # PyInstaller non segue gli import relativi al di fuori del main script,
    # quindi aggiungiamo tutto come hidden imports e come dati
    backend_modules = [
        "blinkpy_patches",
        "camera_settings",
        "config",
        "credentials",
        "local_auth",
        "state",
        "routers",
        "routers.auth",
        "routers.cameras",
        "routers.events",
        "routers.livestream",
        "routers.media",
        "routers.system",
    ]
    hidden_imports.extend(backend_modules)

    pyinstaller_args = [
        str(venv_python), "-m", "PyInstaller",
        "--noconfirm",
        "--name", "backend",
        "--distpath", str(DIST_DIR),
        "--workpath", str(WORK_DIR),
        "--specpath", str(SPEC_DIR),
        # onedir: startup più veloce, debug più facile
        "--onedir",
        # No console window in release
        "--noconsole",
        # Path di ricerca per i moduli del backend
        "--paths", str(BACKEND_DIR),
    ]

    # Aggiungi hidden imports
    for hi in hidden_imports:
        pyinstaller_args.extend(["--hidden-import", hi])

    # Aggiungi i file .py del backend come dati (per import dinamici)
    # e la cartella routers
    pyinstaller_args.extend([
        "--add-data", f"{BACKEND_DIR / 'routers'}{os.pathsep}routers",
    ])

    # Aggiungi il file config.toml se presente
    config_file = BACKEND_DIR / "config.toml"
    if config_file.exists():
        pyinstaller_args.extend([
            "--add-data", f"{config_file}{os.pathsep}.",
        ])

    # Entry point
    pyinstaller_args.append(str(BACKEND_DIR / "main.py"))

    run(pyinstaller_args)

    # 5. Copia il risultato nella cartella resources di Tauri
    print("\n[OK] Copia risultato in src-tauri/resources/backend/...")
    built_dir = DIST_DIR / "backend"
    if not built_dir.exists():
        print(f"ERRORE: directory di output non trovata: {built_dir}")
        sys.exit(1)

    shutil.copytree(built_dir, RESOURCES_DIR)

    # Verifica che l'exe esista
    exe_path = RESOURCES_DIR / "backend.exe"
    if not exe_path.exists():
        print(f"ERRORE: {exe_path} non trovato!")
        sys.exit(1)

    size_mb = exe_path.stat().st_size / (1024 * 1024)
    print(f"\n=== Build completata! ===")
    print(f"    Exe: {exe_path} ({size_mb:.1f} MB)")
    print(f"    Dir: {RESOURCES_DIR}")
    print(f"\n    Ora puoi eseguire: npm run tauri build")


if __name__ == "__main__":
    main()
