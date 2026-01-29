import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // ❌ DevTools åpnes IKKE automatisk
  // (du kan åpne manuelt med Ctrl+Shift+I)

  if (isDev) {
    mainWindow.loadURL("http://localhost:5174");
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "../renderer/index.html")
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* --------------------------------------------------
   📂 IPC – ÅPNE POWERPOINT MIDLERTIDIG
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
