// src/config/userConfig.ts
// ------------------------------------------------------------
// Ansvar:
// - Bestemme språk automatisk (NO/DK) ut fra epost
// - Finne riktig personlig base-mappe for bruker
// - Gi trygge fallbacks hvis ny konsulent opprettes
// - Admin-roller
// ------------------------------------------------------------

export type SupportedLanguage = "no" | "da";

// ------------------------------------------------------------
// 0. Admin-system
// ------------------------------------------------------------
const ADMIN_EMAILS = [
  "lea@tanzaniatours.dk",
  "jakob@tanzaniatours.dk",
  // Legg til flere admin-brukere her ved behov
];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// ------------------------------------------------------------
// 1. Mapping: bruker → base-folder + default språk
//    language = hva appen åpner med som DEFAULT for denne brukeren
// ------------------------------------------------------------

interface UserFolder {
  email: string;
  language: SupportedLanguage;
  folder: string;
}

export const userFolders: UserFolder[] = [
  // DK – men Lea og Camilla bruker NO som default
  { email: "lea@tanzaniatours.dk",     language: "no", folder: "lea-Rejseprogram og tilbud" },
  { email: "camilla@tanzaniatours.dk", language: "no", folder: "camilla-Rejseprogram og tilbud" },
  { email: "gordon@tanzaniatours.dk",  language: "da", folder: "gordon-Rejseprogram og tilbud" },
  { email: "lars@tanzaniatours.dk",    language: "da", folder: "lars-Rejseprogram og tilbud" },
  { email: "jakob@tanzaniatours.dk",   language: "da", folder: "jakob-Rejseprogram og tilbud" },
  { email: "sofia@tanzaniatours.dk",   language: "da", folder: "sofia-Rejseprogram og tilbud" },
  { email: "lennie@tanzaniatours.dk",  language: "da", folder: "lennie-Rejseprogram og tilbud" },
];

// ------------------------------------------------------------
// 2. Auto-deteksjon av språk ut fra epost
//    Bruker userFolders som sannhetskilde — ikke separat liste.
// ------------------------------------------------------------
export function detectLanguageFromEmail(email: string): SupportedLanguage {
  const lower = email.toLowerCase();
  if (!lower) return "no";

  // Slå opp i userFolders — her er default-språk per bruker definert
  const entry = userFolders.find(u => u.email === lower);
  if (entry) return entry.language;

  // Fallback for ukjente brukere: .dk-domene = dansk, alt annet = norsk
  return lower.endsWith("@tanzaniatours.dk") ? "da" : "no";
}

// ------------------------------------------------------------
// 3. Manuell overskriving (bruker klikker NO/DK-knapp i UI)
// ------------------------------------------------------------
let overrideLanguage: SupportedLanguage | null = null;

export function setManualLanguage(lang: SupportedLanguage) {
  overrideLanguage = lang;
}

export function getActiveLanguage(userEmail: string): SupportedLanguage {
  // Prioritet: 1) manuell override, 2) auto-detect fra email, 3) default norsk
  if (overrideLanguage) return overrideLanguage;
  if (!userEmail || userEmail === "") return "no";
  return detectLanguageFromEmail(userEmail);
}

// ------------------------------------------------------------
// 4. Finn personlig mappe for bruker
// ------------------------------------------------------------
export function getUserBaseFolder(
  email: string,
  language: SupportedLanguage
): string {
  const lower = email.toLowerCase();

  // Finn bruker i listen
  const entry = userFolders.find(u => u.email.toLowerCase() === lower);

  if (entry) {
    return entry.folder;
  }

  // Fallback for ny konsulent
  const name = lower.split("@")[0].replace(/\./g, "-");

  return language === "no"
    ? `${name}-Reiseprogram og tilbud`
    : `${name}-Rejseprogram og tilbud`;
}

// ------------------------------------------------------------
// 5. Hent bruker-prefix fra email
// ------------------------------------------------------------
export function getUserPrefix(email: string): string {
  const lower = email.toLowerCase();
  
  // Finn bruker i listen
  const entry = userFolders.find(u => u.email.toLowerCase() === lower);
  
  if (entry) {
    // Ekstraher prefix fra folder-navnet (f.eks. "lea-Reiseprogram..." -> "lea")
    const match = entry.folder.match(/^([^-]+)-/);
    return match ? match[1] : "info";
  }
  
  // Fallback for ny konsulent
  const name = lower.split("@")[0].replace(/\./g, "-");
  return name || "info";
}

// ------------------------------------------------------------
// 6. Rot-mapper (brukes av importService)
// ------------------------------------------------------------
export function getLanguageRootPath(language: SupportedLanguage): string {
  return language === "no" ? "/no/templates" : "/da/templates";
}
