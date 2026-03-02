import { create } from "zustand";
import { nanoid } from "nanoid";
import { defaultCategories } from "../../config/templateCategories";
import {
  loadAllTemplates,
  saveTemplate,
  deleteTemplateFromStorage,
  getDefaultOrder,
  type TemplateEntry,
} from "../services/templateStorage";

// Re-export TemplateEntry type
export type { TemplateEntry };

export type Category = {
  id: string;
  name: string;
  kind: "base" | "group" | "dropdown" | "optional";
  parentId?: string;
};

type FlightSlide = {
  type: "flight";
  source: "flyrobott";
  language: string;
  data: any;
};

type Store = {
  templates: TemplateEntry[];
  categories: Category[];

  selectedTemplateIds: string[];
  addSelectedTemplate: (id: string) => void;
  removeSelectedTemplate: (id: string) => void;
  moveSelectedTemplate: (from: number, to: number) => void;
  clearSelectedTemplates: () => void;

  slides: (string | FlightSlide)[];
  addFlightSlide: (flight: any, language: string) => void;
  removeFlightSlides: () => void;

  loadFromDB: () => Promise<void>;
  addTemplate: (t: Partial<TemplateEntry>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setTemplateVisibility: (id: string, visible: boolean) => Promise<void>;
  updateTemplateOrder: (id: string, order: number) => Promise<void>;
  updateTemplateCategory: (id: string, newCategory: string) => Promise<void>;

  getTemplatesByCategoryId: (catName: string) => TemplateEntry[];
  getTemplatesByCategoryName: (catName: string) => TemplateEntry[];
  getTemplateBlob: (id: string) => ArrayBuffer | null | undefined;
};

const LOCKED_CATEGORY = "Reiseprogram og Tilbud";

export const useTemplateStore = create<Store>((set, get) => ({
  templates: [],
  categories: defaultCategories.map(c => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId,
  })),

  selectedTemplateIds: [],
  slides: [],

  addFlightSlide: (flight, language) =>
    set((s) => {
      // Fjern eksisterende flight-slide hvis den finnes
      const slides = s.slides.filter(slide => !(typeof slide === "object" && slide.type === "flight"));
      // Sett inn flight-slide som nest siste slide
      const insertAt = Math.max(slides.length - 1, 0);
      const newSlide: FlightSlide = {
        type: "flight",
        source: "flyrobott",
        language,
        data: flight,
      };
      slides.splice(insertAt, 0, newSlide);
      return { slides };
    }),

  removeFlightSlides: () =>
    set((s) => ({ slides: s.slides.filter(slide => !(typeof slide === "object" && slide.type === "flight")) })),

  loadFromDB: async () => {
    const templates = await loadAllTemplates();
    // Sort by order field
    templates.sort((a, b) => a.order - b.order);
    set({ templates });
  },

  addSelectedTemplate: (id) =>
    set((s) => {
      if (s.selectedTemplateIds.includes(id)) return s;

      const tpl = s.templates.find(t => t.id === id);
      if (!tpl) return s;

      // Base template always goes first
      if (tpl.category === LOCKED_CATEGORY) {
        return {
          selectedTemplateIds: [
            id,
            ...s.selectedTemplateIds.filter(x => x !== id),
          ],
        };
      }

      return { selectedTemplateIds: [...s.selectedTemplateIds, id] };
    }),

  removeSelectedTemplate: (id) =>
    set(s => ({
      selectedTemplateIds: s.selectedTemplateIds.filter(x => x !== id),
    })),

  moveSelectedTemplate: (from, to) =>
    set(s => {
      const ids = [...s.selectedTemplateIds];
      const movingId = ids[from];
      const tpl = s.templates.find(t => t.id === movingId);
      
      // Cannot move locked category
      if (tpl?.category === LOCKED_CATEGORY) return s;
      
      // Cannot move to position 0
      if (to === 0) return s;
      
      ids.splice(from, 1);
      ids.splice(Math.min(to, ids.length), 0, movingId);
      return { selectedTemplateIds: ids };
    }),

  clearSelectedTemplates: () => set({ selectedTemplateIds: [] }),

  addTemplate: async (t) => {
    const entry: TemplateEntry = {
      id: nanoid(),
      name: t.name || "Uten navn",
      category: t.category!,
      categoryId: t.categoryId,
      hotelGroup: t.hotelGroup,
      language: t.language,
      order: t.order ?? getDefaultOrder(t.name || ""),
      visibleInBuilder: t.visibleInBuilder ?? true,
      blob: t.blob || null,
      fileName: t.fileName || "template.pptx",
      createdAt: Date.now(),
      defaultDayOffset: t.defaultDayOffset,
    };
    await saveTemplate(entry);
    set(s => ({ 
      templates: [...s.templates, entry].sort((a, b) => a.order - b.order) 
    }));
  },

  deleteTemplate: async (id) => {
    await deleteTemplateFromStorage(id);
    set(s => ({
      templates: s.templates.filter(t => t.id !== id),
      selectedTemplateIds: s.selectedTemplateIds.filter(x => x !== id),
    }));
  },

  setTemplateVisibility: async (id, visible) => {
    const tpl = get().templates.find(t => t.id === id);
    if (!tpl) return;
    const updated = { ...tpl, visibleInBuilder: visible };
    await saveTemplate(updated);
    set(s => ({
      templates: s.templates.map(t => t.id === id ? updated : t),
    }));
  },

  updateTemplateOrder: async (id, order) => {
    const tpl = get().templates.find(t => t.id === id);
    if (!tpl) return;
    const updated = { ...tpl, order };
    await saveTemplate(updated);
    set(s => ({
      templates: s.templates
        .map(t => t.id === id ? updated : t)
        .sort((a, b) => a.order - b.order),
    }));
  },

  updateTemplateCategory: async (id, newCategory) => {
    const tpl = get().templates.find(t => t.id === id);
    if (!tpl) return;
    const updated = { ...tpl, category: newCategory };
    await saveTemplate(updated);
    set(s => ({
      templates: s.templates.map(t => t.id === id ? updated : t),
    }));
  },

  getTemplatesByCategoryId: (catId) => {
    const category = defaultCategories.find(c => c.id === catId);
    if (!category) return [];
    // Søk på categoryId felt ELLER at kategorinavnet matcher
    return get().templates.filter(t =>
      t.categoryId === catId || t.category === category.name
    );
  },

  getTemplatesByCategoryName: (catName) =>
    get().templates.filter(t => t.category === catName),

  getTemplateBlob: (id) => {
    const tpl = get().templates.find(t => t.id === id);
    return tpl?.blob;
  },
}));
