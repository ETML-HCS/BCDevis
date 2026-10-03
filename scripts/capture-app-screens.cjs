"use strict";

// Capture les quatre écrans du manuel (devis-portable/captures/) avec l'interface
// réellement livrée : jeu de données de démonstration, thème Nuit, libellés français.
//
//   npm run capture:app
//
// Les documents PDF reprennent ensuite ces images : relancer `npm run docs:pdf`.

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(PROJECT_ROOT, "devis-portable", "index.html");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "devis-portable", "captures");
const SEED_SCRIPT = path.join(PROJECT_ROOT, "tmp", "captures", "capture-seed.cjs");
const STORAGE_KEY = "bcdevis-v1";
const RELEASE_NOTES_KEY = "bcdevis-release-notes-last-seen";
const RELEASE_NOTES_REVISION = "8.7.1";
const SWIPE_HINT_KEY = "bcdevis-cart-swipe-hint-seen-v1";
const MIN_CAPTURE_BYTES = 100000;
const VIEWPORT = { width: 1680, height: 1050 };
const PIXEL_RATIO = 2;

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", String(PIXEL_RATIO));

const pad = (value, length = 2) => String(value).padStart(length, "0");
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const stamp = (date) => `${isoDate(date).replaceAll("-", "")}`;

function daysAgo(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

const DEFAULT_CONDITIONS = "Le règlement est exigible au fur et à mesure des séances ou lors de l’achat d’un forfait. Les moyens de paiement acceptés sont les cartes de paiement, les espèces, TWINT et le virement bancaire. Toute solution de paiement échelonné est soumise à l’acceptation préalable du partenaire financier.";

function clientSnapshot(name, phone, email, address, city, postalCode) {
  return {
    contactId: "",
    name,
    phone,
    email,
    company: "",
    address,
    postalCode,
    city,
    country: "Suisse",
    birthDate: "",
    language: "fr",
    reference: "",
    notes: ""
  };
}

function quoteLine({ id, name, categoryId, price, offerType = "single", quantity = 1, freeQuantity = 0, duration = 0, customDiscount = null }) {
  return {
    id,
    serviceId: null,
    name,
    categoryId,
    duration,
    offerType,
    basePrice: price,
    studentDiscount: 50,
    price,
    quantity,
    freeQuantity,
    ...(customDiscount ? { customDiscount } : {})
  };
}

function savedQuote({ id, number, date, client, lines, validDays = 30 }) {
  const createdAt = `${date}T09:15:00.000Z`;
  const valid = new Date(`${date}T12:00:00`);
  valid.setDate(valid.getDate() + validDays);
  return {
    id,
    number,
    status: "saved",
    rootQuoteId: id,
    previousQuoteId: "",
    revisionNumber: 1,
    date,
    validUntil: isoDate(valid),
    client,
    lines,
    discount: { code: "", type: "percent", value: 0 },
    conditions: DEFAULT_CONDITIONS,
    note: "",
    createdAt,
    updatedAt: createdAt
  };
}

// Devis en cours affiché dans la caisse : un pack 6 + 1 et une prestation remisée.
function inProgressQuote() {
  const date = isoDate(new Date());
  const valid = new Date();
  valid.setDate(valid.getDate() + 30);
  const id = "demo-current-quote";
  return {
    id,
    number: "DEV-000001",
    status: "draft",
    rootQuoteId: id,
    previousQuoteId: "",
    revisionNumber: 1,
    date,
    validUntil: isoDate(valid),
    client: clientSnapshot("Sophie Martin", "+41 79 214 88 03", "sophie.martin@bluewin.ch", "Rue des Pâquis 14", "Genève", "1201"),
    lines: [
      quoteLine({ id: "line-barbe", name: "Barbe", categoryId: 20, price: 222, duration: 35, offerType: "pack", quantity: 6, freeQuantity: 1 }),
      quoteLine({ id: "line-visage", name: "Visage complet", categoryId: 20, price: 322, duration: 45, quantity: 1, customDiscount: { type: "percent", value: 10 } })
    ],
    discount: { code: "", type: "percent", value: 0 },
    conditions: DEFAULT_CONDITIONS,
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function historyQuotes() {
  const records = [
    {
      offset: 1,
      client: clientSnapshot("Sophie Martin", "+41 79 214 88 03", "sophie.martin@bluewin.ch", "Rue des Pâquis 14", "Genève", "1201"),
      lines: [
        quoteLine({ id: "h1-barbe", name: "Barbe", categoryId: 20, price: 222, duration: 35 }),
        quoteLine({ id: "h1-visage", name: "Visage complet", categoryId: 20, price: 322, duration: 45 })
      ]
    },
    {
      offset: 6,
      client: clientSnapshot("Aleksandra Petrova", "+41 78 445 12 90", "a.petrova@icloud.com", "Avenue de Châtelaine 47", "Vernier", "1219"),
      lines: [
        quoteLine({ id: "h2-jambes", name: "Demi-jambes", categoryId: 25, price: 292, duration: 40, offerType: "pack", quantity: 6, freeQuantity: 1 }),
        quoteLine({ id: "h2-maillot", name: "Maillot classique", categoryId: 24, price: 148, duration: 20 })
      ]
    },
    {
      offset: 13,
      client: clientSnapshot("Camille Dubois", "+41 76 302 71 18", "camille.dubois@gmail.com", "Chemin des Crêts 3", "Carouge", "1227"),
      lines: [
        quoteLine({ id: "h3-toxine", name: "Toxine botulique", categoryId: 16, price: 420, duration: 30 }),
        quoteLine({ id: "h3-consult", name: "Consultation avec Docteur Mickaël Poiraud", categoryId: 16, price: 100, duration: 15 })
      ]
    },
    {
      offset: 20,
      client: clientSnapshot("Nadia Weber", "+41 79 660 40 25", "nadia.weber@bluewin.ch", "Rue de Lausanne 88", "Genève", "1202"),
      lines: [
        quoteLine({ id: "h4-combinee", name: "Jambes complètes, maillot classique, SIF et aisselles", categoryId: 35, price: 758, duration: 35, offerType: "pack", quantity: 6, freeQuantity: 1 })
      ]
    },
    {
      offset: 27,
      client: clientSnapshot("Léa Fontaine", "+41 78 921 55 47", "lea.fontaine@hotmail.com", "Route de Meyrin 210", "Meyrin", "1217"),
      lines: [
        quoteLine({ id: "h5-peeling", name: "Peeling médical", categoryId: 32, price: 280, duration: 30, customDiscount: { type: "percent", value: 5 } })
      ]
    }
  ];
  return records.map((record, index) => {
    const date = daysAgo(record.offset);
    return savedQuote({
      id: `demo-quote-${index + 1}`,
      number: `DEV-${stamp(date)}A${pad(index + 1, 3)}`,
      date: isoDate(date),
      client: record.client,
      lines: record.lines
    });
  });
}

function buildDatabase({ mode = "tiles", withClient = false, withHistory = false }) {
  const quotes = {};
  if (withHistory) historyQuotes().forEach((item) => { quotes[item.id] = item; });
  return {
    version: 25,
    sequence: 0,
    quoteCounters: {},
    settings: {
      theme: "night",
      fontFamily: "red-hat",
      catalogMode: mode,
      quoteTrackingEnabled: false,
      trackingRemindersOnStartup: false,
      showTaxInformation: false,
      displayMode: "auto",
      ipadLayoutMode: "auto"
    },
    customServices: [],
    catalogOverrides: {},
    contacts: {},
    quotes,
    current: withClient ? inProgressQuote() : null
  };
}

async function settle(window, delay = 260) {
  await window.webContents.executeJavaScript(`document.fonts.ready`);
  await new Promise((resolve) => setTimeout(resolve, delay));
  await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
}

async function waitFor(window, expression, label) {
  const deadline = Date.now() + 8000;
  for (;;) {
    const ready = await window.webContents.executeJavaScript(`(() => { try { return Boolean(${expression}); } catch (error) { return false; } })()`);
    if (ready) return;
    if (Date.now() > deadline) throw new Error(`Délai dépassé en attendant ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

// Le stockage d'une origine `file://` n'est pas partagé entre deux documents :
// un preload réécrit le jeu de démonstration avant le démarrage de l'application.
async function applySeed(window, database) {
  const payload = JSON.stringify(JSON.stringify(database));
  await fs.mkdir(path.dirname(SEED_SCRIPT), { recursive: true });
  await fs.writeFile(SEED_SCRIPT, `"use strict";
try {
  window.localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${payload});
  window.localStorage.setItem(${JSON.stringify(RELEASE_NOTES_KEY)}, ${JSON.stringify(RELEASE_NOTES_REVISION)});
  window.localStorage.setItem(${JSON.stringify(SWIPE_HINT_KEY)}, "1");
} catch (error) {
  // Stockage indisponible : l'application repartira d'une base vierge.
}
`, "utf8");
  // L'URL change à chaque passe : Chromium relance réellement le document et le preload.
  await window.loadFile(APP_PATH, { query: { capture: String(Date.now()) } });
  await waitFor(window, `document.querySelector("#familyList") && document.documentElement.dataset.theme === "night"`, "le catalogue");
  await settle(window);
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#releaseNotesLayer:not([hidden]) [data-close="releaseNotesLayer"]')?.click();
    document.querySelector(".toast-close")?.click();
  })()`);
  await settle(window, 140);
}

async function capture(window, name) {
  const image = await window.webContents.capturePage();
  const buffer = image.toPNG();
  if (buffer.length < MIN_CAPTURE_BYTES) {
    throw new Error(`Capture ${name} incomplète (${buffer.length} octets)`);
  }
  if (buffer.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error(`Capture ${name} illisible`);
  }
  await fs.writeFile(path.join(OUTPUT_PATH, name), buffer);
  return { bytes: buffer.length, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function captureQuote(window) {
  const audit = await window.webContents.executeJavaScript(`(() => {
    const shell = document.querySelector("#appShell").getBoundingClientRect();
    const lines = [...document.querySelectorAll(".cart-line")].map((line) => line.textContent.replace(/\\s+/g, " ").trim());
    return {
      lines: lines.length,
      lineTexts: lines,
      client: document.querySelector("#clientName")?.textContent.trim() || "",
      total: document.querySelector(".checkout-total strong, #checkoutTotal strong, .checkout-total-value")?.textContent.trim() || "",
      theme: document.documentElement.dataset.theme,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      shellVisible: shell.width > 900
    };
  })()`);
  if (audit.lines !== 2 || audit.theme !== "night" || audit.horizontalOverflow || !audit.shellVisible) {
    throw new Error(`Écran principal invalide : ${JSON.stringify(audit)}`);
  }
  const shot = await capture(window, "01-devis-en-cours.png");
  return { ...audit, ...shot };
}

async function captureSettings(window) {
  const audit = await window.webContents.executeJavaScript(`(() => {
    document.querySelector("#settingsButton").click();
    document.querySelector('[data-settings-tab="interface"]').click();
    document.querySelector("#settingsPanelInterface").scrollTop = 0;
    const modal = document.querySelector("#settingsLayer .settings-modal").getBoundingClientRect();
    return {
      open: !document.querySelector("#settingsLayer").hidden,
      themeCards: document.querySelectorAll(".theme-card").length,
      fonts: document.querySelectorAll(".font-card").length,
      navigation: [...document.querySelectorAll(".catalog-mode-card strong")].map((node) => node.textContent.trim()),
      ipadOptions: document.querySelectorAll(".ipad-layout-option").length,
      contained: modal.left >= 0 && modal.right <= innerWidth + 1 && modal.top >= 0 && modal.bottom <= innerHeight + 1,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  })()`);
  if (!audit.open || audit.themeCards !== 5 || audit.fonts !== 4 || audit.navigation.join(",") !== "Tuiles,Corps interactif" || audit.ipadOptions !== 3 || !audit.contained || audit.overflow) {
    throw new Error(`Écran des réglages invalide : ${JSON.stringify(audit)}`);
  }
  await settle(window, 200);
  const shot = await capture(window, "02-reglages.png");
  await window.webContents.executeJavaScript(`document.querySelector('#settingsLayer [data-close="settingsLayer"]').click()`);
  await settle(window, 160);
  return { ...audit, ...shot };
}

async function captureHistory(window) {
  const audit = await window.webContents.executeJavaScript(`(() => {
    document.querySelector("#historyButton").click();
    const options = document.querySelector("#historyOptionsDrawer");
    if (options) options.open = true;
    const rows = document.querySelectorAll("#historyList .history-table tbody tr");
    const table = document.querySelector("#historyList .history-table");
    const footer = document.querySelector(".history-footer").getBoundingClientRect();
    return {
      open: !document.querySelector("#historyLayer").hidden,
      title: document.querySelector("#historyTitle").textContent.trim(),
      tabsHidden: document.querySelector("#historyTabs").hidden,
      rows: rows.length,
      headers: [...document.querySelectorAll("#historyList .history-table thead th")].map((node) => node.textContent.trim()),
      firstRow: rows[0]?.textContent.replace(/\\s+/g, " ").trim() || "",
      cardView: Boolean(document.querySelector("#historyList .history-item")),
      tableVisible: Boolean(table && table.getBoundingClientRect().height > 80),
      backupVisible: Boolean(document.querySelector("#exportBackupButton")?.getBoundingClientRect().height),
      footerContained: footer.bottom <= innerHeight + 1,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  })()`);
  if (!audit.open || audit.title !== "Mes devis" || !audit.tabsHidden || audit.rows !== 5 || audit.cardView || !audit.tableVisible || !audit.backupVisible || !audit.footerContained || audit.overflow) {
    throw new Error(`Écran de l’historique invalide : ${JSON.stringify(audit)}`);
  }
  await settle(window, 200);
  const shot = await capture(window, "03-historique-des-devis.png");
  await window.webContents.executeJavaScript(`document.querySelector('#historyLayer [data-close="historyLayer"]').click()`);
  await settle(window, 160);
  return { ...audit, ...shot };
}

async function captureBodyMap(window) {
  const audit = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-body-model-choice="female"]')?.click();
    const map = document.querySelector(".interactive-body-map");
    const figure = document.querySelector(".body-figure")?.getBoundingClientRect();
    const active = document.querySelector("[data-body-region].active");
    return {
      mode: document.body.dataset.catalogMode || document.documentElement.dataset.catalogMode || "",
      mapVisible: Boolean(map && map.getBoundingClientRect().height > 400),
      model: map?.dataset.bodyModel || "",
      femalePressed: document.querySelector('[data-body-model-choice="female"]')?.getAttribute("aria-pressed") || "",
      side: document.querySelector(".body-selector")?.dataset.bodySide || "",
      activeRegion: active?.dataset.bodyRegion || "",
      regionTitle: document.querySelector(".body-results")?.dataset.bodyResultsTitle || "",
      services: document.querySelectorAll(".body-service-options .family-option").length,
      figureHeight: figure ? Math.round(figure.height) : 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  })()`);
  if (!audit.mapVisible || audit.model !== "female" || audit.femalePressed !== "true" || audit.side !== "front" || audit.activeRegion !== "front-visage" || !audit.regionTitle || audit.services < 5 || audit.figureHeight < 400 || audit.overflow) {
    throw new Error(`Écran du mannequin invalide : ${JSON.stringify(audit)}`);
  }
  await settle(window, 200);
  const shot = await capture(window, "04-corps-interactif.png");
  return { ...audit, ...shot };
}

async function main() {
  await fs.mkdir(OUTPUT_PATH, { recursive: true });
  // Le harnais visuel n’embarque pas le preload de l’application livrée : celui-ci
  // amorce seulement la base locale, puis l’application reprend la main.
  ipcMain.handle("bcdevis:window-is-maximized", () => false);
  ipcMain.handle("bcdevis:startup-get", () => false);
  const window = new BrowserWindow({
    show: false,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    backgroundColor: "#171512",
    webPreferences: {
      preload: SEED_SCRIPT,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
      partition: `bcdevis-app-captures-${process.pid}-${Date.now()}`
    }
  });
  window.setContentSize(VIEWPORT.width, VIEWPORT.height);
  window.webContents.on("console-message", (event) => {
    if (event.level >= 1) console.log(`RENDERER_CONSOLE_${event.level}: ${event.message}`);
  });

  try {
    await applySeed(window, buildDatabase({ mode: "tiles", withClient: true }));
    const quote = await captureQuote(window);

    await applySeed(window, buildDatabase({ mode: "tiles" }));
    const settings = await captureSettings(window);

    await applySeed(window, buildDatabase({ mode: "tiles", withHistory: true }));
    const history = await captureHistory(window);

    await applySeed(window, buildDatabase({ mode: "body" }));
    const bodyMap = await captureBodyMap(window);

    console.log("BCDEVIS_APP_CAPTURES_OK");
    console.log(JSON.stringify({ output: OUTPUT_PATH, viewport: VIEWPORT, quote, settings, history, bodyMap }, null, 2));
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
