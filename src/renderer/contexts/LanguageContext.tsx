import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SupportedLanguage, translations, TranslationBlock } from "@/translations/translations";
import { detectLanguageFromEmail, setManualLanguage } from "@/config/userConfig";
import { useAuth } from "./AuthContext";
import { useFlightStore } from "@/store/useFlightStore";
import { useTemplateStore } from "@/store/useTemplateStore";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationBlock;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getLangStorageKey(email: string) {
  return `nts-language-${email.toLowerCase()}`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>("no");

  // Auto-detect language from user email, but respect persisted preference
  useEffect(() => {
    if (account?.username) {
      const stored = localStorage.getItem(getLangStorageKey(account.username)) as SupportedLanguage | null;
      if (stored === "no" || stored === "da") {
        // User has a saved preference — use it and register override
        setManualLanguage(stored);
        setLanguageState(stored);
      } else {
        // First time: auto-detect from email
        const detected = detectLanguageFromEmail(account.username);
        setLanguageState(detected);
      }
    }
  }, [account?.username]);

  const setLanguage = (lang: SupportedLanguage) => {
    // Only reset if language is actually changing
    if (lang !== language) {
      // Reset flight search results
      useFlightStore.getState().resetAll();
      
      // Reset template builder (selected slides and flight slides)
      useTemplateStore.getState().clearSelectedTemplates();
      useTemplateStore.getState().removeFlightSlides();
      
      // Clear saved flights from localStorage (used by FlightInfoContext)
      localStorage.removeItem('saved-flights');
      
      console.log(`🔄 Language changed from ${language} to ${lang} - all data reset`);
    }
    
    // Persist language preference for this user across app restarts
    if (account?.username) {
      localStorage.setItem(getLangStorageKey(account.username), lang);
    }
    setManualLanguage(lang);
    setLanguageState(lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
