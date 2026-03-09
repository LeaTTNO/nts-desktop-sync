import { useState, useEffect, useRef } from 'react';
import { oneDriveClient } from '@/lib/oneDriveClient';
import { toast } from 'sonner';

export interface OneDriveTemplate {
  id: string;
  name: string;
  category: string;
  categoryId?: string; // Add categoryId field
  fileId: string;
  order?: number;
  folderName?: string;
  fullPath?: string;
}

export interface TemplateCategory {
  key: string;
  name: string;
  includeInDropdown: boolean;
}

// Mapping fra mappenavn til kategori ID - OPPDATERT TIL NYE KATEGORI-IDer
const mapFolderToCategory = (folderName: string, fullPath?: string): string => {
  const lower = folderName.toLowerCase().trim();
  const pathLower = fullPath?.toLowerCase() || '';
  
  // Check for language-specific paths to differentiate identical folder names
  const isNoDomain = pathLower.includes('nts no') || pathLower.includes('nts_no');
  const isDkDomain = pathLower.includes('nts dk') || pathLower.includes('nts_dk');
  
  // Exact folder name mapping - BRUKER NYE KATEGORI-IDer FRA templateCategories.ts
  if (lower === 'arusha første nat' || lower === 'arusha første natt' || lower === 'arusha first night') {
    return 'arusha_first_night';
  }
  
  if (lower === 'sidste nat safari' || lower === 'siste natt safari' || lower === 'last night safari') {
    return 'last_safari_night';
  }
  
  if (lower === 'zanzibar hotel 1') return 'zanzibar_hotel_1';
  if (lower === 'zanzibar hotel 2') return 'zanzibar_hotel_2';
  if (lower === 'stone town') return 'zanzibar_hotel_2';
  if (lower === 'kilimanjaro') return 'kilimanjaro';
  if (lower === 'arusha aktiviteter' || lower === 'arusha activities') return 'arusha_activities_slides';
  if (lower === 'fastland' || lower === 'mainland' || lower === 'diverse mainland') return 'diverse_mainland';
  if (lower === 'flyinformasjon' || lower === 'flight information') return 'flyinformasjon';
  if (lower === 'flyinformation') return 'flyinformation';
  if (lower === 'reiseprogram og tilbud' || lower === 'rejseprogram og tilbud' || lower === 'base program') return 'base_program';
  if (lower === 'ekstra slides' || lower === 'extra slides') return 'extra_slides';
  
  // Safari periods - NYE IDs
  if (lower.includes('dec') || lower.includes('feb') || lower.includes('ndutu')) return 'safari_mid_dec_feb_ndutu';
  if (lower.includes('marts') || lower.includes('march')) return 'safari_march_ndutu_no_tar';
  if (lower.includes('april') || lower.includes('mai') || lower.includes('may')) return 'safari_april_may_ser_no_tar';
  if (lower.includes('juni') || lower.includes('june') && lower.includes('juli')) return 'safari_june_10july_ser';
  if (lower.includes('juli') || lower.includes('july') || lower.includes('sep')) return 'safari_10july_sep_tar_ser_north';
  if (lower.includes('okt') || lower.includes('oct')) return 'safari_oct_tar_ser';
  if (lower.includes('nov') && (lower.includes('dec') || lower.includes('middec'))) return 'safari_nov_middec_tar_ser';
  
  console.log('  ⚠️ No category mapping for folder:', folderName, (fullPath ? `(path: ${fullPath})` : ''), '-> using folder name as category');
  return folderName;
};

// Legacy: Mapping fra filnavn til kategori (brukes ikke lenger for OneDrive)
const extractCategory = (filename: string): string => {
  const lower = filename.toLowerCase().replace(/\.pptx?$/i, '');
  console.log('🔍 Categorizing file:', filename, '→', lower);
  
  // Safari alternativer (sjekk FØRST før måneder, siden disse ikke har måned i navnet)
  if (lower.includes('alternativ')) {
    console.log('  ✅ Matched: alternativ → safariJulSep');
    return 'safariJulSep';
  }
  if (lower.includes('billigere')) {
    console.log('  ✅ Matched: billigere → safariJulSep');
    return 'safariJulSep';
  }
  if (lower.includes('reiseprogram') && !lower.includes('dages')) {
    console.log('  ✅ Matched: reiseprogram → safariJulSep');
    return 'safariJulSep';
  }
  
  // Safari perioder (basert på måneder eller områder)
  if (lower.includes('ndutu') || lower.includes('dec') || lower.includes('feb')) {
    console.log('  ✅ Matched: ndutu/dec/feb → safariDecFeb');
    return 'safariDecFeb';
  }
  if (lower.includes('marts') || lower.includes('march')) {
    console.log('  ✅ Matched: marts/march → safariMarch');
    return 'safariMarch';
  }
  if (lower.includes('april') || lower.includes('mai') || lower.includes('may')) {
    console.log('  ✅ Matched: april/mai/may → safariAprMay');
    return 'safariAprMay';
  }
  if (lower.includes('juni') || lower.includes('june')) {
    console.log('  ✅ Matched: juni/june → safariJunJul');
    return 'safariJunJul';
  }
  if (lower.includes('juli') || lower.includes('july') || lower.includes('sep')) {
    console.log('  ✅ Matched: juli/july/sep → safariJulSep');
    return 'safariJulSep';
  }
  if (lower.includes('okt') || lower.includes('oct')) {
    console.log('  ✅ Matched: okt/oct → safariOct');
    return 'safariOct';
  }
  if (lower.includes('nov')) {
    console.log('  ✅ Matched: nov → safariNovDec');
    return 'safariNovDec';
  }
  
  // Kilimanjaro
  if (lower.includes('kilimanjaro') || lower.includes('kili')) {
    console.log('  ✅ Matched: kilimanjaro/kili → kilimanjaro');
    return 'kilimanjaro';
  }
  
  // Zanzibar Hotels - specific hotels
  if (lower.includes('jambiani')) {
    console.log('  ✅ Matched: jambiani → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('karafuu')) {
    console.log('  ✅ Matched: karafuu → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('mr kahawa') || lower.includes('kahawa')) {
    console.log('  ✅ Matched: kahawa → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('next paradise')) {
    console.log('  ✅ Matched: next paradise → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('pongwe')) {
    console.log('  ✅ Matched: pongwe → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('residence')) {
    console.log('  ✅ Matched: residence → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('z hotel')) {
    console.log('  ✅ Matched: z hotel → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('zanzibari')) {
    console.log('  ✅ Matched: zanzibari → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  if (lower.includes('white paradise')) {
    console.log('  ✅ Matched: white paradise → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  
  // Zanzibar Hotels - generic
  if (lower.includes('zanzibar') && (lower.includes('hotel2') || lower.includes('second'))) {
    console.log('  ✅ Matched: zanzibar hotel2 → zanzibarHotel2');
    return 'zanzibarHotel2';
  }
  if (lower.includes('zanzibar')) {
    console.log('  ✅ Matched: zanzibar → zanzibarHotel1');
    return 'zanzibarHotel1';
  }
  
  // Stone Town Hotels
  if (lower.includes('stonetown') || lower.includes('stone_town') || lower.includes('stone town')) {
    console.log('  ✅ Matched: stone town → stoneTownHotel');
    return 'stoneTownHotel';
  }
  
  // Arusha Hotels & Lodges
  if (lower.includes('forrest hill') || lower.includes('forest hill')) {
    console.log('  ✅ Matched: forrest/forest hill → arushaFirstNight');
    return 'arushaFirstNight';
  }
  if (lower.includes('rivertrees')) {
    console.log('  ✅ Matched: rivertrees → arushaFirstNight');
    return 'arushaFirstNight';
  }
  if (lower.includes('planet lodge')) {
    console.log('  ✅ Matched: planet lodge → arushaFirstNight');
    return 'arushaFirstNight';
  }
  if (lower.includes('arusha') && lower.includes('first')) {
    console.log('  ✅ Matched: arusha first → arushaFirstNight');
    return 'arushaFirstNight';
  }
  
  // Safari Lodges (last night)
  if (lower.includes('pazuri')) {
    console.log('  ✅ Matched: pazuri → lastNightSafari');
    return 'lastNightSafari';
  }
  if (lower.includes('tumbili')) {
    console.log('  ✅ Matched: tumbili → lastNightSafari');
    return 'lastNightSafari';
  }
  if (lower.includes('under the shade')) {
    console.log('  ✅ Matched: under the shade → lastNightSafari');
    return 'lastNightSafari';
  }
  if (lower.includes('lastnightsafari') || lower.includes('last_night')) {
    console.log('  ✅ Matched: lastnightsafari → lastNightSafari');
    return 'lastNightSafari';
  }
  
  // Activities
  if (lower.includes('arusha') && lower.includes('activity')) {
    console.log('  ✅ Matched: arusha activity → activitiesArusha');
    return 'activitiesArusha';
  }
  
  console.log('  ⚠️ No match found → unknown');
  return 'unknown';
};

export const useOneDriveTemplates = (language: 'no' | 'da') => {
  const [templates, setTemplates] = useState<OneDriveTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customCategories, setCustomCategories] = useState<TemplateCategory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [folderPath, setFolderPath] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const isFirstAuth = useRef(true);

  useEffect(() => {
    initializeOneDrive();
  }, []);

  useEffect(() => {
    const uniqueCategories = [...new Set(templates.map(t => t.category))];
    setCategories(uniqueCategories);
  }, [templates]);

  // Auto-load templates when language changes or user authenticates
  useEffect(() => {
    if (!isAuthenticated) return;

    if (isFirstAuth.current) {
      // Første gangs autentisering (oppstart) – prøv cache + delta istedet for full scan
      isFirstAuth.current = false;
      const cachedRaw = localStorage.getItem('onedrive-cached-templates');
      const deltaLink = localStorage.getItem('onedrive-delta-link');

      if (cachedRaw && deltaLink) {
        try {
          const cached = JSON.parse(cachedRaw) as OneDriveTemplate[];
          if (cached.length > 0) {
            console.log(`📋 Oppstart: laster ${cached.length} maler fra cache, kjører delta-sync i bakgrunnen...`);
            setTemplates(cached);
            const storedSync = localStorage.getItem('onedrive-last-sync');
            if (storedSync) setLastSyncTime(storedSync);
            setIsLoading(false);
            // Delta-sync i bakgrunnen for å hente eventuelle endringer
            refreshTemplates();
            return;
          }
        } catch (e) {
          console.warn('⚠️ Kunne ikke lese cache – kjører full scan');
        }
      }

      // Ingen cache eller delta-link → full scan
      loadTemplatesForLanguage(language);
    } else {
      // Language-bytte → alltid full scan
      loadTemplatesForLanguage(language);
    }
  }, [language, isAuthenticated]);

  // Auto-sync scheduler: full scan kl 08:00 (oppdaterer også delta-link for dagen)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Load last sync time from localStorage
    const storedLastSync = localStorage.getItem('onedrive-last-sync');
    if (storedLastSync) {
      setLastSyncTime(storedLastSync);
    }

    const scheduleNextSync = () => {
      const now = new Date();
      const next8AM = new Date(now);
      next8AM.setHours(8, 0, 0, 0);
      
      // If 08:00 has passed today, schedule for tomorrow
      if (next8AM <= now) {
        next8AM.setDate(next8AM.getDate() + 1);
      }
      
      const timeUntil8AM = next8AM.getTime() - now.getTime();
      console.log(`🔄 OneDrive auto-sync scheduled for ${next8AM.toLocaleString('nb-NO')} (in ${Math.round(timeUntil8AM / 1000 / 60)} minutes)`);
      
      const timeoutId = setTimeout(async () => {
        console.log('🔄 Running scheduled OneDrive sync at 08:00...');
        try {
          // Full scan at 08:00 — also refreshes the delta link for manual syncs during the day
          await loadTemplatesForLanguage(language);
          const syncTime = new Date().toISOString();
          localStorage.setItem('onedrive-last-sync', syncTime);
          setLastSyncTime(syncTime);
          toast.success('OneDrive synkronisert automatisk kl 08:00');
        } catch (error) {
          console.error('Auto-sync failed:', error);
          toast.error('Automatisk synkronisering feilet');
        }
        
        // Schedule next sync
        scheduleNextSync();
      }, timeUntil8AM);
      
      return timeoutId;
    };

    const timeoutId = scheduleNextSync();
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isAuthenticated, language]);

  useEffect(() => {
    // Load custom categories from localStorage
    const stored = localStorage.getItem('custom-categories');
    if (stored) {
      try {
        setCustomCategories(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to load custom categories:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Save custom categories to localStorage
    localStorage.setItem('custom-categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // 🔄 Auto-sync listener - triggered daily at 08:00 by main process
  useEffect(() => {
    if (!window.electron?.on) return;

    console.log('🔔 Setting up OneDrive auto-sync listener');
    
    const unsubscribe = window.electron.on('onedrive:auto-sync-trigger', () => {
      console.log('⏰ Auto-sync triggered at 08:00');
      if (isAuthenticated) {
        console.log('🔄 Refreshing templates from OneDrive...');
        loadTemplatesForLanguage(language);
        toast.info('Auto-synkroniserer maler fra OneDrive...');
      } else {
        console.log('⚠️ Auto-sync skipped: not authenticated');
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, language]);

  const initializeOneDrive = async () => {
    try {
      await oneDriveClient.initialize();
      setIsAuthenticated(oneDriveClient.isAuthenticated());
    } catch (error) {
      console.error('Failed to initialize OneDrive:', error);
      toast.error('Kunne ikke initialisere OneDrive');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplatesForLanguage = async (lang: 'no' | 'da', customPath?: string) => {
    // Start by searching in root folder if no custom path is set
    const defaultPath = '';  // Empty string means root folder
    
    const pathToUse = customPath || folderPath || defaultPath;
    
    console.log('📁 Attempting to load templates from:', pathToUse);
    
    try {
      setIsLoading(true);
      
      // Search recursively through subfolders
      console.log('🔍 Searching for PowerPoint files recursively...');
      const filesWithFolders = await oneDriveClient.searchPowerPointFilesRecursive(pathToUse);
      console.log('📄 Found PowerPoint files:', filesWithFolders.length);
      
      if (filesWithFolders.length === 0) {
        const folderDisplay = pathToUse || 'root-mappen';
        toast.error(`Ingen PowerPoint-filer funnet i ${folderDisplay}. Bruk "Bla gjennom" for å velge riktig mappe.`);
        setTemplates([]);
        setIsLoading(false);
        return;
      }
      
      const newTemplates: OneDriveTemplate[] = filesWithFolders.map(({ file, folderName, fullPath }) => {
        const categoryId = mapFolderToCategory(folderName, fullPath); // Use as categoryId (modern system)
        const category = folderName; // Keep original folder name as display category
        console.log(`  📄 ${file.name} (folder: ${folderName}, path: ${fullPath}) → categoryId: ${categoryId}, category: ${category}`);
        return {
          id: `${categoryId}_${file.id}`,
          name: file.name,
          category,
          categoryId, // KRITISK: This will be used by useTemplateStore filtering
          fileId: file.id,
          folderName,
          fullPath,
        };
      });

      setTemplates(newTemplates);
      // Lagre template-listen i cache for rask oppstart neste gang
      localStorage.setItem('onedrive-cached-templates', JSON.stringify(newTemplates));
      
      // Update last sync time
      const syncTime = new Date().toISOString();
      localStorage.setItem('onedrive-last-sync', syncTime);
      setLastSyncTime(syncTime);

      // Store delta link for incremental syncs
      try {
        const deltaLink = await oneDriveClient.initDeltaLink(pathToUse);
        if (deltaLink) {
          localStorage.setItem('onedrive-delta-link', deltaLink);
          localStorage.setItem('onedrive-delta-folder', pathToUse);
          console.log('✅ Delta link stored for incremental syncs');
        }
      } catch (deltaErr) {
        console.warn('⚠️ Could not store delta link (non-critical):', deltaErr);
      }
      
      toast.success(`✅ Lastet ${newTemplates.length} maler for ${lang.toUpperCase()}`);
      console.log('✅ Templates loaded successfully:', newTemplates);
    } catch (error: any) {
      console.error('❌ Failed to load templates:', error);
      
      let errorMessage = 'Kunne ikke laste maler fra OneDrive';
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, {
        duration: 5000,
        description: `Mappe: ${pathToUse}`
      });
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      await oneDriveClient.login();
      setIsAuthenticated(true);
      toast.success('Logget inn på OneDrive');
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Provide specific error messages
      let errorMessage = 'Kunne ikke logge inn på OneDrive';
      
      if (error?.errorCode === 'popup_window_error' || error?.message?.includes('popup')) {
        errorMessage = 'Popup ble blokkert. Vennligst tillat popups for denne siden.';
      } else if (error?.errorCode === 'user_cancelled') {
        errorMessage = 'Innlogging ble avbrutt';
      } else if (error?.message) {
        errorMessage = `Innloggingsfeil: ${error.message}`;
      }
      
      toast.error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      await oneDriveClient.logout();
      setIsAuthenticated(false);
      setTemplates([]);
      toast.success('Logget ut fra OneDrive');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Kunne ikke logge ut');
    }
  };

  const refreshTemplates = async () => {
    if (!isAuthenticated) return;

    // Check if we have a delta link for incremental sync
    const storedDeltaLink = localStorage.getItem('onedrive-delta-link');

    if (storedDeltaLink) {
      // --- Incremental delta sync: only fetch changed/new/deleted files ---
      try {
        console.log('🔄 Running incremental delta sync...');
        setIsLoading(true);

        const { changed, deleted, nextDeltaLink } = await oneDriveClient.getDeltaChanges(storedDeltaLink);
        console.log(`📊 Delta: ${changed.length} endringer, ${deleted.length} slettede`);

        // Filter changed items to only .pptx/.ppt files
        const changedPptx = changed.filter(item => {
          if (!item.file) return false;
          const n = item.name.toLowerCase();
          return n.endsWith('.pptx') || n.endsWith('.ppt');
        });

        if (deleted.length === 0 && changedPptx.length === 0) {
          const syncTime = new Date().toISOString();
          localStorage.setItem('onedrive-last-sync', syncTime);
          localStorage.setItem('onedrive-delta-link', nextDeltaLink);
          setLastSyncTime(syncTime);
          toast.success('✅ Ingen nye filer siden sist synkronisering');
          setIsLoading(false);
          return;
        }

        // Map changed pptx items to OneDriveTemplate objects
        const updatedTemplates: OneDriveTemplate[] = changedPptx.map(item => {
          const folderName = item.parentReference?.name || 'root';
          // parentReference.path is like "/drive/root:/NTS DK/Zanzibar Hotel 1"
          const rawPath = item.parentReference?.path || '';
          const pathWithoutRoot = rawPath.replace(/^\/drive\/root:\/?/, '');
          const fullPath = pathWithoutRoot ? `${pathWithoutRoot}/${item.name}` : item.name;

          const categoryId = mapFolderToCategory(folderName, fullPath);
          const category = folderName;

          console.log(`  📄 [delta] ${item.name} (folder: ${folderName}) → categoryId: ${categoryId}`);
          return {
            id: `${categoryId}_${item.id}`,
            name: item.name,
            category,
            categoryId,
            fileId: item.id,
            folderName,
            fullPath,
          };
        });

        // Merge: remove deleted + removed changed (by fileId), then add updated
        setTemplates(prev => {
          const deletedIds = new Set(deleted);
          const changedFileIds = new Set(changedPptx.map(i => i.id));

          // Keep existing templates that were not deleted or overwritten
          const kept = prev.filter(t => !deletedIds.has(t.fileId) && !changedFileIds.has(t.fileId));
          const merged = [...kept, ...updatedTemplates];
          // Oppdater cache med merged liste
          localStorage.setItem('onedrive-cached-templates', JSON.stringify(merged));
          return merged;
        });

        const syncTime = new Date().toISOString();
        localStorage.setItem('onedrive-last-sync', syncTime);
        localStorage.setItem('onedrive-delta-link', nextDeltaLink);
        setLastSyncTime(syncTime);

        const addedCount = changedPptx.length;
        const removedCount = deleted.length;
        const parts: string[] = [];
        if (addedCount) parts.push(`${addedCount} ny/endret`);
        if (removedCount) parts.push(`${removedCount} slettet`);
        toast.success(`✅ Synkronisert: ${parts.join(', ')} fil${addedCount + removedCount !== 1 ? 'er' : ''}`);
        setIsLoading(false);
        return;

      } catch (deltaError: any) {
        if (deltaError?.message === 'DELTA_EXPIRED') {
          console.warn('⚠️ Delta token utløpt – kjører full synkronisering...');
          localStorage.removeItem('onedrive-delta-link');
          localStorage.removeItem('onedrive-delta-folder');
          // Fall through to full sync below
        } else {
          console.error('Delta sync feilet:', deltaError);
          toast.error('Kunne ikke synkronisere maler (delta)');
          setIsLoading(false);
          return;
        }
      }
    }

    // --- Full sync fallback (first time, or after delta expiry) ---
    try {
      // Notify main process about manual sync
      if (window.electron?.invoke) {
        console.log('📤 Calling onedrive:sync-now IPC handler');
        await window.electron.invoke('onedrive:sync-now', { language });
      }
      
      // Refresh templates from OneDrive (full scan)
      await loadTemplatesForLanguage(language);
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.error('Kunne ikke synkronisere maler');
    }
  };

  const downloadTemplate = async (template: OneDriveTemplate): Promise<Blob> => {
    try {
      return await oneDriveClient.downloadFile(template.fileId);
    } catch (error) {
      console.error('Failed to download template:', error);
      toast.error('Kunne ikke laste ned mal');
      throw error;
    }
  };

  const removeCategory = async (category: string) => {
    setTemplates(prev => prev.filter(t => t.category !== category));
    toast.success(`Fjernet kategori: ${category}`);
  };

  const clearAll = async () => {
    setTemplates([]);
    toast.success('Fjernet alle maler');
  };

  const addCategory = (name: string, includeInDropdown: boolean = true) => {
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newCategory: TemplateCategory = { key, name, includeInDropdown };
    setCustomCategories(prev => [...prev, newCategory]);
    toast.success(`Opprettet kategori: ${name}`);
  };

  const removeCustomCategory = (key: string) => {
    setCustomCategories(prev => prev.filter(c => c.key !== key));
    setTemplates(prev => prev.filter(t => t.category !== key));
    toast.success('Fjernet kategori');
  };

  const toggleCategoryInDropdown = (key: string) => {
    setCustomCategories(prev => prev.map(c => 
      c.key === key ? { ...c, includeInDropdown: !c.includeInDropdown } : c
    ));
  };

  const setCustomFolderPath = (path: string) => {
    setFolderPath(path);
    if (isAuthenticated) {
      loadTemplatesForLanguage(language, path);
    }
  };

  return {
    templates,
    isLoading,
    isAuthenticated,
    categories,
    customCategories,
    folderPath,
    lastSyncTime,
    login,
    logout,
    refreshTemplates,
    downloadTemplate,
    removeCategory,
    clearAll,
    addCategory,
    removeCustomCategory,
    toggleCategoryInDropdown,
    setCustomFolderPath,
  };
};
