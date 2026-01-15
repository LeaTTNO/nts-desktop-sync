# Struktur for Basefiler i OneDrive

## Oversikt

Systemet bruker nå **brukerspesifikke mapper** for basefiler. Hver bruker har sin egen mappe med basefiler som kun admin kan se i malbiblioteket.

## Mappestruktur i OneDrive

### Norsk (/no/templates/)

```
/no/templates/
├── lea-base/
│   ├── Reiseprogram og Tilbud - Safari & Zanzibar.pptx
│   ├── Reiseprogram og Tilbud - Safari.pptx
│   ├── Reiseprogram og Tilbud - Zanzibar.pptx
│   ├── Reiseprogram og Tilbud - Kilimanjaro.pptx
│   ├── Reiseprogram og Tilbud - Safari & Kilimanjaro.pptx
│   ├── Reiseprogram og Tilbud - Zanzibar & Kilimanjaro.pptx
│   └── Reiseprogram og Tilbud - Safari, Zanzibar & Kilimanjaro.pptx
│
├── gordon-base/
│   └── (samme filer som over, Gordons versjon)
│
├── jakob-base/
│   └── (samme filer som over, Jakobs versjon)
│
└── [andre brukere...]
```

### Dansk (/da/templates/)

```
/da/templates/
├── lea-base/
│   ├── Rejseprogram og Tilbud - Safari & Zanzibar.pptx
│   ├── Rejseprogram og Tilbud - Safari.pptx
│   ├── Rejseprogram og Tilbud - Zanzibar.pptx
│   ├── Rejseprogram og Tilbud - Kilimanjaro.pptx
│   ├── Rejseprogram og Tilbud - Safari & Kilimanjaro.pptx
│   ├── Rejseprogram og Tilbud - Zanzibar & Kilimanjaro.pptx
│   └── Rejseprogram og Tilbud - Safari, Zanzibar & Kilimanjaro.pptx
│
├── gordon-base/
│   └── (samme filer på dansk, Gordons versjon)
│
└── [andre brukere...]
```

## Viktige punkter

### ✅ Filnavnkonvensjon

**VIKTIG:** Filene skal IKKE ha bruker-prefix i navnet!

- ✅ **Riktig:** `Reiseprogram og Tilbud - Safari & Zanzibar.pptx`
- ❌ **Feil:** `lea-Reiseprogram og Tilbud - Safari & Zanzibar.pptx`

Bruker-prefikset er i **mappenavnet**, ikke filnavnet.

### 🔒 Tilgangskontroll

1. **Vanlige brukere:**
   - Ser IKKE basefil-kategoriene i malbiblioteket
   - Systemet bruker automatisk riktig basefil basert på destinasjonsvalg
   - Kan velge mellom sine basefiler i "Bygg Reiseprogram"

2. **Admin (lea@tanzaniatours.no):**
   - Ser ALLE basefil-kategorier i malbiblioteket:
     - "Lea - Basefiler"
     - "Gordon - Basefiler"
     - "Jakob - Basefiler"
     - osv.
   - Kan laste opp og administrere basefiler for alle brukere

### 🗂️ Alle basefil-varianter som MÅ finnes

For BÅDE norsk og dansk, for HVER bruker:

1. **Reiseprogram og Tilbud - Safari & Zanzibar** (default)
2. **Reiseprogram og Tilbud - Safari**
3. **Reiseprogram og Tilbud - Zanzibar**
4. **Reiseprogram og Tilbud - Kilimanjaro**
5. **Reiseprogram og Tilbud - Safari & Kilimanjaro**
6. **Reiseprogram og Tilbud - Zanzibar & Kilimanjaro**
7. **Reiseprogram og Tilbud - Safari, Zanzibar & Kilimanjaro**

(Dansk: Bytt "Reiseprogram" med "Rejseprogram")

### 🚀 Automatisk valg

Når en bruker bygger et reiseprogram:
1. Systemet ser på hvilke destinasjoner som er valgt (Safari/Zanzibar/Kilimanjaro)
2. Finner automatisk riktig basefil fra BRUKERENS base-mappe
3. Brukeren kan overstyre og velge manuelt hvis ønskelig

### 👥 Brukerliste

Følgende brukere har base-mapper:
- **Lea** (NO + DA)
- **Gordon** (DA)
- **Jakob** (DA)
- **Camilla** (DA)
- **Sofia** (DA)
- **Lars** (DA)
- **Lennie** (DA)
- **Info** (NO + DA)

## Oppsett

### Trinn 1: Opprett mapper
Opprett mappene i OneDrive hvis de ikke finnes allerede.

### Trinn 2: Last opp basefiler
For hver bruker, last opp alle 7 varianter av basefilen i brukerens base-mappe.

### Trinn 3: Synkroniser
Systemet vil automatisk oppdage de nye mappene når templates synkroniseres fra OneDrive.

## Vedlikehold

### Oppdatere en brukers basefiler
1. Logg inn som admin
2. Gå til "Malbibliotek"
3. Finn kategorien "[Bruker] - Basefiler"
4. Last opp nye filer eller erstatt eksisterende

### Legge til ny bruker
1. Legg til bruker i `userBaseTemplates.ts`
2. Legg til bruker i `templateCategories.ts` (getAllUserBaseCategories)
3. Opprett mapper i OneDrive
4. Last opp basefiler

## Feilsøking

### Bruker ser ikke basefiler i "Bygg Reiseprogram"
- Sjekk at basefil-mappen eksisterer i OneDrive
- Sjekk at filnavnene er **eksakt** som spesifisert over (uten bruker-prefix!)
- Synkroniser templates på nytt

### Admin ser ikke basefil-kategorier
- Sjekk at brukeren er definert som admin i `userConfig.ts`
- Hard refresh av applikasjonen

## Spørsmål?
Kontakt utvikler hvis noe er uklart!
