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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>("no");

  // Always detect language from userFolders config — never use stale localStorage value
  useEffect(() => {
    if (account?.username) {
      const detected = detectLanguageFromEmail(account.username);
      setManualLanguage(detected);
      setLanguageState(detected);
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
