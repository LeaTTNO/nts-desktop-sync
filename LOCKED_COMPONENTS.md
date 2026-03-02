# 🔒 LOCKED COMPONENTS

Dette dokumentet beskriver kritiske komponenter som **IKKE skal endres** uten grundig testing, da de løser spesifikke arkitektoniske problemer.

---

## 📅 Calendar System

### `src/renderer/components/ui/calendar.tsx`

**Status:** 🔒 **LOCKED - KRITISK**

**Hvorfor det eksisterer:**
- React-day-picker v9 rendrer navigasjon og caption som sibling-elementer (ikke parent-child)
- CSS kan ikke omorganisere disse til ønsket layout `< måned år >`
- Shadcn Calendar wrapper blokkerer DayPicker's `components` API

**Løsning:**
- Custom wrapper med egen header-komponent
- `hideNavigation` prop til DayPicker
- Manuell navigasjonshåndtering med state
- Locale-aware måned-formatering med type guards

**Kritiske features:**
```tsx
// 1. Custom header (< måned år >)
<div className="flex items-center justify-between px-1 pb-1">
  <button onClick={handlePreviousMonth}>
    <ChevronLeft />
  </button>
  <span>{formatMonthYear()}</span>
  <button onClick={handleNextMonth}>
    <ChevronRight />
  </button>
</div>

// 2. DayPicker med skjult nav
<DayPicker
  hideNavigation        // KRITISK
  fixedWeeks           // Forhindrer høyde-hopping
  month={displayMonth}
  onMonthChange={...}
/>
```

**IKKE endre:**
- ❌ Ikke fjern `hideNavigation` prop
- ❌ Ikke prøv CSS-løsninger igjen
- ❌ Ikke legg til `defaultMonth` prop i parent komponenter
- ❌ Ikke endre compact sizing (12px fonts, 28px buttons)

**Bruksområder:**
- `FlightRobot.tsx` (2 kalendere: avreise + retur)
- `TravelForm.tsx`
- `TravelProgramBuilder.tsx`

**Relaterte filer:**
- [src/renderer/index.css](#calendar-css) (RDP CSS overrides)

---

### Calendar CSS - `src/renderer/index.css`

**Status:** 🔒 **LOCKED - KRITISK**

**Linjer:** 390-411

**Kritiske regler:**

```css
/* KRITISK: Skjuler DayPicker's default caption */
.rdp-month_caption {
  display: none !important;
}

/* Kompakt størrelse (forhindrer popover overflow) */
.rdp-day_button,
.rdp button {
  font-size: 0.75rem !important;  /* 12px */
  height: 1.75rem !important;     /* 28px */
  width: 1.75rem !important;
  padding: 0 !important;
}

.rdp th {
  font-size: 0.6875rem !important; /* 11px */
  padding: 0.125rem !important;
}

/* Outside days (andre måneder) */
.rdp-outside button {
  color: hsl(var(--muted-foreground)) !important;
  opacity: 0.4 !important;
}
```

**IKKE endre:**
- ❌ Ikke endre `.rdp-month_caption { display: none !important; }`
- ❌ Ikke øk font-størrelser (bryter popover layout)
- ❌ Ikke fjern `!important` flagg
- ❌ Ikke endre selectorer (må matche DayPicker v9 struktur)

**Hvorfor `!important`?**
- DayPicker bruker inline styles som må overskrives
- Sikrer konsistens på tvers av browsere

---

## 📊 PowerPoint Generation System

### `src/main/electron-main.js` - `ppt:generate` handler

**Status:** 🔒 **LOCKED - KRITISK**

**Linjer:** 946-1111

**KRITISK ARKITEKTUR:**

PowerPoint SKAL åpnes via `shell.openPath()` ETTER at PowerShell-scriptene er ferdig — IKKE via COM-objektets `$ppApp.Visible = $true`.

**Hvorfor:**
- PowerShell-prosessen avsluttes når scriptet er ferdig
- Når PowerShell avsluttes, lukkes COM-objektet (`$ppApp`)
- Hvis PowerPoint ble åpnet via `$ppApp.Visible = $true`, forsvinner den umiddelbart
- `shell.openPath()` åpner filen som et eget OS-nivå dokument (fungerer både i dev og production)

**Korrekt flyt:**

```javascript
// 1. Kjør ppt-build.ps1 ($ppApp.Visible = $false)
execFile("powershell.exe", [...], (error, stdout, stderr) => {
  if (!error) {
    // 2. Kjør ppt-post-process.ps1
    execFile("powershell.exe", [...], (postError, postStdout, postStderr) => {
      if (!postError) {
        // 3. Åpne filen via shell ETTER at PS-scriptene er ferdig
        shell.openPath(basePath).then(() => {
          console.log("📂 PowerPoint file opened successfully");
        });
        resolve({ ok: true });
      }
    });
  }
});
```

**ppt-build.ps1 korrekt oppsett:**

```powershell
# RIKTIG: Hold PowerPoint skjult under bygging
$ppApp = New-Object -ComObject PowerPoint.Application
$ppApp.Visible = $false  # Keep hidden during build

# ... bygg presentasjonen ...

# IKKE lagre - filen åpnes av shell.openPath() etterpå
Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utført"
```

### VANLIGE FEIL (gjort 10+ ganger):

❌ **FEIL 1: Sette `$ppApp.Visible = $true`**
```powershell
$ppApp = New-Object -ComObject PowerPoint.Application
$ppApp.Visible = $true  # ❌ PowerPoint forsvinner når PS-scriptet avsluttes!
```

❌ **FEIL 2: Glemme `shell.openPath()` i electron-main.js**
```javascript
} else {
  console.log("✅ ppt-post-process.ps1 complete");
  resolve({ ok: true }); // ❌ Filen åpnes ALDRI!
}
```

❌ **FEIL 3: Bruke emojis i PowerShell-filer**
```powershell
Write-Host "✅ Ferdig!"  # ❌ PowerShell parsing-feil!
```
Kun ASCII-tekst i `.ps1` filer — emojis forårsaker parsing-feil.

### Filer som MÅ synkroniseres:

1. **`src/main/ppt-build.ps1`** - Bygger PPT via COM, `$ppApp.Visible = $false`
2. **`src/main/ppt-post-process.ps1`** - DG/DTO erstatning, holder PowerPoint skjult
3. **`src/main/electron-main.js`** - `ppt:generate` handler, kaller `shell.openPath()` etter scriptene
4. **`scripts/build-main.mjs`** - Kopierer alle 3 filer til `dist/main/`

**Build-sjekkliste før release:**

- [ ] `ppt-build.ps1` har `$ppApp.Visible = $false`
- [ ] `electron-main.js` kaller `shell.openPath(basePath)` etter begge scriptene
- [ ] Ingen emojis i `.ps1` filer (bruk kun ASCII)
- [ ] `scripts/build-main.mjs` kopierer alle 3 filer til `dist/main/`
- [ ] **TEST I DEV-MODUS FØR BYGG** (`npm run dev` + generer PPT)

### Testing:

```bash
# 1. Start dev-modus
npm run dev

# 2. Bygg PowerPoint i appen
# 3. Verifiser at PowerPoint åpnes automatisk
# 4. Hvis PowerPoint IKKE åpnes:
#    - Sjekk at shell.openPath() kalles (se console.log)
#    - Sjekk at $ppApp.Visible = $false i ppt-build.ps1
#    - Sjekk at ingen emojis i .ps1 filer
```

**IKKE bygg production før dette er verifisert!**

---

## 🎯 Popover System

### `src/renderer/components/ui/popover.tsx`

**Status:** 🔒 **LOCKED - KRITISK**

**Hvorfor det eksisterer:**
- Radix UI Popover wrapper for konsistent posisjonering
- Brukes av FlightRobot kalendere

**Kritiske props i bruk:**

```tsx
<PopoverContent
  className="w-auto p-0"
  align="start"
  avoidCollisions={false}  // KRITISK for FlightRobot
>
  <Calendar ... />
</PopoverContent>
```

**IKKE endre:**
- ❌ Ikke endre default `align` eller `side` props
- ❌ Ikke endre `avoidCollisions={false}` i FlightRobot

**Bruksområder:**
- `FlightRobot.tsx` (kalender popovers)
- Andre dropdown-komponenter

---

## 📝 ANBEFALINGER FOR FREMTIDEN

### Hvis Calendar må oppdateres:

1. **Test grundig:**
   - Sjekk alle 3 bruksområder (FlightRobot, TravelForm, TravelProgramBuilder)
   - Test i både norsk og dansk locale
   - Verifiser at måned/år vises kun én gang
   - Sjekk at navigasjonspiler fungerer
   - Verifiser at høyde ikke hopper ved månedsskifte

2. **Før du gjør endringer:**
   - Les denne dokumentasjonen
   - Lag en backup av `calendar.tsx` og `index.css`
   - Test i development-miljø først

3. **Red flags:**
   - Ser du duplikat måned/år? → Sjekk at `hideNavigation` er satt
   - Hopper kalenderen opp/ned? → Sjekk at `fixedWeeks` er satt
   - Feil måned ved åpning? → Sjekk at `defaultMonth` IKKE brukes i parent
   - TypeScript errors på locale? → Sjekk type guards i `formatMonthYear()`

### Hvis DayPicker oppgraderes:

⚠️ **KRITISK: Test alt grundig!**

- Sjekk om v10+ fikser nav/caption layout-problemet
- Verifiser at CSS-selectorer fortsatt matcher (`.rdp-month_caption`, etc.)
- Test locale-formatering med nb/da locales
- Sjekk at compact sizing fortsatt fungerer

---

## 🗂️ CONFIG-MAPPESTRUKTUR

### `src/renderer/config/` vs `src/config/`

**Status:** ⚠️ **VIKTIG**

**Aktiv kilde:** `src/renderer/config/`

**Hvorfor:**
- TypeScript alias `@/` peker til `./src/renderer/`
- Alle imports bruker `from "@/config/templateCategories"`
- Vite resolver til `src/renderer/config/`

**Legacy mappe:** `src/config/`
- **Brukes IKKE** av renderer-koden
- Kan være relevant for main-process (Electron)
- Bør synkroniseres eller fjernes

**ANBEFALING:**
- Verifiser om main-process bruker `src/config/`
- Hvis nei: Slett `src/config/` helt
- Hvis ja: Synkroniser med `src/renderer/config/`

---

## 📦 DEPENDENCIES

### Aktive (IKKE fjern):

- `react-day-picker` v9.13.0 - Calendar backend
- `date-fns` v2.30.0 - Datoformatering og locales
- `@radix-ui/react-popover` - Popover system
- `zustand` v5.0.9 - State management
- `idb` v8.0.3 - IndexedDB (template storage)
- `sonner` v2.0.7 - Toast notifications

### Potensielt ubrukte (sjekk før fjerning):

- `@tanstack/react-query` v5.90.16 - Ingen imports funnet
- `pptxgenjs` v4.0.1 - Ingen imports funnet (muligens fremtidig bruk)
- `recharts` v3.6.0 - Kun brukt i `chart.tsx` (sjekk om chart brukes)
- `embla-carousel-react` v8.6.0 - Kun brukt i `carousel.tsx` (sjekk om brukes)

### Fjernet (ubrukte):

- ✅ `flatpickr` - Fjernet
- ✅ `react-flatpickr` - Fjernet
- ✅ `dayjs` - Fjernet

---

## 📂 ARKIVERTE FILER

### `archive/CategoryManager.tsx`

**Hvorfor arkivert:**
- Ingen imports i codebase
- Ingen bruk funnet
- Fullstendig komponent (183 linjer)
- Ser ut til å være bruker-kategori-manager

**Gjenbruk:**
- Flytt tilbake til `src/renderer/components/builder/`
- Importer i relevant komponent
- Test funksjonalitet

---

## 🎯 SUMMARY

| Komponent | Status | Risiko ved endring |
|-----------|--------|-------------------|
| calendar.tsx | 🔒 LOCKED | KRITISK |
| index.css (RDP section) | 🔒 LOCKED | KRITISK |
| popover.tsx | 🔒 LOCKED | MIDDELS |
| src/renderer/config/ | ⚠️ VIKTIG | LAV |

**Sist oppdatert:** 2026-02-04

**Kontakt:** Ved spørsmål om locked components, se git history eller denne dokumentasjonen.
