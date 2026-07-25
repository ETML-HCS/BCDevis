"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

app.setName("BCDevis");

// electron-builder exposes PORTABLE_EXECUTABLE_DIR for the Windows portable
// target. macOS app bundles and Linux/AppImage mounts must keep their data in
// Electron's writable per-user directory instead of modifying the application.
const windowsPortableDirectory = process.platform === "win32"
  ? String(process.env.PORTABLE_EXECUTABLE_DIR || "").trim()
  : "";
if (windowsPortableDirectory) {
  app.setPath("userData", path.join(windowsPortableDirectory, "data"));
} else if (!app.isPackaged) {
  app.setPath("userData", path.join(__dirname, "data"));
}

let mainWindow;

function allowedExternalUrl(url) {
  const target = new URL(String(url));
  if (!["https:", "mailto:"].includes(target.protocol)) throw new Error("Lien externe non autorisé.");
  return target.toString();
}

function safePdfName(requestedName) {
  const candidate = path.basename(String(requestedName || "devis.pdf")).trim() || "devis.pdf";
  return candidate.toLowerCase().endsWith(".pdf") ? candidate : `${candidate}.pdf`;
}

async function availablePdfPath(directory, requestedName) {
  const parsed = path.parse(safePdfName(requestedName));
  const extension = parsed.ext || ".pdf";
  const baseName = parsed.name || "devis";

  await fs.mkdir(directory, { recursive: true });
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index ? ` (${index})` : "";
    const candidate = path.join(directory, `${baseName}${suffix}${extension}`);
    try {
      await fs.access(candidate);
    } catch (error) {
      if (error?.code === "ENOENT") return candidate;
      throw error;
    }
  }
  throw new Error("Impossible de choisir un nom de fichier PDF disponible.");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(allowedExternalUrl(url)).catch((error) => console.error(error));
    } catch {}
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      try {
        shell.openExternal(allowedExternalUrl(url)).catch((error) => console.error(error));
      } catch {}
    }
  });
}

async function savePdf(event, requestedName, includeContents = false) {
  const filePath = await availablePdfPath(app.getPath("downloads"), requestedName);
  const pdf = await event.sender.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  await fs.writeFile(filePath, pdf);
  return {
    saved: true,
    fileName: path.basename(filePath),
    filePath,
    // The renderer only receives the contents for the native share operation.
    // Keeping this opt-in avoids transferring a PDF for a regular download.
    contentBase64: includeContents ? pdf.toString("base64") : undefined
  };
}

ipcMain.handle("bcdevis:save-pdf", (event, requestedName) => savePdf(event, requestedName));
ipcMain.handle("bcdevis:save-pdf-for-share", (event, requestedName) => savePdf(event, requestedName, true));

ipcMain.handle("bcdevis:open-external", async (_event, url) => {
  const target = allowedExternalUrl(url);
  await shell.openExternal(target);
  return true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createWindow).catch((error) => console.error(error));
  app.on("window-all-closed", () => app.quit());
}
