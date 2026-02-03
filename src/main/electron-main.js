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

const FLIGHTROBOT_BASE_URL = process.env.FLIGHTROBOT_BASE_URL || "https://api.farewise.dk";
const FLIGHTROBOT_AUTH_GUID = process.env.FLIGHTROBOT_AUTH_GUID;

// Region-spesifikke innstillinger
const FAREWISE_REGIONS = {
  no: {
    baseUrl: "https://api.farewise.dk",
    customerId: 17179,
    customerName: "Tanzania Tours ApS",
  },
  da: {
    baseUrl: "https://api.farewise.dk",
    customerId: 1280,
    customerName: "Tanzania Tours ApS",
  },
};

console.log("ENV CHECK", {
  FLIGHTROBOT_BASE_URL,
  FLIGHTROBOT_AUTH_GUID_EXISTS: !!FLIGHTROBOT_AUTH_GUID
});

/* --------------------------------------------------
   🔁 RATE LIMIT (Farewise)
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

  // Bygg Farewise request body
  const legs = [];
  
  // Outbound leg
  legs.push({
    departure: originLocationCode,
    arrival: destinationLocationCode,
    date: departureDate,
  });

  // Return leg (open-jaw supported)
  if (returnDate) {
    legs.push({
      departure: returnOriginCode || destinationLocationCode,
      arrival: params.returnDestinationCode || originLocationCode,
      date: returnDate,
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

  const res = await fetch(`${region.baseUrl}/v30/flight/recommendations/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
    },
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
    console.warn("Farewise returned no recommendations. Full response:", result);
    return { data: [] };
  }
  
  // Konverter Farewise format til Amadeus-format (FlightRobot sitt format)
  return convertFarewiseToAmadeus(result);
}

/* --------------------------------------------------
   � FAREWISE → AMADEUS FORMAT CONVERTER
-------------------------------------------------- */

function convertFarewiseToAmadeus(farewiseData) {
  // Farewise returnerer recommendations array
  const recommendations = farewiseData?.recommendations || [];
  
  if (!Array.isArray(recommendations)) {
    console.warn("Farewise response not in expected format:", farewiseData);
    return { data: [] };
  }

  const amadeusOffers = recommendations.map((rec, index) => {
    // Konverter Farewise itineraries til Amadeus segments
    const itineraries = (rec.itineraries || []).map(itinerary => {
      const segments = (itinerary.segments || []).map(seg => ({
        departure: {
          iataCode: seg.departureAirport?.iataCode || seg.departure || "",
          at: seg.departureTime || seg.departureDateTime || "",
        },
        arrival: {
          iataCode: seg.arrivalAirport?.iataCode || seg.arrival || "",
          at: seg.arrivalTime || seg.arrivalDateTime || "",
        },
        carrierCode: seg.carrierCode || seg.airline || "",
        number: String(seg.flightNumber || seg.number || ""),
        duration: seg.duration || "PT0H",
        numberOfStops: seg.stops || 0,
      }));

      return {
        duration: itinerary.totalDuration || itinerary.duration || "PT0H",
        segments,
      };
    });

    return {
      id: rec.id || `farewise-${index}`,
      price: {
        total: String(rec.price?.total || rec.totalPrice || 0),
        currency: rec.price?.currency || rec.currency || "DKK",
        grandTotal: String(rec.price?.grandTotal || rec.price?.total || rec.totalPrice || 0),
      },
      itineraries,
      validatingAirlineCodes: rec.validatingCarriers || rec.airlines || [],
      numberOfBookableSeats: rec.availableSeats || 9,
    };
  });

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
 * Bygger PowerPoint ved å la PowerPoint selv gjøre jobben:
 * - Åpner basefil synlig
 * - Setter inn modul-slides før de 2 siste slidene
 * - Kjører DG/DTO-makro
 * - LAGRER IKKE (bruker lagrer selv)
 */
ipcMain.handle("ppt:build-in-open-powerpoint", async (_, payload) => {
  const { basePath, modulePaths, departureDate } = payload;

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
          // Kjør DG/DTO-parvis etter at PowerPoint er bygget
          try {
            const ole = require('win32ole');
            const { replaceDgDtoPairwise } = require('./ppt-dg-dto.js');
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

    icon: path.join(__dirname, "../../build/icon.ico"),
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
