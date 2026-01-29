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

      // 🔥 TVING ÉN REACT-INSTANS (fikser Invalid hook call)
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },

  // 🔥 Sørger for at Vite/Zustand/React deler samme React
  optimizeDeps: {
    dedupe: ["react", "react-dom"],
  },

  server: {
    port: 5174,
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
