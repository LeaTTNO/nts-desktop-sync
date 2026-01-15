// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),

  // 🔑 KRITISK FOR ELECTRON
  base: "./",

  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "src/renderer"),
      ],
    },
  },

  plugins: [react()],
});
