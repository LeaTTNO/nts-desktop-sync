import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChevronRight, Folder, FileText, ArrowLeft, Search } from 'lucide-react';
import { oneDriveClient } from '@/lib/oneDriveClient';
import { toast } from 'sonner';

interface OneDriveFolderBrowserProps {
  onFolderSelected: (folderPath: string) => void;
  language: 'no' | 'da';
}

export const OneDriveFolderBrowser = ({ onFolderSelected, language }: OneDriveFolderBrowserProps) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [driveInfo, setDriveInfo] = useState<any>(null);

  const t = language === 'no' ? {
    title: 'Bla gjennom OneDrive',
    loading: 'Laster...',
    back: 'Tilbake',
    selectFolder: 'Velg denne mappen',
    currentFolder: 'Nåværende mappe',
    root: 'Rot',
    noItems: 'Ingen filer eller mapper funnet',
    error: 'Kunne ikke laste mappe',
    search: 'Søk',
    searchPlaceholder: 'Søk etter "NTS" eller andre mapper...',
    searchResults: 'Søkeresultater',
    driveType: 'OneDrive type',
    clickFolderToOpen: 'Klikk på en mappe for å åpne den',
  } : {
    title: 'Gennemse OneDrive',
    loading: 'Indlæser...',
    back: 'Tilbage',
    selectFolder: 'Vælg denne mappe',
    currentFolder: 'Nuværende mappe',
    root: 'Rod',
    noItems: 'Ingen filer eller mapper fundet',
    error: 'Kunne ikke indlæse mappe',
    search: 'Søg',
    searchPlaceholder: 'Søg efter "NTS" eller andre mapper...',
    searchResults: 'Søgeresultater',
    driveType: 'OneDrive type',
    clickFolderToOpen: 'Klik på en mappe for at åbne den',
  };

  useEffect(() => {
    loadDriveInfo();
    loadFolder('');
  }, []);

  const loadDriveInfo = async () => {
    try {
      const info = await oneDriveClient.getDriveInfo();
      setDriveInfo(info);
      console.log('📊 Drive info loaded:', info);
    } catch (error) {
      console.error('Failed to load drive info:', error);
    }
  };

  const loadFolder = async (path: string) => {
    setIsLoading(true);
    try {
      console.log('📂 Loading folder:', path || '(root)');
      const files = await oneDriveClient.listFilesInFolder(path);
      console.log('📂 Loaded items count:', files.length);
      console.log('📂 Item names:', files.map(f => ({
        name: f.name,
        isFolder: !!f.folder,
        isFile: !!f.file
      })));
      
      // Filter out OneDrive system/metadata folders that users don't need to see
      const filteredFiles = files.filter(item => {
        const name = item.name.toLowerCase();
        const isSystemFolder = name.startsWith('.') || 
                              name === 'odcmetadata' || 
                              name.match(/^[a-f0-9-]{36}$/i); // UUID pattern
        return !isSystemFolder;
      });
      
      console.log('📂 After filtering:', filteredFiles.length, 'items');
      setItems(filteredFiles);
      setCurrentPath(path);
      
      if (filteredFiles.length === 0 && files.length > 0) {
        toast.info('Filtrerte bort system-mapper. Prøv å søke etter "Tanzania" eller "NTS"');
      }
    } catch (error: any) {
      console.error('❌ Failed to load folder:', error);
      toast.error(t.error + ': ' + (error.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderName: string, folderId: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setPathHistory([...pathHistory, currentPath]);
    loadFolder(newPath);
  };

  const goBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      loadFolder(previousPath);
    }
  };

  const handleSelectFolder = () => {
    onFolderSelected(currentPath);
    toast.success(`Valgt mappe: ${currentPath || t.root}`);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Skriv inn et søkeord');
      return;
    }

    setIsLoading(true);
    setIsSearchMode(true);
    try {
      console.log('🔍 Searching for:', searchQuery);
      const results = await oneDriveClient.searchFiles(searchQuery);
      console.log('🔍 Search results:', results);
      setItems(results);
      
      if (results.length === 0) {
        toast.info(`Ingen resultater for "${searchQuery}"`);
      } else {
        toast.success(`Fant ${results.length} resultater`);
      }
    } catch (error: any) {
      console.error('❌ Search failed:', error);
      toast.error(t.error + ': ' + (error.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const exitSearchMode = () => {
    setIsSearchMode(false);
    setSearchQuery('');
    loadFolder(currentPath);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t.title}</h3>
        {pathHistory.length > 0 && (
          <Button variant="outline" size="sm" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.back}
          </Button>
        )}
      </div>


      {driveInfo && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm font-medium mb-1">{t.driveType}:</p>
          <p className="text-sm text-muted-foreground">
            {driveInfo.driveType || 'Personal'} - {driveInfo.owner?.user?.displayName || 'Unknown'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
        {isSearchMode && (
          <Button variant="outline" size="sm" onClick={exitSearchMode} className="w-full">
            Tilbake til mapper
          </Button>
        )}
      </div>

      <div className="p-3 bg-secondary/20 rounded-lg">
        <p className="text-sm font-medium mb-1">
          {isSearchMode ? t.searchResults : t.currentFolder}:
        </p>
        <p className="text-sm text-muted-foreground font-mono break-all">
          {isSearchMode ? `"${searchQuery}"` : (currentPath || t.root)}
        </p>
      </div>

      <Button onClick={handleSelectFolder} className="w-full">
        {t.selectFolder}
      </Button>

      <div className="border rounded-lg max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            {t.loading}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {t.noItems}
          </div>
        ) : (
          <div className="divide-y">
            {items
              .sort((a, b) => {
                // Folders first
                if (a.folder && !b.folder) return -1;
                if (!a.folder && b.folder) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((item) => (
                <div
                  key={item.id}
                  className={`p-3 ${
                    item.folder ? 'hover:bg-secondary/20 cursor-pointer' : ''
                  }`}
                  onClick={() => {
                    if (item.folder) {
                      if (isSearchMode) {
                        // If in search mode, use the full path from the item
                        const fullPath = item.parentReference?.path 
                          ? item.parentReference.path.split(':').pop()?.replace(/^\//, '') + '/' + item.name
                          : item.name;
                        setIsSearchMode(false);
                        setSearchQuery('');
                        loadFolder(fullPath);
                      } else {
                        navigateToFolder(item.name, item.id);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {item.folder ? (
                        <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{item.name}</p>
                        {isSearchMode && item.parentReference?.path && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.parentReference.path.split(':').pop()}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.folder && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
};
