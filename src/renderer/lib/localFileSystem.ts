import { saveTemplate, getTemplateById, getDefaultOrder, type TemplateEntry } from '@/services/templateStorage';

// Local file system integration using File System Access API
export interface LocalFile {
  id: string;
  name: string;
  file: File;
  category: string;
}

export interface LocalFolder {
  id: string;
  name: string;
  category: string;
  files: LocalFile[];
}

// Helper to convert File to ArrayBuffer
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Helper to save file to new storage format
async function saveFileAsTemplate(id: string, name: string, category: string, file: File): Promise<void> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const entry: TemplateEntry = {
    id,
    name,
    category,
    order: getDefaultOrder(name),
    visibleInBuilder: true,
    blob: arrayBuffer,
    fileName: file.name,
    createdAt: Date.now(),
  };
  await saveTemplate(entry);
}

class LocalFileSystemClient {
  // Check if File System Access API is supported
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  // Let user pick a directory and read PowerPoint files
  async pickDirectory(category: string): Promise<LocalFolder | null> {
    try {
      // Check if we're in an iframe or cross-origin - showDirectoryPicker won't work
      const isInIframe = window.self !== window.top;
      
      if (isInIframe || !this.isSupported()) {
        // Use file input fallback
        return await this.pickFilesWithInput(category);
      }

      // Use File System Access API
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      const files: LocalFile[] = [];
      
      // Read all files in the directory
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          // Filter for PowerPoint files only
          if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) {
            const id = `${category}-${file.name}-${Date.now()}`;
            
            console.log('localFileSystem - Saving to IndexedDB:', { id, name: file.name, category });
            // Save to IndexedDB for persistence
            await saveFileAsTemplate(id, file.name, category, file);
            console.log('localFileSystem - Saved to IndexedDB successfully');
            
            files.push({
              id,
              name: file.name,
              file: file,
              category: category
            });
          }
        }
      }

      return {
        id: `local-${Date.now()}-${category}`,
        name: dirHandle.name,
        category: category,
        files: files
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled the picker
        return null;
      }
      console.error('Error picking directory:', error);
      // Fallback to file input on any error (including SecurityError)
      return await this.pickFilesWithInput(category);
    }
  }

  // File input fallback method for iframe or unsupported browsers
  private async pickFilesWithInput(category: string): Promise<LocalFolder | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.ppt,.pptx';
      
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const localFiles: LocalFile[] = [];
          
          for (const file of Array.from(files)) {
            const id = `${category}-${file.name}-${Date.now()}`;
            
            console.log('localFileSystem - Saving to IndexedDB (input fallback):', { id, name: file.name, category });
            // Save to IndexedDB for persistence
            await saveFileAsTemplate(id, file.name, category, file);
            console.log('localFileSystem - Saved to IndexedDB successfully (input fallback)');
            
            localFiles.push({
              id,
              name: file.name,
              file: file,
              category: category
            });
          }
          
          resolve({
            id: `local-${Date.now()}-${category}`,
            name: category,
            category: category,
            files: localFiles
          });
        } else {
          resolve(null);
        }
      };
      
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  // Fallback: Use input file picker for browsers without File System Access API
  async pickFilesLegacy(category: string): Promise<LocalFile[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.ppt,.pptx';
      // @ts-ignore - webkitdirectory is not in TypeScript types
      input.webkitdirectory = true;

      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const files: LocalFile[] = [];
        
        if (target.files) {
          for (let i = 0; i < target.files.length; i++) {
            const file = target.files[i];
            if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) {
              const id = `${category}-${file.name}-${Date.now()}`;
              
              // Save to IndexedDB for persistence
              await saveFileAsTemplate(id, file.name, category, file);
              
              files.push({
                id,
                name: file.name,
                file: file,
                category: category
              });
            }
          }
        }
        
        resolve(files);
      };

      input.onerror = () => {
        reject(new Error('File selection failed'));
      };

      input.click();
    });
  }

  // Get file as Blob for download/processing
  async getFileBlob(localFile: LocalFile): Promise<Blob> {
    // Try to get from IndexedDB first (more reliable for persisted data)
    const stored = await getTemplateById(localFile.id);
    if (stored?.blob) {
      return new Blob([stored.blob], { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
    }
    
    // Fallback to the file object if available
    if (localFile.file) {
      return localFile.file;
    }
    
    throw new Error('File not found');
  }
}

export const localFileSystemClient = new LocalFileSystemClient();
