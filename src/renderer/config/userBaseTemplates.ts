// src/config/userBaseTemplates.ts
import type { AccountInfo } from "@azure/msal-browser";

export type LanguageCode = "no" | "da";

export type UserKey =
  | "Lea"
  | "Gordon"
  | "Jakob"
  | "Camilla"
  | "Sofia"
  | "Lars"
  | "Info"
  | "Lennie";

interface UserBaseTemplateConfig {
  no?: string;
  da?: string;
}

interface UserConfig {
  baseFolders: UserBaseTemplateConfig; // For brukerens basefiler (kun admin ser disse)
  personalFolders: UserBaseTemplateConfig; // For brukerens personlige maler
}

/**
 * Her ligger alle base-mapper og personlige mapper per bruker og språk.
 * - baseFolders: Brukerens basefiler (templates som brukes som grunnlag) - kun synlig for admin
 * - personalFolders: Brukerens personlige maler - synlig for brukeren selv
 */
const USER_CONFIGS: Record<UserKey, UserConfig> = {
  Lea: {
    baseFolders: {
      no: "/no/templates/lea-base",
      da: "/da/templates/lea-base",
    },
    personalFolders: {
      no: "/no/templates/lea-personal",
      da: "/da/templates/lea-personal",
    },
  },
  Gordon: {
    baseFolders: {
      no: "/no/templates/gordon-base",
      da: "/da/templates/gordon-base",
    },
    personalFolders: {
      no: "/no/templates/gordon-personal",
      da: "/da/templates/gordon-personal",
    },
  },
  Jakob: {
    baseFolders: {
      no: "/no/templates/jakob-base",
      da: "/da/templates/jakob-base",
    },
    personalFolders: {
      no: "/no/templates/jakob-personal",
      da: "/da/templates/jakob-personal",
    },
  },
  Camilla: {
    baseFolders: {
      no: "/no/templates/camilla-base",
      da: "/da/templates/camilla-base",
    },
    personalFolders: {
      no: "/no/templates/camilla-personal",
      da: "/da/templates/camilla-personal",
    },
  },
  Sofia: {
    baseFolders: {
      no: "/no/templates/sofia-base",
      da: "/da/templates/sofia-base",
    },
    personalFolders: {
      no: "/no/templates/sofia-personal",
      da: "/da/templates/sofia-personal",
    },
  },
  Lars: {
    baseFolders: {
      no: "/no/templates/lars-base",
      da: "/da/templates/lars-base",
    },
    personalFolders: {
      no: "/no/templates/lars-personal",
      da: "/da/templates/lars-personal",
    },
  },
  Info: {
    baseFolders: {
      no: "/no/templates/info-base",
      da: "/da/templates/info-base",
    },
    personalFolders: {
      no: "/no/templates/info-personal",
      da: "/da/templates/info-personal",
    },
  },
  Lennie: {
    baseFolders: {
      da: "/da/templates/lennie-base",
    },
    personalFolders: {
      da: "/da/templates/lennie-personal",
    },
  },
};

/**
 * Prøver å finne riktig "brukernøkkel" (Lea, Gordon, osv.)
 * basert på navnet/brukernavnet fra MSAL-kontoen.
 *
 * Dette gjør at Lea bare ser Lea-base, Gordon ser Gordon-base osv.
 */
export function resolveUserKeyFromAccount(account: AccountInfo | null): UserKey {
  if (!account) {
    return "Info";
  }

  const text =
    (account.name ||
      account.username ||
      account.localAccountId ||
      "")
      .toLowerCase();

  if (text.includes("lea")) return "Lea";
  if (text.includes("gordon")) return "Gordon";
  if (text.includes("camilla")) return "Camilla";
  if (text.includes("sofia")) return "Sofia";
  if (text.includes("jakob")) return "Jakob";
  if (text.includes("lars")) return "Lars";
  if (text.includes("lennie")) return "Lennie";

  // fallback: Info-profil
  return "Info";
}

/**
 * Hent base-mappe for innlogget bruker + språk (no/da).
 * Returnerer f.eks. "/no/templates/lea-base" eller undefined hvis det ikke finnes.
 */
export function getBaseTemplateFolderForAccount(
  account: AccountInfo | null,
  language: LanguageCode
): string | undefined {
  const userKey = resolveUserKeyFromAccount(account);
  const config = USER_CONFIGS[userKey];
  return config?.baseFolders?.[language];
}

/**
 * Hent personlig mappe for innlogget bruker + språk (no/da).
 * Returnerer f.eks. "/no/templates/lea-personal" eller undefined hvis det ikke finnes.
 */
export function getPersonalTemplateFolderForAccount(
  account: AccountInfo | null,
  language: LanguageCode
): string | undefined {
  const userKey = resolveUserKeyFromAccount(account);
  const config = USER_CONFIGS[userKey];
  return config?.personalFolders?.[language];
}

/**
 * Hent basefil-mappe for en spesifikk bruker (brukes av admin)
 * @param userPrefix - Brukerens prefix (lea, gordon, osv.)
 * @param language - Språk (no/da)
 */
export function getBaseFolderForUser(
  userPrefix: string,
  language: LanguageCode
): string | undefined {
  const userKey = userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1) as UserKey;
  const config = USER_CONFIGS[userKey];
  return config?.baseFolders?.[language];
}

/**
 * Hvis du senere trenger alle base-mapper for debugging eller UI.
 */
export function getAllBaseTemplateConfig() {
  return USER_CONFIGS;
}
