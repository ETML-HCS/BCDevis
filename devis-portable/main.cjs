"use strict";

const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createStartupManager } = require("./system-startup.cjs");

app.setName("BCDevis");
if (process.platform === "win32" && typeof app.setAppUserModelId === "function") {
  app.setAppUserModelId("ch.cliniquebellecour.bcdevis");
}

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

const startupManager = createStartupManager({ app });
let mainWindow;
let desktopPreferences;
const TABLET_WINDOW_SIZE = Object.freeze({ width: 1180, height: 820 });

const OUTLOOK_COMPOSE_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '$payloadPath = $env:BCDEVIS_EMAIL_PAYLOAD',
  'if ([string]::IsNullOrWhiteSpace($payloadPath)) { throw "Payload e-mail manquant." }',
  '$payload = Get-Content -LiteralPath $payloadPath -Raw -Encoding UTF8 | ConvertFrom-Json',
  '$outlook = New-Object -ComObject Outlook.Application',
  '$mail = $outlook.CreateItem(0)',
  '$mail.BodyFormat = 1',
  'if (-not [string]::IsNullOrWhiteSpace([string]$payload.to)) { $mail.To = [string]$payload.to }',
  '$mail.Subject = [string]$payload.subject',
  '$mail.Body = [string]$payload.body',
  '[void]$mail.Attachments.Add([string]$payload.attachmentPath)',
  'if ($mail.Attachments.Count -lt 1) { throw "La pièce jointe Outlook n’a pas été ajoutée." }',
  '$mail.Display($false)'
].join("\r\n");
const OUTLOOK_COMPOSE_COMMAND = Buffer.from(OUTLOOK_COMPOSE_SCRIPT, "utf16le").toString("base64");

function allowedExternalUrl(url) {
  const target = new URL(String(url));
  if (target.protocol !== "https:") throw new Error("Lien externe non autorisé.");
  return target.toString();
}

function runExecutable(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function desktopPreferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function safeConfiguredDirectory(value) {
  const directory = String(value || "").trim();
  return directory && path.isAbsolute(directory) ? path.resolve(directory) : "";
}

async function readDesktopPreferences() {
  if (desktopPreferences) return desktopPreferences;
  try {
    const parsed = JSON.parse(await fs.readFile(desktopPreferencesPath(), "utf8"));
    desktopPreferences = { pdfDirectory: safeConfiguredDirectory(parsed?.pdfDirectory) };
  } catch {
    desktopPreferences = { pdfDirectory: "" };
  }
  return desktopPreferences;
}

async function writeDesktopPreferences(nextPreferences) {
  desktopPreferences = { pdfDirectory: safeConfiguredDirectory(nextPreferences?.pdfDirectory) };
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(desktopPreferencesPath(), `${JSON.stringify(desktopPreferences, null, 2)}\n`, "utf8");
  return desktopPreferences;
}

async function configuredPdfDirectory() {
  const preferences = await readDesktopPreferences();
  return preferences.pdfDirectory || path.resolve(app.getPath("downloads"));
}

async function pdfDirectoryState() {
  const preferences = await readDesktopPreferences();
  return {
    available: true,
    directory: preferences.pdfDirectory || path.resolve(app.getPath("downloads")),
    isDefault: !preferences.pdfDirectory
  };
}

function pathIsWithin(directory, targetPath) {
  const relative = path.relative(path.resolve(directory), path.resolve(targetPath));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function safeEmailPayload(payload) {
  const attachmentPath = path.resolve(String(payload?.attachmentPath || ""));
  const allowedDirectories = [app.getPath("downloads"), await configuredPdfDirectory()];
  if (
    path.extname(attachmentPath).toLowerCase() !== ".pdf"
    || !allowedDirectories.some((directory) => pathIsWithin(directory, attachmentPath))
  ) {
    throw new Error("Pièce jointe e-mail non autorisée.");
  }
  return {
    to: String(payload?.to || "").replace(/[\r\n]+/g, " ").trim().slice(0, 320),
    subject: String(payload?.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 250),
    body: String(payload?.body || "").slice(0, 50000),
    attachmentPath
  };
}

function base64Lines(value) {
  return Buffer.from(value).toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function encodedEmailHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

async function availableEmlPath(attachmentPath) {
  const directory = app.getPath("downloads");
  const baseName = `${path.parse(attachmentPath).name || "devis"}-email`;
  await fs.mkdir(directory, { recursive: true });
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index ? ` (${index})` : "";
    const candidate = path.join(directory, `${baseName}${suffix}.eml`);
    try {
      await fs.access(candidate);
    } catch (error) {
      if (error?.code === "ENOENT") return candidate;
      throw error;
    }
  }
  throw new Error("Impossible de choisir un nom de brouillon e-mail disponible.");
}

async function composeEmailWithEml(payload) {
  const email = await safeEmailPayload(payload);
  const attachment = await fs.readFile(email.attachmentPath);
  if (attachment.length > 25 * 1024 * 1024) {
    throw new Error("Le PDF est trop volumineux pour être joint automatiquement.");
  }
  const attachmentName = path.basename(email.attachmentPath);
  const asciiAttachmentName = attachmentName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  const boundary = `----BCDevis-${randomUUID()}`;
  const lines = [
    "X-Unsent: 1",
    `To: ${email.to}`,
    `Subject: ${encodedEmailHeader(email.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@bcdevis.local>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.body, "utf8")),
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${asciiAttachmentName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${asciiAttachmentName}"; filename*=UTF-8''${encodeURIComponent(attachmentName)}`,
    "",
    base64Lines(attachment),
    "",
    `--${boundary}--`,
    ""
  ];
  const draftPath = await availableEmlPath(email.attachmentPath);
  await fs.writeFile(draftPath, lines.join("\r\n"), "utf8");
  const openError = await shell.openPath(draftPath);
  if (openError) throw new Error(`Le brouillon e-mail n’a pas pu être ouvert : ${openError}`);
  return { opened: true, attached: true, client: "eml", draftPath };
}

async function composeEmailWithOutlook(payload) {
  const email = await safeEmailPayload(payload);
  const payloadPath = path.join(app.getPath("temp"), `bcdevis-email-${process.pid}-${randomUUID()}.json`);
  await fs.writeFile(payloadPath, JSON.stringify(email), "utf8");
  try {
    const powershell = path.join(
      String(process.env.SystemRoot || "C:\\Windows"),
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    await runExecutable(
      powershell,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", OUTLOOK_COMPOSE_COMMAND],
      {
        windowsHide: true,
        timeout: 45000,
        env: { ...process.env, BCDEVIS_EMAIL_PAYLOAD: payloadPath }
      }
    );
    return { opened: true, attached: true, client: "outlook" };
  } finally {
    await fs.unlink(payloadPath).catch(() => {});
  }
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

function tabletWindowBounds(window) {
  const workArea = screen.getDisplayMatching(window.getBounds()).workArea;
  const width = Math.min(TABLET_WINDOW_SIZE.width, workArea.width);
  const height = Math.min(TABLET_WINDOW_SIZE.height, workArea.height);
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height
  };
}

function switchToTabletWindow(window) {
  if (window.isFullScreen()) window.setFullScreen(false);
  if (window.isMaximized()) window.unmaximize();
  window.setBounds(tabletWindowBounds(window), true);
  return false;
}

function createWindow() {
  const appIcon = path.join(__dirname, "assets", "bcdevis-app-icon.png");
  const customWindowPlatforms = ["win32", "linux"];
  const windowChrome = process.platform === "darwin"
    ? { titleBarStyle: "hiddenInset" }
    : (customWindowPlatforms.includes(process.platform) ? { titleBarStyle: "hidden" } : {});
  const windowShell = process.platform === "darwin"
    ? "mac"
    : (customWindowPlatforms.includes(process.platform) ? "custom" : "standard");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: "#ffffff",
    icon: appIcon,
    autoHideMenuBar: true,
    ...windowChrome,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  const syncMaximizedState = () => {
    mainWindow?.webContents.send("bcdevis:window-maximized", mainWindow.isMaximized());
  };
  mainWindow.on("maximize", syncMaximizedState);
  mainWindow.on("unmaximize", syncMaximizedState);
  const appUrl = pathToFileURL(path.join(__dirname, "index.html"));
  appUrl.searchParams.set("windowShell", windowShell);
  mainWindow.loadURL(appUrl.toString());
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
  const filePath = await availablePdfPath(await configuredPdfDirectory(), requestedName);
  const pdf = await event.sender.printToPDF({ pageSize: "A4", printBackground: false, preferCSSPageSize: true });
  await fs.writeFile(filePath, pdf);
  return {
    saved: true,
    fileName: path.basename(filePath),
    filePath,
    directory: path.dirname(filePath),
    // The renderer only receives the contents for the native share operation.
    // Keeping this opt-in avoids transferring a PDF for a regular download.
    contentBase64: includeContents ? pdf.toString("base64") : undefined
  };
}

ipcMain.handle("bcdevis:save-pdf", (event, requestedName) => savePdf(event, requestedName));
ipcMain.handle("bcdevis:save-pdf-for-share", (event, requestedName) => savePdf(event, requestedName, true));
ipcMain.handle("bcdevis:pdf-directory-get", () => pdfDirectoryState());
ipcMain.handle("bcdevis:pdf-directory-choose", async (event) => {
  const current = await pdfDirectoryState();
  const owner = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: "Choisir le dossier des devis PDF",
    defaultPath: current.directory,
    properties: ["openDirectory", "createDirectory"]
  };
  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths?.[0]) return { ...current, canceled: true };
  await writeDesktopPreferences({ pdfDirectory: result.filePaths[0] });
  return pdfDirectoryState();
});
ipcMain.handle("bcdevis:pdf-directory-reset", async () => {
  await writeDesktopPreferences({ pdfDirectory: "" });
  return pdfDirectoryState();
});
ipcMain.handle("bcdevis:compose-email", async (_event, payload) => {
  const email = await safeEmailPayload(payload);
  if (process.platform !== "win32") return composeEmailWithEml(email);
  try {
    return await composeEmailWithOutlook(email);
  } catch (outlookError) {
    console.warn("Outlook classique indisponible, ouverture du brouillon EML.", outlookError?.message || outlookError);
    return composeEmailWithEml(email);
  }
});

ipcMain.handle("bcdevis:open-external", async (_event, url) => {
  const target = allowedExternalUrl(url);
  await shell.openExternal(target);
  return true;
});
ipcMain.handle("bcdevis:startup-get", () => startupManager.get());
ipcMain.handle("bcdevis:startup-set", (_event, enabled) => {
  if (typeof enabled !== "boolean") throw new TypeError("Le réglage de démarrage doit être un booléen.");
  return startupManager.set(enabled);
});
ipcMain.handle("bcdevis:window-minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
  return true;
});
ipcMain.handle("bcdevis:window-toggle-maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  if (window.isMaximized() || window.isFullScreen()) return switchToTabletWindow(window);
  window.maximize();
  return window.isMaximized();
});
ipcMain.handle("bcdevis:window-is-maximized", (event) => {
  return Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized());
});
ipcMain.handle("bcdevis:window-close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
  return true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  dialog.showErrorBox?.(
    "BCDevis est déjà ouvert",
    "Fermez complètement l’ancienne fenêtre BCDevis, puis relancez ce nouvel EXE pour appliquer la mise à jour."
  );
  app.quit();
}
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createWindow).catch((error) => console.error(error));
  app.on("window-all-closed", () => app.quit());
}
