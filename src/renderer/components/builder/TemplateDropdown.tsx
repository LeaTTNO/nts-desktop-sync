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
                categories={getNestedCategories(cat.name)}
                getItemsForCategory={(hotelKey) => getNestedItems(cat.name, hotelKey)}
                onSelectItem={(item) => {
                  setSelectedId(item.id);
                  setNestedOpenMap(map => ({ ...map, [cat.name]: false }));
                  onInclude(item.id);
                }}
                title={`Velg hotell og antall netter`}
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
