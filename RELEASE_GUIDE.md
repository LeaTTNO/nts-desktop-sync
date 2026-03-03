# Utsending av ny versjon – NTS Desktop Sync

Bruk denne guiden **hver gang** du har gjort endringer og vil sende ut en oppdatering til Gordon, Jakob og andre brukere.

> **Viktig å forstå:** Appen har innebygd auto-update via GitHub. Det betyr at når du publiserer en ny versjon på GitHub, vil alle som allerede har appen installert automatisk få et varsel ved neste oppstart og kan oppdatere med ett klikk – du trenger ikke sende dem noe manuelt.

---

## Oversikt – hva skjer fra start til slutt

```
Du endrer kode  →  Test at det virker  →  Øk versjonsnummer  →  Commit til Git
     →  Bygg installer (.exe)  →  Publiser på GitHub  →  Gordon/Jakob får auto-update
```

Hvert steg forklares i detalj under.

---

## Steg 1 – Test at appen virker med dine endringer

Før du sender ut noe, må du alltid sjekke at appen faktisk fungerer etter endringene dine.

**Åpne en ekstern PowerShell** – dette er viktig! Ikke bruk terminalen inne i VS Code, da den kan forstyrre Electron og gi en hvit skjerm."

Slik åpner du ekstern PowerShell:
- Trykk `Windows-tast`, skriv `PowerShell`, klikk på appen som dukker opp
- Eller høyreklikk på Start-knappen → "Windows PowerShell"

Skriv disse kommandoene (kopier og lim inn alle på én gang):

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
taskkill /IM node.exe /F 2>$null ; taskkill /IM electron.exe /F 2>$null
Start-Sleep 2
npm run dev
```

**Hva disse kommandoene gjør:**
- `cd ...` – navigerer til prosjektmappen
- `taskkill ...` – stopper eventuelle gamle prosesser som kjører fra før
- `Start-Sleep 2` – venter 2 sekunder for å sikre at alt er ryddet opp
- `npm run dev` – starter appen i utviklingsmodus

**Vent ca. 20–30 sekunder.** Appen åpner seg automatisk.

**Sjekk at:**
- Appen åpner uten hvit skjerm eller feilmeldinger
- Det du endret fungerer som forventet
- De andre funksjonene du ikke endret fortsatt fungerer (klikk rundt litt)

Når du er fornøyd, lukk appen og gå til steg 2.

---

## Steg 2 – Øk versjonsnummeret

Versjonsnummeret forteller auto-update-systemet at det finnes en nyere versjon. Uten dette vil ikke brukerne få noen oppdatering.

**Åpne filen `package.json`** i VS Code (ligger i rotmappen i prosjektet).

Nær toppen av filen finner du:

```json
{
  "name": "nts-desktop-sync",
  "version": "1.1.4",        ← denne linjen
  "description": "NTS Desktop Sync - Tanzania Tours Desktop Application",
```

Endre `"version"` til neste nummer. Versjonsnummeret er bygget opp som `MAJOR.MINOR.PATCH`:

| Hva du har gjort | Eksempel | Hva du gjør med nummeret |
|---|---|---|
| Fikset en bug, rettet en skrivefeil, småjusteringer | `1.1.4` → `1.1.5` | Øk det siste tallet med 1 |
| Lagt til en ny funksjon brukerne vil merke | `1.1.5` → `1.2.0` | Øk midtre tall med 1, sett siste til 0 |
| Fullstendig ombygging, stor ny versjon | `1.2.0` → `2.0.0` | Øk første tall med 1, sett de andre til 0 |

**Eksempel – du har rettet en bug:**

```json
"version": "1.1.5",
```

**Eksempel – du har lagt til Zanzibar-hotellgruppering (ny funksjon):**

```json
"version": "1.2.0",
```

Lagre filen (`Ctrl+S`).

---

## Steg 3 – Lagre endringene til Git og send til GitHub

Git er et versjonskontrollsystem – det holder oversikt over alle endringer du gjør. Du må lagre ("committe") endringene og laste dem opp ("pushe") til GitHub.

**Åpne den eksterne PowerShell-vinduet igjen** og skriv:

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
git add -A
git commit -m "fix: rettet hvit skjerm ved oppstart"
git push origin main
```

**Hva disse kommandoene gjør:**
- `git add -A` – forteller Git at alle endrede filer skal med i neste lagring
- `git commit -m "..."` – lagrer endringene med en beskrivelse av hva du gjorde
- `git push origin main` – laster opp det lagrede til GitHub slik at andre (og GitHub Actions) kan se det

**Skriv alltid en meningsfull commitmelding** som beskriver hva du faktisk endret. Dette hjelper deg selv neste gang du lurer på hva som ble gjort når.

Eksempler på gode commitmeldinger:

```
fix: rettet hvit skjerm ved oppstart på Windows
feat: Zanzibar-hoteller vises nå gruppert i to nivåer
fix: norske og danske maler blandes ikke lenger i biblioteket
feat: lagt til Serengeti som reisemål
fix: datovelger viser feil år for norske brukere
chore: oppdatert avhengigheter
```

Forkortelsene i starten (`fix:`, `feat:`, etc.) er konvensjon – de er ikke påkrevd, men gjør det lettere å lese historikken:
- `fix:` – noe som var ødelagt er nå fikset
- `feat:` – ny funksjonalitet
- `chore:` – vedlikehold, oppdateringer som brukerne ikke merker
- `build:` – endringer i byggeprosessen

**Du vil se noe slikt i terminalen når det er vellykket:**

```
[main a3f8c21] fix: rettet hvit skjerm ved oppstart på Windows
 2 files changed, 15 insertions(+), 3 deletions(-)
...
   f8588d3..a3f8c21  main -> main
```

---

## Steg 4 – Bygg installeringsfilene (.exe)

Nå skal du lage den faktiske installer-filen som brukerne installerer.

**I den eksterne PowerShell:**

```powershell
cd "C:\Users\leaal\Desktop\NTS-Desktop-Sync"
taskkill /IM node.exe /F 2>$null ; taskkill /IM electron.exe /F 2>$null
Start-Sleep 2
npm run build
```

**Hva skjer automatisk når du kjører `npm run build`:**

1. **Rydder opp** – sletter gamle `.exe` og `.blockmap`-filer fra `dist/` slik at bare én versjon finnes
2. **Bygger brukergrensesnittet** – kompilerer React-koden (det brukerne ser på skjermen)
3. **Bygger bakgrunnsprosessen** – kompilerer Electron-koden (OneDrive-synk, filbehandling osv.)
4. **Pakker alt sammen** – lager en Windows installer-fil med `electron-builder`

**Ventetid:** Typisk 3–8 minutter. Du vil se mye tekst rulle forbi – det er normalt.

**Når det er ferdig ser du noe slikt:**

```
  • building        target=NSIS name="NTS Desktop Sync" file=dist/NTS Desktop Sync Setup 1.1.5.exe
  • building block map  blockMapFile=dist/NTS Desktop Sync Setup 1.1.5.exe.blockmap
```

**Sjekk at disse tre filene nå finnes i `dist/`-mappen:**

```
dist/
  NTS Desktop Sync Setup 1.1.5.exe          ← selve installer-filen (stor, ~80 MB)
  NTS Desktop Sync Setup 1.1.5.exe.blockmap ← teknisk fil for auto-update (liten)
  latest.yml                                 ← teknisk fil for auto-update (liten tekstfil)
```

Alle tre må lastes opp til GitHub i neste steg.

---

## Steg 5 – Publiser på GitHub (GitHub Release)

En "GitHub Release" er en offisiell versjon du legger ut på GitHub. Auto-update-systemet i appen sjekker GitHub for nye releases ved oppstart – uten dette skjer ingenting hos brukerne.

### Steg 5a – Åpne siden for ny release

Gå til denne adressen i nettleseren:

**[https://github.com/LeaTTNO/nts-desktop-sync/releases/new](https://github.com/LeaTTNO/nts-desktop-sync/releases/new)**

### Steg 5b – Fyll ut Tag-feltet

Øverst på siden er det et felt som sier **"Choose a tag"**. Klikk på det.

Skriv inn versjonsnummeret med `v` foran, for eksempel:

```
v1.1.5
```

Klikk deretter **"Create new tag: v1.1.5 on publish"** som dukker opp under feltet.

> ⚠️ **`v` foran nummeret er obligatorisk.** Uten `v` vil auto-update ikke gjenkjenne det som en gyldig versjon. Skriv `v1.1.5`, ikke `1.1.5`.

### Steg 5c – Fyll ut tittelfeltet

Under tag-feltet er det et felt som heter **"Release title"**. Skriv:

```
NTS Desktop Sync v1.1.5
```

### Steg 5d – Skriv en beskrivelse

I det store tekstfeltet under tittelen skriver du hva som er nytt eller rettet. Dette er det brukerne ser når de mottar varselet om oppdatering.

Bruk dette som mal – bare bytt ut innholdet:

```markdown
## Hva er nytt i v1.1.5

### Fikset
- Hvit skjerm ved oppstart på Windows er rettet
- Norske og danske maler blandes ikke lenger i malbiblioteket

### Nytt
- Zanzibar-hoteller vises nå gruppert under hvert hotell i to nivåer
```

Eller hvis det bare er én liten fix:

```markdown
## v1.1.5

- Rettet feil der appen krasjet ved oppstart på noen Windows-maskiner
```

### Steg 5e – Last opp de tre filene

**Metode 1: Via GitHub i nettleser**

Finn feltet som sier **"Attach binaries by dropping them here or selecting them"** (det er en stor stiplet boks nede på siden).

Åpne File Explorer, naviger til `C:\Users\leaal\Desktop\NTS-Desktop-Sync\dist\` og dra disse **tre filene** inn i den stiplede boksen:

1. `NTS Desktop Sync Setup 1.1.5.exe`
2. `NTS Desktop Sync Setup 1.1.5.exe.blockmap`
3. `latest.yml`

Vent til alle tre filene er ferdig lastet opp (du ser en grønn hake ved siden av hvert filnavn).

**Metode 2: Via kommandolinje (raskere)**

Åpne PowerShell i prosjektmappen og kjør:

```powershell
gh release create v1.1.5 `
  "dist\NTS-Desktop-Sync-Setup-1.1.5.exe" `
  "dist\NTS-Desktop-Sync-Setup-1.1.5.exe.blockmap" `
  "dist\latest.yml" `
  --title "NTS Desktop Sync v1.1.5" `
  --notes "**Hva er nytt:**`n`n- Fikset bug med template selection`n- Forbedret basefil synkronisering"
```

> **Tips:** Bytt ut versjonsnummer, tittel og notes med dine egne verdier. Backticks (\`) gjør at kommandoen kan deles over flere linjer.

> ⚠️ **Alle tre filene må lastes opp.** Det er fristende å bare laste opp `.exe`-filen siden det er den folk installerer, men `latest.yml` og `.blockmap` er det auto-update-systemet bruker for å sjekke og laste ned oppdateringer. Uten disse vil brukerne aldri få automatiske oppdateringer.

### Steg 5f – Publiser

Klikk den grønne knappen **"Publish release"**.

> ⚠️ **Ikke klikk "Save as draft"** – en draft er ikke synlig for appen sin auto-updater. Kun publiserte releases teller.

---

## Steg 6 – Hva skjer hos brukerne?

### Gordon og Jakob (har allerede appen installert)

Du trenger ikke gjøre noe mer. Neste gang de starter appen:

1. Appen sjekker stille i bakgrunnen om det finnes en nyere versjon på GitHub
2. Hvis det gjør det, kommer det opp en dialogboks: *"En oppdatering er tilgjengelig – vil du laste ned nå?"*
3. De klikker "Ja" / "Last ned", appen laster ned og installerer seg selv
4. Appen starter på nytt med den nye versjonen

**Du kan gjerne sende dem en melding på Teams/e-post** og si at det er lagt ut en oppdatering og hva som er nytt, slik at de vet de skal starte appen og se etter varselet.

### Ny bruker (har ikke installert appen ennå)

1. Gå til [https://github.com/LeaTTNO/nts-desktop-sync/releases](https://github.com/LeaTTNO/nts-desktop-sync/releases)
2. Last ned `NTS Desktop Sync Setup 1.1.5.exe` fra nyeste release
3. Send filen til brukeren via OneDrive, e-post eller Teams
4. Brukeren kjører `.exe`, klikker gjennom installasjonen, og er i gang

---

## Rask huskeliste – print denne ut

```
□ 1. TEST:    Åpne ekstern PowerShell → npm run dev → sjekk at alt virker

□ 2. VERSJON: Åpne package.json → øk "version" (f.eks. 1.1.4 → 1.1.5) → Ctrl+S

□ 3. GIT:     git add -A
              git commit -m "fix: kort beskrivelse av hva du endret"
              git push origin main

□ 4. BYGG:    taskkill /IM node.exe /F 2>$null ; taskkill /IM electron.exe /F 2>$null
              npm run build
              (vent 3-8 minutter)

□ 5. GITHUB:  Gå til github.com/LeaTTNO/nts-desktop-sync/releases/new
              Tag: v1.1.5  (med v foran!)
              Tittel: NTS Desktop Sync v1.1.5
              Last opp: .exe + .exe.blockmap + latest.yml  (alle tre!)
              Klikk "Publish release"  (ikke Save as draft!)
              
              ELLER bruk kommandolinje:
              gh release create v1.1.5 "dist\*.exe" "dist\*.blockmap" "dist\latest.yml" \
                --title "v1.1.5" --notes "Beskrivelse av endringer"

□ 6. VARSLE: Send melding til Gordon/Jakob om at ny versjon er ute
```

---

## Feilsøking

### "npm run build" feiler halvveis

Prøv å stoppe alle prosesser og bygg igjen:

```powershell
taskkill /IM node.exe /F 2>$null
taskkill /IM electron.exe /F 2>$null
Start-Sleep 5
npm run build
```

### Brukerne ser ikke noen oppdateringsvarsel

Sjekk disse tingene i rekkefølge:
1. Er GitHub Release **publisert** (ikke draft)? Gå til releases-siden og se om det står "Draft" ved siden av versjonen.
2. Er **tag-navnet** riktig? Det må starte med `v`, f.eks. `v1.1.5`.
3. Er **`latest.yml`** lastet opp i releasen? Klikk på releasen og sjekk at filen er der under "Assets".
4. Er versjonsnummeret i `package.json` **høyere** enn den versjonen brukerne allerede har installert?

### Appen åpner med hvit skjerm under testing

Du kjørte trolig `npm run dev` fra VS Code sin interne terminal. Lukk den og bruk en **ekstern PowerShell** (Start-menyen → PowerShell).
