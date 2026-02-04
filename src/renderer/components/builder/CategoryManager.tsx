import React, { useState } from "react";
import { useUserCategoryStore } from "@/store/useUserCategoryStore";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function CategoryManager() {
  const { userEmail } = useAuth();
  const { categories, addCategory, deleteCategory, updateCategory, getCategoriesForUser } = useUserCategoryStore();
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryHasCheckbox, setNewCategoryHasCheckbox] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const userCategories = userEmail ? getCategoriesForUser(userEmail) : [];

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !userEmail) {
      toast.error("Kategori navn kan ikke være tomt");
      return;
    }

    addCategory(newCategoryName.trim(), userEmail, newCategoryHasCheckbox);
    toast.success(`Kategori "${newCategoryName}" opprettet`);
    setNewCategoryName("");
    setNewCategoryHasCheckbox(true);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (confirm(`Er du sikker på at du vil slette kategorien "${name}"?`)) {
      deleteCategory(id);
      toast.success(`Kategori "${name}" slettet`);
    }
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim()) {
      toast.error("Kategori navn kan ikke være tomt");
      return;
    }

    updateCategory(id, { name: editingName.trim() });
    toast.success("Kategori oppdatert");
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleToggleCheckbox = (id: string, currentValue: boolean) => {
    updateCategory(id, { hasCheckbox: !currentValue });
    toast.success(currentValue ? "Kategori vises alltid" : "Kategori har checkbox");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administrer Egendefinerte Kategorier</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new category */}
        <div className="space-y-2 p-4 bg-gray-50 rounded-md">
          <Label>Ny Kategori</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Kategori navn..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              className="flex-1"
            />
            <Button onClick={handleAddCategory} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Legg til
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has-checkbox"
              checked={newCategoryHasCheckbox}
              onCheckedChange={(checked) => setNewCategoryHasCheckbox(!!checked)}
            />
            <Label htmlFor="has-checkbox" className="text-sm font-normal cursor-pointer">
              Bruk checkbox (hvis av, vises alltid)
            </Label>
          </div>
        </div>

        {/* List existing categories */}
        <div className="space-y-2">
          <Label>Dine Kategorier ({userCategories.length})</Label>
          {userCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen egendefinerte kategorier ennå</p>
          ) : (
            <div className="space-y-2">
              {userCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-3 bg-white border rounded-md"
                >
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(cat.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        onClick={() => handleSaveEdit(cat.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat.hasCheckbox ? "Med checkbox" : "Alltid synlig"}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleToggleCheckbox(cat.id, cat.hasCheckbox)}
                        size="sm"
                        variant="outline"
                      >
                        {cat.hasCheckbox ? "Fjern checkbox" : "Legg til checkbox"}
                      </Button>
                      <Button
                        onClick={() => handleStartEdit(cat.id, cat.name)}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
