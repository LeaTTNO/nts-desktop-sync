const { contextBridge, ipcRenderer } = require("electron");

const allowedInvokes = [
  "ppt:generate",
  "ppt:open-temp",
  "onedrive:import-templates",
  "shell:open-path",
  "flights:search",
  "farewise:searchFlights",
  "onedrive:auto-sync",
  "onedrive:sync-now",
  "onedrive:get-file",
  "onedrive:upload-template",
  "dialog:select-file",
  "file:read"
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
  generatePpt: async ({ base, modules, language, departureDate, flightData, baseTemplateName }) => {
    console.log('🔧 PRELOAD generatePpt called - about to invoke ppt:generate');
    // Send data direkte til main-prosess - la main håndtere filoperasjoner
    const result = await ipcRenderer.invoke('ppt:generate', {
      base,
      modules,
      departureDate,
      language,
      flightData,
      baseTemplateName,
    });
    console.log('🔧 PRELOAD generatePpt - IPC invoke completed, result:', result ? 'OK' : 'NULL');
    return result;
  },

  // 🔄 NEW — Auto-sync listener
  onAutoSync: (callback) => {
    ipcRenderer.on('onedrive:auto-sync', callback);
  },

  // 🐛 NEW — Generic event listener for debugging
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});
