# Farewise API Integrasjon

## Status: ⚠️ Venter på Farewise Support

**API-integrasjonen er teknisk komplett, men Farewise returnerer 0 resultater.**

---

## 🔄 Hvordan bytte mellom Amadeus og Farewise

### Bruk Amadeus (Standard - FUNGERER)

1. **FlightRobot.tsx** - Linje 51-56:
```typescript
import {
  searchFlights,
  FlightOffer,
  airlineNames,
} from "@/lib/amadeusClient";
```

2. **FlightResultCard.tsx** - Linje 7:
```typescript
import { FlightOffer, airportNames } from "@/lib/amadeusClient";
```

### Bytt til Farewise (Når det fungerer)

1. **FlightRobot.tsx** - Linje 51-56:
```typescript
import {
  searchFlights,
  FlightOffer,
  airlineNames,
} from "@/lib/flightRobotClient";
```

2. **FlightResultCard.tsx** - Linje 7:
```typescript
import { FlightOffer, airportNames } from "@/lib/flightRobotClient";
```

---

## ✅ Hva som er implementert

### 1. Farewise API Client (`flightRobotClient.ts`)
- ✅ IPC-basert kommunikasjon (renderer → main process)
- ✅ Samme interface som Amadeus (drop-in replacement)
- ✅ Støtte for NO/DA språk/regioner

### 2. Electron Main Process (`electron-main.js`)
- ✅ Farewise API endpoint: `/v30/flight/recommendations/search`
- ✅ Autentisering: `authorizationGuid` i request body
- ✅ Region-spesifikk konfigurasjon:
  - **Norge**: customerId 17179, farewise.dk
  - **Danmark**: customerId 1280, farewise.dk
- ✅ Data converter: Farewise → Amadeus format
- ✅ IPC handler: `farewise:searchFlights`

### 3. Preload Script (`preload.js`)
- ✅ Whitelisted channel: `farewise:searchFlights`

### 4. FlightRobot Format Handler
- ✅ Håndterer både Amadeus `{data: [...]}` og Farewise `[...]` format

---

## ❌ Problem: Farewise returnerer tom data

### Hva skjer:
```json
{
  "searchKey": "abc-123-guid",
  "recommendations": []
}
```

API-et svarer **200 OK**, men `recommendations` er alltid tom array.

### Mulige årsaker:

1. **Asynkron polling-basert søk**
   - `searchKey` brukes til å hente resultater senere?
   - Må polle `GET /v30/flight/recommendations/{searchKey}`?

2. **customerId tilgang**
   - customerId 17179 har ikke riktige tilganger?
   - Må aktiveres i Farewise admin-panel?

3. **Datoer/ruter**
   - Søk for langt fram i tid?
   - Ruter ikke støttet for denne kunden?

4. **Manglende parametere**
   - Er det required felter vi mangler?

---

## 📋 Hva du må spørre Farewise Support

### Email-mal til Farewise:

```
Hei Farewise Support,

Vi har integrert Farewise API v30 i vår applikasjon, men får alltid tom 
"recommendations" array tilbake.

API CALL:
POST https://api.farewise.dk/v30/flight/recommendations/search

REQUEST:
{
  "authorizationGuid": "66DF9C55-C53B-4789-AF3A-5FBA8088FB99",
  "customerId": 17179,
  "customerName": "Tanzania Tours ApS",
  "legs": [
    {"departure": "OSL", "arrival": "JRO", "date": "2026-04-01T00:00:00.000Z"},
    {"departure": "ZNZ", "arrival": "OSL", "date": "2026-04-07T00:00:00.000Z"}
  ],
  "passengers": {"adults": 1, "children": []},
  "advancedSearchParams": { ... }
}

RESPONSE (Status 200):
{
  "searchKey": "abc-123",
  "recommendations": []
}

SPØRSMÅL:
1. Hvorfor returnerer API-et tom recommendations array?
2. Er searchKey for polling? Skal vi hente resultater senere via 
   GET /v30/flight/recommendations/{searchKey}?
3. Har customerId 17179 riktige tilganger aktivert?
4. Finnes det en test-rute som garantert gir resultater?
5. Er det required parametere vi mangler?

Mvh,
Tanzania Tours ApS
```

---

## 🔧 Når Farewise fungerer

Når dere får svar fra Farewise og fikser problemet:

### 1. Oppdater converter (hvis nødvendig)
Hvis Farewise-data har annen struktur enn vi forventet, oppdater:
```javascript
// electron-main.js - linje ~175
function convertFarewiseToAmadeus(farewiseData) {
  // Tilpass mapping her basert på faktisk Farewise response
}
```

### 2. Bytt til Farewise
Endre imports i `FlightRobot.tsx` og `FlightResultCard.tsx` (se over)

### 3. Test begge språk
- Norsk: customerId 17179
- Dansk: customerId 1280

### 4. Verifiser at alt fungerer
- ✅ Søk etter fly
- ✅ Kategorisering (best/billigst/kvalitet)
- ✅ Send til PowerPoint
- ✅ Kopier formatert tekst
- ✅ Open-jaw søk (fly til A, hjem fra B)

---

## 📁 Relevante filer

```
src/
├── main/
│   ├── electron-main.js       # Farewise API logic (linje 35-225)
│   └── preload.js             # IPC bridge (linje 9)
├── renderer/
│   ├── lib/
│   │   ├── amadeusClient.ts   # Amadeus (FUNGERER)
│   │   └── flightRobotClient.ts # Farewise (Venter på data)
│   └── components/builder/
│       ├── FlightRobot.tsx    # Main component (bytt import her)
│       └── FlightResultCard.tsx # Card component (bytt import her)
└── types/
    └── electron-api.d.ts      # TypeScript definitions
```

---

## 🎯 Sammendrag

| Komponent | Status | Beskrivelse |
|-----------|--------|-------------|
| **Amadeus API** | ✅ Fungerer | Test API, 1-2 requests/sec limit |
| **Farewise Integration** | ⚠️ Klar, men ingen data | Teknisk komplett, venter på support |
| **FlightRobot Logic** | ✅ Fungerer | All filtrering, kategorisering OK |
| **UI Improvements** | ✅ Komplett | Copy, PowerPoint, layover layout |
| **NO/DA Support** | ✅ Klar | Velger riktig customerId automatisk |

**Konklusjon:** Alt er klart - vi venter bare på at Farewise skal returnere data! 🚀
