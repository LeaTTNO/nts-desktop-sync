// ──────────────────────────────────────────────
// 📦 IMPORTS
// ──────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, shell, screen, dialog, net, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import "dotenv/config";
import { execFile } from "child_process";
import JSZip from "jszip";

// ⚠️ electron-updater er CommonJS
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;

// ──────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// Global window reference for IPC communication
let mainWindow = null;

/* --------------------------------------------------
   🧹 DEV-FIX (Windows cache / GPU-problemer)
-------------------------------------------------- */
app.commandLine.appendSwitch("disable-gpu-cache");
app.commandLine.appendSwitch("disable-software-rasterizer");

// Deaktiver hardware-akselerasjon - forhindrer renderer-kræsj på Windows/Electron 29
app.disableHardwareAcceleration();

/* --------------------------------------------------
   🔐 ENV
-------------------------------------------------- */

const FLIGHTROBOT_BASE_URL = process.env.FLIGHTROBOT_BASE_URL || "https://www.farewise.no";
const FLIGHTROBOT_AUTH_GUID = process.env.FLIGHTROBOT_AUTH_GUID || "66DF9C55-C53B-4789-AF3A-5FBA8088FB99";

// Region-spesifikke innstillinger
const FAREWISE_REGIONS = {
  no: {
    baseUrl: "https://www.farewise.no",
    currency: "NOK",
    customerId: 17179,
    customerName: "Tanzania Tours ApS",
    authRequired: true,
    authGuid: "66DF9C55-C53B-4789-AF3A-5FBA8088FB99",
  },
  da: {
    baseUrl: "https://www.farewise.dk",
    currency: "DKK",
    customerId: 1280,
    customerName: "Tanzania Tours ApS",
    authRequired: false,
    authGuid: "66DF9C55-C53B-4789-AF3A-5FBA8088FB99",
  },
};

console.log("ENV CHECK", {
  FLIGHTROBOT_BASE_URL,
  FLIGHTROBOT_AUTH_GUID_EXISTS: !!FLIGHTROBOT_AUTH_GUID
});

/* --------------------------------------------------
/* --------------------------------------------------
   🔐 FAREWISE LOGIN + PERSISTENT SESSION
   Bruker Electrons eget net-modul med persist:farewise-XX sesjon.
   Cookies lagres til disk i appData og gjenbrukes mellom søk og
   mellom app-restarter — akkurat som en innlogget nettleser.
-------------------------------------------------- */
const FAREWISE_USERNAME = "tan6170";
const FAREWISE_PASSWORD = "PongweBH!";

// Holder styr på om vi allerede er innlogget per språk (for denne kjøringen)
const farewiseLoggedIn = { no: false, dk: false };

/**
 * Hjelper: HTTP-forespørsel via Electrons net.request() med persistent sesjon.
 * Sesjonen lagrer cookies til disk automatisk.
 */
function sessionFetch(url, options = {}, language = 'no') {
  return new Promise((resolve, reject) => {
    const partition = `persist:farewise-${language}`;
    const ses = session.fromPartition(partition);

    const req = net.request({
      url,
      method: options.method || 'GET',
      session: ses,
      useSessionCookies: true, // Bruk og oppdater session cookies automatisk
    });

    // Sett headers
    const headers = options.headers || {};
    for (const [key, value] of Object.entries(headers)) {
      req.setHeader(key, value);
    }

    req.on('response', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          headers: response.headers,
          text: () => Promise.resolve(body),
          json: () => Promise.resolve(JSON.parse(body)),
        });
      });
      response.on('error', reject);
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function loginToFarewise(language = 'no') {
  // Allerede innlogget i denne kjøringen — hopp over
  if (farewiseLoggedIn[language]) {
    console.log(`🔐 Farewise ${language.toUpperCase()}: bruker eksisterende sesjon (innlogget)`);
    return;
  }

  const domain = language === 'da' ? 'dk' : 'no';
  const loginUrl = `https://www.farewise.${domain}/api/accountApi/login`;
  console.log(`🔐 Logger inn på Farewise ${language.toUpperCase()} (persistent sesjon)...`);

  const res = await sessionFetch(loginUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7',
      'Content-Type': 'application/json;charset=UTF-8',
      'Referer': `https://www.farewise.${domain}/nd/login`,
      'Origin': `https://www.farewise.${domain}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ username: FAREWISE_USERNAME, password: FAREWISE_PASSWORD }),
  }, language);

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Farewise innlogging feilet: ${res.status} - ${txt.substring(0, 200)}`);
  }

  farewiseLoggedIn[language] = true;
  console.log(`✅ Farewise ${language.toUpperCase()}: innlogging OK — cookies lagret i persistent sesjon`);
}

/* --------------------------------------------------
   �🔁 RATE LIMIT (Farewise)
-------------------------------------------------- */
let lastRequest = 0;
async function rateLimit(ms = 500) {
  const now = Date.now();
  const diff = now - lastRequest;
  if (diff < ms) {
    await new Promise((r) => setTimeout(r, ms - diff));
  }
  lastRequest = Date.now();
}

/* --------------------------------------------------
   ✈️ FAREWISE FLIGHT SEARCH
-------------------------------------------------- */

async function searchFlightsMain(params) {
  await rateLimit();

  const {
    originLocationCode,
    destinationLocationCode,
    departureDate,
    returnDate,
    returnOriginCode,
    adults = 1,
    language = "no", // Default til norsk
  } = params;

  // FORSØKER DK API: Bruk language-spesifikk Farewise region
  // Fallback til NO hvis DK feiler (backup i electron-main.BACKUP-WORKING-NO-ONLY.js)
  console.log(`🔐 Logging in to Farewise ${language.toUpperCase()}...`);
  await loginToFarewise(language);

  // Bygg Farewise request body - bruker strukturen som ga oss 225 resultater
  const legs = [];
  
  // Bruk riktig timezone basert på region (+01 for både NO og DK - begge i Europa)
  const timezone = "+01";
  
  // Outbound leg - convert date to timezone format
  legs.push({
    departure: originLocationCode,
    arrival: destinationLocationCode,
    date: departureDate.includes('T') ? departureDate : `${departureDate}T00:00:00${timezone}`,
  });

  // Return leg (open-jaw supported)
  if (returnDate) {
    legs.push({
      departure: returnOriginCode || destinationLocationCode,
      arrival: params.returnDestinationCode || originLocationCode,
      date: returnDate.includes('T') ? returnDate : `${returnDate}T00:00:00${timezone}`,
    });
  }

  // Bruk language-spesifikk region
  const region = FAREWISE_REGIONS[language] || FAREWISE_REGIONS.no;

  const requestBody = {
    customerId: region.customerId,
    customerName: region.customerName,
    legs,
    dataSources: [],
    passengers: {
      adults: Number(adults),
      children: [],
    },
    advancedSearchParams: {
      publicFares: true,
      negoFares: true,
      itFares: true,
      lowCostCarriers: true,
      corporativeCodes: "",
      carriers: "",
      maxConnectionHours: 0,
      excludeIntercityConnections: true,
      combinationView: true,
      filterLongerConnection: true,
      useFastSearch: false,
      allowMultiOnewaySearch: false,
      sortByDeparture: true,
      includingBaggage: true,
    },
    raw: false,
    cabinClass: "Y",
  };
  
  // Kun legg til authorizationGuid hvis region krever det (NO)
  if (region.authRequired && FLIGHTROBOT_AUTH_GUID) {
    requestBody.authorizationGuid = FLIGHTROBOT_AUTH_GUID;
  }

  const domain = language === "da" ? "dk" : "no";
  const apiUrl = `https://www.farewise.${domain}/api/recommendations/search`;

  console.log(`Farewise ${language.toUpperCase()} API Request:`, JSON.stringify(requestBody, null, 2));
  console.log(`Using endpoint: ${apiUrl}`);
  console.log(`CustomerId: ${region.customerId}`);

  const res = await sessionFetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': `https://www.farewise.${domain}/nd/flight/search`,
      'Origin': `https://www.farewise.${domain}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
    },
    body: JSON.stringify(requestBody),
  }, language);

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Farewise ${language.toUpperCase()} API Error:`, res.status, errorText);
    throw new Error(`Farewise API feil: ${res.status} - ${errorText}`);
  }

  const result = await res.json();
  console.log(`Farewise ${language.toUpperCase()} RAW RESPONSE:`, JSON.stringify(result, null, 2).substring(0, 2000));
  console.log(`Farewise ${language.toUpperCase()} returned ${result?.recommendations?.length || 0} recommendations`);
  
  // DEBUG: Find Emirates flights and send RAW data to renderer for inspection
  if (result?.recommendations) {
    const ekFlights = result.recommendations.filter(rec => {
      const hasEK = rec.legs?.some(leg => 
        leg.routes?.some(route => 
          route.segments?.some(seg => seg.marketingCarrier?.code === 'EK')
        )
      );
      return hasEK;
    });
    
    if (ekFlights.length > 0) {
      console.log(`\n🔍 FOUND ${ekFlights.length} EMIRATES FLIGHTS IN RAW FAREWISE RESPONSE`);
      // Send first EK flight to renderer for debugging in DevTools
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('farewise:debug-ek', {
          count: ekFlights.length,
          firstFlight: ekFlights[0],
          fields: Object.keys(ekFlights[0]),
        });
      }
    }
  }
  
  // Hvis ingen resultater, returner tom array
  if (!result?.recommendations || result.recommendations.length === 0) {
    console.warn("⚠️ Farewise returned no recommendations.");
    console.warn("🔍 This may mean:");
    console.warn("  1. customerId does not have access to flight search");
    console.warn("  2. Route/dates have no availability");
    console.warn("  3. Search parameters are invalid");
    console.warn("Full response:", result);
    return { data: [] };
  }
  
  // Konverter Farewise format til Amadeus-format
  // DK API returnerer allerede DKK (ingen konvertering nødvendig)
  // NO API returnerer NOK
  const targetCurrency = region.currency;
  const convertPrices = false; // Farewise returnerer allerede riktig valuta per region
  return convertFarewiseToAmadeus(result, targetCurrency, convertPrices);
}

/* --------------------------------------------------
   � FAREWISE → AMADEUS FORMAT CONVERTER
-------------------------------------------------- */

function convertFarewiseToAmadeus(farewiseData, currency = "NOK", convertPrices = false) {
  // Valutakurs NOK til DKK (oppdatert kurs)
  const NOK_TO_DKK = 0.65;
  
  // Farewise returnerer recommendations array
  const recommendations = farewiseData?.recommendations || [];
  
  if (!Array.isArray(recommendations)) {
    console.warn("Farewise response not in expected format:", farewiseData);
    return { data: [] };
  }

  const amadeusOffers = recommendations.map((rec, index) => {
    // Farewise har options[0].legs[] istedenfor itineraries[]
    const firstOption = rec.options?.[0];
    if (!firstOption || !firstOption.legs) {
      console.warn(`⚠️ Recommendation ${rec.id} missing options or legs. Has options: ${!!rec.options}, Has legs: ${!!rec.options?.[0]?.legs}`);
      return null;
    }

    // Convert Farewise legs to Amadeus itineraries
    const itineraries = firstOption.legs.map((leg, legIndex) => {
      // Farewise har leg.routes[0].segments[] istedenfor leg.segments[]
      const route = leg.routes?.[0];
      if (!route || !route.segments || route.segments.length === 0) {
        console.warn(`⚠️ Leg ${legIndex} in ${rec.id} has no route or segments`);
        return null;
      }

      const segments = route.segments.map((seg, segIndex) => {
        // Convert Farewise duration "06:30" to ISO 8601 "PT6H30M"
        let duration = "PT0H";
        if (seg.elapsedFlyingTime && seg.elapsedFlyingTime.includes(':')) {
          const [hours, minutes] = seg.elapsedFlyingTime.split(':');
          duration = `PT${parseInt(hours)}H${parseInt(minutes)}M`;
        } else if (seg.departureDate && seg.arrivalDate) {
          // Beregn duration fra datoer hvis elapsedFlyingTime mangler
          const depDate = new Date(seg.departureDate);
          const arrDate = new Date(seg.arrivalDate);
          const diffMs = arrDate - depDate;
          const diffMinutes = Math.floor(diffMs / 60000);
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          duration = `PT${hours}H${minutes}M`;
        }

        return {
          departure: {
            iataCode: seg.departure?.code || "",
            at: seg.departureDate || "",
          },
          arrival: {
            iataCode: seg.arrival?.code || "",
            at: seg.arrivalDate || "",
          },
          carrierCode: seg.marketingCarrier?.code || "",
          number: String(seg.flightNumber || ""),
          duration: duration,
        };
      });

      // USE FAREWISE-PROVIDED DURATION DIRECTLY - same source as what Farewise website displays
      // route.duration and leg.duration are in "HH:MM" format (e.g., "14:00", "12:35")
      let legDuration = "PT0H0M";

      if (route.totalTime && typeof route.totalTime === 'number' && route.totalTime > 0) {
        // Primary: use route.totalTime (in minutes) — includes stopovers, timezone-independent
        const totalMinutes = Math.round(route.totalTime);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        legDuration = `PT${hours}H${minutes}M`;
        console.log(`✅ LEG ${legIndex} duration from route.totalTime: ${route.totalTime} min → ${legDuration}`);
      } else if (segments.length > 0 && segments[0].departure.at && segments[segments.length - 1].arrival.at) {
        // Fallback: timestamp diff (first departure → last arrival) — correctly includes overnight stopovers
        // Timestamps from Farewise have explicit UTC offset (+00:00 or Z) so new Date() is accurate
        const firstDeparture = new Date(segments[0].departure.at);
        const lastArrival = new Date(segments[segments.length - 1].arrival.at);
        const totalMs = lastArrival - firstDeparture;
        const totalMinutes = Math.floor(totalMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        legDuration = `PT${hours}H${minutes}M`;
        console.log(`✅ LEG ${legIndex} duration from timestamps (first→last): ${segments[0].departure.at} → ${segments[segments.length-1].arrival.at} = ${legDuration}`);
      } else if (route.duration && route.duration.includes(':')) {
        // Last resort: route.duration in "HH:MM" format
        const [h, m] = route.duration.split(':');
        legDuration = `PT${parseInt(h)}H${parseInt(m)}M`;
        console.log(`✅ LEG ${legIndex} duration from route.duration: ${route.duration} → ${legDuration}`);
      } else {
        console.warn(`⚠️ LEG ${legIndex} no duration available, using PT0H0M`);
      }

      return {
        duration: legDuration,
        segments,
      };
    });

    // Get price from recommendation
    const priceTotal = firstOption.total || rec.total || 0;
    
    // Konverter pris til DKK hvis nødvendig
    const finalPrice = convertPrices ? Math.round(priceTotal * NOK_TO_DKK) : priceTotal;

    // Determine fare type - Farewise uses negoFare and isPackage boolean fields
    let fareType = "PUBLIC"; // Default
    
    // Check Farewise-specific boolean fields (negoFare and isPackage)
    // These indicate package/negotiated fares (red in Farewise UI)
    if (rec.negoFare === true || firstOption.negoFare === true) {
      fareType = "NEGOTIATED";
      console.log(`✅ Set NEGOTIATED via negoFare for ${rec.id}:`, {
        'rec.negoFare': rec.negoFare,
        'firstOption.negoFare': firstOption.negoFare
      });
    } else if (rec.isPackage === true || firstOption.isPackage === true) {
      fareType = "NEGOTIATED";
      console.log(`✅ Set NEGOTIATED via isPackage for ${rec.id}:`, {
        'rec.isPackage': rec.isPackage,
        'firstOption.isPackage': firstOption.isPackage
      });
    }
    // Also check string-based fields for other providers
    else if (rec.fareType === "NEGOTIATED" || rec.fareType === "negotiated") {
      fareType = "NEGOTIATED";
    } else if (rec.priceType === "NEGOTIATED" || rec.priceType === "negotiated") {
      fareType = "NEGOTIATED";
    } else if (firstOption.fareType === "NEGOTIATED" || firstOption.fareType === "negotiated") {
      fareType = "NEGOTIATED";
    }
    
    // Log if still PUBLIC (shouldn't happen for Emirates)
    const hasEK = itineraries.some(itin => 
      itin.segments.some(seg => seg.carrierCode === 'EK')
    );
    if (fareType === "PUBLIC" && hasEK) {
      console.log(`⚠️ EK flight ${rec.id} is PUBLIC - checking fields:`, {
        'rec.negoFare': rec.negoFare,
        'rec.isPackage': rec.isPackage,
        'firstOption.negoFare': firstOption.negoFare,
        'firstOption.isPackage': firstOption.isPackage
      });
    }

    // Detect cabin class from Farewise response
    // Business class booking codes in GDS: C, D, I, J, Z
    // First class booking codes: F, A, P
    // Everything else is Economy
    const BUSINESS_CODES = new Set(['C', 'D', 'I', 'J', 'Z']);
    const FIRST_CODES    = new Set(['F', 'A', 'P']);
    let travelClass = 'ECONOMY'; // Default when cabinClass: "Y" was requested

    // Check top-level fields first (fastest path)
    const rawCabin = (
      rec.cabin || rec.cabinClass || rec.travelClass ||
      firstOption.cabin || firstOption.cabinClass || firstOption.travelClass ||
      ""
    ).toUpperCase();

    if (rawCabin.includes('BUSINESS') || rawCabin === 'C' || rawCabin === 'J') {
      travelClass = 'BUSINESS';
    } else if (rawCabin.includes('FIRST') || rawCabin === 'F') {
      travelClass = 'FIRST';
    } else {
      // Check route/segment level booking class
      const allSegments = firstOption.legs?.flatMap(leg =>
        leg.routes?.flatMap(r => r.segments || []) || []
      ) || [];
      for (const seg of allSegments) {
        const bc = (seg.bookingClass || seg.cabin || seg.cabinClass || seg.serviceClass || "").toUpperCase();
        if (BUSINESS_CODES.has(bc) || bc.includes('BUSINESS')) {
          travelClass = 'BUSINESS';
          break;
        }
        if (FIRST_CODES.has(bc) || bc.includes('FIRST')) {
          travelClass = 'FIRST';
          break;
        }
      }
    }

    if (travelClass !== 'ECONOMY') {
      console.log(`✈️ Non-economy class detected: ${travelClass} for ${rec.id || index}`);
    }

    return {
      id: rec.id || `farewise-${index}`,
      price: {
        total: String(finalPrice),
        currency: currency, // NOK for norsk, DKK for dansk
        grandTotal: String(finalPrice),
      },
      fareType: fareType,
      travelClass: travelClass,
      itineraries,
      validatingAirlineCodes: [rec.carrier?.code || ""],
      numberOfBookableSeats: 9,
      rawRecommendation: rec, // Preserve original Farewise data for booking flow
    };
  }).filter(Boolean); // Remove nulls

  if (convertPrices) {
    console.log(`💱 Converted ${amadeusOffers.length} prices from NOK to DKK (rate: 1 NOK = 0.65 DKK)`);
  }
  console.log(`✅ Converted ${amadeusOffers.length} Farewise offers to Amadeus format`);
  return { data: amadeusOffers };
}

/* --------------------------------------------------
   �🔌 IPC
-------------------------------------------------- */

// Farewise IPC handler
ipcMain.handle("farewise:searchFlights", async (_, params) => {
  try {
    const result = await searchFlightsMain(params);
    // result er allerede {data: [...]} fra converter
    return { ok: true, data: result.data };
  } catch (err) {
    console.error("Farewise search error:", err);
    return { ok: false, error: String(err) };
  }
});

// Legacy handler for kompatibilitet
ipcMain.handle("flights:search", async (_, payload) => {
  try {
    const result = await searchFlightsMain(payload);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ✈️ Farewise: Revalidate flight offer
ipcMain.handle("farewise:revalidate", async (_, { datasource, segments, adults, children = 0, language = "no" }) => {
  try {
    await loginToFarewise(language);
    const domain = language === "da" ? "dk" : "no";
    const region = FAREWISE_REGIONS[language] || FAREWISE_REGIONS.no;
    const apiUrl = `https://www.farewise.${domain}/api/recommendations/revalidate`;

    const childrenList = Array.from({ length: children }, (_, i) => ({ age: 10 }));

    const requestBody = {
      customerId: region.customerId,
      customerName: region.customerName,
      dataSource: datasource,
      segments,
      passengers: {
        adults: Number(adults),
        children: childrenList,
      },
    };
    if (region.authRequired && FLIGHTROBOT_AUTH_GUID) {
      requestBody.authorizationGuid = FLIGHTROBOT_AUTH_GUID;
    }

    console.log(`Farewise revalidate (${language.toUpperCase()}):`, JSON.stringify(requestBody, null, 2));

    const res = await sessionFetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Referer": `https://www.farewise.${domain}/nd/flight/search`,
        "Origin": `https://www.farewise.${domain}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(requestBody),
    }, language);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Farewise revalidate error: ${res.status}`, errorText);
      return { ok: false, error: `Revalidation failed: ${res.status}` };
    }

    const result = await res.json();
    console.log("Farewise revalidate result:", JSON.stringify(result, null, 2).substring(0, 1000));
    return { ok: true, data: result };
  } catch (err) {
    console.error("Farewise revalidate error:", err);
    return { ok: false, error: String(err) };
  }
});

// ✈️ Farewise: Create reservation (get PNR)
// Uses SAME web API as search (www.farewise.{domain}/api/recommendations/book)
// Segments sent AS-IS from search response — no format conversion
ipcMain.handle("farewise:createReservation", async (_, { datasource, recommendationId, routes, adults, children = 0, language = "no" }) => {
  try {
    const region = FAREWISE_REGIONS[language] || FAREWISE_REGIONS.no;
    const domain = language === "da" ? "dk" : "no";

    // Send routes with raw segments exactly as returned by search API
    const bookingRoutes = (routes || []).map(route => ({
      recommendationId,
      dataSource: datasource,
      segments: route.segments || [],
      totalTime: route.totalTime != null ? route.totalTime : null,
      majorityCarrier: route.majorityCarrier || null,
      validatingCarrier: route.validatingCarrier || null,
      transaction: route.transaction || null,
    }));

    // Try multiple request body formats — web API format first, then BkApi format
    const webApiBody = {
      customerId: region.customerId,
      customerName: region.customerName,
      dataSource: datasource,
      recommendationId,
      routes: bookingRoutes,
      passengers: {
        adults: Number(adults),
        children: Array.from({ length: Number(children) }, () => ({ age: 10 })),
      },
      confirmed: false,
      loadServices: false,
    };

    // Add authorizationGuid
    if (FLIGHTROBOT_AUTH_GUID) {
      webApiBody.authorizationGuid = FLIGHTROBOT_AUTH_GUID;
    }

    const url = `https://www.farewise.${domain}/api/recommendations/book`;
    const bodyStr = JSON.stringify(webApiBody);

    // Log full request for debugging — send to renderer too
    console.log(`Farewise createReservation (${language.toUpperCase()}) → ${url}`);
    console.log(`Request body:`, bodyStr.substring(0, 6000));

    // Send debug info to renderer for visibility
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('farewise:booking-debug', {
        url,
        datasource,
        recommendationId,
        routeCount: bookingRoutes.length,
        segmentCounts: bookingRoutes.map(r => (r.segments || []).length),
        firstSegment: bookingRoutes[0]?.segments?.[0] ? JSON.stringify(bookingRoutes[0].segments[0]).substring(0, 500) : 'none',
        bodyLength: bodyStr.length,
      });
    }

    await loginToFarewise(language);
    const res = await sessionFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Referer": `https://www.farewise.${domain}/nd/flight/search`,
        "Origin": `https://www.farewise.${domain}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      },
      body: bodyStr,
    }, language);

    const resBody = await res.text();
    console.log(`Farewise reservation response: ${res.status}`, resBody.substring(0, 2000));

    if (!res.ok) {
      console.error(`Farewise reservation error: ${res.status}`, resBody);
      return { ok: false, error: `Reservation failed: ${res.status} — ${resBody.substring(0, 500)}` };
    }

    const data = JSON.parse(resBody);
    const pnr = data?.pnr || data?.number || data?.reservationId || data?.id || "";
    const resolvedDatasource = data?.dataSource || data?.datasource || datasource;
    return { ok: true, pnr, datasource: resolvedDatasource, data };
  } catch (err) {
    console.error("Farewise createReservation error:", err);
    return { ok: false, error: String(err) };
  }
});

// ✈️ Farewise: Open booking URL in browser
ipcMain.handle("farewise:openBooking", async (_, { pnr, datasource, language = "no" }) => {
  try {
    const domain = language === "da" ? "dk" : "no";
    const url = `https://www.farewise.${domain}/nd/flight/reservation/${encodeURIComponent(pnr)}/${encodeURIComponent(datasource)}`;
    console.log(`Opening Farewise booking URL: ${url}`);
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    console.error("Farewise openBooking error:", err);
    return { ok: false, error: String(err) };
  }
});

// ✅ BRUKES AV pptxMerger (TypeScript-generert PPTX) – åpner direkte i PowerPoint
ipcMain.handle("ppt:open-temp", async (_, { data, fileName }) => {
  try {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, fileName);

    const buffer = Buffer.from(data);
    await fs.promises.writeFile(filePath, buffer);
    await shell.openPath(filePath);

    return { ok: true };
  } catch (err) {
    console.error("Error opening temp PPT:", err);
    return { ok: false, error: String(err) };
  }
});

/* --------------------------------------------------
   🧠 POWERPOINT – BYGG I ÅPEN PPT (NY)
-------------------------------------------------- */

/**
 * Mottar ArrayBuffers fra renderer og bygger PowerPoint
 */
// ──────────────────────────────────────────────
// ✈️ Bygg Flyinformasjon PPTX fra scratch med JSZip
// Ingen mal trengs — tabellen genereres direkte fra segment-data
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// ✈️ Injiser flytabell i eksisterende Flyinformasjon PPTX
// Fjerner det innebygde Excel OLE-objektet og erstatter med ekte PPTX-tabell
// ──────────────────────────────────────────────
async function injectFlightTable(buffer, segments, passengers, outboundSegmentCount, language = 'no') {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files).filter(
    f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml') && !f.includes('_rels')
  ).sort();

  // IATA flyplass → bynavn
  const airportNames = {
    OSL:'Oslo', BGO:'Bergen', SVG:'Stavanger', TRD:'Trondheim', TOS:'Tromsø',
    CPH:'København', ARN:'Stockholm', HEL:'Helsinki', LHR:'London', LGW:'London Gatwick',
    CDG:'Paris', AMS:'Amsterdam', FRA:'Frankfurt', MUC:'München', ZRH:'Zürich',
    FCO:'Roma', BCN:'Barcelona', MAD:'Madrid', VIE:'Wien', BRU:'Brussel',
    DXB:'Dubai', DOH:'Doha', AUH:'Abu Dhabi', IST:'Istanbul', SIN:'Singapore',
    BKK:'Bangkok', KUL:'Kuala Lumpur', HKG:'Hongkong', NRT:'Tokyo', ICN:'Seoul',
    SYD:'Sydney', MEL:'Melbourne', JFK:'New York', LAX:'Los Angeles', MIA:'Miami',
    ORD:'Chicago', DFW:'Dallas', ATL:'Atlanta', SFO:'San Francisco', YYZ:'Toronto',
    GRU:'São Paulo', EZE:'Buenos Aires', LIM:'Lima', BOG:'Bogotá', SCL:'Santiago',
    NBO:'Nairobi', ADD:'Addis Abeba', DAR:'Dar es Salaam', JRO:'Kilimanjaro',
    ZNZ:'Zanzibar', MBA:'Mombasa', ENT:'Entebbe', KGL:'Kigali', LOS:'Lagos',
    ACC:'Accra', CPT:'Cape Town', JNB:'Johannesburg', DUR:'Durban', SEZ:'Mahé',
    MLE:'Malé', BOM:'Mumbai', DEL:'New Delhi', MAA:'Chennai', BLR:'Bangalore',
    CMB:'Colombo', KTM:'Kathmandu', CCU:'Kolkata',
  };

  // IATA flyselskap → fullt navn
  const airlineNames = {
    ET:'Ethiopian Airlines', QR:'Qatar Airways', EK:'Emirates', SK:'SAS',
    LH:'Lufthansa', BA:'British Airways', AF:'Air France', KL:'KLM',
    AY:'Finnair', TK:'Turkish Airlines', MS:'EgyptAir', WB:'RwandAir',
    KQ:'Kenya Airways', TC:'Air Tanzania', PW:'Precision Air', S8:'Sounds Air',
    DY:'Norwegian', FR:'Ryanair', U2:'easyJet', VY:'Vueling',
    IB:'Iberia', AZ:'ITA Airways', OS:'Austrian', LX:'Swiss',
    UA:'United Airlines', AA:'American Airlines', DL:'Delta Air Lines',
    AC:'Air Canada', QF:'Qantas', NZ:'Air New Zealand', CX:'Cathay Pacific',
    SQ:'Singapore Airlines', MH:'Malaysia Airlines', TG:'Thai Airways',
    JL:'Japan Airlines', NH:'ANA', OZ:'Asiana Airlines', KE:'Korean Air',
  };

  const expandAirport = code => airportNames[code?.toUpperCase()] || code || '';
  const expandAirline = code => airlineNames[code?.toUpperCase()] || code || '';

  // Kantlinje-XML mosegrønn #798D84
  const border = (w = 9525) =>
    `<a:solidFill><a:srgbClr val="798D84"/></a:solidFill>`;
  const allBorders = (w = 9525) =>
    `<a:lnL w="${w}" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnL>` +
    `<a:lnR w="${w}" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnR>` +
    `<a:lnT w="${w}" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnT>` +
    `<a:lnB w="${w}" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnB>`;

  // Hjelpefunksjon: én normal celle (ikke merged)
  // algn: "l"=venstre, "ctr"=midtstilt
  function makeCell(text, { bg, fontColor, font, sz, bold, algn, bottomBorder } = {}) {
    const bgFill = bg ? `<a:solidFill><a:srgbClr val="${bg}"/></a:solidFill>` : `<a:noFill/>`;
    const fc = fontColor || '2C2C2C';
    const typeface = font || 'PT Sans';
    const fontSize = sz || '900';
    const boldAttr = bold ? ' b="1"' : '';
    const align = algn || 'ctr';
    const lnBXml = bottomBorder
      ? `<a:lnB w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnB>`
      : `<a:lnB w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnB>`;
    return (
      `<a:tc>` +
        `<a:txBody>` +
          `<a:bodyPr anchor="ctr"/>` +
          `<a:lstStyle/>` +
          `<a:p>` +
            `<a:pPr algn="${align}"/>` +
            `<a:r>` +
              `<a:rPr lang="nb-NO" sz="${fontSize}"${boldAttr} dirty="0">` +
                `<a:solidFill><a:srgbClr val="${fc}"/></a:solidFill>` +
                `<a:latin typeface="${typeface}"/>` +
              `</a:rPr>` +
              `<a:t>${text}</a:t>` +
            `</a:r>` +
            `<a:endParaRPr lang="nb-NO" sz="${fontSize}"${boldAttr} dirty="0">` +
              `<a:solidFill><a:srgbClr val="${fc}"/></a:solidFill>` +
              `<a:latin typeface="${typeface}"/>` +
            `</a:endParaRPr>` +
          `</a:p>` +
        `</a:txBody>` +
        `<a:tcPr marL="114300" marR="114300" marT="45720" marB="45720">` +
          `<a:lnL w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnL>` +
          `<a:lnR w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnR>` +
          `<a:lnT w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnT>` +
          lnBXml +
          bgFill +
        `</a:tcPr>` +
      `</a:tc>`
    );
  }

  // Merged celle som spenner over alle 5 kolonner
  function makeMergedCell(text, { bg, fontColor, font, sz, bold, algn } = {}) {
    const bgFill = bg ? `<a:solidFill><a:srgbClr val="${bg}"/></a:solidFill>` : `<a:noFill/>`;
    const fc = fontColor || '2C2C2C';
    const typeface = font || 'PT Sans';
    const fontSize = sz || '900';
    const boldAttr = bold ? ' b="1"' : '';
    const align = algn || 'l';
    const numCols = 5;
    // Første celle med gridSpan=5, resten hMerge="1"
    const firstCell =
      `<a:tc gridSpan="${numCols}">` +
        `<a:txBody>` +
          `<a:bodyPr anchor="ctr"/>` +
          `<a:lstStyle/>` +
          `<a:p>` +
            `<a:pPr algn="${align}"/>` +
            `<a:r>` +
              `<a:rPr lang="nb-NO" sz="${fontSize}"${boldAttr} dirty="0">` +
                `<a:solidFill><a:srgbClr val="${fc}"/></a:solidFill>` +
                `<a:latin typeface="${typeface}"/>` +
              `</a:rPr>` +
              `<a:t>${text}</a:t>` +
            `</a:r>` +
            `<a:endParaRPr lang="nb-NO" sz="${fontSize}"${boldAttr} dirty="0">` +
              `<a:solidFill><a:srgbClr val="${fc}"/></a:solidFill>` +
              `<a:latin typeface="${typeface}"/>` +
            `</a:endParaRPr>` +
          `</a:p>` +
        `</a:txBody>` +
        `<a:tcPr marL="114300" marR="114300" marT="45720" marB="45720">` +
          `<a:lnL w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnL>` +
          `<a:lnR w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnR>` +
          `<a:lnT w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnT>` +
          `<a:lnB w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnB>` +
          bgFill +
        `</a:tcPr>` +
      `</a:tc>`;
    const mergedCells = Array(numCols - 1).fill(
      `<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT><a:lnB w="0"><a:noFill/></a:lnB><a:noFill/></a:tcPr></a:tc>`
    ).join('');
    return firstCell + mergedCells;
  }

  // Kolonnebredder like store (totalt cx=6567488)
  const colWidths = [1313498, 1313498, 1313498, 1313498, 1313496];
  const colDefs = colWidths.map(w => `<a:gridCol w="${w}"/>`).join('');

  // Rad 1: #46413F, venstrestilt + vertikalt sentrert "REISENDE OG FLY", hvit Montserrat 8pt, spenner alle 5 kol
  const row1 = `<a:tr h="320000">${makeMergedCell('REISENDE OG FLY', { bg: '46413F', fontColor: 'FFFFFF', font: 'Montserrat', sz: '800', bold: false, algn: 'l' })}</a:tr>`;

  // Rad 2: 2-delt rad — kol 1: "NAVN PÅ REISENDE" (label), kol 2-5 merged: tom verdicelle
  // labelCell: F2F2F2 bakgrunn, mørk tekst, midtstilt; valueCell: F2F2F2 bakgrunn, tom
  const labelCell =
    `<a:tc>` +
      `<a:txBody>` +
        `<a:bodyPr anchor="ctr"/>` +
        `<a:lstStyle/>` +
        `<a:p><a:pPr algn="l"/>` +
          `<a:r><a:rPr lang="nb-NO" sz="800" dirty="0">` +
            `<a:solidFill><a:srgbClr val="2C2C2C"/></a:solidFill>` +
            `<a:latin typeface="PT Sans"/>` +
          `</a:rPr><a:t>NAVN P\u00C5 REISENDE</a:t></a:r>` +
          `<a:endParaRPr lang="nb-NO" sz="800" dirty="0">` +
            `<a:solidFill><a:srgbClr val="2C2C2C"/></a:solidFill>` +
            `<a:latin typeface="PT Sans"/>` +
          `</a:endParaRPr>` +
        `</a:p>` +
      `</a:txBody>` +
      `<a:tcPr marL="114300" marR="114300" marT="45720" marB="45720">` +
        `<a:lnL w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnL>` +
        `<a:lnR w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnR>` +
        `<a:lnT w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnT>` +
        `<a:lnB w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnB>` +
        `<a:solidFill><a:srgbClr val="F2F2F2"/></a:solidFill>` +
      `</a:tcPr>` +
    `</a:tc>`;
  // Verdicellen er tom — bruker fyller inn navn manuelt
  const valueCell =
    `<a:tc gridSpan="4">` +
      `<a:txBody>` +
        `<a:bodyPr anchor="ctr"/>` +
        `<a:lstStyle/>` +
        `<a:p><a:pPr algn="l"/></a:p>` +
      `</a:txBody>` +
      `<a:tcPr marL="114300" marR="114300" marT="45720" marB="45720">` +
        `<a:lnL w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnL>` +
        `<a:lnR w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnR>` +
        `<a:lnT w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnT>` +
        `<a:lnB w="9525" cap="flat" cmpd="sng"><a:solidFill><a:srgbClr val="798D84"/></a:solidFill></a:lnB>` +
        `<a:solidFill><a:srgbClr val="F2F2F2"/></a:solidFill>` +
      `</a:tcPr>` +
    `</a:tc>` +
    Array(3).fill(`<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT><a:lnB w="0"><a:noFill/></a:lnB><a:noFill/></a:tcPr></a:tc>`).join('');
  const row2 = `<a:tr h="320000">${labelCell}${valueCell}</a:tr>`;

  // Rad 3: #798D84, midtstilt + vertikalt sentrert, hvit Montserrat 8pt, IKKE fet
  const colHeaders = ['DATO', 'FRA', 'TIL', 'TID', 'SELSKAP'];
  const row3 = `<a:tr h="320000">${colHeaders.map(h => makeCell(h, { bg: '798D84', fontColor: 'FFFFFF', font: 'Montserrat', sz: '800', bold: false, algn: 'ctr' })).join('')}</a:tr>`;

  // Datarader: vekslende #F2F2F2/#D9D9D9, midtstilt (horisontal+vertikal), PT Sans 9pt, bunnlinje #BFBFBF
  // Bestem hvor mange outbound-segmenter det er (resten er inbound)
  const insertAt = (typeof outboundSegmentCount === 'number' && outboundSegmentCount > 0 && outboundSegmentCount < segments.length)
    ? outboundSegmentCount
    : segments.length; // Ingen inbound = legg til sist

  // Ekstra rad for manuell innenriksflyvning (standard: Arusha → Zanzibar, Precision Air)
  const extraRowBg = insertAt % 2 === 0 ? 'F2F2F2' : 'D9D9D9';
  const extraRowCells = [
    '',            // Dato: tom – fylles inn manuelt
    'Arusha',      // Fra
    'Zanzibar',    // Til
    '09.25 - 10.45', // Tid
    'Precision Air', // Selskap
  ];
  const extraRow = `<a:tr h="300000">${extraRowCells.map(c => makeCell(c, { bg: extraRowBg, fontColor: '2C2C2C', font: 'PT Sans', sz: '800', bold: false, algn: 'ctr', bottomBorder: true })).join('')}</a:tr>`;

  // Bygg dataradene med korrekt vekslende farge.
  // Rader ETTER den ekstra raden (inbound) er forskjøvet +1 i endelig posisjon,
  // så de må få fargen basert på sin globale indeks (ikke den opprinnelige segmentindeksen).
  const dataRowsArr = [];

  // Outbound-segmenter (indeks 0 .. insertAt-1) — globalt indeks = i
  for (let i = 0; i < insertAt && i < segments.length; i++) {
    const bg = i % 2 === 0 ? 'F2F2F2' : 'D9D9D9';
    const seg = segments[i];
    const cells = [seg.date || '', expandAirport(seg.from), expandAirport(seg.to), seg.time || '', expandAirline(seg.airline)];
    dataRowsArr.push(`<a:tr h="300000">${cells.map(c => makeCell(c, { bg, fontColor: '2C2C2C', font: 'PT Sans', sz: '800', bold: false, algn: 'ctr', bottomBorder: true })).join('')}</a:tr>`);
  }

  // Ekstra rad (Arusha → Zanzibar) — globalt indeks = insertAt
  dataRowsArr.push(extraRow);

  // Inbound-segmenter (indeks insertAt .. end) — globalt indeks = i + 1 (forskjøvet av ekstra rad)
  for (let i = insertAt; i < segments.length; i++) {
    const globalIdx = i + 1;
    const bg = globalIdx % 2 === 0 ? 'F2F2F2' : 'D9D9D9';
    const seg = segments[i];
    const cells = [seg.date || '', expandAirport(seg.from), expandAirport(seg.to), seg.time || '', expandAirline(seg.airline)];
    dataRowsArr.push(`<a:tr h="300000">${cells.map(c => makeCell(c, { bg, fontColor: '2C2C2C', font: 'PT Sans', sz: '800', bold: false, algn: 'ctr', bottomBorder: true })).join('')}</a:tr>`);
  }

  const dataRows = dataRowsArr.join('');

  // Høyde: 3 header-rader à 320000 + datarader à 300000 (inkl. den ekstra raden)
  const tableHeight = 3 * 320000 + (segments.length + 1) * 300000;
  // Gapet mellom tekstboks 7 (bunn y=3715321) og Rektangel 10 (topp y=7631482)
  const gapTop = 3715321;
  const gapBottom = 7631482;
  const yPos = Math.round(((gapTop + gapBottom) / 2) - tableHeight / 2);

  const tableFrame =
    `<p:graphicFrame>` +
      `<p:nvGraphicFramePr>` +
        `<p:cNvPr id="99" name="Flytabell"/>` +
        `<p:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></p:cNvGraphicFramePr>` +
        `<p:nvPr/>` +
      `</p:nvGraphicFramePr>` +
      `<p:xfrm><a:off x="479425" y="${yPos}"/><a:ext cx="6567488" cy="${tableHeight}"/></p:xfrm>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
        `<a:tbl>` +
          `<a:tblPr firstRow="0" bandRow="0"/>` +
          `<a:tblGrid>${colDefs}</a:tblGrid>` +
          row1 + row2 + row3 + dataRows +
        `</a:tbl>` +
      `</a:graphicData></a:graphic>` +
    `</p:graphicFrame>`;

  for (const slideFile of slideFiles) {
    let xml = await zip.files[slideFile].async('string');

    // Fjern innebygd Excel OLE-objekt
    xml = xml.replace(/<p:graphicFrame>(?:(?!<p:graphicFrame>)[\s\S])*?progId="Excel\.Sheet\.12"[\s\S]*?<\/p:graphicFrame>/g, '');

    // Injiser tabell rett før </p:spTree>
    xml = xml.replace('</p:spTree>', tableFrame + '</p:spTree>');

    // Apply language-specific text and locale
    if (language === 'da') {
      xml = xml
        .replace(/lang="nb-NO"/g, 'lang="da-DK"')
        .replace(/REISENDE OG FLY/g, 'REJSENDE OG FLY')
        .replace(/NAVN P\u00C5 REISENDE/g, 'NAVN P\u00C5 REJSENDE');
    }
    zip.file(slideFile, xml);
    console.log(`✈️ Injected flight table into ${slideFile} (${segments.length} rows, 3 header rows, lang=${language})`);
    break;
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function buildFlightPptxFromScratch(segments) {
  // Kalles bare hvis ingen mal-buffer finnes (fallback)
  // Hjelpefunksjon: lag én tabell-celle med tekst
  function tc(text, bold = false, isHeader = false) {
    const bgFill = isHeader
      ? `<a:solidFill><a:srgbClr val="1F3864"/></a:solidFill>`
      : `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`;
    const fontColor = isHeader ? `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>` : `<a:solidFill><a:srgbClr val="333333"/></a:solidFill>`;
    const boldAttr = bold || isHeader ? ' b="1"' : '';
    return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="nb-NO" sz="1200"${boldAttr} dirty="0"><a:latin typeface="PT Sans"/>${fontColor}</a:rPr><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr><a:lnL w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnL><a:lnR w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnR><a:lnT w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnT><a:lnB w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnB>${bgFill}</a:tcPr></a:tc>`;
  }

  // Kolonnebredder i EMU (totalt ~6 567 488 ≈ slide-bredde minus marginer)
  const colWidths = [1313498, 1313498, 1313498, 1313498, 1313496];
  const colDefs = colWidths.map(w => `<a:gridCol w="${w}"/>`).join('');

  // Overskriftsrad
  const headers = ['Dato', 'Fra', 'Til', 'Tid', 'Flyselskap'];
  const headerRow = `<a:tr h="500000">${headers.map(h => tc(h, true, true)).join('')}</a:tr>`;

  // Datarader
  const dataRows = segments.map(seg => {
    const cells = [
      seg.date    || '',
      seg.from    || '',
      seg.to      || '',
      seg.time    || '',
      seg.airline || '',
    ];
    return `<a:tr h="450000">${cells.map(c => tc(c)).join('')}</a:tr>`;
  }).join('');

  // Komplett tabelldefinisjon
  const tableXml = `<a:tbl><a:tblPr firstRow="1" bandRow="0"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid>${colDefs}</a:tblGrid>${headerRow}${dataRows}</a:tbl>`;

  // Slide XML
  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <!-- Tittel -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Tittel"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="479425" y="274638"/><a:ext cx="6567488" cy="600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>
          <a:p><a:r><a:rPr lang="nb-NO" sz="2400" b="1" dirty="0"><a:solidFill><a:srgbClr val="1F3864"/></a:solidFill><a:latin typeface="PT Sans"/></a:rPr><a:t>Flyinformasjon</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <!-- Flytabell -->
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="3" name="Flytabell"/>
          <p:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></p:cNvGraphicFramePr>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm><a:off x="479425" y="950000"/><a:ext cx="6567488" cy="${500000 + segments.length * 450000}"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          ${tableXml}
        </a:graphicData></a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

  // slideRels — ingen relasjoner trengs (ingen bilder/lenker)
  const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  // Minimal presentasjon — 1 slide, standard A4-landscape (9144000 × 6858000 EMU)
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
</p:presentation>`;

  const presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml"        ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml"       ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  // Minimal slideLayout og slideMaster (tomme, men PPTX-validatoren krever dem)
  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

  const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

  const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  // Bygg ZIP
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('ppt/presentation.xml', presentationXml);
  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml);
  zip.file('ppt/slides/slide1.xml', slideXml);
  zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelsXml);
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRelsXml);
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRelsXml);

  console.log(`✈️ Built Flyinformasjon PPTX from scratch — ${segments.length} segment(s)`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ========================================
// HELPER: Get unpacked path for PowerShell scripts
// ========================================
function getUnpackedPath(filename) {
  if (app.isPackaged) {
    // Production: PowerShell cannot read from app.asar, use app.asar.unpacked
    const asarPath = path.join(__dirname, filename);
    return asarPath.replace('app.asar', 'app.asar.unpacked');
  } else {
    // Dev mode: use direct path
    return path.join(__dirname, filename);
  }
}

// ========================================
// IPC: Generate PowerPoint
// ========================================
ipcMain.handle("ppt:generate", async (_, payload) => {
  const { base, modules, departureDate, language, flightData, baseTemplateName } = payload;
  
  // CRITICAL DEBUG: Write to file for production debugging
  const logPath = path.join(os.tmpdir(), 'nts-ppt-debug.log');
  
  function debugLog(msg) {
    const fullMsg = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, fullMsg);
    console.log(msg);
  }
  
  debugLog(`ppt:generate called. departureDate=${departureDate}, modules=${modules?.length}, language=${language}, isPackaged=${app.isPackaged}`);
  
  try {
    debugLog('Step 1: Creating temp directory...');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptgen-'));
    debugLog(`Step 1 OK: tmpDir=${tmpDir}`);

    debugLog('Step 2: Preparing base file...');
    const defaultFileName = language === 'da' ? 'Rejseprogram og Tilbud.pptx' : 'Reiseprogram og Tilbud.pptx';
    // Bruk basefil-navn fra UI hvis tilgjengelig (f.eks. "Reiseprogram og Tilbud - Safari & Zanzibar")
    const safeBaseName = baseTemplateName
      ? baseTemplateName.replace(/[<>:"/\\|?*]/g, '-').replace(/\.pptx$/i, '') + '.pptx'
      : defaultFileName;
    const fileName = safeBaseName;
    const basePath = path.join(tmpDir, fileName);
    debugLog(`Step 2 OK: basePath=${basePath}`);
    
    debugLog(`Step 3: Writing base file (size=${base?.length || 0} bytes)...`);
    fs.writeFileSync(basePath, Buffer.from(base));
    debugLog('Step 3 OK: Base file written');
    
    debugLog(`Step 4: Writing ${modules.length} module files...`);
    const modulePaths = [];
    for (let i = 0; i < modules.length; i++) {
      const safeName = (modules[i].name || `mod${i + 1}`)
        .replace(/[^a-zA-Z0-9æøåÆØÅ\-_. ]/g, '_')
        .replace(/\s+/g, '_');
      const modPath = path.join(tmpDir, safeName.endsWith('.pptx') ? safeName : `${safeName}.pptx`);

      // Flyinformasjon: erstatt {{DATO}}, {{FRA}} etc. direkte i PPTX XML før fil skrives
      const isFlight = modules[i].name && (
        modules[i].name.toLowerCase().includes('flyinformasjon') ||
        modules[i].name.toLowerCase().includes('flyinformation')
      );
      if (isFlight && flightData?.flights?.[0]?.segments?.length > 0) {
        const segments = flightData.flights[0].segments;
        const outboundSegmentCount = flightData.flights[0].outboundSegmentCount ?? segments.length;
        const srcBuffer = Buffer.from(modules[i].buffer);
        let finalBuffer;
        if (srcBuffer.length > 100) {
          // Mal finnes — injiser tabell i eksisterende PPTX (bevarer design)
          finalBuffer = await injectFlightTable(srcBuffer, segments, flightData.passengers, outboundSegmentCount, language);
        } else {
          // Ingen mal — bygg fra scratch
          finalBuffer = await buildFlightPptxFromScratch(segments);
        }
        fs.writeFileSync(modPath, finalBuffer);
        console.log(`✈️ Flyinformasjon injected: ${modules[i].name} (${segments.length} segments)`);
      } else {
        fs.writeFileSync(modPath, Buffer.from(modules[i].buffer));
      }
      modulePaths.push(modPath);
    }
    debugLog(`Step 4 OK: All ${modules.length} module files written`);
    
    debugLog('Step 5: Calling ppt-build.ps1...');
    // Kall eksisterende build-handler
    const result = await new Promise((resolve, reject) => {
      const scriptPath = getUnpackedPath("ppt-build.ps1");
      
      debugLog(`  Script path: ${scriptPath}`);
      debugLog(`  Base path: ${basePath}`);
      debugLog(`  Departure date: ${departureDate || "(ingen)"}`);
      debugLog(`  Module count: ${modulePaths.length}`);
      
      debugLog('Step 5a: Spawning powershell.exe...');
      
      execFile(
        "powershell.exe",
        [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
          basePath,
          departureDate || "",
          ...modulePaths
        ],
        (error, stdout, stderr) => {
          debugLog('Step 5b: PowerShell callback received');
          // ALWAYS log output from PowerShell
          if (stdout) {
            debugLog('PowerShell stdout: ' + stdout);
            console.log('📝 PowerShell (ppt-build) output:\n' + stdout);
          }
          if (stderr) {
            debugLog('PowerShell stderr: ' + stderr);
            console.warn('⚠️ PowerShell (ppt-build) warnings:\n' + stderr);
          }
          
          if (error) {
            debugLog(`PowerShell ERROR: ${error.message}`);
            console.error("❌ PowerPoint build error:", error);
            reject(stderr || error.message);
          } else {
            debugLog('Step 5c: ppt-build.ps1 SUCCESS');
            console.log('✅ ppt-build.ps1 completed successfully');
            console.log('✅ ppt-build.ps1 completed successfully');
            // After successful build, run post-processing
            const postProcessPath = getUnpackedPath("ppt-post-process.ps1");
            const flightDataJson = flightData ? JSON.stringify(flightData) : "";
            
            // Debug: Log flight data being sent
            if (flightData) {
              console.log('🛩️ Flight data being sent to PowerShell:');
              console.log('  Flights count:', flightData.flights?.length || 0);
              if (flightData.flights && flightData.flights[0]) {
                console.log('  First flight segments:', flightData.flights[0].segments?.length || 0);
              }
              console.log('  JSON length:', flightDataJson.length);
            } else {
              console.log('⚠️ No flight data to send to PowerShell');
            }
            
            // Write flight data to temp file instead of passing as parameter (safer for special characters)
            let flightDataPath = "";
            if (flightDataJson) {
              flightDataPath = path.join(tmpDir, 'flight-data.json');
              fs.writeFileSync(flightDataPath, flightDataJson, 'utf8');
              console.log('📄 Flight data written to:', flightDataPath);
            }
            
            console.log('🔧 Starting ppt-post-process.ps1...');
            console.log('  Script path:', postProcessPath);
            console.log('  Presentation path:', basePath);
            console.log('  Departure date:', departureDate || "(ingen)");
            console.log('  Flight data path:', flightDataPath || "(ingen)");
            console.log('  Language:', language || "no");
            
            execFile(
              "powershell.exe",
              [
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                postProcessPath,
                basePath,
                departureDate || "",
                flightDataPath,  // Send file path instead of JSON string
                language || "no"
              ],
              (postError, postStdout, postStderr) => {
                // ALWAYS log all output for debugging
                if (postStdout) console.log('📝 PowerShell (post-process) output:\n' + postStdout);
                if (postStderr) console.warn('⚠️ PowerShell (post-process) warnings:\n' + postStderr);
                
                if (postError) {
                  console.error("❌ PowerPoint post-processing error:", postError);
                  console.error("Error code:", postError.code);
                  console.error("Error message:", postError.message);
                  // Check if it's a critical error or just warnings
                  if (postStdout && postStdout.includes("Post-processing complete")) {
                    console.log("✅ Despite errors, post-processing completed successfully");
                    console.log("� PowerPoint file created at:", basePath);
                    console.log("📂 PowerShell will open the file automatically");
                    resolve({ ok: true });
                  } else {
                    reject(postStderr || postError.message);
                  }
                } else {
                  console.log("✅ ppt-post-process.ps1 complete");
                  console.log("� PowerPoint file created at:", basePath);
                  console.log("📂 PowerShell opened the file automatically");
                  resolve({ ok: true });
                }
              }
            );
          }
        }
      );
    });
    
    debugLog('Step 6: All PowerShell scripts completed successfully');

    // Step 7: Show save dialog starting in correct customer folder
    if (result.ok && mainWindow) {
      const username = os.userInfo().username;
      const userHome = path.join('C:', 'Users', username);
      const defaultDir = language === 'da'
        ? path.join(userHome, 'OneDrive - TANZANIA TOURS', 'TANZANIA TOURS - Dokumenter', 'DK TANZANIA TOURS', 'Salg', 'Kunder DK', '2026 DK')
        : path.join(userHome, 'OneDrive - TANZANIA TOURS', 'TANZANIA TOURS - Dokumenter', 'NO TANZANIA TOURS', 'Kunder NORGE', '2026 NO');
      
      // Fallback: hvis mappen ikke finnes, bruk Desktop
      const saveDir = fs.existsSync(defaultDir) ? defaultDir : path.join(userHome, 'Desktop');

      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: language === 'da' ? 'Gem præsentation som...' : 'Lagre presentasjon som...',
        defaultPath: path.join(saveDir, fileName),
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      });

      if (!saveResult.canceled && saveResult.filePath) {
        const destPath = saveResult.filePath.endsWith('.pptx') ? saveResult.filePath : saveResult.filePath + '.pptx';
        // PowerShell: finn åpen presentasjon og SaveAs til valgt sti
        const saveScript = [
          `$ppApp = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')`,
          `foreach ($pres in $ppApp.Presentations) {`,
          `  if ($pres.FullName -ieq '${basePath.replace(/'/g, "''")}') {`,
          `    $pres.SaveAs('${destPath.replace(/'/g, "''")}', 24)`,
          `    break`,
          `  }`,
          `}`,
        ].join('\n');
        const saveScriptPath = path.join(tmpDir, 'save-as.ps1');
        fs.writeFileSync(saveScriptPath, saveScript, 'utf8');

        await new Promise((res) => {
          execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', saveScriptPath],
            (err, stdout, stderr) => {
              if (err) console.warn('SaveAs warning:', stderr || err.message);
              else console.log('Saved to:', destPath);
              res(); // Ikke feile hele operasjonen hvis SaveAs har problemer
            }
          );
        });

        debugLog(`Step 7 OK: Saved to ${destPath}`);
        return { ok: true, savedPath: destPath };
      }
      // Bruker trykket Avbryt – filen er fortsatt åpen i PowerPoint fra temp
      debugLog('Step 7: Save dialog cancelled by user');
    }

    debugLog(`Final result: ${JSON.stringify(result)}`);
    console.log('Final result:', result);
    return result;
  } catch (error) {
    debugLog(`FATAL ERROR: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
    console.error('❌ ppt:generate error:', error);
    console.error('Error stack:', error.stack);
    return { ok: false, error: String(error) };
  }
});

/**
 * Bygger PowerPoint ved å la PowerPoint selv gjøre jobben:
 * - Åpner basefil synlig
 * - Setter inn modul-slides før de 2 siste slidene
 * - Kjører DG/DTO-makro
 * - LAGRER IKKE (bruker lagrer selv)
 */
ipcMain.handle("ppt:build-in-open-powerpoint", async (_, payload) => {
  const { basePath, modulePaths, departureDate, language, flightData } = payload;

  return new Promise((resolve, reject) => {
    const scriptPath = getUnpackedPath("ppt-build.ps1");
    execFile(
      "powershell.exe",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        basePath,
        departureDate || "",
        ...modulePaths
      ],
      (error, stdout, stderr) => {
        if (error) {
          console.error("PowerPoint build error:", stderr || error);
          reject(stderr || error.message);
        } else {
          // Kjør DG/DTO-parvis og flyinformasjon etter at PowerPoint er bygget
          try {
            const { replaceDgDtoPairwise, insertFlightInformation } = require('./ppt-dg-dto.js');
            const ole = require('win32ole');
            const pptApp = ole.client.Dispatch('PowerPoint.Application');
            // Finn åpen presentasjon basert på basePath
            let pres = null;
            for (let i = 1; i <= pptApp.Presentations.Count; i++) {
              const p = pptApp.Presentations.Item(i);
              if (p.FullName && p.FullName.toLowerCase() === basePath.toLowerCase()) {
                pres = p;
                break;
              }
            }
            if (!pres) throw new Error('Fant ikke åpen presentasjon for DG/DTO');
            console.log('🔄 Calling DG/DTO replacement with departureDate:', departureDate);
            replaceDgDtoPairwise(departureDate || null);
            // Sett inn flyinformasjon hvis tilgjengelig
            if (flightData && flightData.flights && flightData.flights.length > 0) {
              console.log('✈️ Calling flight information insertion');
              insertFlightInformation(pres, flightData, language || 'no');
            }
            resolve({ ok: true });
          } catch (err) {
            console.error("⚠️ DG/DTO error:", err);
            reject('DG/DTO-feil: ' + err.message);
          }
        }
      }
    );
  });
});

/* --------------------------------------------------   📁 FILE DIALOG
-------------------------------------------------- */
ipcMain.handle("dialog:select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'PowerPoint', extensions: ['pptx', 'ppt'] }
    ]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  
  return { filePaths: result.filePaths }; // Return all selected files
});
// Read file content (for template upload)
ipcMain.handle("file:read", async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer };
  } catch (error) {
    console.error("❌ File read error:", error);
    return { success: false, error: error.message };
  }
});
/* --------------------------------------------------   � ONEDRIVE SYNC (Auto-sync kl 08:00 + Manual)
-------------------------------------------------- */
// Get OneDrive shared folder path
function getOneDriveSharedPath(language = 'no') {
  const username = os.userInfo().username;
  const languageFolder = language === 'da' ? 'NTS DK' : 'NTS NO';
  
  const possiblePaths = [
    path.join('C:', 'Users', username, 'OneDrive - TANZANIA TOURS', 'TANZANIA TOURS - Dokumenter', 'NO TANZANIA TOURS', 'NTS', languageFolder),
    path.join(os.homedir(), 'OneDrive - TANZANIA TOURS', 'TANZANIA TOURS - Dokumenter', 'NO TANZANIA TOURS', 'NTS', languageFolder),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

// IPC handler: Register template in manifest (files already in OneDrive)
ipcMain.handle("onedrive:upload-template", async (event, args) => {
  console.log("📝 OneDrive: Admin registering template in manifest");
  
  try {
    const { filePath: selectedFilePath, category, categoryId, order, language } = args;
    
    const oneDrivePath = getOneDriveSharedPath(language);
    if (!oneDrivePath) {
      return { success: false, error: "OneDrive-mappe ikke funnet" };
    }
    
    // Check if selected file is inside OneDrive folder (supports subfolders)
    const normalizedOneDrive = path.normalize(oneDrivePath);
    const normalizedFile = path.normalize(selectedFilePath);
    
    if (!normalizedFile.startsWith(normalizedOneDrive)) {
      return { success: false, error: "Filen må ligge i OneDrive-mappen for å kunne deles" };
    }
    
    // Calculate relative path from OneDrive root
    const relativePath = path.relative(normalizedOneDrive, normalizedFile);
    console.log(`✅ File found in OneDrive: ${relativePath}`);
    
    // Update or create manifest.json in the root of NTS NO/NTS DK
    const manifestPath = path.join(oneDrivePath, 'manifest.json');
    let manifest = [];
    
    if (fs.existsSync(manifestPath)) {
      const manifestData = fs.readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(manifestData);
    }
    
    // Add or update entry (use relative path for subfolders)
    const existingIndex = manifest.findIndex(m => m.filePath === relativePath);
    const entry = {
      filePath: relativePath, // Store relative path (e.g., "Safari/Arusha.pptx")
      fileName: path.basename(selectedFilePath), // Also store just the filename
      category,
      categoryId: categoryId || category, // Store category ID for reference
      order: order || 999,
      uploadedAt: new Date().toISOString(),
      uploadedBy: os.userInfo().username,
    };
    
    if (existingIndex >= 0) {
      manifest[existingIndex] = entry;
    } else {
      manifest.push(entry);
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Updated manifest.json with: ${relativePath}`);
    
    return { success: true, filePath: relativePath };
    
  } catch (error) {
    console.error("❌ Register error:", error);
    return { success: false, error: error.message };
  }
});

// IPC handler for manual sync trigger
ipcMain.handle("onedrive:sync-now", async (event, args) => {
  console.log("📁 OneDrive: Sync from manifest");
  const language = args?.language || 'no';
  console.log("📁 Language:", language);
  
  try {
    const oneDrivePath = getOneDriveSharedPath(language);
    
    if (!oneDrivePath) {
      console.error("❌ OneDrive folder not found");
      return { 
        success: false, 
        error: `OneDrive mappe ikke funnet. Kontroller at OneDrive er synkronisert.` 
      };
    }
    
    const manifestPath = path.join(oneDrivePath, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.log("⚠️ No manifest.json found");
      return { 
        success: true, 
        files: [], 
        count: 0,
        message: "Ingen filer lastet opp av admin ennå"
      };
    }
    
    // Read manifest – returner kun metadata, IKKE fildata (unngår minnekrasj)
    const manifestData = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData);
    
    console.log(`📁 Found ${manifest.length} files in manifest`);

    // Filtrer ut filer som faktisk eksisterer
    const fileList = manifest
      .map(entry => {
        const relPath = entry.filePath || entry.fileName;
        const fullPath = path.join(oneDrivePath, relPath);
        if (!fs.existsSync(fullPath)) {
          console.log(`⚠️ File not found: ${relPath}`);
          return null;
        }
        return {
          name: entry.fileName || path.basename(relPath),
          relPath,
          category: entry.category,
          categoryId: entry.categoryId,
          order: entry.order,
          uploadedAt: entry.uploadedAt,
          uploadedBy: entry.uploadedBy,
          size: fs.statSync(fullPath).size,
        };
      })
      .filter(Boolean);
    
    return { 
      success: true, 
      files: fileList,       // Kun metadata – ingen base64-data
      count: fileList.length,
      sourcePath: oneDrivePath,
      language: language
    };
    
  } catch (error) {
    console.error("❌ OneDrive sync error:", error);
    return { success: false, error: error.message };
  }
});

// Henter én fil av gangen – unngår at alle filer lastes inn i minnet på én gang
ipcMain.handle("onedrive:get-file", async (event, args) => {
  const { language, relPath } = args;
  try {
    const oneDrivePath = getOneDriveSharedPath(language);
    if (!oneDrivePath) return { success: false, error: 'OneDrive mappe ikke funnet' };

    const fullPath = path.join(oneDrivePath, relPath);
    if (!fs.existsSync(fullPath)) return { success: false, error: `Fil ikke funnet: ${relPath}` };

    const buffer = fs.readFileSync(fullPath);
    return { success: true, data: buffer.toString('base64') };
  } catch (error) {
    console.error(`❌ Failed to read file ${relPath}:`, error.message);
    return { success: false, error: error.message };
  }
});

// Scheduler for daglig auto-sync kl 08:00
// Checks every minute if it's 08:00
function startOneDriveSyncScheduler() {
  console.log("📅 OneDrive Scheduler: Starting daily sync scheduler (08:00)");
  
  // Check every minute
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Trigger sync at 08:00 (and only at minute 0 to avoid multiple triggers)
    if (hours === 8 && minutes === 0) {
      console.log("⏰ OneDrive Scheduler: Time is 08:00 - triggering auto-sync");
      
      // Send event to renderer process to trigger sync
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("onedrive:auto-sync-trigger");
        console.log("📤 OneDrive Scheduler: Sent auto-sync event to renderer");
      } else {
        console.warn("⚠️ OneDrive Scheduler: Main window not available");
      }
    }
  }, 60 * 1000); // Check every minute
}

/* --------------------------------------------------
   �🔄 AUTO UPDATE (kun i PROD)
-------------------------------------------------- */

function initAutoUpdate() {
  if (isDev) return;

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.checkForUpdates();

  autoUpdater.on("checking-for-update", () => {
    console.log("🔍 Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("⬇️ Update available:", info.version);
    if (mainWindow) {
      mainWindow.webContents.send("update-status", {
        type: "available",
        version: info.version
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("✅ No update available");
  });

  autoUpdater.on("error", (err) => {
    console.error("❌ Auto-update error:", err);
    if (mainWindow) {
      mainWindow.webContents.send("update-status", {
        type: "error",
        message: err?.message || String(err)
      });
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`⬇️ Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("🚀 Update downloaded:", info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Oppdatering klar",
        message: `Versjon ${info.version} er lastet ned.`,
        detail: "Vil du starte appen på nytt nå for å installere oppdateringen?",
        buttons: ["Ja, start på nytt", "Ikke nå"],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    } else {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

/* --------------------------------------------------
   🪟 WINDOW
-------------------------------------------------- */

function createWindow() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 1200,              // start-bredde
    height: height,           // full høyde ved oppstart

    resizable: true,          // bruker kan endre både bredde og høyde
    maximizable: true,        // tillatt
    center: true,

    icon: getUnpackedPath("logo-white.ico"),
    webPreferences: {
      preload: getUnpackedPath("preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Store global reference for OneDrive sync scheduler
  mainWindow = win;

  if (isDev) {
    win.loadURL("http://localhost:5174");
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    console.log("📦 PROD index.html:", indexPath);
    win.loadFile(indexPath);
  }

  win.once("ready-to-show", () => {
    initAutoUpdate();
    
    // Start OneDrive sync scheduler
    startOneDriveSyncScheduler();
    console.log("✅ OneDrive daily sync scheduler started");
  });

  // Clear reference when window is closed
  win.on("closed", () => {
    mainWindow = null;
  });
}

/* --------------------------------------------------
   🚀 APP READY
-------------------------------------------------- */

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.tanzaniatours.nts");
  }
  createWindow();
});

// KRITISK: Avslutt prosessen når vinduet lukkes på Windows.
// Uten dette fortsetter bakgrunnsprosessen å kjøre og blokkerer NSIS-installer.
app.on("window-all-closed", () => {
  app.quit();
});
