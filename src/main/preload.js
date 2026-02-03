const { contextBridge, ipcRenderer } = require("electron");

const allowedInvokes = [
  "ppt:generate",
  "ppt:open-temp",
  "onedrive:import-templates",
  "shell:open-path",
  "flights:search",
  "farewise:searchFlights",
  "onedrive:auto-sync",
  "onedrive:sync-now"
];

contextBridge.exposeInMainWorld("electron", {
  invoke: async (channel, args) => {
    if (!allowedInvokes.includes(channel)) {
      throw new Error("Channel not allowed: " + channel);
    }
    return await ipcRenderer.invoke(channel, args);
  },

  // Existing helpers (unchanged)
  openPath: async (p) => ipcRenderer.invoke("shell:open-path", p),

  log: (...args) =>
    ipcRenderer.send("renderer-log", { level: "info", args }),

  // ✈️ NEW — clean wrapper
  searchFlights: async (payload) => {
    return await ipcRenderer.invoke("flights:search", payload);
  },

  // PowerPoint/COM merging
  generatePpt: async ({ base, modules, language, departureDate, flightData }) => {
    // Lagre base og moduler til tempfiler
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptgen-'));
    const basePath = path.join(tmpDir, 'base.pptx');
    fs.writeFileSync(basePath, Buffer.from(base));
    const modulePaths = [];
    for (let i = 0; i < modules.length; i++) {
      const modPath = path.join(tmpDir, `mod${i + 1}.pptx`);
      fs.writeFileSync(modPath, Buffer.from(modules[i].buffer));
      modulePaths.push(modPath);
    }
    // Kall main-prosess for å bygge PPT
    const result = await ipcRenderer.invoke('ppt:build-in-open-powerpoint', {
      basePath,
      modulePaths,
      departureDate,
      language,
      flightData,
    });
    // Les ut base-filen etter merging (bruker lagrer selv, men vi kan returnere basePath)
    const buffer = fs.readFileSync(basePath);
    return { fileName: 'Reiseprogram.pptx', buffer };
  },

  // 🔄 NEW — Auto-sync listener
  onAutoSync: (callback) => {
    ipcRenderer.on('onedrive:auto-sync', callback);
  }
});
