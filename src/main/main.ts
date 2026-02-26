import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

/* --------------------------------------------------
   📁 ESM __dirname support
-------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* --------------------------------------------------
   🔧 Globals
-------------------------------------------------- */
let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

/* --------------------------------------------------
   🪟 CREATE WINDOW
-------------------------------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // 🔧 DEV: Vite / dev-server
    mainWindow.loadURL("http://localhost:5174");
  } else {
    // 🚀 PROD: last bygget renderer fra app.asar
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist", "renderer", "index.html")
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* --------------------------------------------------
   � AUTO UPDATE
-------------------------------------------------- */
function initAutoUpdate() {
  if (isDev) return;

  autoUpdater.logger = console;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("checking-for-update", () => {
    console.log("🔍 Checking for updates...");
  });

  autoUpdater.on("update-available", () => {
    console.log("⬇️ Update available");
  });

  autoUpdater.on("update-not-available", () => {
    console.log("✅ No update available");
  });

  autoUpdater.on("error", (err) => {
    console.error("❌ Auto-update error:", err);
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("🚀 Update downloaded – restarting");
    autoUpdater.quitAndInstall();
  });
}

/* --------------------------------------------------
   �📂 IPC – ÅPNE POWERPOINT MIDLERTIDIG
-------------------------------------------------- */
ipcMain.handle("ppt:open-temp", async (_, { data, fileName }) => {
  try {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, fileName);

    const buffer = Buffer.from(data);
    await fs.promises.writeFile(filePath, buffer);

    await shell.openPath(filePath);
    return { ok: true };
  } catch (err) {
    console.error("PPT open error:", err);
    return { ok: false, error: String(err) };
  }
});

/* --------------------------------------------------
   🚀 APP READY
-------------------------------------------------- */
app.whenReady().then(() => {
  createWindow();
  initAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/* --------------------------------------------------
   ❌ ALL WINDOWS CLOSED
-------------------------------------------------- */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
