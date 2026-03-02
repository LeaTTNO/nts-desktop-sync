import React, { useState, useEffect } from "react";
import { useTemplateStore } from "@/store/useTemplateStore";
import { useUserCategoryStore } from "@/store/useUserCategoryStore";
import TemplateDropdown from "./TemplateDropdown";
import { getBaseTemplateFileName, getAllBaseTemplateOptions, type DestinationSelection } from "@/config/baseTemplateSelector";
import { getUserPrefix } from "@/config/userConfig";
import { getUserBaseCategory, getCategoryNameForLanguage } from "@/config/templateCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { nb, da } from "date-fns/locale";
import { GripVertical, X, FileDown, RotateCcw, Loader2, ChevronDown, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* =========================
   KONSTANTER - KATEGORIER (språkavhengige)
========================= */

/* =========================
   COMPONENT
========================= */

interface TravelProgramBuilderProps {
  language?: 'no' | 'da';
}

export default function TravelProgramBuilder({ language = 'no' }: TravelProgramBuilderProps) {
  const { userEmail, isAdmin: userIsAdmin } = useAuth();
  const { language: userLanguage } = useLanguage(); // Reaktiv – oppdateres når NO/DK byttes
  const userPrefix = userEmail ? getUserPrefix(userEmail) : undefined;

  const {
    categories,
    templates,
    selectedTemplateIds,
    addSelectedTemplate,
    removeSelectedTemplate,
    moveSelectedTemplate,
    clearSelectedTemplates,
    getTemplatesByCategoryName,
    getTemplatesByCategoryId,
    loadFromDB,
    slides, // <-- bring in slides from global state
    removeFlightSlides, // <-- add this
  } = useTemplateStore();

  const { categories: userCategories, getCategoriesForUser, isBuiltinCategoryVisible, getBuiltinCategoryName } = useUserCategoryStore();
  const myUserCategories = userEmail ? getCategoriesForUser(userEmail) : [];

  // Helper to get category name by id – respekterer: 1) admin-override, 2) aktivt språk, 3) norsk default
  const getCategoryNameById = (id: string): string => {
    const override = getBuiltinCategoryName(id);
    if (override) return override;
    return getCategoryNameForLanguage(id, userLanguage) ?? "";
  };

  // Dynamically get category names from store
  const AUTO_PROGRAM_CATEGORY = getCategoryNameById("base_program");
  const SAFARI_PERIODS = categories
    .filter(c => c.parentId === "safari_period_group")
    .map(c => getBuiltinCategoryName(c.id) || c.name);
  const FIRST_NIGHT_CATEGORY = getCategoryNameById("arusha_first_night");
  const LAST_NIGHT_CATEGORY = getCategoryNameById("last_safari_night");
  const ZANZIBAR_MAIN = getCategoryNameById("zanzibar_hotel_1");
  const ZANZIBAR_HOTEL_2 = getCategoryNameById("zanzibar_hotel_2");
  const KILIMANJARO = getCategoryNameById("kilimanjaro");
  const ARUSHA_SLIDES = getCategoryNameById("arusha_activities_slides");
  const FASTLAND = getCategoryNameById("diverse_mainland");
  const EXTRA = getCategoryNameById("extra_slides");
  const FLIGHT = getCategoryNameById("flyinformasjon");

  /* =========================
     HELPER - Filtrer templates basert på bruker
  ========================= */
  
  const getFilteredTemplatesByCategoryName = (categoryName: string, categoryId?: string) => {
    // Søk på ID for robusthet (fungerer selv om kategorinavn er endret/feil)
    const allTemplates = categoryId 
      ? getTemplatesByCategoryId(categoryId)
      : getTemplatesByCategoryName(categoryName);
    
    // Filtrer på språk – ALT separert mellom NO og DK, ingen unntak
    return allTemplates.filter(t => t.language === userLanguage);
  };
  
  /* =========================
     HELPER - Hent basefiler for bruker
  ========================= */
  
  const getUserBaseTemplates = () => {
    if (!userPrefix) return [];
    
    // Hent brukerens basefil-kategori
    const baseCategory = getUserBaseCategory(userPrefix, userLanguage);
    
    // Hent alle templates i denne kategorien
    return getTemplatesByCategoryName(baseCategory.name);
  };

  /* =========================
     STATE
  ========================= */

  const [departureDate, setDepartureDate] = useState("");
  const [departureDateInput, setDepartureDateInput] = useState("");
  const [baseProgramId, setBaseProgramId] = useState<string | null>(null);

  const [firstNightId, setFirstNightId] = useState<string | null>(null);
  const [lastNightId, setLastNightId] = useState<string | null>(null);
  const [selectedSafariPeriod, setSelectedSafariPeriod] = useState<string | null>(null);
  const [safariTemplateId, setSafariTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  /* Checkbox state med tilhørende template ID */
  const [zanzibarMain, setZanzibarMain] = useState(false);
  const [zanzibarMainId, setZanzibarMainId] = useState<string | null>(null);
  const [zanzibarHotel2, setZanzibarHotel2] = useState(false);
  const [zanzibarHotel2Id, setZanzibarHotel2Id] = useState<string | null>(null);
  const [kilimanjaro, setKilimanjaro] = useState(false);
  const [kilimanjaroId, setKilimanjaroId] = useState<string | null>(null);
  const [arushaSlides, setArushaSlides] = useState(false);
  const [arushaSlidesId, setArushaSlidesId] = useState<string | null>(null);
  const [fastland, setFastland] = useState(false);
  const [fastlandId, setFastlandId] = useState<string | null>(null);
  const [extraSlides, setExtraSlides] = useState(false);
  const [extraSlidesId, setExtraSlidesId] = useState<string | null>(null);

  // Dynamic user-defined categories state
  const [userCategoryStates, setUserCategoryStates] = useState<Record<string, { checked: boolean; templateId: string | null }>>({});

  // Initialize state for user categories
  useEffect(() => {
    const newStates: Record<string, { checked: boolean; templateId: string | null }> = {};
    myUserCategories.forEach(cat => {
      if (!userCategoryStates[cat.id]) {
        newStates[cat.id] = { checked: false, templateId: null };
      }
    });
    if (Object.keys(newStates).length > 0) {
      setUserCategoryStates(prev => ({ ...prev, ...newStates }));
    }
  }, [myUserCategories.length]);

  // Load templates on mount
  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  /* ==================================
     DEFAULT BASEFIL VED FØRSTE LASTING
  ================================== */

  useEffect(() => {
    // Allerede valgt — ikke overskriv
    if (baseProgramId) return;

    const baseTemplates = getUserBaseTemplates();
    if (baseTemplates.length === 0) return; // Ikke lastet ennå — vent

    // Finn "Safari & Zanzibar"-basefilen som standard
    const defaultFileName = getBaseTemplateFileName(
      { hasSafari: false, hasZanzibar: false, hasKilimanjaro: false },
      userLanguage
    );

    const defaultTemplate =
      baseTemplates.find(t => t.name === defaultFileName) ??
      baseTemplates.find(t => t.name.includes(defaultFileName)) ??
      baseTemplates.find(t => t.name.toLowerCase().includes("safari") && t.name.toLowerCase().includes("zanzibar"));

    if (defaultTemplate) {
      setBaseProgramId(defaultTemplate.id);
      addSelectedTemplate(defaultTemplate.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, userLanguage, userPrefix]);

  /* =========================
     HELPERS
  ========================= */

  // Parse DDMM format (e.g., "0510" -> "05.10.2026")
  function parseDDMM(input: string): Date | null {
    // Remove any non-digits
    const digits = input.replace(/\D/g, "");
    
    let day: number, month: number, year: number;

    if (digits.length === 8) {
      // DDMMYYYY format
      day = parseInt(digits.substring(0, 2), 10);
      month = parseInt(digits.substring(2, 4), 10);
      year = parseInt(digits.substring(4, 8), 10);
    } else if (digits.length === 4) {
      // DDMM format - determine year automatically
      day = parseInt(digits.substring(0, 2), 10);
      month = parseInt(digits.substring(2, 4), 10);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();
      year = currentYear;
      if (month < currentMonth || (month === currentMonth && day < currentDay)) {
        year = currentYear + 1;
      }
    } else {
      return null;
    }
    
    // Validate day and month
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    
    return new Date(year, month - 1, day);
  }

  function replaceTemplate(oldId: string | null, newId: string | null) {
    if (oldId) removeSelectedTemplate(oldId);
    if (newId) addSelectedTemplate(newId);
  }

  /* =========================
     DRAG & DROP
     - index 0 låst (base program)
  ========================= */

  const onDragStart = (e: React.DragEvent, index: number) => {
    if (index === 0) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("fromIndex", String(index));
  };

  const onDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("fromIndex"));
    if (fromIndex === 0 || toIndex === 0) return;
    moveSelectedTemplate(fromIndex, toIndex);
  };

  /* =========================
     GENERATE – VALIDERING
  ========================= */

  async function generatePowerPoint() {
    if (!baseProgramId) {
      toast.error("Reiseprogram og tilbud mangler");
      return;
    }

    setIsGenerating(true);

    try {
      // Basefil er alltid først i listen
      const baseTemplate = templates.find(t => t.id === baseProgramId);
      if (!baseTemplate || !baseTemplate.blob) {
        toast.error("Basefil ikke funnet");
        return;
      }

      // Hent alle valgte moduler (unntatt basefil)
      // VIKTIG: Modulene skal være i NØYAKTIG den rekkefølgen brukeren har valgt dem
      // (kan endres via drag-and-drop i "Valgte slides"-listen)
      // Kun flyinformasjon flyttes til slutten
      const moduleTemplates = selectedTemplateIds
        .filter(id => id !== baseProgramId)
        .map((id) => templates.find((t) => t.id === id))
        .filter(Boolean)
        .sort((a, b) => {
          // Flyinformasjon skal alltid være sist
          const aFlight = (a!.category === FLIGHT || a!.name.toLowerCase().includes('flyinformasjon'));
          const bFlight = (b!.category === FLIGHT || b!.name.toLowerCase().includes('flyinformasjon'));
          if (aFlight && !bFlight) return 1;  // a (flight) kommer etter b
          if (!aFlight && bFlight) return -1; // b (flight) kommer etter a
          
          // Ellers: BEHOLD opprinnelig rekkefølge fra selectedTemplateIds
          return 0;
        }) as typeof templates;

      // Konverter blobs til ArrayBuffers
      const baseBuffer = baseTemplate.blob instanceof Blob 
        ? await baseTemplate.blob.arrayBuffer() 
        : baseTemplate.blob;
      
      // DEBUG: Log module order being sent to PowerShell
      console.log('📋 Module order being sent to PowerShell:');
      moduleTemplates.forEach((m, idx) => {
        const days = extractDaysFromName(m.name);
        console.log(`  ${idx + 1}. ${m.name} ${days ? `(${days} dager)` : '(no days)'} [category: ${m.category}]`);
      });
      
      const moduleBuffers = await Promise.all(
        moduleTemplates.map(async (t) => ({
          name: t.name,
          buffer: t.blob instanceof Blob ? await t.blob.arrayBuffer() : t.blob,
        }))
      );

      // Hent flyinformasjon fra global slides state
      const flightSlide = slides.find(s => typeof s === "object" && s.type === "flight");
      const flightData = flightSlide ? (flightSlide as any).data : null;

      // Hvis flightData finnes, sørg for at en Flyinformasjon-modul er inkludert
      // Hent den faktiske malen fra biblioteket slik at design og layout bevares
      const hasFlightModule = moduleBuffers.some(m =>
        m.name.toLowerCase().includes('flyinformasjon') ||
        m.name.toLowerCase().includes('flyinformation')
      );
      if (flightData?.flights?.[0]?.segments?.length > 0 && !hasFlightModule) {
        // Finn Flyinformasjon-malen i biblioteket
        const flightTemplate = templates.find(t =>
          t.name.toLowerCase().includes('flyinformasjon') ||
          t.name.toLowerCase().includes('flyinformation') ||
          t.category === FLIGHT
        );
        if (flightTemplate) {
          const flightBuffer = flightTemplate.blob instanceof Blob
            ? await flightTemplate.blob.arrayBuffer()
            : flightTemplate.blob;
          moduleBuffers.push({ name: flightTemplate.name, buffer: flightBuffer });
        } else {
          // Ingen mal funnet — bruk tom buffer (electron-main lager noe enkelt)
          moduleBuffers.push({ name: 'Flyinformasjon.pptx', buffer: new ArrayBuffer(0) });
        }
      }

      // Kall Electron API for å bygge PowerPoint
      if (!window.electron?.generatePpt) {
        throw new Error('generatePpt API ikke tilgjengelig');
      }

      const result = await window.electron.generatePpt({
        base: baseBuffer,
        modules: moduleBuffers,
        language: userLanguage,
        departureDate: departureDate || null,
        flightData,
        baseTemplateName: baseTemplate.name,
      });

      console.log('🗓️ generatePowerPoint called with departureDate:', JSON.stringify(departureDate));

      if (result) {
        toast.success(`PowerPoint åpnet med ${moduleTemplates.length + 1} slides`);
      } else {
        toast.success(`PowerPoint åpnet med ${moduleTemplates.length + 1} slides`);
      }
    } catch (error) {
      console.error("Error generating PowerPoint:", error);
      toast.error("Feil ved generering av PowerPoint");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    clearSelectedTemplates();
    setBaseProgramId(null);
    setFirstNightId(null);
    setLastNightId(null);
    setSelectedSafariPeriod(null);
    setSafariTemplateId(null);
    setZanzibarMain(false);
    setZanzibarMainId(null);
    setZanzibarHotel2(false);
    setZanzibarHotel2Id(null);
    setKilimanjaro(false);
    setKilimanjaroId(null);
    setArushaSlides(false);
    setArushaSlidesId(null);
    setFastland(false);
    setFastlandId(null);
    setExtraSlides(false);
    setExtraSlidesId(null);
    setDepartureDate("");
    toast.info("Skjema nullstilt");
  }

  /* =========================
     RENDER HELPERS
  ========================= */

  // Helper: Ekstraher antall dager fra filnavn
  function extractDaysFromName(name: string): number | null {
    // Finn tall i filnavnet (f.eks. "Safari 4 dager" -> 4)
    const match = name.match(/\b(\d+)\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Helper: Sorter templates etter dager i filnavn
  function sortTemplatesByDays<T extends { name: string }>(templates: T[]): T[] {
    // Ny sortering: først de med tall, stigende, så resten alfabetisk
    const withNumber = templates.filter(t => /^\d+/.test(t.name));
    const withoutNumber = templates.filter(t => !/^\d+/.test(t.name));
    withNumber.sort((a, b) => {
      const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
    withoutNumber.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    return [...withNumber, ...withoutNumber];
  }

  // Helper: Grupper templates etter hotellnavn (alt før første tall)
  function groupTemplatesByHotel(templates: typeof categoryTemplates) {
    const groups: Record<string, typeof templates> = {};
    
    templates.forEach(t => {
      // Ekstraher hotellnavn: alt (inkl. spesialtegn som &, -, ') før første tall
      // Eksempel: "Pongwe + Tembo 4 + 1 nætter" → "Pongwe + Tembo"
      // Eksempel: "Baraza & Essque 7 nætter" → "Baraza & Essque"
      const match = t.name.match(/^(.*?)(?=\s+\d)/);
      const hotelName = match ? match[1].trim() : t.name;
      
      if (!groups[hotelName]) {
        groups[hotelName] = [];
      }
      groups[hotelName].push(t);
    });
    
    // Sorter innenfor hver gruppe etter dager
    Object.values(groups).forEach(group => {
      group.sort((a, b) => {
        const daysA = extractDaysFromName(a.name);
        const daysB = extractDaysFromName(b.name);
        if (daysA !== null && daysB !== null) return daysA - daysB;
        if (daysA !== null) return -1;
        if (daysB !== null) return 1;
        return a.name.localeCompare(b.name, 'nb');
      });
    });
    
    return groups;
  }

  // Checkbox with conditional dropdown - med gruppering for Zanzibar
  // Bruker Popover for å holde dropdown åpen mens man navigerer
  function CheckboxWithDropdown({
    id,
    label,
    checked,
    onCheckedChange,
    category,
    categoryId,
    selectedId,
    onSelectChange,
    indent = false,
    groupByHotel = false,
    hideCheckbox = false,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    category: string;
    categoryId?: string;
    selectedId: string | null;
    onSelectChange: (id: string | null) => void;
    indent?: boolean;
    groupByHotel?: boolean;
    hideCheckbox?: boolean;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedHotel, setSelectedHotel] = useState<string | null>(null);
    
    const categoryTemplates = getFilteredTemplatesByCategoryName(category, categoryId).filter(t => t.visibleInBuilder);
    // Zanzibar-hotell: to-trinns dropdown
    const isZanzibarHotel = [ZANZIBAR_MAIN, ZANZIBAR_HOTEL_2].includes(category) || 
      categoryId === "zanzibar_hotel_1" || categoryId === "zanzibar_hotel_2";
    const groupedTemplates = isZanzibarHotel ? groupTemplatesByHotel(categoryTemplates) : (groupByHotel ? groupTemplatesByHotel(categoryTemplates) : null);
    const hotelNames = groupedTemplates ? Object.keys(groupedTemplates).sort() : [];
    
    const selectedTemplate = selectedId ? templates.find(t => t.id === selectedId) : null;
    
    // Reset hotel selection when dropdown closes
    useEffect(() => {
      if (!isOpen) {
        setSelectedHotel(null);
      }
    }, [isOpen]);
    
    return (
      <div className={`space-y-2 ${indent ? 'ml-6' : ''}`}>
        {!hideCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(c) => {
                const isChecked = c as boolean;
                onCheckedChange(isChecked);
                if (!isChecked && selectedId) {
                  removeSelectedTemplate(selectedId);
                  onSelectChange(null);
                }
              }}
            />
            <Label htmlFor={id} className={`cursor-pointer ${indent ? 'text-sm' : ''}`}>
              {label}
            </Label>
          </div>
        )}
        {(hideCheckbox || checked) && (hideCheckbox || categoryTemplates.length > 0) && (
          <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isOpen}
                className={cn(
                  "w-full justify-between bg-background",
                  indent ? 'ml-6' : '',
                  !selectedTemplate && "text-muted-foreground"
                )}
              >
                {selectedTemplate?.name || (hotelNames.length > 0 ? 'Velg hotell...' : 'Velg mal...')}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-background z-50" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
              <div className="max-h-[300px] overflow-y-auto">
                {isZanzibarHotel ? (
                  !selectedHotel ? (
                    <div className="p-1">
                      {hotelNames.map((hotelName) => (
                        <button
                          key={hotelName}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedHotel(hotelName);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {hotelName}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedHotel(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground flex items-center gap-2"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Tilbake
                      </button>
                      <div className="px-3 py-1 text-xs font-semibold text-primary border-b mb-1">
                        {selectedHotel}
                      </div>
                      {sortTemplatesByDays(groupedTemplates[selectedHotel] || []).map((t) => (
                        <button
                          key={t.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            replaceTemplate(selectedId, t.id);
                            onSelectChange(t.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between",
                            selectedId === t.id && "bg-accent"
                          )}
                        >
                          {t.name}
                          {selectedId === t.id && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  groupByHotel && groupedTemplates ? (
                    !selectedHotel ? (
                      <div className="p-1">
                        {hotelNames.map((hotelName) => (
                          <button
                            key={hotelName}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedHotel(hotelName);
                            }}
                            className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {hotelName}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedHotel(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground flex items-center gap-2"
                        >
                          <ArrowLeft className="h-3 w-3" />
                          Tilbake
                        </button>
                        <div className="px-3 py-1 text-xs font-semibold text-primary border-b mb-1">
                          {selectedHotel}
                        </div>
                        {sortTemplatesByDays(groupedTemplates[selectedHotel] || []).map((t) => (
                          <button
                            key={t.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              replaceTemplate(selectedId, t.id);
                              onSelectChange(t.id);
                              setIsOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between",
                              selectedId === t.id && "bg-accent"
                            )}
                          >
                            {t.name}
                            {selectedId === t.id && <Check className="h-4 w-4" />}
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    // Standard visning - direkte liste sortert etter dager
                    <div className="p-1">
                      {sortTemplatesByDays(categoryTemplates).map((t) => (
                        <button
                          key={t.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            replaceTemplate(selectedId, t.id);
                            onSelectChange(t.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between",
                            selectedId === t.id && "bg-accent"
                          )}
                        >
                          {t.name}
                          {selectedId === t.id && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Safari dropdown component med to-trinns navigering i samme popover
  function SafariDropdown({
    selectedPeriod,
    setSelectedPeriod,
    selectedTemplateId,
    setSelectedTemplateId,
  }: {
    selectedPeriod: string | null;
    setSelectedPeriod: (period: string | null) => void;
    selectedTemplateId: string | null;
    setSelectedTemplateId: (id: string | null) => void;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewingPeriod, setViewingPeriod] = useState<string | null>(null);
    
    const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;
    
    // Reset viewing period when dropdown opens
    useEffect(() => {
      if (isOpen) {
        setViewingPeriod(selectedPeriod);
      }
    }, [isOpen, selectedPeriod]);
    
    // Get periods with templates
    const periodsWithTemplates = SAFARI_PERIODS.filter(period => 
      getFilteredTemplatesByCategoryName(period).some(t => t.visibleInBuilder)
    );
    
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "w-full justify-between bg-background",
              !selectedTemplate && "text-muted-foreground"
            )}
          >
            {selectedTemplate?.name || selectedPeriod || "Velg safariperiode"}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0 bg-background z-50" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="max-h-[350px] overflow-y-auto">
            {!viewingPeriod ? (
              // Trinn 1: Vis perioder
              <div className="p-1">
                {periodsWithTemplates.map((period) => (
                  <button
                    key={period}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewingPeriod(period);
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {period}
                  </button>
                ))}
              </div>
            ) : (
              // Trinn 2: Vis filer fra valgt periode
              <div className="p-1">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewingPeriod(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground flex items-center gap-2"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Tilbake til perioder
                </button>
                <div className="px-3 py-1 text-xs font-semibold text-primary border-b mb-1">
                  {viewingPeriod}
                </div>
                {sortTemplatesByDays(
                  getFilteredTemplatesByCategoryName(viewingPeriod)
                    .filter((t) => t.visibleInBuilder)
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      replaceTemplate(selectedTemplateId, t.id);
                      setSelectedTemplateId(t.id);
                      setSelectedPeriod(viewingPeriod);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between",
                      selectedTemplateId === t.id && "bg-accent"
                    )}
                  >
                    {t.name}
                    {selectedTemplateId === t.id && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Trenger denne for type-inference
  const categoryTemplates: ReturnType<typeof getTemplatesByCategoryName> = [];

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="space-y-6">
      {/* Rad 1: Reiseprogram og Tilbud + Utreisedato + Arusha første natt */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Reiseprogram og Tilbud (Base) - Automatisk valg */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              {userLanguage === 'da' ? 'Rejseprogram og Tilbud' : 'Reiseprogram og Tilbud'}
            </Label>
            <span />
          </div>
          <Select
            value={baseProgramId ?? ""}
            onValueChange={(value) => {
              replaceTemplate(baseProgramId, value || null);
              setBaseProgramId(value || null);
            }}
          >
            <SelectTrigger className="bg-gray-50">
              <SelectValue placeholder={userLanguage === 'da' ? 'Vælg basis-skabelon' : 'Velg base-mal'} />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-gray-50 z-50 max-h-[300px] overflow-y-auto">
              {getUserBaseTemplates()
                .filter((t) => t.visibleInBuilder)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

        </div>

        {/* 2. Utreisedato */}
        <div className="space-y-2">
          <Label htmlFor="departure-date">Utreisedato (valgfritt)</Label>
          <div className="flex gap-2">
            <Input
              id="departure-date"
              type="text"
              placeholder={userLanguage === 'da' ? 'Indtast DDMM (f.eks. 0510)' : 'Skriv DDMM (f.eks. 0510)'}
              value={departureDateInput}
              onChange={(e) => {
                const val = e.target.value;
                setDepartureDateInput(val);
                // Forsøk å parse umiddelbart ved 4 siffer (DDMM) eller 8 siffer (DDMMYYYY)
                const digits = val.replace(/\D/g, "");
                if (digits.length >= 4) {
                  const parsed = parseDDMM(val);
                  if (parsed) {
                    setDepartureDate(format(parsed, "yyyy-MM-dd"));
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const parsed = parseDDMM(departureDateInput);
                  if (parsed) {
                    setDepartureDate(format(parsed, "yyyy-MM-dd"));
                    setDepartureDateInput(format(parsed, "dd.MM.yyyy", { locale: userLanguage === 'da' ? da : nb }));
                  }
                }
              }}
              onBlur={() => {
                if (departureDateInput) {
                  const parsed = parseDDMM(departureDateInput);
                  if (parsed) {
                    setDepartureDate(format(parsed, "yyyy-MM-dd"));
                    setDepartureDateInput(format(parsed, "dd.MM.yyyy", { locale: userLanguage === 'da' ? da : nb }));
                  }
                }
              }}
              className="bg-gray-50 flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "bg-gray-50 px-3",
                    !departureDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate ? new Date(departureDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setDepartureDate(format(date, "yyyy-MM-dd"));
                      setDepartureDateInput(format(date, "dd.MM.yyyy", { locale: userLanguage === 'da' ? da : nb }));
                    }
                  }}
                  locale={userLanguage === 'da' ? da : nb}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  defaultMonth={departureDate ? new Date(departureDate) : new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          {departureDate && (
            <p className="text-xs text-green-600">✓ Dato satt: {departureDate}</p>
          )}
        </div>

        {/* 3. Arusha første natt */}
        {isBuiltinCategoryVisible("arusha_first_night") && (
        <div className="space-y-2">
          <Label>Arusha første natt</Label>
          <Select
            value={firstNightId ?? ""}
            onValueChange={(value) => {
              replaceTemplate(firstNightId, value || null);
              setFirstNightId(value || null);
            }}
          >
            <SelectTrigger className="bg-gray-50">
              <SelectValue placeholder="Velg hotell" />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-gray-50 z-50 max-h-[300px] overflow-y-auto">
              {getFilteredTemplatesByCategoryName(FIRST_NIGHT_CATEGORY)
                .filter((t) => t.visibleInBuilder)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        )}
      </div>

      {/* Rad 2: Safariperiode + Siste natt safari */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 4. Safariperiode - To-trinns i SAMME dropdown med Popover */}
        {isBuiltinCategoryVisible("safari_period_group") && (
        <div className="space-y-2">
          <Label>Safariperiode</Label>
          <SafariDropdown
            selectedPeriod={selectedSafariPeriod}
            setSelectedPeriod={setSelectedSafariPeriod}
            selectedTemplateId={safariTemplateId}
            setSelectedTemplateId={setSafariTemplateId}
          />
        </div>
        )}

        {/* 5. Siste natt safari */}
        {isBuiltinCategoryVisible("last_safari_night") && (
        <div className="space-y-2">
          <Label>Siste natt safari</Label>
          <Select
            value={lastNightId ?? ""}
            onValueChange={(value) => {
              replaceTemplate(lastNightId, value || null);
              setLastNightId(value || null);
            }}
          >
            <SelectTrigger className="bg-gray-50">
              <SelectValue placeholder="Velg hotell" />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-gray-50 z-50 max-h-[300px] overflow-y-auto">
              {getFilteredTemplatesByCategoryName(LAST_NIGHT_CATEGORY)
                .filter((t) => t.visibleInBuilder)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        )}
      </div>

        {/* Rad 3: Zanzibar Hotel + Zanzibar & Stone Town */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 6. Zanzibar Hotel */}
          {isBuiltinCategoryVisible("zanzibar_hotel_1") && (
          <div className="space-y-2">
            <Label>{ZANZIBAR_MAIN}</Label>
            <CheckboxWithDropdown
              id="zanzibar-hotel-1"
              label=""
              checked={true}
              onCheckedChange={() => {}}
              category={ZANZIBAR_MAIN}
              categoryId="zanzibar_hotel_1"
              selectedId={zanzibarMainId}
              onSelectChange={setZanzibarMainId}
              groupByHotel
              hideCheckbox={true}
            />
          </div>
          )}

          {/* 7. Zanzibar & StoneTown */}
          {isBuiltinCategoryVisible("zanzibar_hotel_2") && (
          <div className="space-y-2">
            <Label>{ZANZIBAR_HOTEL_2}</Label>
            <CheckboxWithDropdown
              id="zanzibar-hotel-2"
              label=""
              checked={true}
              onCheckedChange={() => {}}
              category={ZANZIBAR_HOTEL_2}
              categoryId="zanzibar_hotel_2"
              selectedId={zanzibarHotel2Id}
              onSelectChange={setZanzibarHotel2Id}
              groupByHotel
              hideCheckbox={true}
            />
          </div>
          )}
        </div>

        {/* Rad 4: Tilleggsmoduler - 2 rader med checkbokser */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Tilleggsmoduler</Label>
          
          {/* Første rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kilimanjaro */}
            {isBuiltinCategoryVisible("kilimanjaro") && (
            <CheckboxWithDropdown
              id="kilimanjaro"
              label="Kilimanjaro"
              checked={kilimanjaro}
              onCheckedChange={setKilimanjaro}
              category={KILIMANJARO}
              selectedId={kilimanjaroId}
              onSelectChange={setKilimanjaroId}
            />
            )}
          </div>

          {/* Andre rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aktiviteter Arusha - Slides */}
            {isBuiltinCategoryVisible("arusha_activities_slides") && (
            <CheckboxWithDropdown
              id="arusha-slides"
              label="Aktiviteter Arusha - Slides"
              checked={arushaSlides}
              onCheckedChange={setArushaSlides}
              category={ARUSHA_SLIDES}
              selectedId={arushaSlidesId}
              onSelectChange={setArushaSlidesId}
            />
            )}
          </div>

          {/* Tredje rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Diverse Fastland */}
            {isBuiltinCategoryVisible("diverse_mainland") && (
            <CheckboxWithDropdown
              id="fastland"
              label="Diverse Fastland"
              checked={fastland}
              onCheckedChange={setFastland}
              category={FASTLAND}
              selectedId={fastlandId}
              onSelectChange={setFastlandId}
            />
            )}

            {/* Ekstra Slides */}
            {isBuiltinCategoryVisible("extra_slides") && (
            <CheckboxWithDropdown
              id="extra-slides"
              label="Ekstra Slides"
              checked={extraSlides}
              onCheckedChange={setExtraSlides}
              category={EXTRA}
              selectedId={extraSlidesId}
              onSelectChange={setExtraSlidesId}
            />
            )}
          </div>

          {/* Dynamic user-defined categories */}
          {myUserCategories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {myUserCategories.filter(userCat => userCat.isVisible).map((userCat) => {
                const state = userCategoryStates[userCat.id] || { checked: false, templateId: null };
                return (
                  <CheckboxWithDropdown
                    key={userCat.id}
                    id={userCat.id}
                    label={userCat.name}
                    checked={state.checked}
                    onCheckedChange={(checked) =>
                      setUserCategoryStates(prev => ({
                        ...prev,
                        [userCat.id]: { ...state, checked: !!checked }
                      }))
                    }
                    category={userCat.name}
                    selectedId={state.templateId}
                    onSelectChange={(id) =>
                      setUserCategoryStates(prev => ({
                        ...prev,
                        [userCat.id]: { ...state, templateId: id }
                      }))
                    }
                    hideCheckbox={!userCat.hasCheckbox}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Valgte slides - full bredde (inkluderer flight slide fra global state) */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Valgte slides</Label>
          <div className="border rounded-lg p-3 min-h-[120px] bg-muted/30">
            {selectedTemplateIds.length === 0 && slides.filter(s => typeof s === "object" && s.type === "flight").length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Ingen slides valgt ennå
              </p>
            ) : (
              <div className="space-y-2">
                {[...selectedTemplateIds, ...slides.filter(s => typeof s === "object" && s.type === "flight")].map((slide, idx) => {
                  if (typeof slide === "string") {
                    const tpl = templates.find((t) => t.id === slide);
                    if (!tpl) return null;
                    const isLocked = idx === 0;
                    return (
                      <div
                        key={slide}
                        className={`flex items-center gap-2 p-2 rounded bg-background border ${
                          isLocked ? 'border-primary/50 bg-primary/5' : ''
                        }`}
                        draggable={!isLocked}
                        onDragStart={(e) => onDragStart(e, idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, idx)}
                      >
                        {!isLocked && (
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        )}
                        <span className="flex-1 text-sm">{tpl.name}</span>
                        <span className="text-xs text-muted-foreground">{tpl.category}</span>
                        {!isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSelectedTemplate(slide)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  } else if (typeof slide === "object" && slide.type === "flight") {
                    // Render flight slide summary
                    return (
                      <div key={"flight-slide-" + idx} className="flex items-center gap-2 p-2 rounded bg-background border border-blue-400 bg-blue-50">
                        <span className="flex-1 text-sm font-semibold text-blue-900">✈️ Flyreise (fra Flyrobott)</span>
                        <span className="text-xs text-muted-foreground">{slide.language === 'da' ? 'Flyinfo (DK)' : 'Flyinfo (NO)'}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFlightSlides()}
                          className="h-6 w-6 p-0"
                          title="Fjern flyinformasjon"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center pt-4">
          <Button 
            variant="outline"
            onClick={generatePowerPoint} 
            className="gap-2 border-2 border-primary"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {isGenerating ? "Genererer..." : "Generer PowerPoint"}
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2 border-2 border-primary" disabled={isGenerating}>
            <RotateCcw className="h-4 w-4" />
            Nullstill
          </Button>
        </div>
    </div>
  );
}
