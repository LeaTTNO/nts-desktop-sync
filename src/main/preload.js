const { contextBridge, ipcRenderer } = require("electron");

const allowedInvokes = [
  "ppt:generate",
  "ppt:open-temp",
  "onedrive:import-templates",
  "shell:open-path",
  "flights:search",
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

  // 🔄 NEW — Auto-sync listener
  onAutoSync: (callback) => {
    ipcRenderer.on('onedrive:auto-sync', callback);
  }
});
