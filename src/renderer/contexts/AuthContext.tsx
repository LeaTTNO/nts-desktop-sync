import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, Configuration } from "@azure/msal-browser";
import { msalConfig as baseMsalConfig, loginRequest } from "@/config/msalConfig";
import { getUserBaseFolder, getActiveLanguage, isAdmin, SupportedLanguage } from "@/config/userConfig";

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

        // Handle redirect response (if any)
        await msalInstance.handleRedirectPromise();

        // Check for an already-cached account
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          applyAccount(accounts[0]);
          setIsLoading(false);
          return;
        }

        // No cached account — try Windows/Azure silent SSO
        try {
          const response = await msalInstance.ssoSilent({ scopes: loginRequest.scopes });
          applyAccount(response.account);
        } catch {
          // Silent SSO failed — user will need to click "Logg inn"
          console.log("Silent SSO not available — manual login required");
        }
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
        // Clear any old demo email
        localStorage.removeItem("selectedUserEmail");
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
