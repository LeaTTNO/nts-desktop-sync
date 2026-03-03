export type CategoryKind = "base" | "group" | "dropdown" | "optional" | "user";

export interface TemplateCategory {
  id: string;
  name: string;
  order: number;
  kind: CategoryKind;
  parentId?: string;
  isDefault?: boolean;
  userId?: string; // For brukerspesifikke kategorier
}

// Kategorinavne per språk
const categoryNames = {
  no: {
    base: "Reiseprogram og Tilbud",
    arusha_first: "Arusha første natt",
    safari_group: "Safariperiode",
    safari_dec_feb: "Safari - Midt DEC - FEB (Ndutu)",
    safari_march: "Safari - MARTS (Ndutu uden Tar)",
    safari_april_may: "Safari - APRIL - MAI (Ser uden Tar)",
    safari_june_july: "Safari - JUNI - ca. 10. JULI (Ser)",
    safari_july_sep: "Safari - ca. 10. JULI - SEP (Tar + Ser nord)",
    safari_oct: "Safari - OKT (Tar + Ser)",
    safari_nov_dec: "Safari - NOV - Midt DEC (Tar + Ser)",
    last_safari: "Siste natt safari",
    zanzibar_1: "Zanzibar Hotel",
    zanzibar_2: "Zanzibar & Stone Town",
    kilimanjaro: "Kilimanjaro",
    arusha_activities: "Aktiviteter Arusha - Slides",
    diverse: "Diverse Fastland",
    extra: "Ekstra Slides",
    flight: "Flyinformasjon"
  },
  da: {
    base: "Rejseprogram og Tilbud",
    arusha_first: "Arusha første nat",
    safari_group: "Safariperiode",
    safari_dec_feb: "Safari - Midt DEC - FEB (Ndutu)",
    safari_march: "Safari - MARTS (Ndutu uden Tar)",
    safari_april_may: "Safari - APRIL - MAJ (Ser uden Tar)",
    safari_june_july: "Safari - JUNI - ca. 10. JULI (Ser)",
    safari_july_sep: "Safari - ca. 10. JULI - SEP (Tar + Ser nord)",
    safari_oct: "Safari - OKT (Tar + Ser)",
    safari_nov_dec: "Safari - NOV - Midt DEC (Tar + Ser)",
    last_safari: "Sidste nat safari",
    zanzibar_1: "Zanzibar Hotel",
    zanzibar_2: "Zanzibar & Stone Town",
    kilimanjaro: "Kilimanjaro",
    arusha_activities: "Aktiviteter Arusha - Slides",
    diverse: "Diverse Fastland",
    extra: "Ekstra Slides",
    flight: "Flyinformation"
  }
};

// Basis kategorier (språk-uavhengige IDer)
const baseCategoryStructure = [
  { id: "base_program", key: "base", kind: "base" as const, order: 1 },
  { id: "arusha_first_night", key: "arusha_first", kind: "dropdown" as const, order: 2 },
  { id: "safari_period_group", key: "safari_group", kind: "group" as const, order: 3 },
  { id: "safari_mid_dec_feb_ndutu", key: "safari_dec_feb", kind: "dropdown" as const, parentId: "safari_period_group", order: 4 },
  { id: "safari_march_ndutu_no_tar", key: "safari_march", kind: "dropdown" as const, parentId: "safari_period_group", order: 5 },
  { id: "safari_april_may_ser_no_tar", key: "safari_april_may", kind: "dropdown" as const, parentId: "safari_period_group", order: 6 },
  { id: "safari_june_10july_ser", key: "safari_june_july", kind: "dropdown" as const, parentId: "safari_period_group", order: 7 },
  { id: "safari_10july_sep_tar_ser_north", key: "safari_july_sep", kind: "dropdown" as const, parentId: "safari_period_group", order: 8 },
  { id: "safari_oct_tar_ser", key: "safari_oct", kind: "dropdown" as const, parentId: "safari_period_group", order: 9 },
  { id: "safari_nov_middec_tar_ser", key: "safari_nov_dec", kind: "dropdown" as const, parentId: "safari_period_group", order: 10 },
  { id: "last_safari_night", key: "last_safari", kind: "dropdown" as const, order: 20 },
  { id: "zanzibar_hotel_1", key: "zanzibar_1", kind: "dropdown" as const, order: 30 },
  { id: "zanzibar_hotel_2", key: "zanzibar_2", kind: "dropdown" as const, order: 50 },
  { id: "kilimanjaro", key: "kilimanjaro", kind: "optional" as const, order: 60 },
  { id: "arusha_activities_slides", key: "arusha_activities", kind: "optional" as const, order: 70 },
  { id: "diverse_mainland", key: "diverse", kind: "optional" as const, order: 80 },
  { id: "extra_slides", key: "extra", kind: "optional" as const, order: 90 },
  { id: "flyinformasjon", key: "flight", kind: "optional" as const, order: 100 }
];

// Generer kategorier for gitt språk
export function getCategoriesForLanguage(language: "no" | "da" = "no"): TemplateCategory[] {
  const names = categoryNames[language];
  return baseCategoryStructure.map(cat => ({
    id: cat.id,
    name: names[cat.key as keyof typeof names],
    kind: cat.kind,
    order: cat.order,
    isDefault: true,
    ...(cat.parentId && { parentId: cat.parentId })
  }));
}

// Bakoverkompatibilitet - default NO kategorier
export const defaultCategories: TemplateCategory[] = getCategoriesForLanguage("no");

// Helper functions
export const getUploadableCategories = (language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.filter(c => c.kind !== "group");
};

export const getSafariPeriods = (language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.filter(c => c.parentId === "safari_period_group");
};

export const getOptionalCategories = (language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.filter(c => c.kind === "optional");
};

export const getDropdownCategories = (language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.filter(c => c.kind === "dropdown" && !c.parentId);
};

export const getCategoryByName = (name: string, language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.find(c => c.name === name);
};

export const getCategoryById = (id: string, language: "no" | "da" = "no") => {
  const categories = getCategoriesForLanguage(language);
  return categories.find(c => c.id === id);
};

/**
 * Generer brukerspesifikk kategori for egne filer
 * @param userPrefix - Brukerens prefix (lea, gordon, osv.)
 * @param language - Språk (no/da)
 */
export function getUserPersonalCategory(userPrefix: string, language: "no" | "da" = "no"): TemplateCategory {
  const categoryName = language === "no"
    ? `${userPrefix}-Mine egne maler`
    : `${userPrefix}-Mine egne skabeloner`;

  return {
    id: `user_${userPrefix}_personal`,
    name: categoryName,
    kind: "user",
    order: 200, // Etter alle andre kategorier
    isDefault: false,
    userId: userPrefix,
  };
}

/**
 * Generer basefil-kategorier for alle brukere (kun synlig for admin)
 * @param language - Språk (no/da)
 */
export function getAllUserBaseCategories(language: "no" | "da" = "no"): TemplateCategory[] {
  const users = [
    { prefix: "lea", name: "Lea" },
    { prefix: "gordon", name: "Gordon" },
    { prefix: "jakob", name: "Jakob" },
    { prefix: "camilla", name: "Camilla" },
    { prefix: "sofia", name: "Sofia" },
    { prefix: "lars", name: "Lars" },
    { prefix: "info", name: "Info" },
    { prefix: "lennie", name: "Lennie" },
  ];

  return users.map((user, index) => {
    const categoryName = language === "no"
      ? `${user.name} - Reiseprogram og tilbud`
      : `${user.name} - Rejseprogram og tilbud`;

    return {
      id: `base_${user.prefix}`,
      name: categoryName,
      kind: "base" as const,
      order: 10 + index, // Lav order så de vises tidlig
      isDefault: true,
      userId: user.prefix,
    };
  });
}

/**
 * Hent basefil-kategori for en spesifikk bruker
 * @param userPrefix - Brukerens prefix (lea, gordon, osv.)
 * @param language - Språk (no/da)
 */
/**
 * Generer brukerens "Reiseprogram og Tilbud"-kategori (basefilene i dropdown)
 */
export function getUserBaseCategory(userPrefix: string, language: "no" | "da" = "no"): TemplateCategory {
  const userName = userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1);
  const categoryName = language === "no"
    ? `${userName} - Reiseprogram og tilbud`
    : `${userName} - Rejseprogram og tilbud`;

  return {
    id: `base_${userPrefix}`,
    name: categoryName,
    kind: "base",
    order: 10, // Høy prioritet
    isDefault: true,
    userId: userPrefix,
  };
}

