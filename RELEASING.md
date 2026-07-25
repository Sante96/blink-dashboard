# Come fare una release

## Prerequisiti (una tantum)

1. **Chiave di firma updater** (già generata): `~/.tauri/blink-dashboard.key`
   - La pubblica è embeddata in `tauri.conf.json` → `updater.pubkey`
   - ⚠️ Non perdere la privata: senza, gli utenti non riceveranno più update
2. **Per le release automatiche**: carica i segreti su GitHub
   (Settings → Secrets and variables → Actions):
   - `TAURI_PRIVATE_KEY` = contenuto del file `.key`
   - `TAURI_KEY_PASSWORD` = vuoto (chiave generata senza password)

## Release automatica (consigliata, dalla 0.6.0 in poi)

```powershell
# 1. Bump versione in TRE punti (devono combaciare):
#    - package.json            "version"
#    - src-tauri/Cargo.toml    version
#    - src/lib/changelog.ts    nuova entry in cima
#    (tauri.conf.json legge da package.json, non va toccato)

# 2. Commit + tag + push
git add -A
git commit -m "Release v0.6.0"
git tag v0.6.0
git push origin master --tags
```

La GitHub Action compila tutto, firma e pubblica la release con `latest.json`.
Le app installate mostrano il dialogo di aggiornamento al prossimo avvio.

## Release manuale (v0.5.0 o se la CI non è disponibile)

```powershell
# 1. Compila il backend standalone (include ffmpeg.exe)
python build_backend.py

# 2. Build Tauri firmata
$env:TAURI_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\blink-dashboard.key" -Raw
$env:TAURI_KEY_PASSWORD = ""
npm run tauri build

# 3. Genera latest.json e raccogli gli artefatti in build/release/
python make_release.py

# 4. Tag + push + release
git tag v0.5.0
git push origin master --tags
gh release create v0.5.0 (Get-ChildItem build/release/*) --title "v0.5.0" --generate-notes
```

## Checklist pre-release

- [ ] Versioni allineate (package.json, Cargo.toml, changelog.ts)
- [ ] `MOCK_CAMERAS = false` in DashboardPage.tsx
- [ ] `npx tsc --noEmit` pulito
- [ ] `cargo check` pulito
- [ ] Changelog aggiornato con le novità della versione
- [ ] Test manuale: login, live, arm/disarm, eventi, notifiche

## Come funziona l'autoupdate

1. L'app all'avvio interroga
   `https://github.com/Sante96/blink-dashboard/releases/latest/download/latest.json`
2. Se `version` nel JSON > versione installata → dialogo di aggiornamento
3. Scarica il `.msi.zip`, verifica la firma con la pubkey embeddata, installa

Il file `latest.json` è generato da `make_release.py` e caricato come asset
della release: l'URL `releases/latest/download/` punta sempre all'ultima.
