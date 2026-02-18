# Farewise Danmark Feilsøking

## Sammenligning NO vs DK

| Parameter | Norge (NO) | Danmark (DK) | Status |
|-----------|------------|--------------|--------|
| **Login URL** | https://www.farewise.no/api/accountApi/login | https://www.farewise.dk/api/accountApi/login | ✅ Korrekt |
| **Search URL** | https://www.farewise.no/api/recommendations/search | https://www.farewise.dk/api/recommendations/search | ✅ Korrekt |
| **CustomerId** | 17179 | 1280 | ⚠️ Må verifiseres |
| **CustomerName** | "Tanzania Tours ApS" | "Tanzania Tours ApS" | ✅ Samme |
| **Currency** | NOK | DKK | ✅ Korrekt |
| **Username** | tan6170 | tan6170 | ✅ Samme |
| **Password** | PongweBH! | PongweBH! | ✅ Samme |
| **AuthGUID** | 66DF9C55-C53B-4789-AF3A-5FBA8088FB99 | 66DF9C55-C53B-4789-AF3A-5FBA8088FB99 | ✅ Samme |
| **Extra Context Calls** | ❌ Ingen | ✅ Har 2 ekstra kall | ⚠️ Kan være problemet |

## 🔍 Hovedforskjell: Extra Context Calls for Danmark

**Kun for Danmark (DA)**, koden gjør disse ekstra kallene ETTER login:

```javascript
// 1. GET /api/context/default/url
await fetch("https://www.farewise.dk/api/context/default/url", ...)

// 2. GET /api/context/get
await fetch("https://www.farewise.dk/api/context/get", ...)
```

**Dette gjøres IKKE for Norge (NO)!**

## 🧪 Feilsøkingssteg

### Steg 1: Åpne farewise.dk i nettleseren

1. Gå til https://www.farewise.dk
2. Åpne Developer Tools (F12)
3. Gå til **Network** tab
4. Logg inn med: tan6170 / PongweBH!
5. Se hvilke requests som kjøres ved login

**Ting å sjekke:**
- Blir det gjort ekstra kall etter login?
- Hvilke cookies blir satt?
- Er det noen forskjeller fra norsk versjon?

### Steg 2: Test manuelt søk i farewise.dk

1. Når du er logget inn, søk etter en flyreise
2. Se på Network tab for `/api/recommendations/search` request
3. Kopier:
   - **Request Headers** (spesielt Cookie)
   - **Request Body** 
   - **Response**

**Sammenlign med vår kode:**
- Har vi alle de samme headersene?
- Er request body identisk?
- Får du resultater i nettleseren men ikke i appen?

### Steg 3: Sjekk customerId 1280

**Mulige problemer:**
- CustomerId 1280 har kanskje ikke tilgang til API-søk?
- Kun tilgang til web-grensesnitt?
- Må aktiveres av Farewise support?

**Test:**
1. Prøv med norsk customerId (17179) også på .dk domenet
2. Se om det gir resultater

### Steg 4: Sammenlign med chathistorikk

Du nevnte at dere har jobbet med dette for 1 uke siden. Sjekk:
- Hva fant dere ut den gang?
- Var det noe spesifikt i dev tools som ble identifisert?
- Er det noe konfigurasjon som ble endret siden da?

## 🔧 Mulige løsninger

### Løsning A: Legg til ekstra context-kall for Norge også

**Prøv dette:**

```javascript
// I electron-main.js, etter login for norge også:
if (language === "no") {
  await fetch("https://www.farewise.no/api/context/default/url", {
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Cookie": farewiseCookies,
    },
    credentials: "include",
  });
  
  await fetch("https://www.farewise.no/api/context/get", {
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Cookie": farewiseCookies,
    },
    credentials: "include",
  });
}
```

### Løsning B: Fjern ekstra context-kall for Danmark

**Prøv dette:**

```javascript
// I electron-main.js, kommenter ut DK context-kallene (linje 123-144)
// EKSTRA: Hent kontekst for DK etter login (match webklient)
// if (language === "da") {
//   ... fjern dette
// }
```

### Løsning C: Bruk samme customerId for begge

**Test med norsk customerId for dansk også:**

```javascript
const FAREWISE_REGIONS = {
  no: {
    customerId: 17179,  // Norsk
  },
  da: {
    customerId: 17179,  // PRØV NORSK ID OGSÅ FOR DANSK!
  },
};
```

### Løsning D: Sjekk cookie-parsing

**Problem:** Cookies blir kanskje ikke sendt riktig for dansk?

**Debug:**
Legg til logging i `electron-main.js` (etter linje 177):

```javascript
console.log("📨 Sending request to Farewise DK:");
console.log("URL:", apiUrl);
console.log("Cookies:", farewiseCookies);
console.log("Full headers:", {
  "Content-Type": "application/json;charset=UTF-8",
  "Cookie": farewiseCookies || "MISSING!",
});
```

## 📊 Login Flow Sammenligning

### Norge (fungerer):
```
1. POST /api/accountApi/login (NO)
2. Extract cookies
3. FERDIG - klar til search
```

### Danmark (fungerer ikke):
```
1. POST /api/accountApi/login (DK)  
2. Extract cookies
3. GET /api/context/default/url (DK) ← EKSTRA!
4. GET /api/context/get (DK)        ← EKSTRA!
5. FERDIG - klar til search
```

**Spørsmål:** Er context-kallene nødvendige? Eller forårsaker de problemet?

## 🎯 Hva du bør gjøre NÅ

1. **Åpne farewise.dk i Chrome**
   - Logg inn
   - Åpne Developer Tools → Network
   - Gjør et flysøk
   - Send meg screenshots av Network-trafikken

2. **Test i appen med logging**
   - Kjør appen med `npm run dev`
   - Velg dansk språk
   - Prøv flysøk
   - Se i konsollen hva som logges
   - Send meg konsoll-output

3. **Sammenlign med norsk**
   - Kjør samme søk på norsk
   - Sammenlign request/response
   - Finn forskjeller

## 📧 Kontakt Farewise Support

Hvis ingen av løsningene over fungerer:

```
Emne: API Integration - CustomerId 1280 (Danmark)

Hei,

Vi har integrert Farewise API v30 for både Norge (customerId 17179) og 
Danmark (customerId 1280).

Norge fungerer perfekt, men Danmark returnerer alltid tomt recommendations array.

Login fungerer for begge (vi får cookies), men søk returnerer ingen data for DK.

SPØRSMÅL:
1. Har customerId 1280 tilgang til API flight search?
2. Er det forskjell på NO og DK API-endepunkter?
3. Må vi gjøre noe spesielt for DK-søk?
4. Kan dere teste vårt authorizationGuid mot DK API?

Login: tan6170 / PongweBH!
AuthGUID: 66DF9C55-C53B-4789-AF3A-5FBA8088FB99
CustomerIds: 17179 (NO - fungerer), 1280 (DK - tom data)

Mvh,
Tanzania Tours ApS
```

## 🔍 Debug-output å se etter

Når du kjører appen, se etter dette i konsollen:

```
ENV CHECK { ... FLIGHTROBOT_AUTH_GUID_EXISTS: true }
🔐 Logging in to Farewise (DA)...
✅ Login successful, cookies received: ...
Farewise DA API Request: { customerId: 1280, ... }
Farewise DA RAW RESPONSE: { recommendations: [] }  ← PROBLEMET!
⚠️ Farewise returned no recommendations.
```

## ✅ Sjekkliste

- [ ] Test login til farewise.dk i nettleser
- [ ] Kopier Network-requests fra dev tools
- [ ] Sammenlign med Norge
- [ ] Test Løsning A (ekstra calls for NO)
- [ ] Test Løsning B (fjern ekstra calls for DK)
- [ ] Test Løsning C (samme customerId)
- [ ] Legg til debug-logging
- [ ] Kontakt Farewise support
