// ──────────────────────────────────────────────
// 📦 IMPORTS
// ──────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, shell } from "electron";
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

const AMADEUS_KEY = process.env.AMADEUS_KEY;
const AMADEUS_SECRET = process.env.AMADEUS_SECRET;
const AMADEUS_BASE = "https://test.api.amadeus.com";

console.log("ENV CHECK", {
  AMADEUS_KEY,
  AMADEUS_SECRET_EXISTS: !!AMADEUS_SECRET
});

let cachedToken = null;
let tokenExpires = 0;

/* --------------------------------------------------
   🔁 RATE LIMIT (Amadeus)
-------------------------------------------------- */
let lastRequest = 0;
async function rateLimit(ms = 300) {
  const now = Date.now();
  const diff = now - lastRequest;
  if (diff < ms) {
    await new Promise((r) => setTimeout(r, ms - diff));
  }
  lastRequest = Date.now();
}

/* --------------------------------------------------
   🔐 AUTH
-------------------------------------------------- */

async function getAmadeusToken() {
  if (cachedToken && Date.now() < tokenExpires) return cachedToken;

  await rateLimit();

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AMADEUS_KEY,
      client_secret: AMADEUS_SECRET
    })
  });

  const body = await res.text();
  if (!res.ok) throw new Error(body);

  const json = JSON.parse(body);
  cachedToken = json.access_token;
  tokenExpires = Date.now() + (json.expires_in - 60) * 1000;

  return cachedToken;
}

/* --------------------------------------------------
   ✈️ FLIGHT SEARCH
-------------------------------------------------- */

async function searchFlightsMain(args) {
  const token = await getAmadeusToken();

  const url = new URL(`${AMADEUS_BASE}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", args.origin);
  url.searchParams.set("destinationLocationCode", args.dest);
  url.searchParams.set("departureDate", args.date);
  url.searchParams.set("adults", String(args.adults || 2));
  url.searchParams.set("currencyCode", "NOK");
  url.searchParams.set("max", "50");

  if (args.returnDate) {
    url.searchParams.set("returnDate", args.returnDate);
  }

  await rateLimit();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return JSON.parse(text);
}

/* --------------------------------------------------
   🔌 IPC
-------------------------------------------------- */

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
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
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
