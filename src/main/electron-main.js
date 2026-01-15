import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import fetch from "node-fetch";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

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

/* --------------------------------------------------
   ⏳ Rate limit
-------------------------------------------------- */

let lastRequest = 0;
async function rateLimit() {
  const now = Date.now();
  if (now - lastRequest < 1200) {
    await new Promise(r => setTimeout(r, 1200 - (now - lastRequest)));
  }
  lastRequest = Date.now();
}

/* --------------------------------------------------
   🔑 TOKEN CACHE
-------------------------------------------------- */

let cachedToken = null;
let tokenExpires = 0;

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

/* --------------------------------------------------
   🪟 WINDOW
-------------------------------------------------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    console.log("📦 PROD index.html:", indexPath);
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.tanzaniatours.nts");
  }
  createWindow();
});
