import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserCategory {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  order: number;
  hasCheckbox: boolean; // true = checkbox, false = always visible
  isVisible: boolean; // true = vises i frontend, false = skjult
}

interface UserCategoryStore {
  categories: UserCategory[];
  addCategory: (name: string, userId: string, hasCheckbox?: boolean) => void;
  deleteCategory: (id: string) => void;
  updateCategory: (id: string, updates: Partial<UserCategory>) => void;
  getCategoriesForUser: (userId: string) => UserCategory[];
  setBuiltinCategoryVisible: (catId: string, visible: boolean) => void;
  isBuiltinCategoryVisible: (catId: string) => boolean;
  setBuiltinCategoryName: (catId: string, name: string) => void;
  getBuiltinCategoryName: (catId: string) => string | null;
}

export const useUserCategoryStore = create<UserCategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],

      addCategory: (name, userId, hasCheckbox = true) => {
        const newCategory: UserCategory = {
          id: `user-cat-${Date.now()}`,
          name,
          userId,
          createdAt: Date.now(),
          order: get().categories.length + 100, // Start after default categories
          hasCheckbox,
          isVisible: true,
        };
        set((state) => ({
          categories: [...state.categories, newCategory],
        }));
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      getCategoriesForUser: (userId) => {
        return get().categories.filter((c) => c.userId === userId);
      },

      setBuiltinCategoryVisible: (catId, visible) => {
        const BUILTIN_USER = "builtin-visibility";
        const existing = get().categories.find(c => c.id === catId && c.userId === BUILTIN_USER);
        if (existing) {
          set(state => ({
            categories: state.categories.map(c =>
              c.id === catId && c.userId === BUILTIN_USER ? { ...c, isVisible: visible } : c
            ),
          }));
        } else {
          set(state => ({
            categories: [
              ...state.categories,
              {
                id: catId,
                name: catId,
                userId: BUILTIN_USER,
                createdAt: Date.now(),
                order: 0,
                hasCheckbox: true,
                isVisible: visible,
              },
            ],
          }));
        }
      },

      isBuiltinCategoryVisible: (catId) => {
        const BUILTIN_USER = "builtin-visibility";
        const entry = get().categories.find(c => c.id === catId && c.userId === BUILTIN_USER);
        return entry ? entry.isVisible : true; // default visible
      },

      setBuiltinCategoryName: (catId, name) => {
        const BUILTIN_NAME_USER = "builtin-name-override";
        const existing = get().categories.find(c => c.id === catId && c.userId === BUILTIN_NAME_USER);
        if (existing) {
          set(state => ({
            categories: state.categories.map(c =>
              c.id === catId && c.userId === BUILTIN_NAME_USER ? { ...c, name } : c
            ),
          }));
        } else {
          set(state => ({
            categories: [
              ...state.categories,
              {
                id: catId,
                name,
                userId: BUILTIN_NAME_USER,
                createdAt: Date.now(),
                order: 0,
                hasCheckbox: true,
                isVisible: true,
              },
            ],
          }));
        }
      },

      getBuiltinCategoryName: (catId) => {
        const BUILTIN_NAME_USER = "builtin-name-override";
        const entry = get().categories.find(c => c.id === catId && c.userId === BUILTIN_NAME_USER);
        return entry ? entry.name : null;
      },
    }),
    {
      name: "user-categories-storage-v2",
      version: 1,
    }
  )
);
