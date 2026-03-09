// Web-compatible PowerPoint generator bridge
// Uses pptxMerger to merge PPTX templates client-side with DG/DTO replacement

import JSZip from 'jszip';
import { mergePowerPointFiles } from '@/lib/pptxMerger';

export type PPTModule = {
  id: string;
  name: string;
  blob?: ArrayBuffer | null;
  fileName?: string;
  order?: number;
};

export type BuildArgs = {
  departureDate?: string | null;
  firstNightHotel?: string | null;
  safariPeriod?: string | null;
  lastNightHotel?: string | null;
  includeZanzibar?: boolean;
  includeArushaDay2?: boolean;
  includeKili?: boolean;
  modules?: PPTModule[];
  language?: 'no' | 'da';
};

export type BuildResult = {
  ok: boolean;
  blob?: Blob;
  fileName?: string;
  error?: string;
  slideCount?: number;
};

/**
 * Replace DG (Dag) and DTO (Dato) placeholders in slide XML
 * DG -> "Dag 1", "Dag 2", etc.
 * DTO -> "01 jan", "02 jan", etc. (based on departure date)
 */
function replaceDgDto(xml: string, departureDate: string | null, startDayNumber: number): { 
  xml: string; 
  dayCount: number;
} {
  let dayNr = startDayNumber;
  let dtoIndex = 0;
  
  // Replace DG occurrences sequentially
  let replaced = xml.replace(/DG/g, () => `Dag ${dayNr++}`);
  
  // Replace DTO occurrences with dates
  replaced = replaced.replace(/DTO/g, () => {
    dtoIndex++;
    if (departureDate) {
      const base = new Date(departureDate);
      const d = new Date(base);
      d.setDate(base.getDate() + dtoIndex - 1);
      const day = d.getDate().toString().padStart(2, "0");
      const monthNames = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
      const month = monthNames[d.getMonth()];
      return `${day} ${month}`;
    } else {
      return ""; // Remove DTO if no departure date
    }
  });
  
  return { xml: replaced, dayCount: dayNr - startDayNumber };
}

/**
 * Parse a PPTX file and extract slide information
 */
async function parsePPTX(data: ArrayBuffer): Promise<{
  zip: JSZip;
  slideCount: number;
  slides: string[];
}> {
  const zip = await JSZip.loadAsync(data);
  
  // Find all slide files
  const slides: string[] = [];
  zip.folder('ppt/slides')?.forEach((relativePath, file) => {
    if (relativePath.match(/^slide\d+\.xml$/)) {
      slides.push('ppt/slides/' + relativePath);
    }
  });
  
  // Sort slides by number
  slides.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
  
  return {
    zip,
    slideCount: slides.length,
    slides,
  };
}

/**
 * Process a single PPTX file with DG/DTO replacements
 */
async function processPPTXWithReplacements(
  data: ArrayBuffer,
  departureDate: string | null,
  startDayNumber: number
): Promise<void> {
  const { zip, slides } = await parsePPTX(data);
  
  let currentDayNumber = startDayNumber;
  
  // Process each slide
  for (const slidePath of slides) {
    const file = zip.file(slidePath);
    if (!file) continue;
    
    const xml = await file.async("string");
    const { xml: replaced, dayCount } = replaceDgDto(xml, departureDate, currentDayNumber);
    currentDayNumber += dayCount;
    
    zip.file(slidePath, replaced);
  }
  
  // ❌ DEAKTIVERT – PowerPoint-generering og DG/DTO skal kun skje via PowerPoint COM i Electron main
  // Denne filen skal ikke brukes for generering, nedlasting eller XML-manipulasjon.
  // Funksjonen returnerer ingenting og er deaktivert.
  return;
}

/**
 * Merge multiple PPTX files into one
 * Note: Full PPTX merging is complex (relationships, content types, etc.)
 * This simplified version processes files sequentially with DG/DTO replacement
 */
async function mergePPTXFiles(
  modules: PPTModule[],
  departureDate: string | null,
  language: 'no' | 'da' = 'no'
): Promise<void> {
  const validModules = modules.filter(m => m.blob);
  
  if (validModules.length === 0) {
    throw new Error('No valid modules with content');
  }
  
  // Convert ArrayBuffers to Blobs for the merger
  const blobs = validModules.map(m => new Blob([m.blob as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }));
  
    /*
    ❌ DEAKTIVERT – PowerPoint-generering og DG/DTO skal kun skje via PowerPoint COM i Electron main
    Denne filen skal ikke brukes for generering, nedlasting eller XML-manipulasjon.
    */
  }
  
  // (end of file)
  