import React, { useState, useEffect } from "react";
import { useTemplateStore } from "@/store/useTemplateStore";
import { useUserCategoryStore } from "@/store/useUserCategoryStore";
import { useAuth } from "@/contexts/AuthContext";
import { getUploadableCategories, getUserPersonalCategory, getAllUserBaseCategories, getUserBaseCategory, getCategoryNameForLanguage } from "@/config/templateCategories";
import { getUserPrefix } from "@/config/userConfig";
import { saveTemplate, deleteTemplateFromStorage, clearAllTemplates, getAllTemplateIds, type TemplateEntry } from "@/services/templateStorage";
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
import { Upload, Trash2, Eye, EyeOff, Plus, Edit2, FolderPlus, RefreshCw, Save, CheckSquare, Square, Star } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { isAdminUser, toggleAdminUser } from "@/lib/adminManager";

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
  const [builtInCategorySettings, setBuiltInCategorySettings] = useState<Record<string, { isVisible?: boolean; hasCheckbox?: boolean }>>({});;

  const { user, userEmail, isAdmin: userIsAdmin } = useAuth();
  const { language: userLanguage } = useLanguage(); // Reaktiv – oppdateres når NO/DK byttes
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
    updateCategory: updateUserCategory,
    setBuiltinCategoryVisible,
    isBuiltinCategoryVisible,
    setBuiltinCategoryName,
    getBuiltinCategoryName,
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
      // Brukerdefinert kategori
      updateUserCategory(catId!, { name: editingCategoryName.trim() });
    } else {
      // Innebygd kategori - lagre override i store
      if (catId) {
        setBuiltinCategoryName(catId, editingCategoryName.trim());
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
      // For innebygde kategorier - lagre i useUserCategoryStore (persistent)
      const currentIsVisible = isBuiltinCategoryVisible(catId);
      setBuiltinCategoryVisible(catId, !currentIsVisible);
      // Speil i lokal state for umiddelbar UI-oppdatering
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

  // Håndter toggle av admin-status for brukere
  const handleToggleAdminStatus = (categoryUserId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!categoryUserId) {
      toast.error("Kan ikke finne bruker-ID for denne kategorien");
      return;
    }

    // Check if current user is admin
    if (!userIsAdmin) {
      toast.error("Kun admin kan endre admin-rettigheter");
      return;
    }

    // Toggle admin status
    const newStatus = toggleAdminUser(categoryUserId);
    
    // Force reload to update UI (since isAdmin is cached in auth context)
    toast.success(newStatus ? "Bruker gitt admin-rettigheter" : "Admin-rettigheter fjernet");
    
    // Trigger a re-render by forcing context update
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  // Auto-sync ved språkendring er deaktivert – OneDrive synkes kun ved oppstart og manuelt

  // Synkroniser innebygd kategori-synlighet fra store ved oppstart
  useEffect(() => {
    const uploadable = getUploadableCategories();
    const newSettings: Record<string, { isVisible?: boolean; hasCheckbox?: boolean }> = {};
    uploadable.forEach(cat => {
      newSettings[cat.id] = {
        isVisible: isBuiltinCategoryVisible(cat.id),
        hasCheckbox: builtInCategorySettings[cat.id]?.hasCheckbox,
      };
    });
    setBuiltInCategorySettings(newSettings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCategories.length]);

  // � Startup-sync: synk automatisk ved oppstart hvis appen ikke var åpen kl. 08:00
  useEffect(() => {
    const today = new Date().toDateString();
    const lastSyncDate = localStorage.getItem('onedrive-last-sync-date');
    if (lastSyncDate !== today) {
      console.log(`🚀 Startup-sync: siste synk var ${lastSyncDate ?? 'aldri'} – synkroniserer nå`);
      // Liten forsinkelse så appen er ferdig å laste før sync starter
      const timer = setTimeout(() => {
        handleSyncNow();
      }, 3000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Kjør kun én gang ved oppstart

  // �🔄 Auto-sync listener - triggered daily at 08:00 by main process
  useEffect(() => {
    if (!window.electron?.on) return;

    console.log('🔔 TemplateLibrary: Setting up auto-sync listener');
    
    const unsubscribe = window.electron.on('onedrive:auto-sync-trigger', () => {
      console.log('⏰ Auto-sync triggered at 08:00 - syncing templates');
      handleSyncNow();
      toast.info('Auto-synkronisering kl 08:00 startet...');
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLanguage]); // Re-subscribe if language changes

  // Legg til brukerens personlige kategori
  const personalCategory = userPrefix
    ? getUserPersonalCategory(userPrefix, userLanguage)
    : null;

  // Get uploadable categories
  const uploadableCategories = getUploadableCategories();

  // Get base categories:
  // - Admin sees ALL users' base categories
  // - Regular user sees ONLY their own base category
  const baseCategories = userIsAdmin
    ? getAllUserBaseCategories(userLanguage)
    : (userPrefix ? [getUserBaseCategory(userPrefix, userLanguage)] : []);

  // Helper function to get category name: 1) admin-override, 2) aktivt språk, 3) norsk default
  const getCategoryDisplayName = (catId: string, defaultName: string): string => {
    const override = getBuiltinCategoryName(catId);
    if (override) return override;
    return getCategoryNameForLanguage(catId, userLanguage) ?? defaultName;
  };

  // Merge default categories with user-specific categories + personal category + base categories (if admin)
  const userCategoryList = userEmail ? getCategoriesForUser(userEmail) : [];
  const allCategories = [
    ...uploadableCategories.map(c => ({
      ...c,
      name: getCategoryDisplayName(c.id, c.name)
    })),
    ...(personalCategory ? [personalCategory] : []),
    ...baseCategories.map(c => ({
      ...c,
      name: getCategoryDisplayName(c.id, c.name)
    })),
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
  
  // Filtrer kategorier basert på bruker
  const visibleCategories = userIsAdmin
    ? allCategories // Admin ser alle kategorier
    : allCategories.filter(cat => {
        // Vanlige brukere ser kun SINE egne kategorier
        if (!userPrefix) return false; // Ikke logget inn = ingen kategorier
        
        // Sjekk om kategorien tilhører brukeren (userId matcher)
        if ('userId' in cat && cat.userId === userPrefix) {
          return true; // Brukerens egne kategorier (base_lea, user_lea_personal)
        }
        // Skjul alle andre kategorier
        return false;
      });
  
  // Filtrer templates – ALT separert mellom NO og DK, ingen unntak
  const langFilteredTemplates = templates.filter(t => t.language === userLanguage);
  const filteredTemplates = userIsAdmin 
    ? langFilteredTemplates // Admin ser alle templates for aktivt språk
    : langFilteredTemplates.filter(t => {
        // Vanlige brukere ser kun templates i SINE kategorier
        // Sjekk om template tilhører brukerens kategorier
        const belongsToUser = visibleCategories.some(cat => 
          cat.id === t.categoryId || cat.name === t.category || cat.id === t.category
        );
        return belongsToUser;
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

  async function handleUpload(categoryName: string, categoryId: string) {
    try {
      // @ts-ignore - Electron IPC
      const dialogResult = await window.electron.invoke("dialog:select-file");
      
      if (dialogResult.canceled) {
        return; // User canceled
      }
      
      const filePaths = dialogResult.filePaths; // Now an array of paths
      let successCount = 0;
      let failCount = 0;
      
      // Process each selected file
      for (const filePath of filePaths) {
        try {
          const fileName = filePath.split(/[\\/]/).pop() || 'unknown.pptx';
          
          // Read file content via IPC
          // @ts-ignore - Electron IPC
          const fileResult = await window.electron.invoke("file:read", filePath);
          
          if (!fileResult.success) {
            console.error(`Kunne ikke lese ${fileName}:`, fileResult.error);
            failCount++;
            continue;
          }
          
          const buf = fileResult.data.buffer; // Convert Node Buffer to ArrayBuffer
          
          // Save to IndexedDB (local) - use categoryName for storage (maintains compatibility)
          await addTemplate({
            name: fileName.replace(/\.pptx?$/i, ""),
            fileName: fileName,
            blob: buf,
            category: categoryName,
            categoryId: categoryId, // Lagre ID slik at vi kan søke robust
            language: userLanguage, // 🌐 Skiller NO og DK maler
          });
          
          // If admin AND not a personal category: Register file in OneDrive manifest
          // Personal categories (user_*_personal) are always local-only, never synced
          const isPersonalCategory = categoryId.startsWith('user_') && categoryId.endsWith('_personal');
          if (userIsAdmin && !isPersonalCategory) {
            try {
              // @ts-ignore - Electron IPC
              const result = await window.electron.invoke("onedrive:upload-template", {
                filePath: filePath,
                category: categoryName,
                categoryId: categoryId, // Send ID for reference
                order: 999,
                language: userLanguage,
              });
              
              if (result.success) {
                console.log(`✅ Admin registered ${fileName} in OneDrive manifest`);
              } else {
                console.error(`❌ Failed to register ${fileName}:`, result.error);
                failCount++;
                continue;
              }
            } catch (error) {
              console.error(`OneDrive registration error for ${fileName}:`, error);
              failCount++;
              continue;
            }
          }
          
          successCount++;
        } catch (error) {
          console.error('File processing error:', error);
          failCount++;
        }
      }
      
      // Show summary toast
      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount} fil${successCount > 1 ? 'er' : ''} lastet opp til ${categoryName}`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} fil${successCount > 1 ? 'er' : ''} lastet opp, ${failCount} feilet`);
      } else if (failCount > 0) {
        toast.error(`Kunne ikke laste opp ${failCount} fil${failCount > 1 ? 'er' : ''}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Feil ved opplasting');
    }
  }

  function handleDelete(id: string, name: string) {
    if (!userIsAdmin && !confirm(`Slett "${name}"?\n\nMalen fjernes fra din lokale database. Synkroniser på nytt for å hente den tilbake.`)) return;
    deleteTemplate(id);
    toast.success(`"${name}" slettet`);
  }

  function toggleVisibility(id: string, currentlyVisible: boolean) {
    setTemplateVisibility(id, !currentlyVisible);
  }


  async function handleResetAndSync() {
    const langLabel = userLanguage === 'da' ? 'DK (dansk)' : 'NO (norsk)';
    if (!confirm(`Sletter ALLE maler fra lokal database og laster inn ${langLabel}-maler på nytt. Fortsett?`)) return;
    setIsSyncing(true);
    try {
      await clearAllTemplates();
      console.log('🗑️ Alle templates slettet fra IndexedDB');
      toast.info('Database nullstilt – laster inn maler på nytt...');
    } catch (e) {
      console.error('Feil ved nullstilling:', e);
    }
    await handleSyncNow();
  }

  // Synkroniser filer for ETT språk fra OneDrive → IndexedDB
  // Returnerer { successCount, errorCount }
  async function syncLanguage(lang: 'no' | 'da'): Promise<{ successCount: number; errorCount: number }> {
    // @ts-ignore - Electron IPC
    const result = await window.electron.invoke("onedrive:sync-now", { language: lang });

    if (!result.success) {
      console.warn(`⚠️ Sync feilet for ${lang.toUpperCase()}: ${result.error}`);
      return { successCount: 0, errorCount: 0 };
    }

    const { files } = result;
    console.log(`📁 ${lang.toUpperCase()}: ${files.length} filer i manifest`);

    // --- Inkrementell synk: bruk tidsstempel for å hoppe over uendrede filer ---
    const lastSyncKey = `onedrive-last-sync-ts-${lang}`;
    const lastSyncTs = localStorage.getItem(lastSyncKey);
    const lastSyncDate = lastSyncTs ? new Date(lastSyncTs) : null;
    console.log(`🕐 ${lang.toUpperCase()}: siste synk ${lastSyncDate?.toLocaleString() ?? 'aldri'}`);

    // Hent IDer DIREKTE fra IndexedDB — ikke fra Zustand-store som kan være tom/utdatert
    const existingIds = new Set(await getAllTemplateIds());

    // Regn ut forventet ID for hver manifestfil
    const getExpectedId = (f: { categoryId?: string; category?: string; name: string }) => {
      const safeCatKey = (f.categoryId || f.category || 'uncategorized').replace(/[^a-zA-Z0-9_-]/g, '_');
      return `onedrive-${lang}-${safeCatKey}-${f.name}`;
    };

    if (files.length === 0) {
      localStorage.setItem(lastSyncKey, new Date().toISOString());
      return { successCount: 0, errorCount: 0 };
    }

    // Slett maler som er fjernet fra OneDrive (finnes i DB men ikke i manifest)
    const manifestIds = new Set(files.map(getExpectedId));
    const removedFromOneDrive = [...existingIds]
      .filter(id => id.startsWith(`onedrive-${lang}-`) && !manifestIds.has(id));
    for (const oldId of removedFromOneDrive) {
      await deleteTemplateFromStorage(oldId);
      console.log(`🗑️ Slettet (fjernet fra OneDrive): ${oldId}`);
    }

    // Filtrer til kun filer som er nye/oppdaterte siden siste synk, eller mangler i DB
    const filesToDownload = files.filter(f => {
      const expectedId = getExpectedId(f);
      const alreadyInDB = existingIds.has(expectedId);
      const isNewOrUpdated = !lastSyncDate || (f.uploadedAt && new Date(f.uploadedAt) > lastSyncDate);
      return isNewOrUpdated || !alreadyInDB;
    });

    console.log(`⬇️ ${lang.toUpperCase()}: ${filesToDownload.length} av ${files.length} filer trenger nedlasting`);

    if (filesToDownload.length === 0) {
      localStorage.setItem(lastSyncKey, new Date().toISOString());
      return { successCount: 0, errorCount: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      try {
        toast.info(`[${lang.toUpperCase()}] Laster fil ${i + 1} av ${filesToDownload.length}: ${file.name}`);

        // @ts-ignore - Electron IPC
        const fileResult = await window.electron.invoke("onedrive:get-file", {
          language: lang,
          relPath: file.relPath,
        });

        if (!fileResult.success) {
          console.error(`❌ Kunne ikke hente: ${file.name}`, fileResult.error);
          errorCount++;
          continue;
        }

        const binaryString = atob(fileResult.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        const arrayBuffer = bytes.buffer;

        const safeCatKey = (file.categoryId || file.category || 'uncategorized')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        const newId = `onedrive-${lang}-${safeCatKey}-${file.name}`;

        // Fjern duplikater med gamle ID-formater (uten språk-prefix)
        const legacyIds = [
          `onedrive-${file.name}`,
          `onedrive-${safeCatKey}-${file.name}`,
        ].filter(id => id !== newId && existingIds.has(id));

        const template: TemplateEntry = {
          id: newId,
          name: file.name.replace(/\.pptx?$/i, ''),
          category: file.category || 'onedrive-sync',
          categoryId: file.categoryId,
          language: lang, // 🌐 NO eller DK
          order: file.order || 999,
          visibleInBuilder: true,
          blob: arrayBuffer,
          fileName: file.name,
          createdAt: Date.now(),
        };

        await saveTemplate(template);
        for (const dupId of legacyIds) {
          await deleteTemplateFromStorage(dupId);
          console.log(`🗑️ Fjernet duplikat: ${dupId}`);
        }
        successCount++;
        console.log(`✅ Lagret [${lang.toUpperCase()}]: ${file.name} (${file.category})`);
      } catch (error) {
        console.error(`❌ Feil ved lagring av ${file.name}:`, error);
        errorCount++;
      }
    }

    // Lagre tidsstempel for denne synken – brukes til inkrementell synk neste gang
    localStorage.setItem(lastSyncKey, new Date().toISOString());
    return { successCount, errorCount };
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      console.log("🔄 Starting OneDrive sync – NO + DK...");
      toast.info("Synkroniserer NO og DK fra OneDrive...");

      // Synk begge språk i sekvens
      const [resNo, resDk] = await Promise.all([
        syncLanguage('no'),
        syncLanguage('da'),
      ]);

      const totalSuccess = resNo.successCount + resDk.successCount;
      const totalErrors = resNo.errorCount + resDk.errorCount;

      // Reload UI
      await loadFromDB();

      // Show result
      if (totalSuccess > 0) {
        const noPart = resNo.successCount > 0 ? `${resNo.successCount} NO-mal${resNo.successCount !== 1 ? 'er' : ''}` : null;
        const dkPart = resDk.successCount > 0 ? `${resDk.successCount} DK-mal${resDk.successCount !== 1 ? 'er' : ''}` : null;
        toast.success(`✅ Synkronisert ${[noPart, dkPart].filter(Boolean).join(' + ')}`);
      } else {
        toast.info("✅ Alt er oppdatert – ingen nye filer siden siste synk");
      }
      if (totalErrors > 0) {
        toast.error(`⚠️ ${totalErrors} feil under synkronisering`);
      }

      // Lagre dato for siste vellykkede synk (brukes til startup-synk)
      localStorage.setItem('onedrive-last-sync-date', new Date().toDateString());
      console.log(`🎉 Sync complete: ${totalSuccess} success, ${totalErrors} errors`);
      
    } catch (error) {
      console.error("❌ Sync error:", error);
      toast.error("Kunne ikke synkronisere: " + (error instanceof Error ? error.message : 'Ukjent feil'));
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
          {visibleCategories.map((cat) => {
              // Filtrer templates basert på categoryId (hvis tilgjengelig) eller category navn
              let list = filteredTemplates.filter((t) => 
                t.categoryId === cat.id || t.category === cat.name || t.category === cat.id
              );

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
                          {/* Admin star - only visible to admins for user categories */}
                          {userIsAdmin && 'userId' in cat && cat.userId && (
                            <span 
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                              onClick={e => handleToggleAdminStatus(cat.userId, e)} 
                              title={isAdminUser(cat.userId) ? "Fjern admin-rettigheter" : "Gi admin-rettigheter"}
                            >
                              <Star 
                                className={`h-4 w-4 ${isAdminUser(cat.userId) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
                              />
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
                      {/* Visibility toggle - vises alltid for admin eller brukerkategorier */}
                      {!editingCategoryId && (userIsAdmin || isUserCategory) && (
                        <span 
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                          onClick={e => { 
                            e.stopPropagation(); 
                            handleToggleCategoryVisibility(cat.id); 
                          }} 
                          title={(userCategories.find(c => c.id === cat.id)?.isVisible ?? builtInCategorySettings[cat.id]?.isVisible ?? true) ? "Synlig i Bygg reiseprogram" : "Skjult i Bygg reiseprogram"}
                        >
                          {(userCategories.find(c => c.id === cat.id)?.isVisible ?? builtInCategorySettings[cat.id]?.isVisible ?? true) ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          )}
                        </span>
                      )}
                      {/* Delete category - vises alltid for admin eller brukerkategorier */}
                      {!editingCategoryId && (userIsAdmin || isUserCategory) && (
                        <span 
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" 
                          onClick={e => { 
                            e.stopPropagation(); 
                            handleDeleteCategory(cat.id); 
                          }} 
                          title="Slett kategori"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </span>
                      )}
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpload(cat.name, cat.id)}
                          className="gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Last opp filer
                        </Button>
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
                                  <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                                    {visibleCategories.map((c) => (
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

                              {/* Delete button - alle brukere kan slette fra sin lokale database */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(t.id, t.name)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Slett fra lokal database"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
          {userIsAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleResetAndSync}
              disabled={isSyncing}
              title="Slett alle maler og last inn på nytt med korrekt språk"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Nullstill og synk
            </Button>
          )}
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
