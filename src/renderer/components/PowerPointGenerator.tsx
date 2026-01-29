import { useState, useEffect } from "react";
import { STANDARD_ORDER } from "@/config/standardOrder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Loader2, AlertCircle, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OneDriveTemplate } from "@/hooks/useOneDriveTemplates";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// import { mergePowerPointFiles } from "@/lib/pptxMerger";

interface PowerPointGeneratorProps {
  language: "no" | "da";
  formData: any;
  templateReferences: OneDriveTemplate[];
  downloadTemplate: (templateRef: OneDriveTemplate) => Promise<Blob>;
  onReset?: () => void;
}

interface SelectedSlide {
  id: string;
  templateRef: OneDriveTemplate;
  replacements: { [key: string]: string };
}

interface SortableSlideItemProps {
  slide: SelectedSlide;
  index: number;
}

const SortableSlideItem = ({ slide, index }: SortableSlideItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border rounded-lg bg-background"
    >
      <div className="flex items-center gap-2 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <FileText className="h-4 w-4" />
        <span className="font-medium">{slide.templateRef.name}</span>
      </div>
      <span className="text-sm text-muted-foreground">#{index + 1}</span>
    </div>
  );
};

export const PowerPointGenerator = ({
  language,
  formData,
  templateReferences,
  downloadTemplate,
  onReset,
}: PowerPointGeneratorProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // 👉 dette er nå KUN de filene brukeren valgte fra dropdown
  const [orderedSlides, setOrderedSlides] = useState<SelectedSlide[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedSlides((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const translations = {
    no: {
      title: "Generer PowerPoint presentasjon",
      description: "Kombinerer valgte maler til en ferdig presentasjon",
      generate: "Generer presentasjon",
      generating: "Genererer...",
      success: "Presentasjon generert!",
      error: "Feil ved generering",
      noTemplates: "Ingen maler valgt",
      selectTemplates: "Valgte maler:",
      downloadSelected: "Last ned valgte maler",
    },
    da: {
      title: "Generer PowerPoint præsentation",
      description: "Kombinerer valgte skabeloner til en færdig præsentation",
      generate: "Generer præsentation",
      generating: "Genererer...",
      success: "Præsentation genereret!",
      error: "Fejl ved generering",
      noTemplates: "Ingen skabeloner valgt",
      selectTemplates: "Valgte skabeloner:",
      downloadSelected: "Download valgte skabeloner",
    },
  };

  const t = translations[language];

  // 👉 HOVEDFIKSEN
  // hver dropdown gir en template-id → vi oversetter til faktiske filer
  useEffect(() => {
    if (!formData?.selectedTemplates || !Array.isArray(formData.selectedTemplates)) return;

    let selected: SelectedSlide[] = formData.selectedTemplates
      .map((templateId: string, index: number) => {
        const ref = templateReferences.find((r) => r.id === templateId);
        if (!ref) return null;
        return {
          id: `slide-${index}`,
          templateRef: ref,
          replacements: {},
        };
      })
      .filter(Boolean) as SelectedSlide[];
    setOrderedSlides(selected);

    // Sorter etter STANDARD_ORDER hvis mulig
    const getOrderKey = (slide: SelectedSlide) => {
      // Prøv å matche navn eller kategori mot STANDARD_ORDER
      const name = slide.templateRef.name.toLowerCase();
      const category = slide.templateRef.category?.toLowerCase() || "";
      // Finn beste match
      let bestKey = Object.keys(STANDARD_ORDER).find(key => name.includes(key) || category.includes(key));
      return bestKey ? STANDARD_ORDER[bestKey] : 999;
    };
    selected.sort((a, b) => getOrderKey(a) - getOrderKey(b));
    setOrderedSlides(selected);
  }, [formData?.selectedTemplates, templateReferences]);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      if (orderedSlides.length === 0) {
        toast({
          title: t.error,
          description: language === "no" ? "Ingen maler valgt" : "Ingen skabeloner valgt",
          variant: "destructive",
        });
        return;
      }

      // Last ned alle valgte moduler som Blob
      const downloadedFiles: { name: string; buffer: ArrayBuffer }[] = [];
      for (let i = 0; i < orderedSlides.length; i++) {
        const slide = orderedSlides[i];
        const file = await downloadTemplate(slide.templateRef);
        const buffer = await file.arrayBuffer();
        downloadedFiles.push({ name: slide.templateRef.name, buffer });
      }

      // Hent flight info fra localStorage hvis tilgjengelig
      const flightDataStr = localStorage.getItem('flyinformasjon-data');
      const flightReady = localStorage.getItem('flyinformasjon-ready');
      const flightData = flightDataStr && flightReady === 'true' ? JSON.parse(flightDataStr) : null;

      // Kall PowerShell/COM via electronAPI
      if (!window.electronAPI?.generatePpt) throw new Error('generatePpt API ikke tilgjengelig');
      const result = await window.electronAPI.generatePpt({
        base: downloadedFiles[0].buffer,
        modules: downloadedFiles.slice(1).map(f => ({ name: f.name, buffer: f.buffer })),
        language,
        departureDate: formData.departureDate || null,
        flightData,
      });

      if (result && result.ok) {
        toast({
          title: t.success,
          description: `${downloadedFiles.length} filer slått sammen og åpnet i PowerPoint`,
        });
        if (onReset) setTimeout(() => onReset(), 1500);
      } else {
        toast({
          title: t.error,
          description: language === "no" ? "En feil oppstod under generering" : "Der opstod en fejl under genereringen",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: t.error,
        description: language === "no" ? "En feil oppstod under generering" : "Der opstod en fejl under genereringen",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {orderedSlides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.noTemplates}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-medium">{t.selectTemplates}</h4>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedSlides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-2">
                  {orderedSlides.map((slide, index) => (
                    <SortableSlideItem key={slide.id} slide={slide} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.generating}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t.downloadSelected}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
