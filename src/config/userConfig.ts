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
// Admin management is now handled by src/renderer/lib/adminManager.ts
// This function is kept for backward compatibility and uses dynamic admin list
export function isAdmin(email: string): boolean {
  // Check if running in renderer context (localStorage available)
  if (typeof localStorage !== 'undefined') {
    try {
      // Dynamically import adminManager to avoid issues in main process
      const adminStorage = localStorage.getItem('adminUsers');
      if (adminStorage) {
        const admins = JSON.parse(adminStorage);
        return admins.includes(email.toLowerCase());
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  }
  
  // Fallback to default admins if localStorage not available or error
  const DEFAULT_ADMINS = [
    "lea@tanzaniatours.dk",
    "jakob@tanzaniatours.dk",
  ];
  return DEFAULT_ADMINS.includes(email.toLowerCase());
}

// ------------------------------------------------------------
// 1. Auto-deteksjon av språk ut fra epost
// ------------------------------------------------------------
export function detectLanguageFromEmail(email: string): SupportedLanguage {
  const lower = email.toLowerCase();

  // Ingen email = default norsk
  if (!lower || lower === "") return "no";
  
  // Camilla og Lea er default NO
  if (lower.includes("camilla") || lower.includes("lea")) return "no";
  
  // Alle andre (Gordon, Sofia, Jakob, Lars, Lennie) er default DK
  if (lower.includes("gordon") || lower.includes("sofia") || 
      lower.includes("jakob") || lower.includes("lars") || 
      lower.includes("lennie")) return "da";
  
  // Fallback basert på domene
  if (lower.endsWith("@tanzaniatours.dk")) return "da";
  
  // Alt annet (inkl. .no) = norsk
  return "no";
}

// ------------------------------------------------------------
// 2. Manuell overskriving (bruker klikker NO/DK-knapp i UI)
// ------------------------------------------------------------
let overrideLanguage: SupportedLanguage | null = null;

export function setManualLanguage(lang: SupportedLanguage) {
  overrideLanguage = lang;
}

export function getActiveLanguage(userEmail: string): SupportedLanguage {
  // Prioritet: 1) manuell override, 2) auto-detect fra email, 3) default norsk
  if (overrideLanguage) return overrideLanguage;
  if (!userEmail || userEmail === "") return "no"; // Default norsk
  return detectLanguageFromEmail(userEmail);
}

// ------------------------------------------------------------
// 3. Mapping: bruker → base-folder
// ------------------------------------------------------------

interface UserFolder {
  email: string;
  language: SupportedLanguage;
  folder: string;
}

export const userFolders: UserFolder[] = [
  // DK
  { email: "lea@tanzaniatours.dk", language: "no", folder: "lea-Rejseprogram og tilbud" },
  { email: "gordon@tanzaniatours.dk", language: "da", folder: "gordon-Rejseprogram og tilbud" },
  { email: "lars@tanzaniatours.dk", language: "da", folder: "lars-Rejseprogram og tilbud" },
  { email: "camilla@tanzaniatours.dk", language: "da", folder: "camilla-Rejseprogram og tilbud" },
  { email: "jakob@tanzaniatours.dk", language: "da", folder: "jakob-Rejseprogram og tilbud" },
  { email: "sofia@tanzaniatours.dk", language: "da", folder: "sofia-Rejseprogram og tilbud" },
  { email: "lennie@tanzaniatours.dk", language: "da", folder: "lennie-Rejseprogram og tilbud" },
  { email: "info@tanzaniatours.dk", language: "da", folder: "info-Rejseprogram og tilbud" },
];

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
