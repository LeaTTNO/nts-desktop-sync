// ──────────────────────────────────────────────
// 📦 IMPORTS
// ──────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, shell, screen, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import fetch from "node-fetch";
import "dotenv/config";
import { execFile } from "child_process";

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

/* --------------------------------------------------
   🔐 ENV
-------------------------------------------------- */

const FLIGHTROBOT_BASE_URL = process.env.FLIGHTROBOT_BASE_URL || "https://www.farewise.no";
const FLIGHTROBOT_AUTH_GUID = process.env.FLIGHTROBOT_AUTH_GUID;

// Region-spesifikke innstillinger
const FAREWISE_REGIONS = {
  no: {
    baseUrl: "https://www.farewise.no",
    currency: "NOK",
    customerId: 17179,
    customerName: "Tanzania Tours ApS",
    authRequired: true,
  },
  da: {
    baseUrl: "https://www.farewise.dk",
    currency: "DKK",
    customerId: 1280,
    customerName: "Tanzania Tours ApS",
    authRequired: false, // DK krever IKKE authorizationGuid
  },
};

console.log("ENV CHECK", {
  FLIGHTROBOT_BASE_URL,
  FLIGHTROBOT_AUTH_GUID_EXISTS: !!FLIGHTROBOT_AUTH_GUID
});

/* --------------------------------------------------
   � FAREWISE LOGIN
-------------------------------------------------- */
const FAREWISE_USERNAME = "tan6170";
const FAREWISE_PASSWORD = "PongweBH!";
let farewiseCookies = null;

async function loginToFarewise(language = "no") {
  const region = FAREWISE_REGIONS[language] || FAREWISE_REGIONS.no;
  const loginUrl = language === "no" 
    ? "https://www.farewise.no/api/accountApi/login"
    : "https://www.farewise.dk/api/accountApi/login";

  console.log(`🔐 Logging in to Farewise (${language.toUpperCase()})...`);
  console.log(`Login URL: ${loginUrl}`);
  console.log(`CustomerId: ${region.customerId}, CustomerName: ${region.customerName}`);

  const res = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/json;charset=UTF-8",
      "Referer": language === "no" ? "https://www.farewise.no/nd/login" : "https://www.farewise.dk/nd/login",
      "Origin": language === "no" ? "https://www.farewise.no" : "https://www.farewise.dk",
    },
    credentials: "include",
    body: JSON.stringify({
      username: FAREWISE_USERNAME,
      password: FAREWISE_PASSWORD,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Login failed: ${res.status}`, errorText.substring(0, 500));
    throw new Error(`Login failed: ${res.status} - ${errorText.substring(0, 200)}`);
  }

  // Extract cookies from response
  const setCookie = res.headers.raw()['set-cookie'];
  if (setCookie) {
    // Parse cookies: kun ta navn=verdi delen, ikke expires/path/etc
    const cookiePairs = setCookie.map(cookie => {
      const mainPart = cookie.split(';')[0]; // Ta kun "name=value" delen
      return mainPart;
    });
    farewiseCookies = cookiePairs.join('; ');
    console.log("✅ Login successful, cookies received:");
    console.log("   Cookies:", farewiseCookies.substring(0, 200) + "...");
  } else {
    console.warn("⚠️ No cookies received from login!");
  }

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

  // Bruk language-spesifikk endpoint
  const domain = language === "da" ? "dk" : "no";
  const apiUrl = `https://www.farewise.${domain}/api/recommendations/search`;

  console.log(`Farewise ${language.toUpperCase()} API Request:`, JSON.stringify(requestBody, null, 2));
  console.log(`Using endpoint: ${apiUrl}`);
  console.log(`CustomerId: ${region.customerId}`);
  console.log(`Cookies being sent:`);
  if (farewiseCookies) {
    const cookieArray = farewiseCookies.split('; ');
    cookieArray.forEach(cookie => {
      const [name, value] = cookie.split('=');
      console.log(`   ${name}: ${value ? value.substring(0, 50) + '...' : 'EMPTY'}`);
    });
  } else {
    console.log('   NONE!');
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": `https://www.farewise.${domain}/nd/flight/search`,
      "Origin": `https://www.farewise.${domain}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Cookie": farewiseCookies || "",
      "cache-control": "no-cache",
      "pragma": "no-cache",
    },
    credentials: "include",
    body: JSON.stringify(requestBody),
  });

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

      // CALCULATE DURATION FROM TIMESTAMPS - Farewise duration fields have DST bugs
      // This matches what Farewise website displays (timestamps are always correct)
      let legDuration = "PT0H0M";
      
      if (segments.length > 0) {
        const firstDeparture = new Date(segments[0].departure.at);
        const lastArrival = new Date(segments[segments.length - 1].arrival.at);
        const totalMs = lastArrival - firstDeparture;
        let totalMinutes = Math.floor(totalMs / 60000);
        
        // CRITICAL: Farewise timestamps don't include timezone offsets properly
        // Subtract 1 hour correction for DST (summer time) if flight is Mar-Oct
        const departureMonth = firstDeparture.getMonth(); // 0-11
        const isDSTPeriod = departureMonth >= 2 && departureMonth <= 9; // Mar-Oct
        if (isDSTPeriod) {
          totalMinutes -= 60; // Subtract 1 hour for DST correction
        }
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        legDuration = `PT${hours}H${minutes}M`;
        
        // Debug logging for EK (Emirates)
        const hasEK = segments.some(s => s.carrierCode === 'EK');
        if (hasEK) {
          console.log(`✅ EK DURATION CALCULATED from timestamps for leg ${legIndex}:`, {
            departure: segments[0].departure.at,
            arrival: segments[segments.length - 1].arrival.at,
            calculated: legDuration,
            dstCorrected: isDSTPeriod,
            'route.duration (IGNORED)': route.duration,
            'leg.duration (IGNORED)': leg.duration
          });
        }
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

    return {
      id: rec.id || `farewise-${index}`,
      price: {
        total: String(finalPrice),
        currency: currency, // NOK for norsk, DKK for dansk
        grandTotal: String(finalPrice),
      },
      fareType: fareType,
      itineraries,
      validatingAirlineCodes: [rec.carrier?.code || ""],
      numberOfBookableSeats: 9,
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

// ⚠️ IKKE REAKTIVER
// PowerPoint skal ALLTID åpnes via ppt:build-in-open-powerpoint (COM)
// shell.openPath gir nedlasting og ødelegger rekkefølge/basefil
/* ❌ DEAKTIVERT – SKAL IKKE BRUKES FOR POWERPOINT
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
*/

/* --------------------------------------------------
   🧠 POWERPOINT – BYGG I ÅPEN PPT (NY)
-------------------------------------------------- */

/**
 * Mottar ArrayBuffers fra renderer og bygger PowerPoint
 */
ipcMain.handle("ppt:generate", async (_, payload) => {
  const { base, modules, departureDate, language, flightData, baseTemplateName } = payload;
  
  try {
    // Lag temp-mappe for filene
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptgen-'));
    // Use language-specific filename
    const fileName = language === 'da' ? 'Rejseprogram og Tilbud.pptx' : 'Reiseprogram og Tilbud.pptx';
    const basePath = path.join(tmpDir, fileName);
    
    // Skriv base-fil
    fs.writeFileSync(basePath, Buffer.from(base));
    
    // Skriv modul-filer
    const modulePaths = [];
    for (let i = 0; i < modules.length; i++) {
      const modPath = path.join(tmpDir, `mod${i + 1}.pptx`);
      fs.writeFileSync(modPath, Buffer.from(modules[i].buffer));
      modulePaths.push(modPath);
    }
    
    // Kall eksisterende build-handler
    const result = await new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, "ppt-build.ps1");
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
            // After successful build, run post-processing
            const postProcessPath = path.join(__dirname, "ppt-post-process.ps1");
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
                if (postError) {
                  console.error("PowerPoint post-processing error:", postStderr || postError);
                  reject(postStderr || postError.message);
                } else {
                  console.log("Post-processing complete:", postStdout);
                  resolve({ ok: true });
                }
              }
            );
          }
        }
      );
    });
    
    return result;
  } catch (error) {
    console.error('ppt:generate error:', error);
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
    const scriptPath = path.join(__dirname, "ppt-build.ps1");
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
          import('./ppt-dg-dto.js').then(({ replaceDgDtoPairwise, insertFlightInformation }) => {
            try {
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
              replaceDgDtoPairwise(pres, departureDate || null);
              // Sett inn flyinformasjon hvis tilgjengelig
              if (flightData && flightData.flights && flightData.flights.length > 0) {
                insertFlightInformation(pres, flightData, language || 'no');
              }
              resolve({ ok: true });
            } catch (err) {
              reject('DG/DTO-feil: ' + err.message);
            }
          }).catch(err => {
            console.error("⚠️ kunne ikke laste ppt-dg-dto:", err);
            reject('Kunne ikke laste ppt-dg-dto: ' + err.message);
          });
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
    const { filePath: selectedFilePath, category, order, language } = args;
    
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
    
    // Read manifest
    const manifestData = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData);
    
    console.log(`📁 Found ${manifest.length} files in manifest`);
    
    // Read each file listed in manifest (using relative paths)
    const filesWithData = [];
    
    for (const entry of manifest) {
      try {
        // Use filePath (relative path) or fall back to fileName for old manifests
        const relPath = entry.filePath || entry.fileName;
        const fullPath = path.join(oneDrivePath, relPath);
        
        if (!fs.existsSync(fullPath)) {
          console.log(`⚠️ File not found: ${relPath}`);
          continue;
        }
        
        const buffer = fs.readFileSync(fullPath);
        filesWithData.push({
          name: entry.fileName || path.basename(relPath),
          category: entry.category,
          order: entry.order,
          data: buffer.toString('base64'),
          size: buffer.length,
          uploadedAt: entry.uploadedAt,
          uploadedBy: entry.uploadedBy,
        });
        
        console.log(`✅ Read: ${relPath} (category: ${entry.category})`);
      } catch (error) {
        console.error(`❌ Failed to read ${entry.filePath || entry.fileName}:`, error.message);
      }
    }
    
    return { 
      success: true, 
      files: filesWithData,
      count: filesWithData.length,
      sourcePath: oneDrivePath,
      language: language
    };
    
  } catch (error) {
    console.error("❌ OneDrive sync error:", error);
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
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("checking-for-update", () => {
    console.log("🔍 Checking for updates...");
  });

  autoUpdater.on("update-available", () => {
    console.log("⬇️ Update available");
  });

  autoUpdater.on("update-not-available", () => {
    console.log("✅ No update available");
  });

  autoUpdater.on("error", (err) => {
    console.error("❌ Auto-update error:", err);
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("🚀 Update downloaded – restarting");
    autoUpdater.quitAndInstall();
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

    icon: path.join(__dirname, "../../public/logo-white.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
