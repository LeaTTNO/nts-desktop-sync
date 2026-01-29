import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "@/config/msalConfig";
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

// Initialize MSAL instance
let msalInstance: PublicClientApplication | null = null;

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

  // Check if running in iframe (Lovable preview)
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Demo login for testing (works in iframe)
  const loginAsDemo = (email: string = "info@tanzaniatours.no") => {
    const name = email.split("@")[0];
    setAccount({
      homeAccountId: "demo-user",
      environment: "demo",
      tenantId: "demo",
      username: email,
      localAccountId: "demo",
      name: name.charAt(0).toUpperCase() + name.slice(1),
    } as AccountInfo);
    setIsAuthenticated(true);
    // Lagre valgt bruker i localStorage
    localStorage.setItem("selectedUserEmail", email);
  };

  useEffect(() => {
    async function initMsal() {
      // Skip MSAL initialization - we use simple user selection instead
      // MSAL is only needed for OneDrive access, not for basic login
      
      // Auto-login med sist valgte bruker fra localStorage
      const savedEmail = localStorage.getItem("selectedUserEmail");
      if (savedEmail) {
        loginAsDemo(savedEmail);
      }
      // Ikke logg inn automatisk hvis ingen bruker er lagret - la brukeren velge
      setIsLoading(false);
    }

    initMsal();
  }, []);

  const login = async () => {
    if (!msalInstance) return;

    try {
      setError(null);
      const response = await msalInstance.loginPopup(loginRequest);
      if (response.account) {
        msalInstance.setActiveAccount(response.account);
        setAccount(response.account);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Innlogging feilet");
    }
  };

  const logout = async () => {
    // Demo mode - just clear state
    if (!msalInstance || isInIframe) {
      setAccount(null);
      setIsAuthenticated(false);
      // Fjern lagret bruker fra localStorage
      localStorage.removeItem("selectedUserEmail");
      return;
    }

    try {
      await msalInstance.logoutPopup({ account: account });
      setAccount(null);
      setIsAuthenticated(false);
      localStorage.removeItem("selectedUserEmail");
    } catch (err: any) {
      console.error("Logout error:", err);
      // Still clear local state even if popup fails
      setAccount(null);
      setIsAuthenticated(false);
      localStorage.removeItem("selectedUserEmail");
    }
  };

  const getAccessToken = async (): Promise<string> => {
    if (!msalInstance || !account) {
      throw new Error("Ikke innlogget");
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Token expired, need interactive login
        const popupResponse = await msalInstance.acquireTokenPopup(loginRequest);
        if (popupResponse.account) {
          msalInstance.setActiveAccount(popupResponse.account);
          setAccount(popupResponse.account);
        }
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
