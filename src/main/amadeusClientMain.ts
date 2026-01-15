import fetch from "node-fetch";
import { ipcMain } from "electron";

const API_KEY = process.env.AMADEUS_API_KEY!;
const API_SECRET = process.env.AMADEUS_API_SECRET!;
const BASE_URL = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";

let token: string | null = null;
let expiresAt = 0;

async function getToken() {
  if (token && Date.now() < expiresAt) return token;

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: API_KEY,
      client_secret: API_SECRET,
    }).toString(),
  });

  if (!res.ok) throw new Error("Amadeus auth failed");

  const data = await res.json();
  token = data.access_token;
  expiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return token;
}

export async function searchFlightsMain(params: any) {
  const t = await getToken();

  const url = new URL(`${BASE_URL}/v2/shopping/flight-offers`);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${t}` },
  });

  if (!res.ok) throw new Error("Flight search failed");

  return res.json();
}

/* ---------------- IPC BRIDGE ---------------- */

ipcMain.handle("amadeus:searchFlights", async (event, params) => {
  try {
    const result = await searchFlightsMain(params);
    return { ok: true, data: result };
  } catch (err: any) {
    console.error("AMADEUS IPC ERROR", err);
    return { ok: false, error: err?.message || "unknown error" };
  }
});
