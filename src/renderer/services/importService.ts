// src/renderer/services/importService.ts

//
//  Globale typer for kommunikasjon med Electron (preload / main)
//  Disse MÅ matche det som eksponeres i src/main/preload.js
//

export interface ImportedTemplateDTO {
  id: string;
  name: string;
  category: string;
  type: "base" | "module";
  sortKey?: number;
  fileData: ArrayBuffer;
}

export interface GeneratePptArgs {
  base: ArrayBuffer;
  modules: { id: string; name: string; blob: ArrayBuffer }[];
  language: "no" | "dk";
}

export interface GeneratePptResult {
  fileName: string;
  buffer: ArrayBuffer;
}

declare global {
  interface Window {
    electronAPI?: {
      /**
       * Hentes fra preload.js:
       *  importTemplatesFromOneDrive(language: "no" | "dk")
       */
      importTemplatesFromOneDrive: (
        language: "no" | "dk"
      ) => Promise<ImportedTemplateDTO[]>;

      /**
       * Generer PPT i main-prosessen
       */
      generatePpt: (args: GeneratePptArgs) => Promise<GeneratePptResult>;

      /**
       * Valgfritt – ikke brukt akkurat nå, men finnes i preload
       */
      openFileDialog?: () => Promise<any>;
      openPath?: (path: string) => Promise<boolean>;
    };
  }
}

// Viktig for at filen skal være et modul, men beholde declare global
export {};
