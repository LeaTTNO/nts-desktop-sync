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

export const defaultCategories: TemplateCategory[] = [
  { id: "arusha_first_night", name: "Arusha første natt", kind: "dropdown", order: 2, isDefault: true },
  { id: "safari_period_group", name: "Safariperiode", kind: "group", order: 3, isDefault: true },
  { id: "safari_mid_dec_feb_ndutu", name: "Safari - Midt DEC - FEB (Ndutu)", kind: "dropdown", parentId: "safari_period_group", order: 4, isDefault: true },
  { id: "safari_march_ndutu_no_tar", name: "Safari - MARTS (Ndutu uden Tar)", kind: "dropdown", parentId: "safari_period_group", order: 5, isDefault: true },
  { id: "safari_april_may_ser_no_tar", name: "Safari - APRIL - MAI (Ser uden Tar)", kind: "dropdown", parentId: "safari_period_group", order: 6, isDefault: true },
  { id: "safari_june_10july_ser", name: "Safari - JUNI - ca. 10. JULI (Ser)", kind: "dropdown", parentId: "safari_period_group", order: 7, isDefault: true },
  { id: "safari_10july_sep_tar_ser_north", name: "Safari - ca. 10. JULI - SEP (Tar + Ser nord)", kind: "dropdown", parentId: "safari_period_group", order: 8, isDefault: true },
  { id: "safari_oct_tar_ser", name: "Safari - OKT (Tar + Ser)", kind: "dropdown", parentId: "safari_period_group", order: 9, isDefault: true },
  { id: "safari_nov_middec_tar_ser", name: "Safari - NOV - Midt DEC (Tar + Ser)", kind: "dropdown", parentId: "safari_period_group", order: 10, isDefault: true },
  { id: "last_safari_night", name: "Siste natt safari", kind: "dropdown", order: 20, isDefault: true },
  { id: "zanzibar_hotel_1", name: "Zanzibar Hotel", kind: "dropdown", order: 30, isDefault: true },
  { id: "zanzibar_stone_town", name: "Zanzibar & Stone Town", kind: "dropdown", order: 35, isDefault: true },
  { id: "zanzibar_hotel_2", name: "Zanzibar & StoneTown", kind: "dropdown", order: 50, isDefault: true },
  { id: "kilimanjaro", name: "Kilimanjaro", kind: "optional", order: 60, isDefault: true },
  { id: "arusha_activities_slides", name: "Aktiviteter Arusha - Slides", kind: "optional", order: 70, isDefault: true },
  { id: "diverse_mainland", name: "Diverse Fastland", kind: "optional", order: 80, isDefault: true },
  { id: "extra_slides", name: "Ekstra Slides", kind: "optional", order: 90, isDefault: true },
  { id: "flyinformasjon", name: "Flyinformasjon", kind: "optional", order: 100, isDefault: true }
];

// Helper functions
export const getUploadableCategories = () => 
  defaultCategories.filter(c => c.kind !== "group");

export const getSafariPeriods = () => 
  defaultCategories.filter(c => c.parentId === "safari_period_group");

export const getOptionalCategories = () => 
  defaultCategories.filter(c => c.kind === "optional");

export const getDropdownCategories = () => 
  defaultCategories.filter(c => c.kind === "dropdown" && !c.parentId);

export const getCategoryByName = (name: string) => 
  defaultCategories.find(c => c.name === name);

export const getCategoryById = (id: string) => 
  defaultCategories.find(c => c.id === id);

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
      ? `${user.name} - Reiseprogram & Tilbud`
      : `${user.name} - Rejseprogram & Tilbud`;

    return {
      id: `base_${user.prefix}`,
      name: categoryName,
      kind: "base" as const,
      order: 500 + index, // Høy order så de kommer til slutt
      isDefault: false,
      userId: user.prefix,
    };
  });
}

/**
 * Hent basefil-kategori for en spesifikk bruker
 * @param userPrefix - Brukerens prefix (lea, gordon, osv.)
 * @param language - Språk (no/da)
 */
export function getUserBaseCategory(userPrefix: string, language: "no" | "da" = "no"): TemplateCategory {
  const userName = userPrefix.charAt(0).toUpperCase() + userPrefix.slice(1);
  const categoryName = language === "no"
    ? `${userName} - Reiseprogram & Tilbud`
    : `${userName} - Rejseprogram & Tilbud`;

  return {
    id: `base_${userPrefix}`,
    name: categoryName,
    kind: "base",
    order: 500,
    isDefault: false,
    userId: userPrefix,
  };
}