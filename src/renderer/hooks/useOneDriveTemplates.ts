import { useState, useEffect } from 'react';
import { oneDriveClient } from '@/lib/oneDriveClient';
import { toast } from 'sonner';

export interface OneDriveTemplate {
  id: string;
  name: string;
  category: string;
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

// Mapping fra mappenavn til kategori ID
const mapFolderToCategory = (folderName: string): string => {
  const lower = folderName.toLowerCase().trim();
  
  // Exact folder name mapping (prefer these over partial matches)
  if (lower === 'arusha første natt' || lower === 'arusha first night') return 'arushaFirstNight';
  if (lower === 'siste natt safari' || lower === 'last night safari') return 'lastNightSafari';
  if (lower === 'zanzibar hotel 1') return 'zanzibarHotel1';
  if (lower === 'zanzibar hotel 2') return 'zanzibarHotel2';
  if (lower === 'stone town') return 'stoneTownHotel';
  if (lower === 'kilimanjaro') return 'kilimanjaro';
  if (lower === 'arusha aktiviteter' || lower === 'arusha activities') return 'activitiesArusha';
  if (lower === 'fastland' || lower === 'mainland') return 'diverseMainland';
  if (lower === 'flyinformasjon' || lower === 'flight information') return 'flyinformasjon';
  if (lower === 'reiseprogram og tilbud' || lower === 'base program') return 'baseProgram';
  
  // Safari periods
  if (lower.includes('dec') || lower.includes('feb') || lower.includes('ndutu')) return 'safariDecFeb';
  if (lower.includes('marts') || lower.includes('march')) return 'safariMarch';
  if (lower.includes('april') || lower.includes('mai') || lower.includes('may')) return 'safariAprMay';
  if (lower.includes('juni') || lower.includes('june')) return 'safariJunJul';
  if (lower.includes('juli') || lower.includes('july') || lower.includes('sep')) return 'safariJulSep';
  if (lower.includes('okt') || lower.includes('oct')) return 'safariOct';
  if (lower.includes('nov')) return 'safariNovDec';
  
  console.log('  âš ï¸ No category mapping for folder:', folderName, '-> using folder name as category');
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

  useEffect(() => {
    initializeOneDrive();
  }, []);

  useEffect(() => {
    const uniqueCategories = [...new Set(templates.map(t => t.category))];
    setCategories(uniqueCategories);
  }, [templates]);

  // Auto-load templates when language changes or user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      loadTemplatesForLanguage(language);
    }
  }, [language, isAuthenticated]);

  // Auto-sync scheduler: sync kl 08:00 hver dag
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
          await loadTemplatesForLanguage(language);
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

  // Auto-sync scheduler: sync kl 08:00 hver dag
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
        const category = mapFolderToCategory(folderName);
        console.log(`  📄 ${file.name} (folder: ${folderName}) → category: ${category}`);
        return {
          id: `${category}_${file.id}`,
          name: file.name,
          category,
          fileId: file.id,
          folderName,
          fullPath,
        };
      });

      setTemplates(newTemplates);
      
      // Update last sync time
      const syncTime = new Date().toISOString();
      localStorage.setItem('onedrive-last-sync', syncTime);
      setLastSyncTime(syncTime);
      
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
    
    try {
      // Notify main process about manual sync
      if (window.electron?.invoke) {
        console.log('📤 Calling onedrive:sync-now IPC handler');
        await window.electron.invoke('onedrive:sync-now', { language });
      }
      
      // Refresh templates from OneDrive
      loadTemplatesForLanguage(language);
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
