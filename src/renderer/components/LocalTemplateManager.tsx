import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLocalTemplates } from '@/contexts/LocalTemplatesContext';
import { FolderOpen, Trash2, AlertCircle, FileText, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { deleteTemplateFromStorage as deleteTemplateById } from '@/services/templateStorage';

interface LocalTemplateManagerProps {
  language: 'no' | 'da';
  onTemplatesReady: (ready: boolean) => void;
}

const LocalTemplateManager = ({ language, onTemplatesReady }: LocalTemplateManagerProps) => {
  const { templateReferences, isLoading, categories, addFolderForCategory, removeTemplateCategory, clearAll, setTemplateReferences } = useLocalTemplates();
  const { toast } = useToast();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const translations = {
    no: {
      title: 'Lokal Template Håndtering',
      description: 'Velg filer på din datamaskin med PowerPoint-filer for hver kategori.',
      instructions: [
        'Klikk på "Velg filer" for hver kategori',
        'Velg PowerPoint-filene for den kategorien',
        'Filene vil bli lastet lokalt fra din maskin',
        'Du kan oppdatere en kategori ved å velge nye filer'
      ],
      categories: {
        arushaFirstNight: 'Arusha første nat',
        safariDecFeb: 'Safari - Midt DEC - FEB (Ndutu)',
        safariMarch: 'Safari - MARTS (Ndutu uden Tar)',
        safariAprMay: 'Safari - APRIL - MAI (Ser uden Tar)',
        safariJunJul: 'Safari - JUNI - Ca. 10. JULI (Ser)',
        safariJulSep: 'Safari - Ca. 10. JULI - SEP (Tar + Ser nord)',
        safariOct: 'Safari - OKT (Tar + Ser)',
        safariNovDec: 'Safari - NOV - Midt DEC (Tar + Ser)',
        lastNightSafari: 'Sidste nat safari',
        zanzibarHotel1: 'Zanzibar Hotel 1',
        stoneTownHotel: 'Stone Town Hotel',
        zanzibarHotel2: 'Zanzibar Hotel 2',
        kilimanjaro: 'Kilimanjaro',
        activitiesArusha: 'Aktiviteter Arusha - Slides',
        diverseFastland: 'Diverse Fastland',
        extraSlides: 'Ekstra Slides',
        baseTemplate: 'Reiseprogram og Tilbud.pptx'
      },
      selectFolder: 'Velg filer',
      filesFound: 'filer funnet',
      removeCategory: 'Fjern kategori',
      clearAll: 'Fjern alle',
      browserNotSupported: 'Velg flere filer samtidig for å legge til en kategori.',
      errorAdding: 'Kunne ikke legge til filer',
      successAdded: 'Filer lagt til',
      categoryRemoved: 'Kategori fjernet'
    },
    da: {
      title: 'Lokal Template Håndtering',
      description: 'Vælg filer på din computer med PowerPoint-filer til hver kategori.',
      instructions: [
        'Klik på "Vælg filer" for hver kategori',
        'Vælg PowerPoint-filerne for den kategori',
        'Filerne vil blive indlæst lokalt fra din maskine',
        'Du kan opdatere en kategori ved at vælge nye filer'
      ],
      categories: {
        arushaFirstNight: 'Arusha første nat',
        safariDecFeb: 'Safari - Midt DEC - FEB (Ndutu)',
        safariMarch: 'Safari - MARTS (Ndutu uden Tar)',
        safariAprMay: 'Safari - APRIL - MAI (Ser uden Tar)',
        safariJunJul: 'Safari - JUNI - Ca. 10. JULI (Ser)',
        safariJulSep: 'Safari - Ca. 10. JULI - SEP (Tar + Ser nord)',
        safariOct: 'Safari - OKT (Tar + Ser)',
        safariNovDec: 'Safari - NOV - Midt DEC (Tar + Ser)',
        lastNightSafari: 'Sidste nat safari',
        zanzibarHotel1: 'Zanzibar Hotel 1',
        stoneTownHotel: 'Stone Town Hotel',
        zanzibarHotel2: 'Zanzibar Hotel 2',
        kilimanjaro: 'Kilimanjaro',
        activitiesArusha: 'Aktiviteter Arusha - Slides',
        diverseFastland: 'Diverse Fastland',
        extraSlides: 'Ekstra Slides',
        baseTemplate: 'Reiseprogram og Tilbud.pptx'
      },
      selectFolder: 'Vælg filer',
      filesFound: 'filer fundet',
      removeCategory: 'Fjern kategori',
      clearAll: 'Fjern alle',
      browserNotSupported: 'Vælg flere filer samtidig for at tilføje en kategori.',
      errorAdding: 'Kunne ikke tilføje filer',
      successAdded: 'Filer tilføjet',
      categoryRemoved: 'Kategori fjernet'
    }
  };

  const t = translations[language];

  // Only call onTemplatesReady when changing from empty to not empty or vice versa
  useEffect(() => {
    const hasTemplates = templateReferences.length > 0;
    onTemplatesReady(hasTemplates);
  }, [templateReferences.length > 0, onTemplatesReady]);

  const handleAddFolder = async (category: string) => {
    try {
      await addFolderForCategory(category);
      const fileCount = templateReferences.filter(t => t.category === category).length;
      if (fileCount > 0) {
        // Open the accordion item to show the newly added files
        setOpenItems(prev => prev.includes(category) ? prev : [...prev, category]);
        toast({
          title: t.successAdded,
          description: `${fileCount} ${t.filesFound}`,
        });
      }
    } catch (error) {
      toast({
        title: t.errorAdding,
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleRemoveCategory = async (category: string) => {
    await removeTemplateCategory(category);
    toast({
      title: t.categoryRemoved,
      description: t.categories[category as keyof typeof t.categories]
    });
  };

  const handleRemoveFile = async (category: string, fileName: string) => {
    const template = templateReferences.find(t => t.category === category && t.name === fileName);
    if (template) {
      // Delete from IndexedDB
      await deleteTemplateById(template.id);
      
      // Update state
      setTemplateReferences(prev => prev.filter(t => t.id !== template.id));
      
      toast({
        title: 'Fil fjernet',
        description: fileName
      });
    }
  };

  const categoryKeys: Array<keyof typeof t.categories> = [
    'arushaFirstNight',
    'safariDecFeb',
    'safariMarch',
    'safariAprMay',
    'safariJunJul',
    'safariJulSep',
    'safariOct',
    'safariNovDec',
    'lastNightSafari',
    'zanzibarHotel1',
    'stoneTownHotel',
    'zanzibarHotel2',
    'kilimanjaro',
    'activitiesArusha',
    'diverseFastland',
    'extraSlides',
    'baseTemplate'
  ];

  return (
    <Card className="p-8 shadow-elevated border-border/50 backdrop-blur-sm bg-card/95">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-3 tracking-tight">{t.title}</h2>
          <p className="text-muted-foreground text-lg">{t.description}</p>
        </div>

        <div className="bg-gradient-to-br from-muted/50 to-muted/30 p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold mb-3 text-lg">Instruksjoner:</h3>
          <ul className="space-y-2">
            {t.instructions.map((instruction, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-primary text-xl leading-none mt-0.5">•</span>
                <span className="text-sm leading-relaxed">{instruction}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/30 p-5 rounded-xl flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-600 leading-relaxed">{t.browserNotSupported}</p>
        </div>

      <Accordion type="multiple" className="space-y-3" value={openItems} onValueChange={setOpenItems}>
        {categoryKeys.map(categoryKey => {
          const categoryTemplates = templateReferences.filter(t => t.category === categoryKey);
          const hasTemplates = categoryTemplates.length > 0;

          return (
            <AccordionItem 
              key={categoryKey} 
              value={categoryKey} 
              className="border rounded-xl bg-gradient-to-br from-card to-card/50 shadow-soft hover:shadow-warm transition-all duration-300"
            >
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <AccordionTrigger className="hover:no-underline py-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-left text-base">{t.categories[categoryKey]}</h3>
                        {hasTemplates && (
                          <span className="text-xs font-medium bg-primary/20 text-primary px-3 py-1 rounded-full">
                            {categoryTemplates.length} {t.filesFound}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleAddFolder(categoryKey)}
                      disabled={isLoading}
                      variant={hasTemplates ? "outline" : "default"}
                      size="sm"
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      {hasTemplates ? 'Legg til flere' : t.selectFolder}
                    </Button>
                    
                    {hasTemplates && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCategory(categoryKey)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <AccordionContent>
                  {hasTemplates && (
                    <div className="mt-5 space-y-2">
                      {categoryTemplates.map(template => (
                        <div 
                          key={template.name} 
                          className="flex items-center justify-between bg-muted/50 hover:bg-muted/70 px-4 py-3 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-sm truncate font-medium">{template.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(categoryKey, template.name)}
                            className="h-8 w-8 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </div>
            </AccordionItem>
          );
        })}
      </Accordion>

      {categories.length > 0 && (
        <Button
          variant="destructive"
          onClick={clearAll}
          className="w-full mt-8 shadow-md hover:shadow-lg transition-shadow"
          size="lg"
        >
          {t.clearAll}
        </Button>
      )}
    </div>
    </Card>
  );
};

export default LocalTemplateManager;
