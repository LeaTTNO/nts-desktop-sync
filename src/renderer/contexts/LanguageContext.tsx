import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SupportedLanguage, translations, TranslationBlock } from "@/translations/translations";
import { detectLanguageFromEmail, setManualLanguage } from "@/config/userConfig";
import { useAuth } from "./AuthContext";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationBlock;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>("no");

  // Auto-detect language from user email
  useEffect(() => {
    if (account?.username) {
      const detected = detectLanguageFromEmail(account.username);
      setLanguageState(detected);
    }
  }, [account?.username]);

  const setLanguage = (lang: SupportedLanguage) => {
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
