# Utsending av ny versjon – NTS Desktop Sync

Bruk denne guiden **hver gang** du har gjort endringer og vil sende ut en oppdatering til Gordon, Jakob og andre brukere.

---

## Oversikt over flyten

```
1. Test lokalt  →  2. Bump versjon  →  3. Build  →  4. GitHub Release  →  5. Brukerne får auto-update
```

Appen har innebygd **auto-update** (electron-updater). Når du publiserer en ny GitHub Release, vil brukerne automatisk bli varslet og tilbudt å laste ned ved neste oppstart.

---

## Steg 1 – Test lokalt før du bygger

Åpne en **ekstern PowerShell** (ikke VS Code-terminal):

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
taskkill /IM node.exe /F 2>$null ; taskkill /IM electron.exe /F 2>$null
Start-Sleep 2
npm run dev
```

Sjekk at:
- Appen åpner uten hvit skjerm
- Det du endret fungerer som forventet
- Ingen feilmeldinger i konsollen

---

## Steg 2 – Bump versjonsnummer

Åpne `package.json` og øk `"version"` **før** du bygger.

Bruk [Semantic Versioning](https://semver.org):

| Hva ble endret | Eksempel | Regel |
|---|---|---|
| Bugfix / liten rettelse | `1.1.4` → `1.1.5` | Øk siste tall (patch) |
| Ny funksjon, ikke breaking | `1.1.5` → `1.2.0` | Øk midtre tall (minor), nullstill patch |
| Stor ombygging / breaking change | `1.2.0` → `2.0.0` | Øk første tall (major) |

```json
// package.json
"version": "1.1.5",   ← endre dette
```

---

## Steg 3 – Commit og push kodeendringene

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
git add -A
git commit -m "feat: beskrivelse av hva som ble endret"
git push origin main
```

**Tips til commit-meldinger:**
- `fix:` – for bugfixer
- `feat:` – for nye funksjoner
- `build:` – for build-system-endringer
- `chore:` – for rydding/vedlikehold

---

## Steg 4 – Bygg installer (.exe)

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
taskkill /IM node.exe /F 2>$null ; taskkill /IM electron.exe /F 2>$null
Start-Sleep 2
npm run build
```

Dette gjør **automatisk**:
1. 🗑️ Sletter gamle `.exe` og `.blockmap` fra `dist/`
2. Bygger renderer (React/Vite)
3. Bygger electron main
4. Pakker installer med `electron-builder`

Når det er ferdig finner du disse filene i `dist/`:
```
dist/
  NTS Desktop Sync Setup 1.1.5.exe          ← installer-filen
  NTS Desktop Sync Setup 1.1.5.exe.blockmap ← brukes av auto-updater
  latest.yml                                 ← brukes av auto-updater
```

Byggetiden er typisk **2–5 minutter**.

---

## Steg 5 – Publiser GitHub Release

> Dette er **kritisk** – uten en GitHub Release vil ikke auto-update fungere.

### 5a – Gå til GitHub Releases
Åpne: [https://github.com/LeaTTNO/nts-desktop-sync/releases/new](https://github.com/LeaTTNO/nts-desktop-sync/releases/new)

### 5b – Fyll ut release-skjemaet

| Felt | Hva du skriver |
|---|---|
| **Tag version** | `v1.1.5` (alltid med `v` foran) |
| **Release title** | `NTS Desktop Sync v1.1.5` |
| **Description** | Kort liste over hva som er nytt/rettet (se eksempel under) |

Eksempel på beskrivelse:
```
## Hva er nytt i v1.1.5

### Fikset
- Hvit skjerm ved oppstart er rettet
- Norske og danske maler blandes ikke lenger

### Nytt
- Zanzibar-hoteller vises nå gruppert i to nivåer
```

### 5c – Last opp filer
Dra disse filene fra `dist/` inn i "Attach binaries"-feltet:
- `NTS Desktop Sync Setup 1.1.5.exe`
- `NTS Desktop Sync Setup 1.1.5.exe.blockmap`
- `latest.yml`

> ⚠️ **Alle tre filene må være med** – `latest.yml` og `.blockmap` er nødvendig for at auto-update skal fungere.

### 5d – Publiser
Klikk **"Publish release"** (ikke "Save as draft").

---

## Steg 6 – Hva skjer hos brukerne?

### Automatisk oppdatering (Gordon, Jakob, osv.)
Når brukerne allerede har appen installert:
- Appen sjekker GitHub for ny versjon ved oppstart
- Ved ny versjon: varsling popup vises i appen
- Brukeren klikker "Oppdater" → ny versjon lastes ned og installeres

### Første gangs installasjon (ny bruker)
Send `.exe`-filen direkte:
- Last ned `NTS Desktop Sync Setup 1.1.5.exe` fra GitHub Releases
- Send filen til brukeren via OneDrive, e-post eller Teams
- Brukeren kjører `.exe` og installerer

---

## Rask huskeliste (cheat sheet)

```
□ Test lokalt med npm run dev
□ Øk versjonsnummer i package.json
□ git add -A && git commit -m "..." && git push origin main
□ npm run build
□ GitHub Release: tag v1.x.x, last opp .exe + .blockmap + latest.yml
□ Publiser release
□ Varsle brukerne hvis det er en viktig oppdatering
```

---

## Feilsøking

### Build feiler
```powershell
# Rydd opp og prøv igjen
taskkill /IM node.exe /F 2>$null
taskkill /IM electron.exe /F 2>$null
Start-Sleep 3
npm run build
```

### Auto-update fungerer ikke hos bruker
Sjekk at `latest.yml` er lastet opp i GitHub Release (se Steg 5c).

### Bruker får ikke oppdatering
- Sjekk at GitHub Release ikke er "Draft" – den må være publisert
- Tag-navn må starte med `v` (f.eks. `v1.1.5`)

### Hvit skjerm ved utvikling (npm run dev)
Kjør alltid fra **ekstern PowerShell** (Start-menyen), ikke fra VS Code-terminal.
