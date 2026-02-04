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
    }),
    {
      name: "user-categories-storage-v2",
      version: 1,
    }
  )
);
