import React from "react";
import { Category, TemplateEntry } from "@/store/useTemplateStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
  const [selectedId, setSelectedId] = React.useState<string>("");

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

  return (
    <div className="flex gap-2">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="flex-1 bg-background">
          <SelectValue placeholder="Velg mal å legge til..." />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          {dropdownCategories.map((cat) => {
            const templates = getTemplatesByCategoryName(cat.name)
              .filter((t) => t.visibleInBuilder && !selectedTemplateIds.includes(t.id));
            
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
        </SelectContent>
      </Select>
      
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
