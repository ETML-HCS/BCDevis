"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, "data"));
const userDataDirectory = path.join(portableDirectory, "data");

app.setName("Bellecour Devis");
app.setPath("userData", userDataDirectory);

let mainWindow;

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
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}

ipcMain.handle("bellecour:save-pdf", async (event, requestedName) => {
  const filePath = await availablePdfPath(app.getPath("downloads"), requestedName);
  const pdf = await event.sender.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  await fs.writeFile(filePath, pdf);
  return { saved: true, fileName: path.basename(filePath), filePath };
});

ipcMain.handle("bellecour:open-external", async (_event, url) => {
  const target = new URL(String(url));
  if (target.protocol !== "https:") throw new Error("Lien externe non autorisé.");
  await shell.openExternal(target.toString());
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
