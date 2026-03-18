// src/services/templateStorage.ts
// ============================================================
// Ansvar:
// - Lokal lagring av templates (IndexedDB)
// - Lese / skrive / slette
// - Ingen React, ingen Zustand, ingen UI
// ============================================================

import { openDB, DBSchema } from "idb";

/* =========================
   TYPES
========================= */

export interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  categoryId?: string;  // Kategori-ID for robust oppslag (uavhengig av kategorinavn)
  language?: string;    // "no" eller "da" – skiller norske og danske maler
  order: number;
  visibleInBuilder: boolean;
  blob: ArrayBuffer | null;
  fileName: string;
  createdAt: number;
  defaultDayOffset?: number;
}

/* =========================
   DB DEFINISJON
========================= */

const DB_NAME = "nts-template-db";
const DB_VERSION = 4;
const STORE_NAME = "templates";

interface TemplateDB extends DBSchema {
  [STORE_NAME]: {
    key: string; // template.id
    value: TemplateEntry;
    indexes: {
      category: string;
    };
  };
}

/* =========================
   DB INSTANCE
========================= */

async function getDB() {
  return openDB<TemplateDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Versjon 1->2: Initial setup
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
          });
          store.createIndex("category", "category");
        }
      }
      
      // Versjon 3 la til market field - vi trenger ikke det feltet nå
      // Versjon 4: Clean version uten market field (ingen endringer nødvendig)
      // Data fortsetter å fungere som normalt
    },
  });
}

/* =========================
   API
========================= */

/** Hent alle templates */
export async function loadAllTemplates(): Promise<TemplateEntry[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/** Hent kun IDer — rask, laster IKKE blobs */
export async function getAllTemplateIds(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys(STORE_NAME) as Promise<string[]>;
}

/** Hent templates etter kategori */
export async function loadTemplatesByCategory(category: string): Promise<TemplateEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, "category", category);
}

/** Hent én template etter ID */
export async function getTemplateById(id: string): Promise<TemplateEntry | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/** Lagre / oppdatere én template */
export async function saveTemplate(template: TemplateEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, template);
}

/** Lagre flere templates på en gang */
export async function saveTemplates(templates: TemplateEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await Promise.all([
    ...templates.map(t => tx.store.put(t)),
    tx.done,
  ]);
}

/** Slette én template */
export async function deleteTemplateFromStorage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/** Slette alle templates i en kategori */
export async function deleteTemplatesByCategory(category: string): Promise<void> {
  const db = await getDB();
  const templates = await db.getAllFromIndex(STORE_NAME, "category", category);
  const tx = db.transaction(STORE_NAME, "readwrite");
  await Promise.all([
    ...templates.map(t => tx.store.delete(t.id)),
    tx.done,
  ]);
}

/** Slette ALT (kun for debug / reset) */
export async function clearAllTemplates(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/* =========================
   STANDARD MODULREKKEFØLGE
========================= */

export const DEFAULT_ORDER: Record<string, number> = {
  "arusha første natt": 1,
  "safari": 2,
  "arusha siste natt": 3,
  "kilimanjaro": 4,
  "siste dag safari": 5,
  "Zanzibar Hotel 1": 6,
  "zanzibar hotel 2": 7,
  "stone town hotel": 8,
};

/** Få standard rekkefølge basert på filnavn */
export function getDefaultOrder(filename: string): number {
  const lower = filename.toLowerCase();
  
  for (const [key, order] of Object.entries(DEFAULT_ORDER)) {
    if (lower.includes(key)) {
      return order;
    }
  }
  
  // Alt som ikke matcher havner sist
  return 999;
}
