import { createContext, useContext, ReactNode } from 'react';
import { useLocalTemplates as useLocalTemplatesHook } from '@/hooks/useLocalTemplates';
import type { TemplateReference } from '@/hooks/useLocalTemplates';

interface LocalTemplatesContextType {
  templateReferences: TemplateReference[];
  isLoading: boolean;
  categories: string[];
  addFolderForCategory: (category: string) => Promise<void>;
  downloadTemplate: (templateRef: TemplateReference) => Promise<Blob>;
  removeTemplateCategory: (category: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setTemplateReferences: (updater: (prev: TemplateReference[]) => TemplateReference[]) => void;
}

const LocalTemplatesContext = createContext<LocalTemplatesContextType | undefined>(undefined);

export const LocalTemplatesProvider = ({ children }: { children: ReactNode }) => {
  const localTemplates = useLocalTemplatesHook();

  return (
    <LocalTemplatesContext.Provider value={localTemplates}>
      {children}
    </LocalTemplatesContext.Provider>
  );
};

export const useLocalTemplates = () => {
  const context = useContext(LocalTemplatesContext);
  if (!context) {
    throw new Error('useLocalTemplates must be used within LocalTemplatesProvider');
  }
  return context;
};
