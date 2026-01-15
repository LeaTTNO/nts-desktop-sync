// src/config/baseTemplateSelector.ts
// Automatisk valg av basefil basert på Safari/Zanzibar/Kilimanjaro kombinasjoner
// Basefilene ligger i brukerspesifikke mapper (f.eks. /no/templates/lea-base/)
// og har IKKE bruker-prefix i filnavnet

export type SupportedLanguage = "no" | "da";

export interface DestinationSelection {
  hasSafari: boolean;
  hasZanzibar: boolean;
  hasKilimanjaro: boolean;
}

/**
 * Bestemmer riktig basefil-navn basert på hvilke destinasjoner som er valgt.
 * Default: Safari & Zanzibar
 * 
 * VIKTIG: Returnerer filnavn UTEN bruker-prefix siden filene ligger i brukerspesifikke mapper
 * Eksempel: "Reiseprogram og Tilbud - Safari & Zanzibar" (ikke "lea-Reiseprogram...")
 * 
 * @param selection - Hvilke destinasjoner som er valgt
 * @param language - Språk (no/da)
 */
export function getBaseTemplateFileName(
  selection: DestinationSelection,
  language: SupportedLanguage = "no"
): string {
  const { hasSafari, hasZanzibar, hasKilimanjaro } = selection;
  
  const basePrefix = language === "no" ? "Reiseprogram og Tilbud" : "Rejseprogram og Tilbud";
  
  // Ingen valgt -> default Safari & Zanzibar
  if (!hasSafari && !hasZanzibar && !hasKilimanjaro) {
    return `${basePrefix} - Safari & Zanzibar`;
  }
  
  // Alle tre
  if (hasSafari && hasZanzibar && hasKilimanjaro) {
    return `${basePrefix} - Safari, Zanzibar & Kilimanjaro`;
  }
  
  // To destinasjoner
  if (hasSafari && hasZanzibar) {
    return `${basePrefix} - Safari & Zanzibar`;
  }
  
  if (hasSafari && hasKilimanjaro) {
    return `${basePrefix} - Safari & Kilimanjaro`;
  }
  
  if (hasZanzibar && hasKilimanjaro) {
    return `${basePrefix} - Zanzibar & Kilimanjaro`;
  }
  
  // Én destinasjon
  if (hasSafari) {
    return `${basePrefix} - Safari`;
  }
  
  if (hasZanzibar) {
    return `${basePrefix} - Zanzibar`;
  }
  
  if (hasKilimanjaro) {
    return `${basePrefix} - Kilimanjaro`;
  }
  
  // Fallback (burde aldri skje)
  return `${basePrefix} - Safari & Zanzibar`;
}

/**
 * Liste over alle mulige basefil-navn for en dropdown
 * 
 * @param language - Språk (no/da)
 */
export function getAllBaseTemplateOptions(
  language: SupportedLanguage = "no"
): string[] {
  const basePrefix = language === "no" ? "Reiseprogram og Tilbud" : "Rejseprogram og Tilbud";
  
  return [
    `${basePrefix} - Safari & Zanzibar`,
    `${basePrefix} - Safari`,
    `${basePrefix} - Zanzibar`,
    `${basePrefix} - Kilimanjaro`,
    `${basePrefix} - Safari & Kilimanjaro`,
    `${basePrefix} - Zanzibar & Kilimanjaro`,
    `${basePrefix} - Safari, Zanzibar & Kilimanjaro`,
  ];
}

/**
 * Sjekker om et template-navn matcher et av base-template-navnene
 * 
 * @param templateName - Navnet på templaten som skal sjekkes
 * @param language - Språk (no/da)
 */
export function isBaseTemplate(
  templateName: string,
  language: SupportedLanguage = "no"
): boolean {
  const options = getAllBaseTemplateOptions(language);
  return options.some(opt => templateName.includes(opt) || opt.includes(templateName));
}
