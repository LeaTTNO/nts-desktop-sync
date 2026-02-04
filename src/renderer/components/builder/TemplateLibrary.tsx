import React, { useState, useEffect } from "react";
import { useTemplateStore } from "@/store/useTemplateStore";
import { useUserCategoryStore } from "@/store/useUserCategoryStore";
import { useAuth } from "@/contexts/AuthContext";
import { getUploadableCategories, getUserPersonalCategory, getAllUserBaseCategories } from "@/config/templateCategories";
import { getUserPrefix } from "@/config/userConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import SectionDivider from "@/components/SectionDivider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Upload, Trash2, Eye, EyeOff, Plus, Edit2, FolderPlus, RefreshCw, Save, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

export default function TemplateLibrary() {
  const [uploading, setUploading] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>("");
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  // State for innebygde kategoriers synlighet og checkbox for admin
  const [builtInCategorySettings, setBuiltInCategorySettings] = useState<Record<string, { isVisible?: boolean; hasCheckbox?: boolean }>>({});

  const { user, userEmail, userLanguage, isAdmin: userIsAdmin } = useAuth();
  const userPrefix = userEmail ? getUserPrefix(userEmail) : undefined;

  const {
    templates,
    addTemplate,
    deleteTemplate,
    setTemplateVisibility,
    updateTemplateCategory,
    loadFromDB,
  } = useTemplateStore();

  const {
    categories: userCategories,
    addCategory: addUserCategory,
    deleteCategory: deleteUserCategory,
    getCategoriesForUser,
    updateCategory: updateUserCategory
  } = useUserCategoryStore();

  // Håndter lagring av nytt navn på kategori
  const handleEditCategory = (catId: string, currentName: string) => {
    setEditingCategoryId(catId);
    setEditingCategoryName(currentName);
  };

  const handleSaveCategoryName = (catId?: string) => {
    if (!editingCategoryName.trim()) {
      toast.error("Kategorinavn kan ikke være tomt");
      return;
    }
    const userCat = userCategories.find(c => c.id === catId);
    if (userCat) {
      updateUserCategory(catId!, { name: editingCategoryName.trim() });
    } else {
      const idx = uploadableCategories.findIndex(c => c.id === catId);
      if (idx !== -1) {
        uploadableCategories[idx].name = editingCategoryName.trim();
      }
      const idxAll = allCategories.findIndex(c => c.id === catId);
      if (idxAll !== -1) {
        allCategories[idxAll].name = editingCategoryName.trim();
      }
    }
    toast.success("Kategorinavn oppdatert");
    setEditingCategoryId(null);
    setEditingCategoryName("");
    loadFromDB();
  };

  const handleToggleCategoryCheckbox = (catId: string) => {
    const userCat = userCategories.find(c => c.id === catId);
    if (userCat) {
      updateUserCategory(catId, { hasCheckbox: !userCat.hasCheckbox });
      toast.success(userCat.hasCheckbox ? "Vises alltid" : "Vises med checkbox");
    } else if (userIsAdmin) {
      // For innebygde kategorier - kun admin kan endre
      const currentHasCheckbox = builtInCategorySettings[catId]?.hasCheckbox ?? true;
      setBuiltInCategorySettings(prev => ({
        ...prev,
        [catId]: { ...prev[catId], hasCheckbox: !currentHasCheckbox }
      }));
      toast.success(currentHasCheckbox ? "Vises alltid" : "Vises med checkbox");
    } else {
      toast.error("Checkbox kan kun endres for egendefinerte kategorier");
    }
  };

  const handleToggleCategoryVisibility = (catId: string) => {
    const userCat = userCategories.find(c => c.id === catId);
    if (userCat) {
      updateUserCategory(catId, { isVisible: !userCat.isVisible });
      toast.success(userCat.isVisible ? "Kategori skjult i frontend" : "Kategori synlig i frontend");
    } else if (userIsAdmin) {
      // For innebygde kategorier - kun admin kan endre
      const currentIsVisible = builtInCategorySettings[catId]?.isVisible ?? true;
      setBuiltInCategorySettings(prev => ({
        ...prev,
        [catId]: { ...prev[catId], isVisible: !currentIsVisible }
      }));
      toast.success(currentIsVisible ? "Kategori skjult i frontend" : "Kategori synlig i frontend");
    } else {
      toast.error("Synlighet kan kun endres for egendefinerte kategorier");
    }
  };

  const handleDeleteCategory = (catId: string) => {
    const category = allCategories.find(c => c.id === catId);
    if (!category) return;
    
    const userCat = userCategories.find(c => c.id === catId);
    if (userCat) {
      if (confirm(`Er du sikker på at du vil slette kategorien "${category.name}"?`)) {
        deleteUserCategory(catId);
        toast.success("Kategori slettet");
        setEditingCategoryId(null);
      }
    } else {
      // For innebygde kategorier - fjern alle maler og skjul kategorien
      if (confirm(`Er du sikker på at du vil slette kategorien "${category.name}" og alle malene i den?`)) {
        const templatesToDelete = templates.filter(t => t.category === catId);
        templatesToDelete.forEach(t => deleteTemplate(t.id));
        setHiddenCategories(prev => [...prev, catId]);
        toast.success(`Kategori "${category.name}" og ${templatesToDelete.length} mal(er) slettet`);
        setEditingCategoryId(null);
      }
    }
  };

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  // Legg til brukerens personlige kategori
  const personalCategory = userPrefix
    ? getUserPersonalCategory(userPrefix, userLanguage)
    : null;

  // Get uploadable categories
  const uploadableCategories = getUploadableCategories();

  // Get base categories for all users (kun for admin)
  const baseCategories = userIsAdmin ? getAllUserBaseCategories(userLanguage) : [];

  // Merge default categories with user-specific categories + personal category + base categories (if admin)
  const userCategoryList = userEmail ? getCategoriesForUser(userEmail) : [];
  const allCategories = [
    ...uploadableCategories,
    ...(personalCategory ? [personalCategory] : []),
    ...baseCategories,
    ...userCategoryList.map(uc => ({
      id: uc.id,
      name: uc.name,
      kind: "dropdown" as const,
      order: uc.order,
      isUserCategory: true,
      isVisible: uc.isVisible ?? true, // Default to true if not set
      hasCheckbox: uc.hasCheckbox ?? true, // Default to true if not set
    }))
  ].filter(cat => !hiddenCategories.includes(cat.id)).sort((a, b) => a.order - b.order);
  
  // Filtrer templates basert på bruker
  const filteredTemplates = userIsAdmin 
    ? templates // Admin ser alle templates
    : templates.filter(t => {
        // Skjul basefil-kategorier fra vanlige brukere (disse vises kun for admin)
        const isBaseCategory = baseCategories.some(bc => bc.name === t.category);
        if (isBaseCategory) return false;
        
        // Hvis det er brukerens personlige kategori, vis kun deres filer
        if (personalCategory && t.category === personalCategory.name) {
          return true;
        }
        
        // Alle andre filer vises for alle
        return true;
    });
  
  const handleCreateCategory = () => {
    if (!userEmail) {
      toast.error("Du må være logget inn for å opprette en kategori");
      return;
    }
    
    if (!newCategoryName.trim()) {
      toast.error("Kategorinavn kan ikke være tomt");
      return;
    }
    
    const exists = allCategories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase());
    if (exists) {
      toast.error("En kategori med dette navnet finnes allerede");
      return;
    }
    
    // Bruk userEmail som userId
    const userId = userEmail || 'unknown';
    addUserCategory(newCategoryName.trim(), userId);
    toast.success(`Kategori "${newCategoryName}" ble opprettet`);
    setNewCategoryName("");
    setIsDialogOpen(false);
  };
  
  const handleDeleteUserCategory = (categoryId: string, categoryName: string) => {
    const hasTemplates = templates.some(t => t.category === categoryName);
    if (hasTemplates) {
      toast.error("Kan ikke slette kategori med maler. Flytt eller slett malene først.");
      return;
    }
    deleteUserCategory(categoryId);
    toast.success(`Kategori "${categoryName}" ble slettet`);
  };

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    category: string
  ) {
    const files = Array.from(e.target.files || []);
    
    for (const f of files) {
      const buf = await f.arrayBuffer();
      await addTemplate({
        name: f.name.replace(/\.pptx?$/i, ""),
        fileName: f.name,
        blob: buf,
        category,
      });
    }
    
    toast.success(`${files.length} fil(er) lastet opp til ${category}`);
    e.target.value = "";
  }

  function handleDelete(id: string, name: string) {
    deleteTemplate(id);
    toast.success(`"${name}" slettet`);
  }

  function toggleVisibility(id: string, currentlyVisible: boolean) {
    setTemplateVisibility(id, !currentlyVisible);
  }


  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      // @ts-ignore - Electron IPC
      const result = await window.electron.invoke("onedrive:sync-now");
      if (result.success) {
        toast.success("OneDrive synkronisering startet!");
        // Reload templates after a short delay
        setTimeout(() => {
          loadFromDB();
          toast.info("Maler oppdatert");
        }, 2000);
      } else {
        toast.error("Synkronisering feilet: " + result.error);
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Kunne ikke starte synkronisering");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-3">
        {/* Admin-indikator fjernet herfra */}
      </CardHeader>
      <CardContent className="pt-2">
        <Accordion
          type="multiple"
          value={openCategories}
          onValueChange={setOpenCategories}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 items-start">
          {allCategories.map((cat) => {
              let list = filteredTemplates.filter((t) => t.category === cat.name);

              // Safari-sortering: tall først numerisk, så resten alfabetisk, så de uten tall til sist
              if (cat.name.toLowerCase().includes('safari')) {
                const withNumber = list.filter(t => /^\d+/.test(t.name));
                const withoutNumber = list.filter(t => !/^\d+/.test(t.name));
                withNumber.sort((a, b) => {
                  const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0', 10);
                  const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0', 10);
                  return numA - numB;
                });
                // De uten tall sorteres alfabetisk og legges til sist
                withoutNumber.sort((a, b) => a.name.localeCompare(b.name));
                list = [...withNumber, ...withoutNumber];
              }

              const isUserCategory = 'isUserCategory' in cat && cat.isUserCategory;
              const isPersonalCategory = cat.kind === 'user';
              const userOwnsCategory = isUserCategory && userCategories.find(c => c.id === cat.id)?.userId === userEmail;
              const canEdit = userIsAdmin || isPersonalCategory || userOwnsCategory;

              return (
                <AccordionItem
                  key={cat.id}
                  value={cat.id}
                  className="border rounded-md px-3 py-1"
                >
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-2">
                      {editingCategoryId === cat.id ? (
                        <>
                          <Input
                            value={editingCategoryName}
                            onChange={e => setEditingCategoryName(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleSaveCategoryName(cat.id);
                              if (e.key === "Escape") setEditingCategoryId(null);
                            }}
                            className="w-36 h-7 text-sm"
                            autoFocus
                          />
                          <span 
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                            onClick={e => { e.stopPropagation(); handleSaveCategoryName(cat.id); }} 
                            title="Lagre"
                          >
                            <Save className="h-4 w-4 text-green-600" />
                          </span>
                          {(userIsAdmin || isUserCategory) && (
                            <>
                              <span 
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  handleToggleCategoryVisibility(cat.id); 
                                }} 
                                title={(userCategories.find(c => c.id === cat.id)?.isVisible ?? builtInCategorySettings[cat.id]?.isVisible ?? true) ? "Synlig i frontend" : "Skjult i frontend"}
                              >
                                {(userCategories.find(c => c.id === cat.id)?.isVisible ?? builtInCategorySettings[cat.id]?.isVisible ?? true) ? (
                                  <Eye className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-gray-600" />
                                )}
                              </span>
                              <span 
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  handleToggleCategoryCheckbox(cat.id); 
                                }} 
                                title={(userCategories.find(c => c.id === cat.id)?.hasCheckbox ?? builtInCategorySettings[cat.id]?.hasCheckbox ?? true) ? "Vises med checkbox" : "Vises alltid"}
                              >
                                {(userCategories.find(c => c.id === cat.id)?.hasCheckbox ?? builtInCategorySettings[cat.id]?.hasCheckbox ?? true) ? (
                                  <CheckSquare className="h-4 w-4 text-purple-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-gray-600" />
                                )}
                              </span>
                            </>
                          )}
                          <span 
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                            onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id); }} 
                            title="Slett kategori"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </span>
                          <span 
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                            onClick={e => { e.stopPropagation(); setEditingCategoryId(null); }} 
                            title="Avbryt"
                          >
                            ✕
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-sm">{cat.name}</span>
                          {canEdit && (
                            <span 
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                              onClick={e => { e.stopPropagation(); handleEditCategory(cat.id, cat.name); }} 
                              title="Endre navn"
                            >
                              <Edit2 className="h-4 w-4 text-blue-600" />
                            </span>
                          )}
                          {isPersonalCategory && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              Personlig
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {list.length} filer
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-2 pb-4">
                  <div className="space-y-4">
                    {/* Upload button - kun for admin eller brukerens personlige kategori */}
                    {(userIsAdmin || isPersonalCategory) && (
                      <div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            accept=".ppt,.pptx"
                            onChange={(e) => handleUpload(e, cat.name)}
                            className="hidden"
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span className="gap-2">
                              <Upload className="h-4 w-4" />
                              Last opp filer
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}

                    {/* Template list */}
                    {list.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Ingen maler i denne kategorien
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {list.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-3 rounded-md border bg-background gap-3"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">{t.name}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Category change dropdown - kun admin eller egne filer */}
                              {(userIsAdmin || isPersonalCategory) && (
                                <Select
                                  value={t.category}
                                  onValueChange={(newCat) => {
                                    updateTemplateCategory(t.id, newCat);
                                    toast.success(`"${t.name}" flyttet til ${newCat}`);
                                  }}
                                  disabled={!userIsAdmin && !isPersonalCategory}
                                >
                                  <SelectTrigger className="h-8 w-[140px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allCategories.map((c) => (
                                      <SelectItem key={c.id} value={c.name}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* Visibility toggle - kun admin */}
                              {userIsAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleVisibility(t.id, t.visibleInBuilder)}
                                  className="h-8 w-8 p-0"
                                  title={t.visibleInBuilder ? "Skjul i builder" : "Vis i builder"}
                                >
                                  {t.visibleInBuilder ? (
                                    <Eye className="h-4 w-4 text-primary" />
                                  ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              )}

                              {/* Delete button - kun admin eller egne filer */}
                              {(userIsAdmin || isPersonalCategory) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(t.id, t.name)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </div>
        </Accordion>
        
        {/* Admin-kontroller nederst */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Synkroniserer..." : "Synkroniser nå"}
          </Button>
          {userIsAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Ny kategori
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Opprett ny kategori</DialogTitle>
                  <DialogDescription>
                    Lag en ny kategori for å organisere maler (kun admin)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Kategorinavn</Label>
                    <Input
                      id="category-name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="F.eks. Mine egne maler"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateCategory();
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleCreateCategory}>
                    Opprett kategori
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
