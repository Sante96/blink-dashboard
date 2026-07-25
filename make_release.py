"""
Genera latest.json per l'updater Tauri a partire dalla build corrente.

Uso (dopo `npm run tauri build`):
    python make_release.py

Legge la versione da package.json, trova l'installer .msi.zip e la sua firma
in src-tauri/target/release/bundle/msi/, e scrive build/release/latest.json
+ copia gli artefatti da caricare sulla GitHub Release.

Poi:
    gh release create v<version> build/release/* --title "v<version>" --notes "..."
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
BUNDLE_DIR = ROOT / "src-tauri" / "target" / "release" / "bundle" / "msi"
OUT_DIR = ROOT / "build" / "release"

REPO = "Sante96/blink-dashboard"


def main() -> None:
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]

    # Trova l'artefatto updater (.msi.zip) e la firma (.msi.zip.sig)
    zips = list(BUNDLE_DIR.glob("*.msi.zip"))
    if not zips:
        print(f"ERRORE: nessun .msi.zip in {BUNDLE_DIR} — esegui prima 'npm run tauri build'")
        sys.exit(1)
    zip_path = zips[0]
    sig_path = zip_path.with_suffix(zip_path.suffix + ".sig")
    if not sig_path.exists():
        print(f"ERRORE: firma mancante ({sig_path}) — build senza TAURI_PRIVATE_KEY?")
        sys.exit(1)

    msis = list(BUNDLE_DIR.glob("*.msi"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for f in [zip_path, sig_path, *msis]:
        shutil.copy2(f, OUT_DIR / f.name)

    # GitHub normalizza i nomi degli asset sostituendo gli spazi con punti:
    # l'URL deve usare il nome normalizzato, non quello del file locale.
    asset_name = zip_path.name.replace(" ", ".")

    latest = {
        "version": f"v{version}",
        "notes": f"Blink Dashboard v{version}",
        "pub_date": datetime.now(timezone.utc).isoformat(),
        "platforms": {
            "windows-x86_64": {
                "signature": sig_path.read_text(encoding="utf-8"),
                "url": f"https://github.com/{REPO}/releases/download/v{version}/{asset_name}",
            }
        },
    }
    (OUT_DIR / "latest.json").write_text(json.dumps(latest, indent=2), encoding="utf-8")

    print("=== Release pronta ===")
    for f in sorted(OUT_DIR.iterdir()):
        print(f"    {f.name}")
    print(f"\nCarica tutto con:\n    gh release create v{version} build/release/* --title \"v{version}\"")


if __name__ == "__main__":
    main()
