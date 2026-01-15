// src/renderer/services/authService.ts
// ------------------------------------------------------------
// AUTH SERVICE – DESKTOP (Electron)
// ------------------------------------------------------------
// Status:
// ✔ Filen finnes (fikser Vite-feil)
// ✔ Klar for MSAL
// ❌ Ingen auto-login ennå
// ❌ Ingen side-effekter ved import
// ------------------------------------------------------------

import {
  PublicClientApplication,
  AccountInfo,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

/* ============================================================
   MSAL CONFIG
   (samme tenant / clientId som Vercel)
============================================================ */

export const msalConfig = {
  auth: {
    clientId: "9ba015e0-0233-4b5c-bfd3-b32a2d6a5a2d",
    authority:
      "https://login.microsoftonline.com/86e7101d-2b71-4a68-abed-8b44db20b94a",
    redirectUri: "http://localhost", // Electron-safe
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Files.Read"],
};

/* ============================================================
   MSAL INSTANCE
============================================================ */

export const msalInstance = new PublicClientApplication(msalConfig);

let activeAccount: AccountInfo | null = null;

/* ============================================================
   INIT (skal kalles én gang senere – IKKE nå)
============================================================ */

export async function initMsal() {
  await msalInstance.initialize();
}

/* ============================================================
   ACCOUNT HELPERS
============================================================ */

export function setActiveAccount(account: AccountInfo) {
  activeAccount = account;
  msalInstance.setActiveAccount(account);
}

export function getActiveAccount(): AccountInfo | null {
  if (activeAccount) return activeAccount;

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    setActiveAccount(accounts[0]);
    return accounts[0];
  }

  return null;
}

/* ============================================================
   LOGIN / LOGOUT
   (brukes i senere fase)
============================================================ */

export async function login() {
  const response = await msalInstance.loginPopup(loginRequest);
  setActiveAccount(response.account!);
  return response.account;
}

export async function logout() {
  if (!activeAccount) return;

  await msalInstance.logoutPopup({
    account: activeAccount,
  });

  activeAccount = null;
}

/* ============================================================
   ACCESS TOKEN (Graph)
============================================================ */

export async function getAccessToken(): Promise<string> {
  if (!activeAccount) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      setActiveAccount(accounts[0]);
    } else {
      throw new Error("Ingen aktiv konto – bruker ikke logget inn");
    }
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: activeAccount!,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const popupResponse =
        await msalInstance.acquireTokenPopup(loginRequest);
      setActiveAccount(popupResponse.account!);
      return popupResponse.accessToken;
    }
    throw error;
  }
}
