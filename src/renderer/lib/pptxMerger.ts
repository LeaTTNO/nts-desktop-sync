import JSZip from "jszip";
import { format, addDays, parse } from "date-fns";
import { nb, da } from "date-fns/locale";

interface MergeOptions {
  departureDate?: string | null;
  language?: "no" | "da";
  flightData?: any | null;
}

/* =====================================================
   DG + DTO – VBA-LIK, TRYGG, KUN TEKST
===================================================== */
const processDgDtoPairwise = (
  slideXml: string[],
  departureDate: string | null,
  language: "no" | "da"
) => {
  let baseDate: Date | null = null;

  if (departureDate) {
    try {
      baseDate = parse(departureDate, "yyyy-MM-dd", new Date());
    } catch {
      baseDate = null;
    }
  }

  let dayCounter = 0;

  return slideXml.map((xml) => {
    let result = xml;

    while (true) {
      const dgIndex = result.indexOf("DG");
      const dtoIndex = result.indexOf("DTO");

      if (dgIndex === -1 || dtoIndex === -1) break;
      if (dgIndex > dtoIndex) break;

      dayCounter++;

      result =
        result.slice(0, dgIndex) +
        `Dag ${dayCounter}` +
        result.slice(dgIndex + 2);

      const newDtoIndex = result.indexOf("DTO");
      if (newDtoIndex === -1) break;

      if (baseDate) {
        const d = addDays(baseDate, dayCounter - 1);
        const formatted = format(d, "dd MMM", {
          locale: language === "da" ? da : nb,
        }).toLowerCase();

        result =
          result.slice(0, newDtoIndex) +
          formatted +
          result.slice(newDtoIndex + 3);
      } else {
        result =
          result.slice(0, newDtoIndex) + "" + result.slice(newDtoIndex + 3);
      }
    }

    return result;
  });
};

/* =====================================================
   MERGE POWERPOINT
   - Kopierer media fra moduler
   - Setter inn moduler FØR de 2 siste base-slidene
===================================================== */
export const mergePowerPointFiles = async (
  files: Blob[],
  options: MergeOptions = {}
) => {
  const { departureDate = null, language = "no", flightData = null } = options;

  if (files.length === 0) throw new Error("no files");

  // 1. Last base-presentasjon
  const base = await JSZip.loadAsync(files[0]);
  const merged = new JSZip();

  // Kopier ALT fra base 1:1
  for (const name of Object.keys(base.files)) {
    if (!base.files[name].dir) {
      merged.file(name, await base.files[name].async("arraybuffer"));
    }
  }

  // Hent presentation.xml og rels
  let presXml = await merged.file("ppt/presentation.xml")!.async("string");
  let presRels = await merged.file("ppt/_rels/presentation.xml.rels")!.async("string");
  let contentTypes = await merged.file("[Content_Types].xml")!.async("string");

  // Finn eksisterende slides i base
  const baseSlideFiles = Object.keys(merged.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .map((n) => parseInt(n.match(/slide(\d+)/)![1]))
    .sort((a, b) => a - b);

  const totalBaseSlides = baseSlideFiles.length;
  
  // De 2 siste slidene skal flyttes til slutten
  const slidesToKeepAtEnd = 2;
  const insertAfterSlide = Math.max(0, totalBaseSlides - slidesToKeepAtEnd);

  // Finn neste slide-ID
  const idMatches = Array.from(
    presXml.matchAll(/<p:sldId[^>]*id="(\d+)"/g)
  ).map((m) => parseInt(m[1]));
  let nextId = idMatches.length ? Math.max(...idMatches) + 1 : 256;

  // Finn høyeste slide-nummer
  let nextSlideNum = baseSlideFiles.at(-1) || 0;

  // Finn høyeste media-nummer for å unngå kollisjoner
  const existingMedia = Object.keys(merged.files)
    .filter((n) => /^ppt\/media\//.test(n))
    .map((n) => {
      const match = n.match(/image(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
  let nextMediaNum = existingMedia.length ? Math.max(...existingMedia) + 1 : 1;

  // Samle nye slides som skal inn FØR de 2 siste
  const newSlides: { num: number; xml: string; rels?: string }[] = [];

  // 2. Legg til ALLE valgte modul-filer
  for (let i = 1; i < files.length; i++) {
    const zip = await JSZip.loadAsync(files[i]);

    // Kopier media fra modul med nye navn
    const mediaMapping: Record<string, string> = {};
    const mediaFiles = Object.keys(zip.files).filter((n) => /^ppt\/media\//.test(n));
    
    for (const mediaPath of mediaFiles) {
      const ext = mediaPath.split('.').pop() || 'png';
      const newMediaName = `image${nextMediaNum}.${ext}`;
      const newMediaPath = `ppt/media/${newMediaName}`;
      
      mediaMapping[mediaPath.split('/').pop()!] = newMediaName;
      
      merged.file(newMediaPath, await zip.files[mediaPath].async("arraybuffer"));
      
      // Legg til i Content_Types hvis ikke finnes
      if (!contentTypes.includes(`/ppt/media/${newMediaName}`)) {
        const contentType = ext === 'png' ? 'image/png' : 
                           ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                           ext === 'gif' ? 'image/gif' : 'image/png';
        contentTypes = contentTypes.replace(
          "</Types>",
          `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`
        );
      }
      
      nextMediaNum++;
    }

    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort();

    for (const src of slideNames) {
      nextSlideNum++;

      let slideXml = await zip.files[src].async("string");
      
      // Oppdater media-referanser i slide XML
      for (const [oldName, newName] of Object.entries(mediaMapping)) {
        slideXml = slideXml.replace(new RegExp(oldName, 'g'), newName);
      }

      const num = src.match(/slide(\d+)/)![1];
      const relSrc = `ppt/slides/_rels/slide${num}.xml.rels`;

      let relsContent: string | undefined;
      if (zip.files[relSrc]) {
        relsContent = await zip.files[relSrc].async("string");
        // Oppdater media-referanser i rels
        for (const [oldName, newName] of Object.entries(mediaMapping)) {
          relsContent = relsContent.replace(new RegExp(oldName, 'g'), newName);
        }
      }

      newSlides.push({
        num: nextSlideNum,
        xml: slideXml,
        rels: relsContent,
      });

      // Legg til i presentation.xml - men vi må sette inn på riktig plass
      // For nå, legg til på slutten av sldIdLst
      presXml = presXml.replace(
        "</p:sldIdLst>",
        `<p:sldId id="${nextId}" r:id="rId${nextId}"/></p:sldIdLst>`
      );

      presRels = presRels.replace(
        "</Relationships>",
        `<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${nextSlideNum}.xml"/></Relationships>`
      );

      if (!contentTypes.includes(`/ppt/slides/slide${nextSlideNum}.xml`)) {
        contentTypes = contentTypes.replace(
          "</Types>",
          `<Override PartName="/ppt/slides/slide${nextSlideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
        );
      }

      nextId++;
    }
  }

  // Skriv nye slides til merged
  for (const slide of newSlides) {
    merged.file(`ppt/slides/slide${slide.num}.xml`, slide.xml);
    if (slide.rels) {
      merged.file(`ppt/slides/_rels/slide${slide.num}.xml.rels`, slide.rels);
    }
  }

  // 3. Reorder slides i presentation.xml slik at moduler kommer FØR de 2 siste
  // Parse sldIdLst og reorder
  const sldIdMatch = presXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
  if (sldIdMatch && insertAfterSlide > 0 && newSlides.length > 0) {
    const sldIdContent = sldIdMatch[1];
    const sldIds = Array.from(sldIdContent.matchAll(/<p:sldId[^>]*\/>/g)).map(m => m[0]);
    
    if (sldIds.length > slidesToKeepAtEnd) {
      // Reorder: [base start] + [new modules] + [base end (2 siste)]
      const baseStart = sldIds.slice(0, insertAfterSlide);
      const baseEnd = sldIds.slice(insertAfterSlide, totalBaseSlides);
      const moduleSlides = sldIds.slice(totalBaseSlides);
      
      const reordered = [...baseStart, ...moduleSlides, ...baseEnd];
      const newSldIdLst = `<p:sldIdLst>${reordered.join('')}</p:sldIdLst>`;
      
      presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, newSldIdLst);
    }
  }

  merged.file("ppt/presentation.xml", presXml);
  merged.file("ppt/_rels/presentation.xml.rels", presRels);
  merged.file("[Content_Types].xml", contentTypes);

  // 4. DG / DTO-oppdatering
  const slidePaths = Object.keys(merged.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort();

  const slideXmlArr = await Promise.all(
    slidePaths.map((p) => merged.files[p].async("string"))
  );

  const processed = processDgDtoPairwise(slideXmlArr, departureDate, language);

  processed.forEach((xml, i) => {
    merged.file(slidePaths[i], xml);
  });

  // 5. Replace flight information placeholders if flight data is available
  if (flightData && flightData.flights && flightData.flights.length > 0) {
    console.log('Populating Flyinformasjon slide with flight data');
    
    // Build flight text content
    let flightText = `Reiseperiode: ${flightData.period}\\nAntall passasjerer: ${flightData.passengers}\\n\\n`;
    
    flightData.flights.forEach((flight: any) => {
      flightText += `${flight.title}:\\n`;
      flightText += `Pris: ${flight.price} per person\\n\\n`;
      flightText += `Utreise: ${flight.outbound.route}\\n`;
      flightText += `Avgang: ${flight.outbound.departure}\\n`;
      flightText += `Ankomst: ${flight.outbound.arrival}\\n`;
      flightText += `Reisetid: ${flight.outbound.duration}\\n`;
      flightText += `Stopp: ${flight.outbound.stops}\\n`;
      
      if (flight.inbound) {
        flightText += `\\nHjemreise: ${flight.inbound.route}\\n`;
        flightText += `Avgang: ${flight.inbound.departure}\\n`;
        flightText += `Ankomst: ${flight.inbound.arrival}\\n`;
        flightText += `Reisetid: ${flight.inbound.duration}\\n`;
        flightText += `Stopp: ${flight.inbound.stops}\\n`;
      }
      flightText += `\\n`;
    });
    
    // Find and update Flyinformasjon slide
    for (const slidePath of slidePaths) {
      let slideXml = await merged.files[slidePath].async("string");
      
      // Check if this slide contains "FLYINFORMATION" or "Flyinformasjon" text
      if (slideXml.includes('FLYINFORMATION') || slideXml.includes('Flyinformasjon') || slideXml.includes('FLYINFORMASJON')) {
        console.log(`Found Flyinformasjon slide: ${slidePath}`);
        
        // Replace placeholder text with actual flight information
        // Look for text placeholders and replace them
        slideXml = slideXml.replace(/FLYINFORMATION|Flyinformasjon|FLYINFORMASJON/g, flightText);
        
        merged.file(slidePath, slideXml);
        console.log('Flyinformasjon slide updated with flight data');
        break;
      }
    }
  }

  return await merged.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
};
