import { useState, useEffect } from 'react';
import { localFileSystemClient, LocalFile } from '@/lib/localFileSystem';
import { 
  loadAllTemplatesMetadata as getAllTemplatesMetadata,
  deleteTemplatesByCategory,
  clearAllTemplates,
  deleteTemplateFromStorage as deleteTemplateById
} from '@/services/templateStorage';
export interface TemplateReference {
  id: string;
  name: string;
  category: string;
  file: File;
}

export const useLocalTemplates = () => {
  const [templateReferences, setTemplateReferences] = useState<TemplateReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Expose setTemplateReferences for external use
  const updateTemplateReferences = (updater: (prev: TemplateReference[]) => TemplateReference[]) => {
    setTemplateReferences(updater);
  };

  // Load templates and categories from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('useLocalTemplates - Loading templates from IndexedDB...');
        // Load templates metadata from IndexedDB (without blobs to avoid OOM)
        const storedTemplates = await getAllTemplatesMetadata();
        console.log('useLocalTemplates - Stored templates from IndexedDB:', storedTemplates.length);
        
        const refs: TemplateReference[] = storedTemplates.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category,
          file: new File([], t.fileName, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
        }));
        
        console.log('useLocalTemplates - Converted to TemplateReferences:', refs.length);
        setTemplateReferences(refs);
        
        // Extract unique categories from templates
        const uniqueCategories = Array.from(new Set(refs.map(r => r.category)));
        setCategories(uniqueCategories);
        
        console.log('useLocalTemplates - Unique categories:', uniqueCategories);
        
        // Always update localStorage with current categories
        if (uniqueCategories.length > 0) {
          localStorage.setItem('local-template-categories', JSON.stringify(uniqueCategories));
        } else {
          localStorage.removeItem('local-template-categories');
        }
      } catch (error) {
        console.error('Failed to load templates from IndexedDB:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const addFolderForCategory = async (category: string): Promise<void> => {
    setIsLoading(true);
    try {
      if (localFileSystemClient.isSupported() || window.self !== window.top) {
        // Use File System Access API or fallback
        const folder = await localFileSystemClient.pickDirectory(category);
        if (folder) {
          const newTemplates: TemplateReference[] = folder.files.map(file => ({
            id: file.id,
            name: file.name,
            category: file.category,
            file: file.file
          }));

          console.log('useLocalTemplates - Adding templates for category:', category, newTemplates);

          // Add to existing templates (replace old ones for same category)
          setTemplateReferences(prev => {
            const updated = [
              ...prev.filter(t => t.category !== category),
              ...newTemplates
            ];
            console.log('useLocalTemplates - Updated templateReferences:', updated);
            return updated;
          });

          // Save category
          if (!categories.includes(category)) {
            const newCategories = [...categories, category];
            setCategories(newCategories);
            localStorage.setItem('local-template-categories', JSON.stringify(newCategories));
          }
        }
      } else {
        // Fallback for older browsers
        const files = await localFileSystemClient.pickFilesLegacy(category);
        const newTemplates: TemplateReference[] = files.map(file => ({
          id: file.id,
          name: file.name,
          category: file.category,
          file: file.file
        }));

        setTemplateReferences(prev => [
          ...prev.filter(t => t.category !== category),
          ...newTemplates
        ]);

        if (!categories.includes(category)) {
          const newCategories = [...categories, category];
          setCategories(newCategories);
          localStorage.setItem('local-template-categories', JSON.stringify(newCategories));
        }
      }
    } catch (error) {
      console.error('Error adding folder:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = async (templateRef: TemplateReference): Promise<Blob> => {
    try {
      return await localFileSystemClient.getFileBlob({
        id: templateRef.id,
        name: templateRef.name,
        file: templateRef.file,
        category: templateRef.category
      });
    } catch (error) {
      console.error('Error getting template:', error);
      throw error;
    }
  };

  const removeTemplateCategory = async (category: string): Promise<void> => {
    // Delete from IndexedDB
    await deleteTemplatesByCategory(category);
    
    // Update state
    setTemplateReferences(prev => prev.filter(t => t.category !== category));
    setCategories(prev => {
      const newCategories = prev.filter(c => c !== category);
      localStorage.setItem('local-template-categories', JSON.stringify(newCategories));
      return newCategories;
    });
  };

  const clearAll = async (): Promise<void> => {
    // Clear IndexedDB
    await clearAllTemplates();
    
    // Update state
    setTemplateReferences([]);
    setCategories([]);
    localStorage.removeItem('local-template-categories');
  };

  return {
    templateReferences,
    isLoading,
    categories,
    addFolderForCategory,
    downloadTemplate,
    removeTemplateCategory,
    clearAll,
    setTemplateReferences: updateTemplateReferences
  };
};
