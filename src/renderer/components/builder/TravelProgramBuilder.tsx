import React, { useState, useEffect } from "react";
import { useTemplateStore } from "@/store/useTemplateStore";
import TemplateDropdown from "./TemplateDropdown";
import { buildPresentation, openGeneratedPath } from "@/services/powerpoint/PPTGeneratorBridge";
import { getBaseTemplateFileName, getAllBaseTemplateOptions, type DestinationSelection } from "@/config/baseTemplateSelector";
import { getUserPrefix } from "@/config/userConfig";
import { getUserBaseCategory } from "@/config/templateCategories";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GripVertical, X, FileDown, RotateCcw, Loader2, ChevronDown, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* =========================
   KONSTANTER - KATEGORIER (språkavhengige)
========================= */

const getCategoryNames = (lang: 'no' | 'da') => ({
  SAFARI_PERIODS: [
    "Safari - Midt DEC - FEB (Ndutu)",
    "Safari - MARTS (Ndutu uden Tar)",
    lang === 'no' ? "Safari - APRIL - MAI (Ser uden Tar)" : "Safari - APRIL - MAJ (Ser uden Tar)",
    "Safari - JUNI - ca. 10. JULI (Ser)",
    "Safari - ca. 10. JULI - SEP (Tar + Ser nord)",
    "Safari - OKT (Tar + Ser)",
    "Safari - NOV - Midt DEC (Tar + Ser)",
  ],
  FIRST_NIGHT: lang === 'no' ? "Arusha første natt" : "Arusha første nat",
  LAST_NIGHT: lang === 'no' ? "Siste natt safari" : "Sidste nat safari",
  ZANZIBAR_MAIN: lang === 'no' ? "Zanzibar hotell 1" : "Zanzibar hotel 1",
  ZANZIBAR_STONE: "Stone Town Hotel",
  ZANZIBAR_HOTEL_2: lang === 'no' ? "Zanzibar hotell 2" : "Zanzibar hotel 2",
  KILIMANJARO: "Kilimanjaro",
  ARUSHA_SLIDES: "Aktiviteter Arusha - Slides",
  FASTLAND: "Diverse Fastland",
  EXTRA: "Ekstra Slides",
  FLIGHT: lang === 'no' ? "Flyinformasjon" : "Flyinformation"
});

/* =========================
   COMPONENT
========================= */

interface TravelProgramBuilderProps {
  language?: 'no' | 'da';
}

export default function TravelProgramBuilder({ language = 'no' }: TravelProgramBuilderProps) {
  const { userEmail, userLanguage, isAdmin: userIsAdmin } = useAuth();
  const userPrefix = userEmail ? getUserPrefix(userEmail) : undefined;
  
  // Språkavhengige konstanter
  const categoryNames = getCategoryNames(userLanguage);
  const AUTO_PROGRAM_CATEGORY = userLanguage === 'da' ? "Rejseprogram og Tilbud" : "Reiseprogram og Tilbud";
  const SAFARI_PERIODS = categoryNames.SAFARI_PERIODS;
  const FIRST_NIGHT_CATEGORY = categoryNames.FIRST_NIGHT;
  const LAST_NIGHT_CATEGORY = categoryNames.LAST_NIGHT;
  const ZANZIBAR_MAIN = categoryNames.ZANZIBAR_MAIN;
  const ZANZIBAR_STONE_TOWN = userLanguage === 'no' ? "Zanzibar & Stone Town" : "Zanzibar & Stone Town";
  const ZANZIBAR_STONE = categoryNames.ZANZIBAR_STONE;
  const ZANZIBAR_HOTEL_2 = categoryNames.ZANZIBAR_HOTEL_2;
  const KILIMANJARO = categoryNames.KILIMANJARO;
  const ARUSHA_SLIDES = categoryNames.ARUSHA_SLIDES;
  const FASTLAND = categoryNames.FASTLAND;
  const EXTRA = categoryNames.EXTRA;
  
  const {
    categories,
    templates,
    selectedTemplateIds,
    addSelectedTemplate,
    removeSelectedTemplate,
    moveSelectedTemplate,
    clearSelectedTemplates,
    getTemplatesByCategoryName,
    loadFromDB,
  } = useTemplateStore();

  /* =========================
     HELPER - Filtrer templates basert på bruker
  ========================= */
  
  const getFilteredTemplatesByCategoryName = (categoryName: string) => {
    const allTemplates = getTemplatesByCategoryName(categoryName);
    
    // Admin ser alt
    if (userIsAdmin) return allTemplates;
    
    // Andre kategorier - vis alt
    return allTemplates;
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
  const [baseProgramId, setBaseProgramId] = useState<string | null>(null);
  const [manualBaseOverride, setManualBaseOverride] = useState<string | null>(null);
  const [firstNightId, setFirstNightId] = useState<string | null>(null);
  const [lastNightId, setLastNightId] = useState<string | null>(null);
  const [selectedSafariPeriod, setSelectedSafariPeriod] = useState<string | null>(null);
  const [safariTemplateId, setSafariTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  /* Checkbox state med tilhørende template ID */
  const [zanzibarMain, setZanzibarMain] = useState(false);
  const [zanzibarMainId, setZanzibarMainId] = useState<string | null>(null);
  const [zanzibarStoneTown, setZanzibarStoneTown] = useState(false);
  const [zanzibarStoneTownId, setZanzibarStoneTownId] = useState<string | null>(null);
  const [zanzibarStone, setZanzibarStone] = useState(false);
  const [zanzibarStoneId, setZanzibarStoneId] = useState<string | null>(null);
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

  // Load templates on mount
  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  /* =========================
     AUTOMATISK BASEFIL-VALG
  ========================= */

  useEffect(() => {
    // Ikke endre hvis brukeren har manuelt overstyrt
    if (manualBaseOverride) return;

    // Bestem hvilke destinasjoner som er valgt
    const hasSafari = !!safariTemplateId;
    const hasZanzibar = zanzibarMain || zanzibarStone || zanzibarHotel2;
    const hasKilimanjaro = kilimanjaro;

    // Beregn riktig basefil-navn (uten bruker-prefix siden filene ligger i brukerspesifikke mapper)
    const baseFileName = getBaseTemplateFileName(
      { hasSafari, hasZanzibar, hasKilimanjaro },
      userLanguage
    );

    // Finn template med dette navnet i brukerens basefil-kategori
    const baseTemplates = getUserBaseTemplates();
    const matchingTemplate = baseTemplates.find(t => 
      t.name === baseFileName || t.name.includes(baseFileName)
    );

    if (matchingTemplate && matchingTemplate.id !== baseProgramId) {
      // Bytt basefil
      if (baseProgramId) {
        removeSelectedTemplate(baseProgramId);
      }
      setBaseProgramId(matchingTemplate.id);
      addSelectedTemplate(matchingTemplate.id);
    }
  }, [safariTemplateId, zanzibarMain, zanzibarStone, zanzibarHotel2, kilimanjaro, userLanguage, userPrefix, manualBaseOverride, baseProgramId, addSelectedTemplate, removeSelectedTemplate]);

  /* =========================
     HELPERS
  ========================= */

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
      const modules = selectedTemplateIds
        .map((id) => templates.find((t) => t.id === id))
        .filter(Boolean)
        .map((t) => ({
          id: t!.id,
          name: t!.name,
          blob: t!.blob,
          fileName: t!.fileName,
        }));

      const result = await buildPresentation({
        departureDate: departureDate || null,
        modules,
        language,
      });

      if (result.ok) {
        await openGeneratedPath(result);
        toast.success("PowerPoint generert og lastet ned!");
      } else {
        toast.error(result.error || "Feil ved generering");
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
    setZanzibarStone(false);
    setZanzibarStoneId(null);
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
    return [...templates].sort((a, b) => {
      const daysA = extractDaysFromName(a.name);
      const daysB = extractDaysFromName(b.name);
      
      // Begge har tall - sorter etter tall
      if (daysA !== null && daysB !== null) {
        return daysA - daysB;
      }
      // Kun a har tall - a først
      if (daysA !== null) return -1;
      // Kun b har tall - b først
      if (daysB !== null) return 1;
      // Ingen har tall - alfabetisk
      return a.name.localeCompare(b.name, 'nb');
    });
  }

  // Helper: Grupper templates etter hotellnavn (første ord)
  function groupTemplatesByHotel(templates: typeof categoryTemplates) {
    const groups: Record<string, typeof templates> = {};
    
    templates.forEach(t => {
      // Ekstraher hotellnavn (første ord eller til første tall/bindestrek)
      const match = t.name.match(/^([A-Za-zÆØÅæøå\s]+)/);
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
    selectedId,
    onSelectChange,
    indent = false,
    groupByHotel = false,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    category: string;
    selectedId: string | null;
    onSelectChange: (id: string | null) => void;
    indent?: boolean;
    groupByHotel?: boolean;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedHotel, setSelectedHotel] = useState<string | null>(null);
    
    const categoryTemplates = getFilteredTemplatesByCategoryName(category).filter(t => t.visibleInBuilder);
    const groupedTemplates = groupByHotel ? groupTemplatesByHotel(categoryTemplates) : null;
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
        
        {checked && categoryTemplates.length > 0 && (
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
                {selectedTemplate?.name || `Velg ${label.toLowerCase()}`}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-background z-50" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
              <div className="max-h-[300px] overflow-y-auto">
                {groupByHotel && groupedTemplates ? (
                  // Gruppert visning - to-trinns
                  !selectedHotel ? (
                    // Trinn 1: Vis hotell-grupper
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
                    // Trinn 2: Vis filer for valgt hotell
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
        {/* Rad 1: Reiseprogram og Tilbud + Utreisedato */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Reiseprogram og Tilbud (Base) - Automatisk valg */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                {userLanguage === 'da' ? 'Rejseprogram og Tilbud' : 'Reiseprogram og Tilbud'}
              </Label>
              {!manualBaseOverride && (
                <span className="text-xs text-muted-foreground italic">
                  {userLanguage === 'da' ? 'Vælges automatisk' : 'Velges automatisk'}
                </span>
              )}
            </div>
            <Select
              value={baseProgramId ?? ""}
              onValueChange={(value) => {
                replaceTemplate(baseProgramId, value || null);
                setBaseProgramId(value || null);
                setManualBaseOverride(value || null);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={userLanguage === 'da' ? 'Vælg basis-skabelon' : 'Velg base-mal'} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getUserBaseTemplates()
                  .filter((t) => t.visibleInBuilder)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {manualBaseOverride && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setManualBaseOverride(null);
                  toast.info("Automatisk valg aktivert");
                }}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Tilbakestill til automatisk
              </Button>
            )}
          </div>

          {/* 2. Utreisedato */}
          <div className="space-y-2">
            <Label htmlFor="departure-date">Utreisedato (valgfritt)</Label>
            <Input
              id="departure-date"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
            />
          </div>
        </div>

        {/* Rad 2: Arusha første natt + Safariperiode + Siste natt safari */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 3. Arusha første natt */}
          <div className="space-y-2">
            <Label>Arusha første natt</Label>
            <Select
              value={firstNightId ?? ""}
              onValueChange={(value) => {
                replaceTemplate(firstNightId, value || null);
                setFirstNightId(value || null);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Velg hotell" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
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

          {/* 4. Safariperiode - To-trinns i SAMME dropdown med Popover */}
          <div className="space-y-2">
            <Label>Safariperiode</Label>
            <SafariDropdown
              selectedPeriod={selectedSafariPeriod}
              setSelectedPeriod={setSelectedSafariPeriod}
              selectedTemplateId={safariTemplateId}
              setSelectedTemplateId={setSafariTemplateId}
            />
          </div>

          {/* 5. Siste natt safari */}
          <div className="space-y-2">
            <Label>Siste natt safari</Label>
            <Select
              value={lastNightId ?? ""}
              onValueChange={(value) => {
                replaceTemplate(lastNightId, value || null);
                setLastNightId(value || null);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Velg hotell" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
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
        </div>

        {/* Rad 3: Zanzibar Hotel 1 + Zanzibar & Stone Town */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 6. Zanzibar Hotel 1 - dropdown (ikke checkbox) */}
          <div className="space-y-2">
            <Label>Zanzibar hotell 1</Label>
            <Select
              value={zanzibarMainId ?? ""}
              onValueChange={(value) => {
                replaceTemplate(zanzibarMainId, value || null);
                setZanzibarMainId(value || null);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Velg hotell" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getFilteredTemplatesByCategoryName(ZANZIBAR_MAIN)
                  .filter((t) => t.visibleInBuilder)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7. Zanzibar & Stone Town */}
          <div className="space-y-2">
            <Label>Zanzibar & Stone Town</Label>
            <Select
              value={zanzibarStoneTownId ?? ""}
              onValueChange={(value) => {
                replaceTemplate(zanzibarStoneTownId, value || null);
                setZanzibarStoneTownId(value || null);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Velg mal" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getFilteredTemplatesByCategoryName(ZANZIBAR_STONE_TOWN)
                  .filter((t) => t.visibleInBuilder)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rad 4: Tilleggsmoduler - 2 rader med checkbokser */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Tilleggsmoduler</Label>
          
          {/* Første rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stone Town Hotel */}
            <CheckboxWithDropdown
              id="zanzibar-stone"
              label="Stone Town Hotel"
              checked={zanzibarStone}
              onCheckedChange={setZanzibarStone}
              category={ZANZIBAR_STONE}
              selectedId={zanzibarStoneId}
              onSelectChange={setZanzibarStoneId}
              groupByHotel
            />

            {/* Zanzibar Hotel 2 */}
            <CheckboxWithDropdown
              id="zanzibar-hotel-2"
              label="Zanzibar Hotel 2"
              checked={zanzibarHotel2}
              onCheckedChange={setZanzibarHotel2}
              category={ZANZIBAR_HOTEL_2}
              selectedId={zanzibarHotel2Id}
              onSelectChange={setZanzibarHotel2Id}
              groupByHotel
            />
          </div>

          {/* Andre rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kilimanjaro */}
            <CheckboxWithDropdown
              id="kilimanjaro"
              label="Kilimanjaro"
              checked={kilimanjaro}
              onCheckedChange={setKilimanjaro}
              category={KILIMANJARO}
              selectedId={kilimanjaroId}
              onSelectChange={setKilimanjaroId}
            />

            {/* Aktiviteter Arusha - Slides */}
            <CheckboxWithDropdown
              id="arusha-slides"
              label="Aktiviteter Arusha - Slides"
              checked={arushaSlides}
              onCheckedChange={setArushaSlides}
              category={ARUSHA_SLIDES}
              selectedId={arushaSlidesId}
              onSelectChange={setArushaSlidesId}
            />
          </div>

          {/* Tredje rad tilleggsmoduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Diverse Fastland */}
            <CheckboxWithDropdown
              id="fastland"
              label="Diverse Fastland"
              checked={fastland}
              onCheckedChange={setFastland}
              category={FASTLAND}
              selectedId={fastlandId}
              onSelectChange={setFastlandId}
            />

            {/* Ekstra Slides */}
            <CheckboxWithDropdown
              id="extra-slides"
              label="Ekstra Slides"
              checked={extraSlides}
              onCheckedChange={setExtraSlides}
              category={EXTRA}
              selectedId={extraSlidesId}
              onSelectChange={setExtraSlidesId}
            />
          </div>
        </div>

        {/* Valgte slides - full bredde */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Valgte maler</Label>
          <div className="border rounded-lg p-3 min-h-[120px] bg-muted/30">
            {selectedTemplateIds.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Ingen maler valgt ennå
              </p>
            ) : (
              <div className="space-y-2">
                {selectedTemplateIds.map((id, idx) => {
                  const tpl = templates.find((t) => t.id === id);
                  if (!tpl) return null;
                  const isLocked = idx === 0;
                  return (
                    <div
                      key={id}
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
                          onClick={() => removeSelectedTemplate(id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center pt-4">
          <Button 
            onClick={generatePowerPoint} 
            className="gap-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {isGenerating ? "Genererer..." : "Generer PowerPoint"}
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2" disabled={isGenerating}>
            <RotateCcw className="h-4 w-4" />
            Nullstill
          </Button>
        </div>
    </div>
  );
}
