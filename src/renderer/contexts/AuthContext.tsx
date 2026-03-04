import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, Configuration } from "@azure/msal-browser";
import { msalConfig as baseMsalConfig, loginRequest } from "@/config/msalConfig";
import { getUserBaseFolder, getActiveLanguage, isAdmin, SupportedLanguage, userFolders } from "@/config/userConfig";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInIframe: boolean;
  account: AccountInfo | null;
  userEmail: string;
  userName: string;
  userFolder: string;
  userLanguage: SupportedLanguage;
  isAdmin: boolean;
  login: () => Promise<void>;
  loginAsDemo: (email?: string) => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  error: string | null;
  user?: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use localStorage so the Microsoft session persists across restarts
const msalConfigWithStorage: Configuration = {
  ...baseMsalConfig,
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new PublicClientApplication(msalConfigWithStorage);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived user info
  const userEmail = account?.username?.toLowerCase() ?? "";
  const userName = account?.name ?? userEmail.split("@")[0] ?? "Bruker";
  const userLanguage = getActiveLanguage(userEmail);
  const userFolder = getUserBaseFolder(userEmail, userLanguage);

  // Check if running in iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  function applyAccount(acc: AccountInfo) {
    msalInstance.setActiveAccount(acc);
    setAccount(acc);
    setIsAuthenticated(true);
  }

  // Fallback demo login (kept for offline/dev use)
  const loginAsDemo = (email: string = "info@tanzaniatours.dk") => {
    const name = email.split("@")[0];
    const fakeAccount = {
      homeAccountId: `demo-${email}`,
      environment: "demo",
      tenantId: "demo",
      username: email,
      localAccountId: `demo-${email}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
    } as AccountInfo;
    setAccount(fakeAccount);
    setIsAuthenticated(true);
    localStorage.setItem("selectedUserEmail", email);
  };

  useEffect(() => {
    async function initMsal() {
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();

        // 1) MSAL already has a cached account (from previous login) → use it
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          applyAccount(accounts[0]);
          setIsLoading(false);
          return;
        }

        // 2) Try ssoSilent with each known email as loginHint.
        //    The one that matches the logged-in Microsoft account on this PC will succeed.
        for (const user of userFolders) {
          try {
            const response = await msalInstance.ssoSilent({
              scopes: loginRequest.scopes,
              loginHint: user.email,
            });
            applyAccount(response.account);
            localStorage.setItem("selectedUserEmail", response.account.username);
            setIsLoading(false);
            return;
          } catch {
            // This email is not logged in on this PC — try next
          }
        }

        // 3) Fallback: restore identity from saved email (after first-time popup login)
        const savedEmail = localStorage.getItem("selectedUserEmail");
        if (savedEmail) {
          const name = savedEmail.split("@")[0];
          setAccount({
            homeAccountId: `restored-${savedEmail}`,
            environment: "login.microsoftonline.com",
            tenantId: "restored",
            username: savedEmail,
            localAccountId: `restored-${savedEmail}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
          } as AccountInfo);
          setIsAuthenticated(true);
        }
        // 4) Nothing found → show "Logg inn med Microsoft" button
      } catch (err) {
        console.error("MSAL init error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initMsal();
  }, []);

  const login = async () => {
    try {
      setError(null);
      const response = await msalInstance.loginPopup(loginRequest);
      if (response.account) {
        applyAccount(response.account);
        // Save for next startup auto-login
        localStorage.setItem("selectedUserEmail", response.account.username);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Innlogging feilet");
    }
  };

  const logout = async () => {
    try {
      await msalInstance.logoutPopup({ account: account ?? undefined });
    } catch (err) {
      console.warn("Logout popup failed, clearing locally:", err);
    } finally {
      setAccount(null);
      setIsAuthenticated(false);
      localStorage.removeItem("selectedUserEmail");
    }
  };

  const getAccessToken = async (): Promise<string> => {
    if (!account) throw new Error("Ikke innlogget");

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const popupResponse = await msalInstance.acquireTokenPopup(loginRequest);
        if (popupResponse.account) applyAccount(popupResponse.account);
        return popupResponse.accessToken;
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isInIframe,
        account,
        userEmail,
        userName,
        userFolder,
        userLanguage,
        isAdmin: isAdmin(userEmail),
        login,
        loginAsDemo,
        logout,
        getAccessToken,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
