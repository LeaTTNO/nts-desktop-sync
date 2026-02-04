// ──────────────────────────────────────────────
// 📦 IMPORTS
// ──────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, shell, screen } from "electron";
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
    baseUrl: "https://api.farewise.dk",
    currency: "NOK",
    customerId: 17179,
    customerName: "Tanzania Tours ApS",
  },
  da: {
    baseUrl: "https://api.farewise.dk",
    currency: "DKK",
    customerId: 17179,
    customerName: "Tanzania Tours ApS",
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

  return await res.json();
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

  // Velg riktig region basert på språk
  const region = FAREWISE_REGIONS[language] || FAREWISE_REGIONS.no;

  // Login hvis vi ikke har cookies
  if (!farewiseCookies) {
    await loginToFarewise(language);
  }

  // Bygg Farewise request body - bruker strukturen som ga oss 73 resultater
  const legs = [];
  
  // Outbound leg - convert date to timezone format (+01 for Europe/Oslo)
  legs.push({
    departure: originLocationCode,
    arrival: destinationLocationCode,
    date: departureDate.includes('T') ? departureDate : `${departureDate}T00:00:00+01`,
  });

  // Return leg (open-jaw supported)
  if (returnDate) {
    legs.push({
      departure: returnOriginCode || destinationLocationCode,
      arrival: params.returnDestinationCode || originLocationCode,
      date: returnDate.includes('T') ? returnDate : `${returnDate}T00:00:00+01`,
    });
  }

  const requestBody = {
    authorizationGuid: FLIGHTROBOT_AUTH_GUID,
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

  console.log(`Farewise ${language.toUpperCase()} API Request:`, JSON.stringify(requestBody, null, 2));

  // Bruk riktig endpoint basert på region
  const apiUrl = language === "no"
    ? "https://www.farewise.no/api/recommendations/search"
    : "https://www.farewise.dk/api/recommendations/search";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": `https://www.farewise.${language}/nd/search`,
      "Origin": `https://www.farewise.${language}`,
      "Cookie": farewiseCookies || "",
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
  
  // Konverter Farewise format til Amadeus-format (FlightRobot sitt format)
  return convertFarewiseToAmadeus(result, region.currency);
}

/* --------------------------------------------------
   � FAREWISE → AMADEUS FORMAT CONVERTER
-------------------------------------------------- */

function convertFarewiseToAmadeus(farewiseData, currency = "NOK") {
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

      // Calculate TOTAL duration from first departure to last arrival (inkluderer mellomlanding!)
      if (segments.length > 0) {
        const firstDeparture = new Date(segments[0].departure.at);
        const lastArrival = new Date(segments[segments.length - 1].arrival.at);
        const totalMs = lastArrival - firstDeparture;
        const totalMinutes = Math.floor(totalMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return {
          duration: `PT${hours}H${minutes}M`,
          segments,
        };
      }

      return {
        duration: `PT${hours}H${minutes}M`,
        segments,
      };
    });

    // Get price from recommendation
    const priceTotal = firstOption.total || rec.total || 0;

    return {
      id: rec.id || `farewise-${index}`,
      price: {
        total: String(priceTotal),
        currency: currency, // NOK for norsk, DKK for dansk
        grandTotal: String(priceTotal),
      },
      itineraries,
      validatingAirlineCodes: [rec.carrier?.code || ""],
      numberOfBookableSeats: 9,
    };
  }).filter(Boolean); // Remove nulls

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
  const { base, modules, departureDate, language, flightData } = payload;
  
  try {
    // Lag temp-mappe for filene
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptgen-'));
    const basePath = path.join(tmpDir, 'base.pptx');
    
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
            
            execFile(
              "powershell.exe",
              [
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                postProcessPath,
                basePath,
                departureDate || "",
                flightDataJson,
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
          try {
            const ole = require('win32ole');
            const { replaceDgDtoPairwise, insertFlightInformation } = require('./ppt-dg-dto.js');
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
        }
      }
    );
  });
});

/* --------------------------------------------------
   🔄 AUTO UPDATE (kun i PROD)
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

  if (isDev) {
    win.loadURL("http://localhost:5174");
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    console.log("📦 PROD index.html:", indexPath);
    win.loadFile(indexPath);
  }

  win.once("ready-to-show", () => {
    initAutoUpdate();
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
