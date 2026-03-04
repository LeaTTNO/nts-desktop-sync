import React, { useRef, useState } from "react";
import { Category, TemplateEntry } from "@/store/useTemplateStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import NestedDropdown, { NestedCategory, NestedItem } from "@/components/NestedDropdown";

interface TemplateDropdownProps {
  categories: Category[];
  getTemplatesByCategoryName: (catName: string) => TemplateEntry[];
  onInclude: (id: string) => void;
  selectedTemplateIds: string[];
}

export default function TemplateDropdown({
  categories,
  getTemplatesByCategoryName,
  onInclude,
  selectedTemplateIds,
}: TemplateDropdownProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  // State for hver Zanzibar-hotellkategori
  const [nestedOpenMap, setNestedOpenMap] = useState<Record<string, boolean>>({});
  const nestedAnchorRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Filter categories that should appear in dropdown (dropdown kind, not already selected base categories)
  const dropdownCategories = categories.filter(
    (c) => c.kind === "dropdown" && !c.parentId
  );

  // Get all available templates from dropdown categories
  const availableTemplates = dropdownCategories.flatMap((cat) => {
    return getTemplatesByCategoryName(cat.name)
      .filter((t) => t.visibleInBuilder && !selectedTemplateIds.includes(t.id))
      .map((t) => ({ ...t, categoryName: cat.name }));
  });

  function handleAdd() {
    if (selectedId) {
      onInclude(selectedId);
      setSelectedId("");
    }
  }

  if (availableTemplates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen flere maler tilgjengelig
      </p>
    );
  }


  // Normalize hotel/category names for robust matching
  function normalizeHotelName(name: string): string {
    return name
      .replace(/hotell/gi, "hotel")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // Zanzibar-hotell-kategorier som skal ha nested dropdown (normalized)
  const zanzibarCategoriesRaw = [
    "Zanzibar Hotel 1",
    "Zanzibar Hotel 2",
    "Stone Town Hotel",
    "Zanzibar & Stone Town"
  ];
  const zanzibarCategories = zanzibarCategoriesRaw.map(normalizeHotelName);


  // Sjekk om noen av dropdownCategories er Zanzibar-hotell (normalized)
  const hasZanzibar = dropdownCategories.some(cat => zanzibarCategories.includes(normalizeHotelName(cat.name)));

  // NestedDropdown data helpers
  function getNestedCategories(catName: string): NestedCategory[] {
    // Gruppér på hotellnavn: alt før første tall eller bindestrek
    const templates = getTemplatesByCategoryName(catName)
      .filter((t) => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
    const hotelMap: Record<string, TemplateEntry[]> = {};
    templates.forEach(t => {
      const match = t.name.match(/^([A-Za-zÆØÅæøå\s]+?)(?=\d| -|$)/);
      const hotelRaw = match ? match[1].trim() : t.name;
      const hotel = normalizeHotelName(hotelRaw);
      if (!hotelMap[hotel]) hotelMap[hotel] = [];
      hotelMap[hotel].push(t);
    });
    // Use original label for display, but normalized for grouping
    return Object.keys(hotelMap)
      .sort()
      .map(hotelKey => {
        // Find a representative label from the first template
        const firstTemplate = hotelMap[hotelKey][0];
        const match = firstTemplate.name.match(/^([A-Za-zÆØÅæøå\s]+?)(?=\d| -|$)/);
        const label = match ? match[1].trim() : firstTemplate.name;
        return { key: hotelKey, label, id: hotelKey };
      });
  }
  // Extract combo name (everything before the first digit)
  // "Jambiani + Mizingani 4 + 1 nætter" → "Jambiani + Mizingani"
  function getComboName(templateName: string): string {
    const match = templateName.match(/^(.+?)\s+\d/);
    return match ? match[1].trim().replace(/\s*-\s*$/, '').trim() : templateName;
  }

  // Extract Stone Town hotel (last word after final " + " in combo name)
  // "Jambiani + Mizingani" → "mizingani"
  function getStoneTownHotelKey(comboName: string): string {
    const parts = comboName.split(/\s*\+\s*/);
    return parts[parts.length - 1].trim().toLowerCase();
  }

  // ---- 3-LEVEL helpers for "Zanzibar & Stone Town" category ----

  // Level 1: unique Stone Town hotels, label = "Strandhotel + {Name}"
  function getThreeLevelCategories(catName: string): NestedCategory[] {
    const templates = getTemplatesByCategoryName(catName)
      .filter(t => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
    const seen = new Set<string>();
    const result: NestedCategory[] = [];
    templates.forEach(t => {
      const combo = getComboName(t.name);
      const stKey = getStoneTownHotelKey(combo);
      if (!seen.has(stKey)) {
        seen.add(stKey);
        const stLabel = combo.split(/\s*\+\s*/).pop()!.trim();
        result.push({ key: stKey, label: `Strandhotel + ${stLabel}`, id: stKey });
      }
    });
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Level 2: unique combo names for a given Stone Town hotel key
  function getSubCategoriesForStoneTown(catName: string, stoneKey: string): NestedCategory[] {
    const templates = getTemplatesByCategoryName(catName)
      .filter(t => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
    const seen = new Set<string>();
    const result: NestedCategory[] = [];
    templates.forEach(t => {
      const combo = getComboName(t.name);
      if (getStoneTownHotelKey(combo) === stoneKey && !seen.has(combo.toLowerCase())) {
        seen.add(combo.toLowerCase());
        result.push({ key: combo.toLowerCase(), label: combo, id: combo.toLowerCase() });
      }
    });
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Level 3: all night variants for a given combo key
  function getItemsForCombo(catName: string, comboKey: string): NestedItem[] {
    const templates = getTemplatesByCategoryName(catName)
      .filter(t => t.visibleInBuilder && !selectedTemplateIds.includes(t.id))
      .filter(t => getComboName(t.name).toLowerCase() === comboKey);
    // Sort by total nights
    templates.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
    return templates.map(t => ({ id: t.id, label: t.name }));
  }

  // Combo categories (zanzibar_hotel_2 = "Zanzibar & Stone Town") use 3-level
  const COMBO_CATEGORY_NORMALIZED = normalizeHotelName("Zanzibar & Stone Town");

  function getNestedItems(catName: string, hotel: string): NestedItem[] {
    let templates = getTemplatesByCategoryName(catName)
      .filter((t) => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
    templates = templates.filter(t => {
      const match = t.name.match(/^([A-Za-zÆØÅæøå\s]+?)(?=\d| -|$)/);
      const hRaw = match ? match[1].trim() : t.name;
      return normalizeHotelName(hRaw) === hotel;
    });
    // Sorter etter tall i filnavn
    const withNumber = templates.filter(t => /^\d+/.test(t.name));
    const withoutNumber = templates.filter(t => !/^\d+/.test(t.name));
    withNumber.sort((a, b) => {
      const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
    withoutNumber.sort((a, b) => a.name.localeCompare(b.name));
    const sorted = [...withNumber, ...withoutNumber];
    return sorted.map(t => ({ id: t.id, label: t.name }));
  }

  return (
    <div className="flex gap-2">
      {dropdownCategories.map((cat) => {
        const normalizedCatName = normalizeHotelName(cat.name);
        if (zanzibarCategories.includes(normalizedCatName)) {
          // Bruk NestedDropdown for Zanzibar-hotell
          const isComboCategory = normalizeHotelName(cat.name) === COMBO_CATEGORY_NORMALIZED;
          return (
            <React.Fragment key={cat.id}>
              <Button
                ref={el => { nestedAnchorRefs.current[cat.name] = el; }}
                variant="outline"
                size="sm"
                onClick={() => setNestedOpenMap(map => ({ ...map, [cat.name]: true }))}
                className="flex-1"
              >
                {cat.name}
              </Button>
              <NestedDropdown
                open={!!nestedOpenMap[cat.name]}
                onOpenChange={open => setNestedOpenMap(map => ({ ...map, [cat.name]: open }))}
                anchorRef={{ current: nestedAnchorRefs.current[cat.name] }}
                categories={isComboCategory
                  ? getThreeLevelCategories(cat.name)
                  : getNestedCategories(cat.name)}
                getItemsForCategory={(hotelKey) => getNestedItems(cat.name, hotelKey)}
                onSelectItem={(item) => {
                  setSelectedId(item.id);
                  setNestedOpenMap(map => ({ ...map, [cat.name]: false }));
                  onInclude(item.id);
                }}
                title={isComboCategory ? "Velg Stone Town-hotell og kombinasjon" : "Velg hotell og antall netter"}
                {...(isComboCategory ? {
                  getSubCategories: (stoneKey) => getSubCategoriesForStoneTown(cat.name, stoneKey),
                  getItemsForSubCategory: (_stoneKey, comboKey) => getItemsForCombo(cat.name, comboKey),
                } : {})}
              />
            </React.Fragment>
          );
        }
        // Standard Select for andre kategorier
        let templates = getTemplatesByCategoryName(cat.name)
          .filter((t) => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
        const withNumber = templates.filter(t => /^\d+/.test(t.name));
        const withoutNumber = templates.filter(t => !/^\d+/.test(t.name));
        withNumber.sort((a, b) => {
          const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0', 10);
          const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0', 10);
          return numA - numB;
        });
        withoutNumber.sort((a, b) => a.name.localeCompare(b.name));
        templates = [...withNumber, ...withoutNumber];
        if (templates.length === 0) return null;
        return (
          <SelectGroup key={cat.id}>
            <SelectLabel className="text-xs text-muted-foreground">
              {cat.name}
            </SelectLabel>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      })}
      <Button
        onClick={handleAdd}
        disabled={!selectedId}
        size="icon"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
