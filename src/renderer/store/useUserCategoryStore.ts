import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserCategory {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  order: number;
}

interface UserCategoryStore {
  categories: UserCategory[];
  addCategory: (name: string, userId: string) => void;
  deleteCategory: (id: string) => void;
  updateCategory: (id: string, name: string) => void;
  getCategoriesForUser: (userId: string) => UserCategory[];
}

export const useUserCategoryStore = create<UserCategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],

      addCategory: (name, userId) => {
        const newCategory: UserCategory = {
          id: `user-cat-${Date.now()}`,
          name,
          userId,
          createdAt: Date.now(),
          order: get().categories.length + 100, // Start after default categories
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

      updateCategory: (id, name) => {
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, name } : c
          ),
        }));
      },

      getCategoriesForUser: (userId) => {
        return get().categories.filter((c) => c.userId === userId);
      },
    }),
    {
      name: "user-categories-storage",
    }
  )
);
