export type SupportedLanguage = "no" | "da";

export interface TranslationBlock {
  app: {
    title: string;
    logout: string;
    login: string;
    syncing: string;
    languageSwitch: string;
  };

  templates: {
    libraryTitle: string;
    upload: string;
    delete: string;
    download: string;
    addCategory: string;
    deleteCategory: string;
    noTemplates: string;
    chooseFiles: string;
    category: string;
    filename: string;
    confirmDelete: string;
    confirmCategoryDelete: string;
  };

  users: {
    detectedUser: string;
    usingFolder: string;
  };

  builder: {
    travelBuilder: string;
    chooseBaseFile: string;
    addModule: string;
    removeModule: string;
    generatePPT: string;
  };

  flyrobot: {
    title: string;
    search: string;
    from: string;
    to: string;
    depart: string;
    return: string;
    passengers: string;
    showAlternatives: string;
  };

  tabs: {
    builder: string;
    flight: string;
    library: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationBlock> = {
  //---------------------------------------------------------------------
  // 🇳🇴 NORSK
  //---------------------------------------------------------------------
  no: {
    app: {
      title: "NTS – Reiseprogram & Tilbud",
      logout: "Logg ut",
      login: "Logg inn med Microsoft",
      syncing: "Synkroniserer...",
      languageSwitch: "Bytt språk",
    },

    templates: {
      libraryTitle: "Malbibliotek",
      upload: "Last opp fil",
      delete: "Slett",
      download: "Last ned",
      addCategory: "Legg til kategori",
      deleteCategory: "Slett kategori",
      noTemplates: "Ingen maler funnet",
      chooseFiles: "Velg filer",
      category: "Kategori",
      filename: "Filnavn",
      confirmDelete: "Er du sikker på at du vil slette denne filen?",
      confirmCategoryDelete: "Dette vil slette alle filer i kategorien. Sikker?",
    },

    users: {
      detectedUser: "Innlogget som",
      usingFolder: "Bruker mappestruktur",
    },

    builder: {
      travelBuilder: "Bygg reiseprogram",
      chooseBaseFile: "Velg grunnmal",
      addModule: "Legg til modul",
      removeModule: "Fjern modul",
      generatePPT: "Generer PowerPoint",
    },

    flyrobot: {
      title: "Flyrobott – Finn beste ruter",
      search: "Søk",
      from: "Fra",
      to: "Til",
      depart: "Avreise",
      return: "Retur",
      passengers: "Passasjerer",
      showAlternatives: "Vis alternativer",
    },

    tabs: {
      builder: "BYGG REISEPROGRAM",
      flight: "FLYROBOTT",
      library: "MALBIBLIOTEK",
    },
  },

  //---------------------------------------------------------------------
  // 🇩🇰 DANSK
  //---------------------------------------------------------------------
  da: {
    app: {
      title: "NTS – Rejseprogram & Tilbud",
      logout: "Log ud",
      login: "Log ind med Microsoft",
      syncing: "Synkroniserer...",
      languageSwitch: "Skift sprog",
    },

    templates: {
      libraryTitle: "Skabelonbibliotek",
      upload: "Upload fil",
      delete: "Slet",
      download: "Download",
      addCategory: "Tilføj kategori",
      deleteCategory: "Slet kategori",
      noTemplates: "Ingen skabeloner fundet",
      chooseFiles: "Vælg filer",
      category: "Kategori",
      filename: "Filnavn",
      confirmDelete: "Er du sikker på, at du vil slette denne fil?",
      confirmCategoryDelete: "Dette vil slette alle filer i kategorien. Er du sikker?",
    },

    users: {
      detectedUser: "Logget ind som",
      usingFolder: "Bruger mappe-struktur",
    },

    builder: {
      travelBuilder: "Byg rejseprogram",
      chooseBaseFile: "Vælg grundskabelon",
      addModule: "Tilføj modul",
      removeModule: "Fjern modul",
      generatePPT: "Generer PowerPoint",
    },

    flyrobot: {
      title: "Flyrobot – Find bedste ruter",
      search: "Søg",
      from: "Fra",
      to: "Til",
      depart: "Afrejse",
      return: "Retur",
      passengers: "Passagerer",
      showAlternatives: "Vis alternativer",
    },

    tabs: {
      builder: "BYG REJSEPROGRAM",
      flight: "FLYROBOT",
      library: "SKABELONBIBLIOTEK",
    },
  },
};
