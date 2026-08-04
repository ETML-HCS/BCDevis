(() => {
  "use strict";

  const STORAGE_KEY = "bcdevis-v1";
  const RELEASE_VERSION = "5.3.1";
  const RELEASE_NOTES_SEEN_KEY = "bcdevis-release-notes-last-seen";
  // Keep the former names here so an update retains every existing quote.
  const LEGACY_STORAGE_KEYS = ["bellecour-atelier-devis-v3", "bellecour-atelier-devis-v2", "bellecour-atelier-devis-v1"];
  const APP_VERSION = 20;
  const EXAMPLE_QUOTE_NUMBER = "DEV-000002";
  const QUOTE_VALIDITY_DAYS = 30;
  const QUOTE_FUTURE_DATE_LIMIT = 14;
  const DEFAULT_LOGO_PATH = "assets/clinique-bellecour-logo-officiel.png";
  const LOGO_FILE_MAX_BYTES = 4 * 1024 * 1024;
  // Keep accepting older logo data so an update never drops a saved identity.
  const LOGO_DATA_MAX_LENGTH = 1800000;
  // New uploads are more compact, leaving ample room for the quote history in
  // the portable Chromium profile.
  const LOGO_UPLOAD_MAX_LENGTH = 800000;
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
  const MAX_LINE_QUANTITY = 999;
  const MAX_LINE_PRICE = 1000000;
  const MAX_CUSTOM_SERVICES = 500;
  const CART_DELETE_REVEAL_WIDTH = 56;
  const CART_SWIPE_START_THRESHOLD = 8;
  const LEGACY_DEFAULT_PAYMENT_CONDITIONS = "Le règlement peut s’effectuer à chaque séance ou par l’achat d’un pack. Les paiements sont acceptés par carte, en espèces, via TWINT, par virement bancaire ou par paiement échelonné. L’échelonnement est soumis à l’accord du partenaire financier.";
  const DEFAULT_PAYMENT_CONDITIONS = "Le règlement est exigible au fur et à mesure des séances ou lors de l’achat d’un forfait. Les moyens de paiement acceptés sont les cartes de paiement, les espèces, TWINT et le virement bancaire. Toute solution de paiement échelonné est soumise à l’acceptation préalable du partenaire financier.";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const windowShell = new URLSearchParams(window.location.search).get("windowShell");
  if (["custom", "windows"].includes(windowShell)) {
    document.documentElement.classList.add("bcdevis-window-overlay");
  } else if (windowShell === "mac") {
    document.documentElement.classList.add("bcdevis-window-mac");
  }
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const { roundMoney, clamp, calculate, installmentMonths, referenceLineTotal } = window.QuoteCore;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const todayISO = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };
  const addDaysISO = (iso, days) => {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  };
  const quoteDateBounds = () => {
    const min = todayISO();
    return { min, max: addDaysISO(min, QUOTE_FUTURE_DATE_LIMIT) };
  };
  const boundedQuoteDate = (value) => {
    const { min, max } = quoteDateBounds();
    if (!value || value < min) return min;
    if (value > max) return max;
    return value;
  };
  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00`));
  };
  const money = (value) => new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(value) || 0).replaceAll(" ", " ");
  const moneyValue = (value) => new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(value) || 0).replaceAll(" ", " ");
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);
  const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
  const safeLogoDataUrl = (value = "") => {
    const logo = String(value || "");
    return logo.length <= LOGO_DATA_MAX_LENGTH && /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(logo) ? logo : "";
  };
  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const boundedNumber = (value, minimum, maximum, fallback = minimum) => {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
  };
  const boundedInteger = (value, minimum, maximum, fallback = minimum) => Math.round(boundedNumber(value, minimum, maximum, fallback));
  const safeLocalId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
  const validISODate = (value, fallback = todayISO()) => {
    const candidate = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
    const date = new Date(`${candidate}T12:00:00`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate ? fallback : candidate;
  };
  const validTimestamp = (value, fallback = new Date().toISOString()) => Number.isNaN(Date.parse(value)) ? fallback : new Date(value).toISOString();
  const KNOWN_FONTS = ["red-hat", "roboto", "roboto-slab", "system"];
  const IPAD_LAYOUT_MODES = ["auto", "always", "off"];
  const SETTINGS_TAB_IDS = ["interface", "company", "pricing", "document"];

  const defaultSettings = {
    companyName: "Clinique Bellecour",
    companySubtitle: "Médecine esthétique",
    companyAddress: "Rue du Mont-Blanc 20 · 1201 Genève",
    companyPhone: "+41 78 669 63 44",
    companyEmail: "contact@cliniquebellecour.ch",
    companyUid: "CHE-244.490.739",
    headerLogoDataUrl: "",
    pdfLogoDataUrl: "",
    quotePrefix: "DEV",
    machineName: "A",
    theme: "light",
    fontFamily: "red-hat",
    validityDays: QUOTE_VALIDITY_DAYS,
    packPaidDefault: 6,
    packFreeDefault: 1,
    studentDiscount: 50,
    taxRate: 8.1,
    taxMode: "included",
    showTaxInformation: false,
    showFamilyPrices: false,
    skipTariffChangeConfirmation: false,
    catalogMode: "tiles",
    ipadLayoutMode: "off",
    launchAtLogin: false,
    visibleFamilies: [],
    conditions: DEFAULT_PAYMENT_CONDITIONS,
    studentConditions: "Le tarif étudiant est accordé sur présentation d’un justificatif étudiant en cours de validité.",
    footerNote: "Prix exprimés en francs suisses. Ce devis ne vaut pas facture.",
    showSignatures: true
  };

  function packDefaults() {
    return {
      paid: boundedInteger(db.settings.packPaidDefault, 1, 24, 6),
      free: boundedInteger(db.settings.packFreeDefault, 0, 12, 0)
    };
  }

  function configuredTaxRate(settings = defaultSettings) {
    if (settings?.taxRate === "" || settings?.taxRate === null || settings?.taxRate === undefined) return defaultSettings.taxRate;
    const rate = Number(settings.taxRate);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : defaultSettings.taxRate;
  }

  function taxInformationEnabled(item) {
    return db.settings.showTaxInformation === true && item?.tax?.enabled !== false;
  }

  function calculateQuote(item) {
    if (taxInformationEnabled(item)) return calculate(item);
    return calculate({ ...item, tax: { ...(item?.tax || {}), enabled: false } });
  }

  function freshDatabase() {
    return { version: APP_VERSION, sequence: 0, quoteCounters: {}, settings: clone(defaultSettings), customServices: [], catalogOverrides: {}, quotes: {}, current: null };
  }

  function sanitizeCustomServices(items) {
    if (!Array.isArray(items)) return [];
    const knownIds = new Set();
    return items.filter(isRecord).map((item) => {
      const name = String(item.name || "").trim().slice(0, 240);
      if (!name) return null;
      const providedId = String(item.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      let id = providedId.startsWith("custom-") ? providedId : `custom-${providedId || uid()}`;
      while (knownIds.has(id)) id = `custom-${uid()}`;
      knownIds.add(id);
      return {
        id,
        name,
        price: boundedNumber(item.price, 0, MAX_LINE_PRICE, 0),
        duration: boundedInteger(item.duration, 0, 1440, 0),
        categoryId: boundedInteger(item.categoryId, 0, 99999, 0),
        custom: true
      };
    }).filter(Boolean).slice(0, MAX_CUSTOM_SERVICES);
  }

  function sanitizeCatalogOverrides(source) {
    if (!isRecord(source)) return {};
    return Object.fromEntries(Object.entries(source).slice(0, MAX_CUSTOM_SERVICES + window.QUOTE_SERVICES.length).map(([rawId, rawOverride]) => {
      const id = safeLocalId(rawId);
      if (!id || !isRecord(rawOverride)) return null;
      const override = {};
      if (Object.hasOwn(rawOverride, "name")) {
        const name = String(rawOverride.name || "").trim().slice(0, 240);
        if (name) override.name = name;
      }
      if (Object.hasOwn(rawOverride, "price")) override.price = boundedNumber(rawOverride.price, 0, MAX_LINE_PRICE, 0);
      if (Object.hasOwn(rawOverride, "duration")) override.duration = boundedInteger(rawOverride.duration, 0, 1440, 0);
      if (Object.hasOwn(rawOverride, "packAveragePrice")) override.packAveragePrice = boundedNumber(rawOverride.packAveragePrice, 0, MAX_LINE_PRICE, 0);
      if (Object.hasOwn(rawOverride, "icon")) {
        const icon = String(rawOverride.icon || "").trim();
        if (/^[a-z0-9-]{1,80}$/.test(icon)) override.icon = icon;
      }
      return Object.keys(override).length ? [id, override] : null;
    }).filter(Boolean));
  }

  function removeExampleQuote(database) {
    Object.entries(database.quotes || {}).forEach(([id, item]) => {
      if (item?.number === EXAMPLE_QUOTE_NUMBER) delete database.quotes[id];
    });
    if (database.current?.number === EXAMPLE_QUOTE_NUMBER) database.current = null;
    return database;
  }

  function applyDefaultTax(database) {
    const enableTax = (item) => {
      if (!item || typeof item !== "object") return;
      item.tax = {
        enabled: true,
        rate: Number(item.tax?.rate) > 0 ? Number(item.tax.rate) : configuredTaxRate(database.settings),
        mode: item.tax?.mode === "excluded" ? "excluded" : database.settings?.taxMode === "excluded" ? "excluded" : "included"
      };
    };
    enableTax(database.current);
    Object.values(database.quotes || {}).forEach(enableTax);
    return database;
  }

  function updateDefaultPaymentWording(database) {
    if (database.settings?.conditions === LEGACY_DEFAULT_PAYMENT_CONDITIONS) {
      database.settings.conditions = DEFAULT_PAYMENT_CONDITIONS;
    }
    const records = [database.current, ...Object.values(database.quotes || {})].filter(Boolean);
    records.forEach((record) => {
      if (record.conditions === LEGACY_DEFAULT_PAYMENT_CONDITIONS) record.conditions = DEFAULT_PAYMENT_CONDITIONS;
    });
    return database;
  }

  function migrateDatabase(database, sourceVersion) {
    const version = Number(sourceVersion || 0);
    if (version < 4) removeExampleQuote(database);
    if (version < 7) applyDefaultTax(database);
    if (version < 17) updateDefaultPaymentWording(database);
    return database;
  }

  function loadDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!raw) return freshDatabase();
      const parsed = JSON.parse(raw);
      const database = {
        ...freshDatabase(),
        ...parsed,
        version: APP_VERSION,
        settings: { ...defaultSettings, ...(parsed.settings || {}) },
        quoteCounters: parsed.quoteCounters && typeof parsed.quoteCounters === "object" && !Array.isArray(parsed.quoteCounters) ? parsed.quoteCounters : {},
        customServices: sanitizeCustomServices(parsed.customServices),
        catalogOverrides: sanitizeCatalogOverrides(parsed.catalogOverrides),
        quotes: isRecord(parsed.quotes) ? parsed.quotes : {}
      };
      database.settings.headerLogoDataUrl = safeLogoDataUrl(database.settings.headerLogoDataUrl);
      database.settings.pdfLogoDataUrl = safeLogoDataUrl(database.settings.pdfLogoDataUrl);
      return migrateDatabase(database, parsed.version);
    } catch (error) {
      console.warn("Sauvegarde locale illisible", error);
      return freshDatabase();
    }
  }

  let db = loadDatabase();
  let activeFamily = "visage";
  let expandedFamily = "visage";
  let activeBodySide = "front";
  let activeBodyModel = "male";
  let activeBodyRegion = "front-visage";
  let activeBodyDetail = "body";
  let activeFaceRegion = "";
  let selectedOfferMode = "single";
  let searchQuery = "";
  let couponOpen = false;
  let toastTimer = null;
  let activeToast = null;
  let pendingTheme = "light";
  let pendingFont = "red-hat";
  let pendingLogos = { headerLogoDataUrl: "", pdfLogoDataUrl: "" };
  let activeSettingsTab = "interface";
  let activeLayerId = "";
  let tileDetailServiceId = "";
  let tileDetailPinned = false;
  let tileDetailReturnFocus = null;
  let tileDetailOpenTimer = 0;
  let tileDetailCloseTimer = 0;
  let tileDetailHideTimer = 0;
  let tileDensityResizeFrame = 0;
  let cartSwipeState = null;
  const layerReturnFocus = new Map();

  function compactMachineCode(value) {
    const code = normalize(value || "A").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
    return code || "A";
  }

  function machineCode() {
    return compactMachineCode(db.settings.machineName);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highestRecordedSequence(date, machine) {
    const day = String(date || todayISO()).replace(/[^0-9]/g, "").slice(0, 8) || todayISO().replaceAll("-", "");
    const machinePattern = escapeRegExp(machine);
    const currentFormat = new RegExp(`^[A-Z0-9-]+-${day}${machinePattern}(\\d{3,})$`, "i");
    const legacyFormat = new RegExp(`^[A-Z0-9-]+-${day}-${machinePattern}-(\\d{3,})$`, "i");
    const records = [...Object.values(db.quotes || {}), db.current].filter(Boolean);
    return records.reduce((highest, record) => {
      const number = String(record.number || "");
      const match = number.match(currentFormat) || number.match(legacyFormat);
      return match ? Math.max(highest, Number(match[1]) || 0) : highest;
    }, 0);
  }

  function nextQuoteNumber(date = todayISO(), machineOverride = machineCode()) {
    const prefix = (db.settings.quotePrefix || "DEV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "DEV";
    const day = String(date || todayISO()).replace(/[^0-9]/g, "").slice(0, 8) || todayISO().replaceAll("-", "");
    const machine = compactMachineCode(machineOverride);
    const key = `${day}:${machine}`;
    db.quoteCounters = db.quoteCounters && typeof db.quoteCounters === "object" ? db.quoteCounters : {};
    const next = Math.max(0, Number(db.quoteCounters[key]) || 0, highestRecordedSequence(date, machine)) + 1;
    db.quoteCounters[key] = next;
    return `${prefix}-${day}${machine}${String(next).padStart(3, "0")}`;
  }

  function compactLegacyQuoteNumber(record) {
    const number = String(record?.number || "").trim().toUpperCase();
    const fullLegacy = number.match(/^([A-Z0-9-]+)-(\d{8})-([A-Z0-9-]+)-(\d{3,})$/);
    if (fullLegacy) return { number: `${fullLegacy[1]}-${fullLegacy[2]}${compactMachineCode(fullLegacy[3])}${String(Number(fullLegacy[4]) || 0).padStart(3, "0")}`, machine: compactMachineCode(fullLegacy[3]) };
    const shortLegacy = number.match(/^([A-Z0-9-]+)-(\d{3,})$/);
    if (!shortLegacy) return null;
    const date = String(record?.date || todayISO()).replace(/[^0-9]/g, "").slice(0, 8) || todayISO().replaceAll("-", "");
    const machine = machineCode();
    return { number: `${shortLegacy[1]}-${date}${machine}${String(Number(shortLegacy[2]) || 0).padStart(3, "0")}`, machine };
  }

  function migrateQuoteNumbersToCompactFormat() {
    let changed = false;
    const storedQuotes = Object.values(db.quotes || {});
    const knownNumbers = new Set(storedQuotes.map((item) => String(item?.number || "")).filter(Boolean));
    const migrateRecord = (record) => {
      const converted = compactLegacyQuoteNumber(record);
      if (!converted || converted.number === record.number) return;
      knownNumbers.delete(record.number);
      record.number = knownNumbers.has(converted.number) ? nextQuoteNumber(record.date, converted.machine) : converted.number;
      knownNumbers.add(record.number);
      changed = true;
    };
    storedQuotes.forEach(migrateRecord);
    if (db.current) {
      const savedVersion = db.quotes?.[db.current.id];
      if (savedVersion) {
        if (db.current.number !== savedVersion.number) {
          db.current.number = savedVersion.number;
          changed = true;
        }
      } else migrateRecord(db.current);
    }
    return changed;
  }

  migrateQuoteNumbersToCompactFormat();

  function newQuote() {
    const date = todayISO();
    return {
      id: uid(),
      number: nextQuoteNumber(date),
      status: "draft",
      date,
      validUntil: addDaysISO(date, QUOTE_VALIDITY_DAYS),
      client: { name: "", phone: "", email: "", address: "" },
      lines: [],
      discount: { code: "", type: "percent", value: 0 },
      tax: { enabled: db.settings.showTaxInformation === true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
      conditions: db.settings.conditions,
      note: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function sanitizeQuote(source) {
    if (!isRecord(source) || !Array.isArray(source.lines)) throw new Error("Format de devis non reconnu");
    const date = todayISO();
    const base = {
      id: uid(), number: "", status: "draft", date,
      validUntil: addDaysISO(date, QUOTE_VALIDITY_DAYS),
      client: { name: "", phone: "", email: "", address: "" },
      lines: [], discount: { code: "", type: "percent", value: 0 },
      tax: { enabled: db.settings.showTaxInformation === true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
      conditions: db.settings.conditions, note: "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const quoteDate = validISODate(source.date, base.date);
    const importedNumber = String(source.number || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 64);
    const knownLineIds = new Set();
    const uniqueLineId = (value) => {
      let id = safeLocalId(value) || uid();
      while (knownLineIds.has(id)) id = uid();
      knownLineIds.add(id);
      return id;
    };
    const sanitized = {
      ...base,
      ...source,
      id: safeLocalId(source.id) || uid(),
      number: importedNumber || nextQuoteNumber(quoteDate),
      date: quoteDate,
      validUntil: addDaysISO(quoteDate, QUOTE_VALIDITY_DAYS),
      client: Object.fromEntries(Object.entries({ ...base.client, ...(isRecord(source.client) ? source.client : {}) }).map(([key, value]) => [key, String(value || "").trim().slice(0, 500)])),
      discount: {
        code: String(source.discount?.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24),
        type: source.discount?.type === "fixed" ? "fixed" : "percent",
        value: Math.max(0, Number(source.discount?.value) || 0)
      },
      tax: {
        enabled: source.tax?.enabled === undefined ? base.tax.enabled : source.tax.enabled !== false,
        rate: boundedNumber(source.tax?.rate, 0, 100, base.tax.rate),
        mode: source.tax?.mode === "excluded" ? "excluded" : "included"
      },
      lines: source.lines.filter(isRecord).map((line) => {
        const offerType = ["single", "pack", "student"].includes(line.offerType) ? line.offerType : "single";
        const price = boundedNumber(line.price ?? line.unit_price, 0, MAX_LINE_PRICE, 0);
        const basePrice = boundedNumber(line.basePrice ?? price, 0, MAX_LINE_PRICE, 0);
        return {
          id: uniqueLineId(line.id),
          serviceId: line.serviceId ?? null,
          name: String(line.name || line.description || "Soin").trim().slice(0, 240) || "Soin",
          categoryId: Number(line.categoryId) || 0,
          duration: boundedInteger(line.duration, 0, 1440, 0),
          offerType,
          basePrice,
          studentDiscount: clamp(line.studentDiscount ?? db.settings.studentDiscount, 0, 100),
          price: offerType === "student" ? basePrice : price,
          quantity: boundedInteger(line.quantity, 1, MAX_LINE_QUANTITY, 1),
          freeQuantity: offerType === "pack" ? boundedInteger(line.freeQuantity, 0, MAX_LINE_QUANTITY, 0) : 0
        };
      }),
      conditions: String(source.conditions ?? base.conditions).trim().slice(0, 5000),
      note: String(source.note ?? base.note).trim().slice(0, 2000),
      createdAt: validTimestamp(source.createdAt, base.createdAt),
      updatedAt: validTimestamp(source.updatedAt, base.updatedAt)
    };
    const hasStudentLines = sanitized.lines.some((line) => line.offerType === "student");
    const hasStandardLines = sanitized.lines.some((line) => line.offerType !== "student");
    if (hasStudentLines && hasStandardLines) {
      const studentQuote = sanitized.lines[0]?.offerType === "student";
      sanitized.lines = sanitized.lines.map((line) => {
        const basePrice = Math.max(0, Number(line.basePrice ?? line.price) || 0);
        if (studentQuote) return { ...line, offerType: "student", basePrice, price: basePrice, freeQuantity: 0 };
        return line.offerType === "student" ? { ...line, offerType: "single", basePrice, price: basePrice, freeQuantity: 0 } : line;
      });
    }
    return sanitized;
  }

  function normalizeSavedQuotes() {
    const normalized = {};
    Object.values(isRecord(db.quotes) ? db.quotes : {}).forEach((record) => {
      try {
        const saved = sanitizeQuote(record);
        while (normalized[saved.id]) saved.id = uid();
        normalized[saved.id] = saved;
      } catch (error) {
        console.warn("Devis enregistré ignoré car illisible", error);
      }
    });
    db.quotes = normalized;
    db.customServices = sanitizeCustomServices(db.customServices);
    db.catalogOverrides = sanitizeCatalogOverrides(db.catalogOverrides);
    if (!db.current) return;
    try {
      db.current = sanitizeQuote(db.current);
    } catch (error) {
      console.warn("Brouillon local ignoré car illisible", error);
      db.current = null;
    }
  }

  normalizeSavedQuotes();

  let quote;
  try {
    quote = db.current ? sanitizeQuote(db.current) : newQuote();
  } catch {
    quote = newQuote();
  }
  const quoteNumberPattern = /^[A-Z0-9-]+-\d{8}[A-Z0-9]+\d{3,}$/;
  if (!db.quotes[quote.id] && !quoteNumberPattern.test(quote.number)) quote.number = nextQuoteNumber(quote.date);

  function saveLocal() {
    quote.updatedAt = new Date().toISOString();
    db.current = clone(quote);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (error) {
      const isQuotaError = error?.name === "QuotaExceededError" || /quota|storage/i.test(String(error?.message || ""));
      toast(isQuotaError ? "Sauvegarde pleine : exportez une sauvegarde puis allégez les logos ou l’historique." : "Le stockage local de BCDevis est indisponible.", "error");
      console.error(error);
      return false;
    }
  }

  function showReleaseNotesOnce() {
    try {
      if (localStorage.getItem(RELEASE_NOTES_SEEN_KEY) === RELEASE_VERSION) return;
      localStorage.setItem(RELEASE_NOTES_SEEN_KEY, RELEASE_VERSION);
    } catch (error) {
      console.warn("État des nouveautés indisponible", error);
    }
    openLayer("releaseNotesLayer");
  }

  function syncToastPlacement() {
    const region = $("#toastRegion");
    if (!region) return;
    if (region.parentElement !== document.body) document.body.append(region);
  }

  function toast(message, type = "success") {
    syncToastPlacement();
    const region = $("#toastRegion");
    window.clearTimeout(toastTimer);
    if (activeToast) activeToast.remove();
    const item = document.createElement("div");
    item.className = `toast ${type === "error" ? "error" : ""}`;
    item.setAttribute("role", type === "error" ? "alert" : "status");
    const symbol = document.createElement("span");
    symbol.className = "toast-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = type === "error" ? "!" : "✓";
    const copy = document.createElement("span");
    copy.className = "toast-copy";
    copy.textContent = message;
    const close = document.createElement("button");
    close.className = "toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Fermer la notification");
    close.textContent = "×";
    const dismiss = () => {
      if (item !== activeToast) return;
      window.clearTimeout(toastTimer);
      activeToast = null;
      item.classList.add("is-leaving");
      window.setTimeout(() => item.remove(), 160);
    };
    close.addEventListener("click", dismiss);
    item.append(symbol, copy, close);
    region.replaceChildren(item);
    activeToast = item;
    toastTimer = window.setTimeout(dismiss, type === "error" ? 5600 : 2600);
  }

  function baseCatalogServices() {
    return [...window.QUOTE_SERVICES, ...db.customServices].filter((item) => Number(item.categoryId) !== 36);
  }

  function allServices() {
    return baseCatalogServices().map((item) => ({
      ...item,
      ...(db.catalogOverrides?.[String(item.id)] || {})
    }));
  }

  function categoryFor(id) {
    return window.QUOTE_CATEGORIES.find((category) => category.id === Number(id)) || {
      id: 0, name: "Sur mesure", short: "Sur mesure", icon: "sparkles", tone: "slate"
    };
  }

  function serviceVisual(item) {
    const category = categoryFor(item.categoryId);
    const requestedIcon = String(item.icon || "");
    return {
      icon: /^[a-z0-9-]+$/.test(requestedIcon) ? requestedIcon : category.icon || "skin-target",
      zone: String(item.zone || category.short || category.name || "Zone sur mesure")
    };
  }

  function prestationIconHref(icon) {
    const normalized = /^[a-z0-9-]+$/.test(String(icon || "")) ? String(icon) : "skin-target";
    const bodyMapId = `icon-map-${normalized}`;
    const legacyId = `icon-${normalized}`;
    if (document.getElementById(bodyMapId)) return `#${bodyMapId}`;
    if (document.getElementById(legacyId)) return `#${legacyId}`;
    return "#icon-map-skin-target";
  }

  function familyFor(id = activeFamily) {
    return window.QUOTE_FAMILIES.find((family) => family.id === id) || window.QUOTE_FAMILIES[0];
  }

  function selectableFamilies() {
    return window.QUOTE_FAMILIES.filter((family) => family.id !== "all");
  }

  function visibleFamilyIds() {
    const configured = Array.isArray(db.settings.visibleFamilies) ? db.settings.visibleFamilies.filter(Boolean) : [];
    const all = selectableFamilies().map((family) => family.id);
    if (!configured.length) return all;
    const valid = configured.filter((id) => all.includes(id));
    return valid.length ? valid : all;
  }

  function visibleFamilies() {
    const ids = new Set(visibleFamilyIds());
    return selectableFamilies().filter((family) => ids.has(family.id));
  }

  function currentCatalogMode() {
    return db.settings.catalogMode === "body" ? "body" : "tiles";
  }

  function serviceInFamily(item, family) {
    return family.id === "all" || family.categoryIds.includes(Number(item.categoryId));
  }

  function offerLabel(line) {
    if (line.offerType === "pack") return `Pack ${line.quantity} + ${line.freeQuantity} offerte${line.freeQuantity === 1 ? "" : "s"}`;
    if (line.offerType === "student") return "Tarif étudiant";
    return "Séance unique";
  }

  function quoteTariffMode() {
    if (!quote.lines.length) return null;
    return quote.lines.every((line) => line.offerType === "student") ? "student" : "standard";
  }

  function tariffGroup(mode) {
    return mode === "student" ? "student" : "standard";
  }

  function tariffLabel(mode) {
    if (mode === "student") return "tarif étudiant";
    if (mode === "pack") return "tarif Pack";
    return "tarif Séance";
  }

  function tariffChangeDetails(mode) {
    const rate = clamp(db.settings.studentDiscount, 0, 100);
    if (mode === "student") return `Le rabais étudiant de ${rate}% sera appliqué à tous les soins. Les séances offertes des packs seront retirées.`;
    if (mode === "pack") return "Le rabais étudiant sera retiré de tous les soins. Chaque ligne passera au Pack avec les quantités configurées dans les réglages.";
    return "Le rabais étudiant sera retiré de tous les soins et les prix Séance seront rétablis.";
  }

  function applyTariffToAllLines(mode) {
    const switchingFromStudent = quoteTariffMode() === "student";
    const packQuantity = Math.max(1, Math.round(Number(db.settings.packPaidDefault) || 6));
    const packFreeQuantity = Math.max(0, Math.round(Number(db.settings.packFreeDefault) || 0));
    const studentDiscount = clamp(db.settings.studentDiscount, 0, 100);
    quote.lines = quote.lines.map((line) => {
      const currentPrice = Math.max(0, Number(line.price) || 0);
      const currentBasePrice = Math.max(0, Number(line.basePrice ?? currentPrice) || 0);
      // A manually adjusted standard price becomes the base for the student rate.
      const basePrice = switchingFromStudent ? currentBasePrice : currentPrice;
      if (mode === "student") return { ...line, offerType: "student", basePrice, price: basePrice, studentDiscount, freeQuantity: 0 };
      if (mode === "pack") return { ...line, offerType: "pack", basePrice, price: basePrice, quantity: packQuantity, freeQuantity: packFreeQuantity };
      return { ...line, offerType: "single", basePrice, price: basePrice, freeQuantity: 0 };
    });
  }

  function applyOfferMode(mode) {
    const currentGroup = quoteTariffMode();
    if (quote.lines.length && currentGroup !== tariffGroup(mode)) applyTariffToAllLines(mode);
    selectedOfferMode = mode;
    const removedPercentage = enforceStudentCouponRule();
    saveLocal();
    renderCatalog();
    renderCheckout();
    if (removedPercentage) toast("Coupon en % retiré : avec Étudiant, seul un montant CHF est cumulable");
  }

  function requestOfferMode(mode) {
    const currentGroup = quoteTariffMode();
    const changesExistingTariff = quote.lines.length && currentGroup !== tariffGroup(mode);
    if (!changesExistingTariff || db.settings.skipTariffChangeConfirmation) {
      applyOfferMode(mode);
      return;
    }
    const layer = $("#tariffChangeLayer");
    layer.dataset.requestedMode = mode;
    $("#tariffChangeTitle").textContent = `Passer au ${tariffLabel(mode)} ?`;
    $("#tariffChangeMessage").textContent = tariffChangeDetails(mode);
    $("#tariffChangeSkipConfirmation").checked = false;
    openLayer("tariffChangeLayer");
  }

  function studentPricingActive() {
    return selectedOfferMode === "student" || quote.lines.some((line) => line.offerType === "student");
  }

  function enforceStudentCouponRule() {
    if (!studentPricingActive() || quote.discount.type !== "percent") return false;
    const removedPercentage = Number(quote.discount.value) > 0;
    quote.discount.type = "fixed";
    quote.discount.value = 0;
    return removedPercentage;
  }

  function offerDisplay() {
    const paid = Math.max(1, Math.round(Number(db.settings.packPaidDefault) || 6));
    const free = Math.max(0, Math.round(Number(db.settings.packFreeDefault) || 0));
    const studentDiscount = clamp(db.settings.studentDiscount, 0, 100);
    if (selectedOfferMode === "pack") return { label: `Pack ${paid} + ${free} offerte${free === 1 ? "" : "s"}` };
    if (selectedOfferMode === "student") return { label: `Étudiant −${studentDiscount}%` };
    return { label: "Séance unique" };
  }

  function renderOfferMode() {
    const currentMode = quoteTariffMode();
    if (currentMode === "student") selectedOfferMode = "student";
    if (currentMode === "standard" && selectedOfferMode === "student") selectedOfferMode = "single";
    const paid = Math.max(1, Math.round(Number(db.settings.packPaidDefault) || 6));
    const free = Math.max(0, Math.round(Number(db.settings.packFreeDefault) || 0));
    const studentDiscount = clamp(db.settings.studentDiscount, 0, 100);
    const content = {
      single: { top: "Séance unique", hint: "Séance", fullHint: "Prix par séance" },
      pack: { top: `Pack ${paid} + ${free}`, hint: `${paid} + ${free}`, fullHint: `${paid} payées + ${free} offerte${free === 1 ? "" : "s"}` },
      student: { top: `Étudiant −${studentDiscount}%`, hint: `−${studentDiscount} %`, fullHint: `Rabais de ${studentDiscount}% appliqué au total` }
    }[selectedOfferMode] || { top: "Séance unique", hint: "Séance", fullHint: "Prix par séance" };
    $$("[data-offer-mode]").forEach((button) => {
      const active = button.dataset.offerMode === selectedOfferMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
      button.tabIndex = active ? 0 : -1;
      button.title = "";
    });
    $("[data-offer-mode=\"pack\"] small").textContent = `${paid} + ${free} offerte${free === 1 ? "" : "s"}`;
    $("[data-offer-mode=\"student\"] small").textContent = `−${studentDiscount} %`;
    const activeOfferHint = $("#activeOfferHint");
    activeOfferHint.textContent = content.hint;
    activeOfferHint.title = content.fullHint;
    activeOfferHint.setAttribute("aria-label", content.fullHint);
    const currentOfferTop = $("#currentOfferTop");
    if (currentOfferTop) currentOfferTop.textContent = content.top;
  }
  function serviceMatchesSearch(item, needle = normalize(searchQuery)) {
    if (!needle) return true;
    const category = categoryFor(item.categoryId);
    return normalize(`${item.name} ${category.name} ${item.duration} ${item.price} ${item.packAveragePrice ?? ""}`).includes(needle);
  }

  function catalogPriceDisplay(item) {
    const pack = packDefaults();
    const configuredAverage = Number(item.packAveragePrice);
    const usesConfiguredPack = selectedOfferMode === "pack"
      && pack.paid === 6
      && pack.free === 1
      && Number.isFinite(configuredAverage)
      && configuredAverage > 0;
    return {
      value: usesConfiguredPack ? configuredAverage : Math.max(0, Number(item.price) || 0),
      title: usesConfiguredPack ? "Prix moyen par session du Pack 6 + 1" : "Prix d’une session"
    };
  }

  function familyServiceOption(item) {
    const display = offerDisplay();
    const added = quote.lines.some((line) => String(line.serviceId) === String(item.id) && line.offerType === selectedOfferMode);
    const durationLabel = item.duration ? ` (${item.duration} min)` : "";
    const durationText = item.duration ? `${item.duration} min` : "";
    const visual = serviceVisual(item);
    const priceDisplay = catalogPriceDisplay(item);
    return `<div class="family-option-shell" data-density-card data-density="normal" data-density-service-id="${escapeHTML(item.id)}">
      <button class="family-option ${added ? "added" : ""}" type="button" data-family-service-id="${escapeHTML(item.id)}" aria-label="Ajouter ${escapeHTML(item.name)}${escapeHTML(durationLabel)} · Zone : ${escapeHTML(visual.zone)} · ${escapeHTML(display.label)} · ${escapeHTML(money(priceDisplay.value))}">
        <span class="service-zone-icon" title="${escapeHTML(visual.zone)}" aria-hidden="true"><svg><use href="${prestationIconHref(visual.icon)}"></use></svg></span>
        <span class="family-option-copy"><strong>${escapeHTML(item.name)}</strong>${durationText ? `<small>${escapeHTML(durationText)}</small>` : ""}</span>
        <b class="family-option-price" title="${escapeHTML(priceDisplay.title)}">${money(priceDisplay.value)}</b>
        <svg class="family-option-add" aria-hidden="true"><use href="#icon-plus"></use></svg>
      </button>
      <button class="family-option-detail-toggle" type="button" data-tile-detail-toggle aria-expanded="false" aria-controls="tileDetailLayer" aria-label="Afficher le détail de ${escapeHTML(item.name)}" title="Afficher le détail" hidden>
        <svg aria-hidden="true"><use href="#icon-eye"></use></svg>
      </button>
    </div>`;
  }

  function tileTextLength(value) {
    const text = String(value || "").trim();
    if (typeof Intl.Segmenter !== "function") return Array.from(text).length;
    return [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(text)].length;
  }

  function tileDensityPercentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((sorted.length - 1) * ratio)))];
  }

  function tileDensityMetric(shell) {
    const item = allServices().find((service) => String(service.id) === shell.dataset.densityServiceId);
    const title = $(".family-option-copy strong", shell);
    const titleLength = tileTextLength(item?.name || title?.textContent);
    const usableWidth = Math.max(120, title?.clientWidth || shell.clientWidth - 86 || 220);
    const widthPressure = clamp(260 / usableWidth, 0.9, 1.8);
    const score = titleLength * widthPressure + (item?.duration ? 6 : 0) + (db.settings.showFamilyPrices ? 9 : 0);
    const titleStyle = title ? window.getComputedStyle(title) : null;
    const lineHeight = Math.max(1, Number.parseFloat(titleStyle?.lineHeight) || Number.parseFloat(titleStyle?.fontSize) * 1.2 || 16);
    const naturalLines = title ? Math.max(1, Math.round(title.scrollHeight / lineHeight)) : 1;
    const clipped = naturalLines > 2 || Boolean(title && title.scrollHeight > title.clientHeight + 1);
    return { shell, score, titleLength, clipped };
  }

  function analyzeTileDensity() {
    $$(".family-options", $("#familyList")).forEach((group) => {
      const metrics = $$("[data-density-card]", group).map(tileDensityMetric);
      const groupThreshold = clamp(tileDensityPercentile(metrics.map((metric) => metric.score), 0.72) + 10, 64, 88);
      metrics.forEach((metric) => {
        const compact = metric.clipped
          || metric.score >= 88
          || (metric.titleLength >= 38 && metric.score >= groupThreshold);
        metric.shell.dataset.density = compact ? "compact" : "normal";
        metric.shell.dataset.densityLevel = compact && (metric.score >= 108 || metric.titleLength >= 72) ? "high" : compact ? "medium" : "low";
        const toggle = $("[data-tile-detail-toggle]", metric.shell);
        if (toggle) {
          toggle.hidden = !compact;
          toggle.tabIndex = compact ? 0 : -1;
          toggle.setAttribute("aria-expanded", String(compact && tileDetailServiceId === metric.shell.dataset.densityServiceId));
        }
      });
    });
    if (tileDetailServiceId) {
      const activeShell = $(`[data-density-service-id="${CSS.escape(tileDetailServiceId)}"]`);
      if (!activeShell || activeShell.dataset.density !== "compact") closeTileDetail({ immediate: true });
    }
  }

  function scheduleTileDensityAnalysis() {
    window.cancelAnimationFrame(tileDensityResizeFrame);
    tileDensityResizeFrame = window.requestAnimationFrame(() => {
      analyzeTileDensity();
      tileDensityResizeFrame = 0;
    });
  }

  function isCoarseTileInterface() {
    return window.matchMedia("(hover: none), (pointer: coarse)").matches || window.innerWidth <= 760;
  }

  function clearTileDetailTimers() {
    window.clearTimeout(tileDetailOpenTimer);
    window.clearTimeout(tileDetailCloseTimer);
    window.clearTimeout(tileDetailHideTimer);
    tileDetailOpenTimer = 0;
    tileDetailCloseTimer = 0;
    tileDetailHideTimer = 0;
  }

  function positionTileDetail(shell) {
    const card = $("#tileDetailCard");
    if (!card) return;
    card.style.removeProperty("left");
    card.style.removeProperty("right");
    card.style.removeProperty("top");
    card.style.removeProperty("bottom");
    card.style.removeProperty("width");
    if (isCoarseTileInterface()) return;
    const shellRect = shell.getBoundingClientRect();
    const checkoutRect = $("#checkoutPanel")?.getBoundingClientRect();
    const rightBoundary = checkoutRect?.width ? checkoutRect.left : window.innerWidth;
    const width = Math.min(410, Math.max(330, shellRect.width + 70), Math.max(280, rightBoundary - 24));
    let left = shellRect.right + 10;
    if (left + width > rightBoundary - 12) left = shellRect.left - width - 10;
    if (left < 12) left = clamp(shellRect.left, 12, Math.max(12, rightBoundary - width - 12));
    card.style.width = `${width}px`;
    card.style.left = `${left}px`;
    const height = card.getBoundingClientRect().height;
    const overlapsShellHorizontally = left < shellRect.right && left + width > shellRect.left;
    let top = shellRect.top;
    if (overlapsShellHorizontally) {
      top = shellRect.bottom + 10;
      if (top + height > window.innerHeight - 12) top = shellRect.top - height - 10;
    }
    card.style.top = `${clamp(top, 12, Math.max(12, window.innerHeight - height - 12))}px`;
  }

  function closeTileDetail({ immediate = false, restoreFocus = false } = {}) {
    clearTileDetailTimers();
    const layer = $("#tileDetailLayer");
    const returnFocus = tileDetailReturnFocus;
    $$("[data-density-card][data-detail-open]").forEach((shell) => shell.removeAttribute("data-detail-open"));
    $$("[data-tile-detail-toggle][aria-expanded='true']").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    tileDetailServiceId = "";
    tileDetailPinned = false;
    tileDetailReturnFocus = null;
    if (layer) {
      layer.classList.remove("is-open", "is-pinned");
      layer.removeAttribute("data-service-id");
      if (immediate) layer.hidden = true;
      else tileDetailHideTimer = window.setTimeout(() => { layer.hidden = true; tileDetailHideTimer = 0; }, 160);
    }
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function openTileDetail(shell, { pinned = false, focusCard = false } = {}) {
    if (!shell || shell.dataset.density !== "compact") return;
    const item = allServices().find((service) => String(service.id) === shell.dataset.densityServiceId);
    const layer = $("#tileDetailLayer");
    const card = $("#tileDetailCard");
    if (!item || !layer || !card) return;
    clearTileDetailTimers();
    $$("[data-density-card][data-detail-open]").forEach((openShell) => openShell.removeAttribute("data-detail-open"));
    $$("[data-tile-detail-toggle][aria-expanded='true']").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    const visual = serviceVisual(item);
    const priceDisplay = catalogPriceDisplay(item);
    const display = offerDisplay();
    const added = quote.lines.some((line) => String(line.serviceId) === String(item.id) && line.offerType === selectedOfferMode);
    tileDetailServiceId = String(item.id);
    tileDetailPinned = pinned;
    tileDetailReturnFocus = $("[data-tile-detail-toggle]", shell) || $("[data-family-service-id]", shell);
    shell.dataset.detailOpen = "true";
    $("[data-tile-detail-toggle]", shell)?.setAttribute("aria-expanded", "true");
    card.innerHTML = `<button class="tile-detail-close" type="button" data-tile-detail-close aria-label="Fermer le détail" title="Fermer"><svg aria-hidden="true"><use href="#icon-x"></use></svg></button>
      <div class="tile-detail-heading">
        <span class="tile-detail-icon service-zone-icon" aria-hidden="true"><svg><use href="${prestationIconHref(visual.icon)}"></use></svg></span>
        <div><small>Détail</small><h3 id="tileDetailTitle">${escapeHTML(item.name)}</h3><p>${escapeHTML(visual.zone)}</p></div>
      </div>
      <dl class="tile-detail-meta">
        ${item.duration ? `<div><dt>Durée</dt><dd>${escapeHTML(item.duration)} min</dd></div>` : ""}
        <div><dt>Tarif</dt><dd>${escapeHTML(display.label)}</dd></div>
        <div><dt>Prix</dt><dd title="${escapeHTML(priceDisplay.title)}">${money(priceDisplay.value)}</dd></div>
      </dl>
      <button class="tile-detail-add" type="button" data-tile-detail-add="${escapeHTML(item.id)}" aria-label="${added ? "Ajouter encore au devis" : "Ajouter au devis"}"><svg aria-hidden="true"><use href="#icon-plus"></use></svg>${added ? "Encore" : "Ajouter"}</button>`;
    layer.dataset.serviceId = String(item.id);
    layer.hidden = false;
    layer.classList.toggle("is-pinned", pinned);
    void layer.offsetWidth;
    layer.classList.add("is-open");
    positionTileDetail(shell);
    if (focusCard) $("[data-tile-detail-close]", card)?.focus();
  }

  function scheduleTileDetailOpenFromEye(toggle) {
    const shell = toggle?.closest("[data-density-card][data-density='compact']");
    if (!shell) return;
    window.clearTimeout(tileDetailCloseTimer);
    window.clearTimeout(tileDetailOpenTimer);
    tileDetailOpenTimer = window.setTimeout(() => {
      openTileDetail(shell);
      tileDetailOpenTimer = 0;
    }, 130);
  }

  function scheduleTileDetailClose() {
    window.clearTimeout(tileDetailOpenTimer);
    window.clearTimeout(tileDetailCloseTimer);
    if (tileDetailPinned) return;
    tileDetailCloseTimer = window.setTimeout(() => {
      closeTileDetail();
      tileDetailCloseTimer = 0;
    }, 110);
  }

  function renderFamilies() {
    const services = allServices();
    const needle = normalize(searchQuery);
    const families = visibleFamilies();
    const groups = families.map((family) => {
      const familyServices = services.filter((item) => serviceInFamily(item, family));
      const visibleServices = familyServices.filter((item) => serviceMatchesSearch(item, needle));
      if (needle && !visibleServices.length) return "";
      const isActive = activeFamily === family.id;
      const isOpen = needle ? visibleServices.length > 0 : isActive && expandedFamily === family.id;
      const options = isOpen ? `<div class="family-options" role="group" aria-label="Soins ${escapeHTML(family.name)}">${visibleServices.map(familyServiceOption).join("")}</div>` : "";
      const countLabel = needle ? plural(visibleServices.length, "résultat") : plural(familyServices.length, "soin");
      return `<div class="family-group ${isOpen ? "open" : ""}">
        <button class="family-button ${isActive ? "active" : ""}" type="button" data-family="${family.id}" aria-expanded="${isOpen}">
          <span class="family-button-icon"><svg><use href="${prestationIconHref(family.icon)}"></use></svg></span>
          <span><strong>${escapeHTML(family.name)}</strong><small>${countLabel}</small></span>
          <svg class="family-arrow"><use href="#icon-chevron"></use></svg>
        </button>
        ${options}
      </div>`;
    }).join("");
    $("#familyList").innerHTML = groups || `<div class="family-no-results"><svg><use href="#icon-search"></use></svg><strong>Aucun soin trouvé</strong><small>Essayez un autre terme.</small></div>`;
    $("#customCategorySelect").innerHTML = window.QUOTE_CATEGORIES.filter((category) => category.id !== 36).map((category) => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("");
    renderFamilyPriceToggle();
  }

  const BODY_FAMILY_IDS = new Set(["visage", "bras", "torse", "dos", "maillot", "jambes"]);
  const BODY_AUXILIARY_FAMILY_IDS = ["electrolyse", "medecine", "combinees", "consultations"];
  const BODY_DEFAULT_REGION_IDS = { front: "front-visage", back: "back-dos" };
  const BODY_REGION_DEFINITIONS = new Map(window.QUOTE_BODY_REGIONS.map((region) => [region.id, region]));
  const FACE_REGION_DEFINITIONS = new Map([
    { id: "face-full", title: "Visage complet", description: "Ensemble du visage.", serviceIds: [29] },
    { id: "face-temples", title: "Tempes", description: "Tempes gauche et droite.", serviceIds: [23] },
    { id: "face-brows", title: "Sourcils", description: "Contour des deux sourcils.", serviceIds: [21] },
    { id: "face-glabella", title: "Entre-sourcils", description: "Zone située entre les sourcils.", serviceIds: [22] },
    { id: "face-nose", title: "Nez & narines", description: "Nez et contour des narines.", serviceIds: [25] },
    { id: "face-cheeks", title: "Joues", description: "Joues gauche et droite.", serviceIds: [26] },
    { id: "face-upper-lip", title: "Lèvre supérieure", description: "Zone située au-dessus de la lèvre supérieure.", serviceIds: [19] },
    { id: "face-beard", title: "Barbe", description: "Bas du visage et zone de barbe.", serviceIds: [27] },
    { id: "face-beard-line", title: "Ligne de barbe", description: "Contour supérieur et latéral de la barbe.", serviceIds: [28] },
    { id: "face-chin", title: "Menton", description: "Zone centrale du menton.", serviceIds: [20] },
    { id: "face-ears", title: "Oreilles", description: "Oreilles gauche et droite.", serviceIds: [24] },
    { id: "face-neck", title: "Cou", description: "Face antérieure et côtés du cou.", serviceIds: [30] }
  ].map((region) => [region.id, region]));

  function bodyRegionsForSide(side) {
    return window.QUOTE_BODY_REGIONS.filter((region) => region.side === side);
  }

  function bodyRegionDefinition(regionId = activeBodyRegion) {
    return BODY_REGION_DEFINITIONS.get(regionId) || null;
  }

  function firstVisibleBodyRegion(side, visibleIds, familyId = "") {
    const regions = bodyRegionsForSide(side).filter((region) => visibleIds.has(region.familyId));
    return regions.find((region) => region.familyId === familyId)
      || regions.find((region) => region.id === BODY_DEFAULT_REGION_IDS[side])
      || regions[0]
      || null;
  }

  function selectBodyRegion(regionId) {
    const region = bodyRegionDefinition(regionId);
    if (!region) return null;
    activeBodyRegion = region.id;
    activeFamily = region.familyId;
    expandedFamily = region.familyId;
    return region;
  }

  function servicesForBodyRegion(region, family) {
    const included = Array.isArray(region?.includeServiceIds) ? new Set(region.includeServiceIds.map(Number)) : null;
    const excluded = new Set(Array.isArray(region?.excludeServiceIds) ? region.excludeServiceIds.map(Number) : []);
    return allServices().filter((item) => {
      if (!family || !serviceInFamily(item, family)) return false;
      const serviceId = Number(item.id);
      if (included && !included.has(serviceId)) return false;
      return !excluded.has(serviceId);
    });
  }

  function bodyRegionMarkup(regionId, shapes, visibleIds) {
    const region = bodyRegionDefinition(regionId);
    if (!region) return "";
    const enabled = visibleIds.has(region.familyId);
    const active = activeBodyRegion === region.id && activeFamily === region.familyId;
    const label = escapeHTML(region.title);
    return `<g class="body-region${active ? " active" : ""}${enabled ? "" : " disabled"}" ${enabled ? `data-body-region="${region.id}" data-body-family="${region.familyId}" role="button" tabindex="0" aria-label="${label}" aria-pressed="${active}"` : 'aria-hidden="true"'}><title>${label}</title>${shapes}</g>`;
  }

  function bodyAnatomyPaths(paths) {
    return (paths || []).map((path) => `<path class="body-region-shape body-anatomy-segment" d="${path}"/>`).join("");
  }

  function anonymousBodyHeadMarkup(side, headGeometry) {
    const cx = headGeometry.cx;
    const headMarkup = `<path class="body-region-shape body-anonymous-head" d="M${cx} 140C${cx - 27} 140 ${cx - 43} 158 ${cx - 43} 185L${cx - 42} 210C${cx - 40} 239 ${cx - 23} 260 ${cx} 269C${cx + 23} 260 ${cx + 40} 239 ${cx + 42} 210L${cx + 43} 185C${cx + 43} 158 ${cx + 27} 140 ${cx} 140Z"/>`;
    const ears = `<path class="body-region-shape body-anonymous-ear" d="M${cx - 42} 184C${cx - 53} 183 ${cx - 55} 198 ${cx - 50} 215C${cx - 48} 222 ${cx - 44} 225 ${cx - 39} 220M${cx + 42} 184C${cx + 53} 183 ${cx + 55} 198 ${cx + 50} 215C${cx + 48} 222 ${cx + 44} 225 ${cx + 39} 220"/>`;
    if (side === "back") {
      const backDetails = `<path class="body-region-detail body-head-landmarks" d="M${cx - 28} 236Q${cx} 250 ${cx + 28} 236M${cx} 247v18"/>`;
      return `${headMarkup}${ears}${backDetails}`;
    }
    const neck = `<path class="body-region-shape body-anonymous-neck" d="M${cx - 26} 250C${cx - 24} 270 ${cx - 29} 285 ${cx - 39} 297Q${cx} 323 ${cx + 39} 297C${cx + 29} 285 ${cx + 24} 270 ${cx + 26} 250C${cx + 18} 262 ${cx + 9} 268 ${cx} 269C${cx - 9} 268 ${cx - 18} 262 ${cx - 26} 250Z"/>`;
    const faceDetails = `<path class="body-region-detail body-face-landmarks" d="M${cx - 28} 187Q${cx - 18} 181 ${cx - 8} 187M${cx + 8} 187Q${cx + 18} 181 ${cx + 28} 187M${cx - 27} 196Q${cx - 18} 189 ${cx - 9} 196Q${cx - 18} 202 ${cx - 27} 196M${cx + 9} 196Q${cx + 18} 189 ${cx + 27} 196Q${cx + 18} 202 ${cx + 9} 196M${cx} 194Q${cx - 5} 208 ${cx} 215M${cx - 15} 233Q${cx} 235 ${cx + 15} 233"/><circle class="body-region-detail-fill body-face-pupil" cx="${cx - 18}" cy="196" r="2.4"/><circle class="body-region-detail-fill body-face-pupil" cx="${cx + 18}" cy="196" r="2.4"/>`;
    return `${headMarkup}${ears}${neck}${faceDetails}`;
  }

  function bodyModelGeometry(side) {
    const geometry = window.BCDEVIS_BODY_ANATOMY?.[activeBodyModel]?.[side];
    if (!geometry) throw new Error(`Géométrie corporelle indisponible : ${activeBodyModel}/${side}`);
    const { cx, cy } = geometry.focus[side === "front" ? "maillot" : "sif"];
    const focus = side === "front"
      ? `<ellipse class="body-region-hitarea" cx="${cx}" cy="${cy}" rx="74" ry="70"/><path class="body-region-focus body-region-maillot" d="M${cx - 68} ${cy - 40}Q${cx} ${cy - 4} ${cx + 68} ${cy - 40}L${cx + 48} ${cy + 30}Q${cx} ${cy + 54} ${cx - 48} ${cy + 30}Z"/>`
      : `<ellipse class="body-region-hitarea" cx="${cx}" cy="${cy}" rx="48" ry="70"/><path class="body-region-focus body-region-sif" d="M${cx} ${cy - 38}v76"/><ellipse class="body-region-target" cx="${cx}" cy="${cy}" rx="13" ry="27"/>`;
    return { ...geometry, focusMarkup: focus };
  }

  function setBodyModel(model, focusSelector) {
    if (!["female", "male"].includes(model) || model === activeBodyModel) return;
    activeBodyModel = model;
    renderCatalog();
    window.setTimeout(() => $(focusSelector)?.focus(), 0);
  }

  function bodyMapMarkup(side, visibleIds) {
    const region = (regionId, shapes) => bodyRegionMarkup(regionId, shapes, visibleIds);
    const geometry = bodyModelGeometry(side);
    const [viewX, viewY, viewWidth, viewHeight] = geometry.viewBox.split(" ").map(Number);
    const headCx = geometry.head.cx;
    const headMaskId = `body-head-mask-${side}`;
    const headMask = `<defs><mask id="${headMaskId}" maskUnits="userSpaceOnUse"><rect x="${viewX}" y="${viewY}" width="${viewWidth}" height="${viewHeight}" fill="#fff"/><rect x="${headCx - 80}" y="130" width="160" height="145" rx="36" fill="#000"/></mask></defs>`;
    const outline = `<path class="body-anatomy-outline" d="${geometry.outline}" mask="url(#${headMaskId})"/>`;
    const modelLabel = activeBodyModel === "female" ? "féminin" : "masculin";
    if (side === "back") {
      return `<svg class="interactive-body-map body-model-${activeBodyModel}" data-body-model="${activeBodyModel}" data-anatomy-source="react-native-body-highlighter" viewBox="${geometry.viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="bodyMapBackTitle bodyMapBackDescription">
        <title id="bodyMapBackTitle">Mannequin ${modelLabel} vu de dos</title>
        <desc id="bodyMapBackDescription">Silhouette anatomique ${modelLabel} et anonyme vue de dos. Choisissez une zone du corps pour afficher les soins correspondants.</desc>
        ${headMask}
        <g class="body-figure">${outline}
          ${region("back-scalp", anonymousBodyHeadMarkup("back", geometry.head))}
          ${region("back-dos", bodyAnatomyPaths(geometry.regions.dos))}
          ${region("back-bras", bodyAnatomyPaths(geometry.regions.bras))}
          ${region("back-jambes", bodyAnatomyPaths(geometry.regions.jambes))}
          ${region("back-sif", geometry.focusMarkup)}
        </g>
      </svg>`;
    }
    return `<svg class="interactive-body-map body-model-${activeBodyModel}" data-body-model="${activeBodyModel}" data-anatomy-source="react-native-body-highlighter" viewBox="${geometry.viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="bodyMapFrontTitle bodyMapFrontDescription">
      <title id="bodyMapFrontTitle">Mannequin ${modelLabel} vu de face</title>
      <desc id="bodyMapFrontDescription">Silhouette anatomique ${modelLabel} et anonyme vue de face, sans traits identifiables. Choisissez une zone du corps pour afficher les soins correspondants.</desc>
      ${headMask}
      <g class="body-figure">${outline}
        ${region("front-visage", anonymousBodyHeadMarkup("front", geometry.head))}
        ${region("front-torse", bodyAnatomyPaths(geometry.regions.torse))}
        ${region("front-bras", bodyAnatomyPaths(geometry.regions.bras))}
        ${region("front-maillot", `${bodyAnatomyPaths(geometry.regions.maillot)}${geometry.focusMarkup}`)}
        ${region("front-jambes", bodyAnatomyPaths(geometry.regions.jambes))}
      </g>
    </svg>`;
  }

  function faceRegionDefinition(regionId = activeFaceRegion) {
    return FACE_REGION_DEFINITIONS.get(regionId) || null;
  }

  function servicesForFaceRegion(region) {
    const serviceIds = new Set((region?.serviceIds || []).map(Number));
    return allServices().filter((service) => serviceIds.has(Number(service.id)));
  }

  function faceRegionMarkup(regionId, shapes) {
    const region = faceRegionDefinition(regionId);
    if (!region) return "";
    const active = activeFaceRegion === region.id;
    const label = escapeHTML(region.title);
    return `<g class="face-region${active ? " active" : ""}" data-face-region="${region.id}" role="button" tabindex="0" aria-label="${label}" aria-pressed="${active}"><title>${label}</title>${shapes}</g>`;
  }

  function faceMapMarkup() {
    const region = faceRegionMarkup;
    const shape = (path, className = "") => `<path class="face-region-shape${className ? ` ${className}` : ""}" d="${path}"/>`;
    const outline = "M514.056 652.765c-28.412 0-67.844-16.379-92.111-32.558-13.708-9.139-45.81-30.541-62.448-65.169-5.675-11.81-15.35-47.194-18.09-85.63-.29-4.069-.495-8.08-.607-11.922-.274-9.376-3.123-19.927-6.422-32.144-3.444-12.755-7.348-27.213-9.387-44.124-.969-8.038-1.765-16.48-2.432-25.808-1.542-21.57-1.957-42.199-2.29-58.774-.19-9.457-.354-17.623-.692-23.372-3.423-58.177 14.383-106.018 54.436-146.256 36.168-36.335 84.873-56.346 137.143-56.346 43.758 0 85.271 14.057 120.05 40.652 38.865 29.72 81.522 90.577 73.834 164.28-1.931 18.5-1.99 36.226-2.048 53.369-.025 7.847-.051 15.258-.248 22.647-.271 10.174-.824 18.381-1.739 25.829-1.09 8.863-4.618 22.422-8.355 36.778-3.633 13.96-7.39 28.396-9.105 39.386-.664 4.26-1.181 9.035-1.625 15.027-.284 3.852-.506 7.722-.74 11.819-1.312 22.953-2.8 48.969-16.56 75.994-18.783 36.888-49.904 58.926-66.624 70.766-24.674 17.465-51.346 25.586-83.99 25.586Z";
    const leftBrow = "M371 354c24-17 58-19 86-7 8 4 9 10 2 14-28-8-54-6-78 5-8 0-13-5-10-12Z";
    const rightBrow = "M653 354c-24-17-58-19-86-7-8 4-9 10-2 14 28-8 54-6 78 5 8 0 13-5 10-12Z";
    const nose = "M514.056 490.604c-4.832 0-6.798-1.266-8.88-2.607-1.683-1.084-3.424-2.204-6.67-2.593-1.265-.151-2.431-.273-3.524-.387-6.463-.673-10.364-1.079-17.179-6.053-18.687-13.636-2.639-41.618 3.402-52.152 7.061-12.311 12.616-35.182 13.49-46.159.088-1.103.169-2.442.26-3.96.805-13.329 2.481-41.064 17.351-41.064 16.174 0 16.758 26.771 17.038 39.637l.03 1.36c.13 5.488 1.449 33.789 14.708 52.02 9.169 12.609 13.909 19.98 12.939 36.982-.521 9.123-8.172 18.369-21.786 18.392-5.01.008-7.9 1.698-10.696 3.333-2.857 1.672-5.558 3.251-10.483 3.251Z";
    const upperLip = "M517.8 562.713c-23.091 0-46.144-4.977-53.186-9.625-6.114-4.035-12.474-6.153-18.084-8.022-7.564-2.52-13.028-4.339-12.946-9.437.031-1.99 5.54-4.238 12.514-7.084 6.607-2.696 14.831-6.052 22.75-10.832 9.405-5.676 17.952-8.554 25.402-8.554 3.461 0 6.686.636 9.585 1.89 3.196 1.382 7.283 2.175 11.213 2.175 2.677 0 4.979-.383 6.315-1.05 1.432-.714 6.615-3.044 13.207-3.044 4.723 0 8.954 1.192 12.578 3.545 12.461 8.084 23.856 12.158 32.178 15.134 8.441 3.018 13.537 4.841 13.421 8.396-.076 2.353-6.081 5.345-13.683 9.132-3.431 1.709-7.317 3.646-11.284 5.833-7.819 4.311-24.712 11.543-49.98 11.543Z";
    const leftEar = "M327.71 476.145c-6.098-.001-11.23-3.516-13.074-8.954-2.574-7.593-7.644-19.347-10.26-24.899-7.952-16.881-14.059-37.302-18.152-60.694-4.024-23 .868-43.01 11.38-46.544 1.578-.531 3.091-.8 4.497-.8 7.423 0 11.507 7.412 15.457 14.58 1.343 2.438 2.612 4.742 4.013 6.784.666 9.292 1.46 17.706 2.426 25.721 2.048 16.982 5.962 31.477 9.415 44.265 3.282 12.156 6.117 22.654 6.388 31.912.112 3.801.313 7.768.598 11.792-2.936 4.348-7.55 6.838-12.688 6.837Z";
    const rightEar = "M696.681 476.502c-4.153 0-8.778-2.696-13.748-8.016.439-5.862.947-10.548 1.6-14.729 1.708-10.941 5.458-25.353 9.085-39.288 3.744-14.389 7.281-27.979 8.379-36.908.908-7.387 1.461-15.511 1.736-25.542 3.563-.971 5.176-4.579 6.881-8.392 2.309-5.163 4.696-10.503 12.129-10.548 3.175 0 6.085 1.632 8.475 4.72 7.001 9.047 8.563 28.2 3.799 46.576-1.434 5.53-2.263 10.367-3.141 15.489-2.032 11.848-4.133 24.099-14.073 46.438-.883 1.984-1.873 4.477-2.922 7.115-1.983 4.99-4.232 10.647-6.26 14.074-3.536 5.979-7.554 9.011-11.94 9.011Z";
    const leftCheek = "M367 417c20-16 52-18 79-5 12 26 10 62-4 91-11 23-30 39-47 33-19-7-32-28-37-56-5-27-2-50 9-63Z";
    const rightCheek = "M657 417c-20-16-52-18-79-5-12 26-10 62 4 91 11 23 30 39 47 33 19-7 32-28 37-56 5-27 2-50-9-63Z";
    const chin = "M515.387 644.44c-20.101 0-34.128-7.148-42.355-13.144-9.333-6.802-15.8-15.651-16.476-22.546-.784-7.991.757-14.181 4.579-18.396 4.63-5.107 12.754-7.589 24.835-7.589 6.615 0 13.548.715 19.664 1.347 4.604.475 8.954.924 12.413.983.562.01 1.123.014 1.685.014 7.036 0 14.084-.715 20.899-1.406 6.177-.626 12.011-1.218 17.289-1.218 12.363 0 23.804 2.835 23.804 23.4.001 23.062-34.3 38.555-66.337 38.555Z";
    const neck = "M512.406 771.61c-35.609-.003-70.226-8.836-100.107-25.543-31.472-17.597-56.233-43.341-71.633-74.471 8.085-5.842 14.546-11.482 19.21-16.766l.12-.137.005-.182c.127-4.836.254-9.316.374-13.546.802-28.232 1.293-45.506-.699-83.309 17.027 33.589 48.228 54.389 61.714 63.38 24.393 16.263 64.055 32.727 92.666 32.727 32.861 0 59.718-8.179 84.518-25.739 16.449-11.648 46.781-33.127 65.773-68.89-2.146 24.711-4.435 60.412-1.344 94.409l.01.108.054.095c2.816 4.929 9.55 11.089 20.015 18.313-16.669 31.791-41.94 57.704-73.103 74.954-29.067 16.091-62.801 24.596-97.554 24.596Z";
    const temples = "M350 284c-16 23-21 61-12 102 9 13 22 11 31-3 8-30 9-64 0-90-6-8-13-12-19-9Zm324 0c16 23 21 61 12 102-9 13-22 11-31-3-8-30-9-64 0-90 6-8 13-12 19-9Z";
    const glabella = "M490 346c7-6 15-9 22-9s15 3 22 9l-4 43c-6 8-12 12-18 12s-12-4-18-12l-4-43Z";
    const lowerFace = "M369 505c14 65 54 122 145 148 91-26 131-83 145-148-25 36-74 63-145 63s-120-27-145-63Z";
    const eyeLandmarks = "M378 382Q417 360 456 382Q417 401 378 382ZM646 382Q607 360 568 382Q607 401 646 382Z";
    const facialLandmarks = "M512 352C507 387 506 418 510 447M488 478Q512 493 536 478M492 525Q512 517 532 525M466 548Q512 570 558 548M482 611Q512 623 542 611";
    return `<svg class="interactive-face-map face-model-${activeBodyModel}" data-body-model="${activeBodyModel}" data-anatomy-source="user-reference" viewBox="260 45 505 740" preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby="faceMapTitle faceMapDescription">
      <title id="faceMapTitle">Détail du visage neutre</title>
      <desc id="faceMapDescription">Schéma médical neutre et anonyme, sans cheveux ni identité reconnaissable. Choisissez une zone anatomique pour filtrer le soin correspondant.</desc>
      <g class="face-figure">
        <path class="face-anatomy-base face-anatomy-neck-base" d="${neck}"/>
        <path class="face-anatomy-base" d="${outline}"/>
        ${region("face-neck", shape(neck, "face-region-soft"))}
        ${region("face-full", shape(outline, "face-region-base"))}
        ${region("face-beard", shape(lowerFace, "face-region-soft"))}
        ${region("face-temples", shape(temples))}
        ${region("face-ears", `${shape(leftEar)}${shape(rightEar)}`)}
        ${region("face-brows", `${shape(leftBrow)}${shape(rightBrow)}`)}
        ${region("face-glabella", shape(glabella))}
        ${region("face-cheeks", `${shape(leftCheek)}${shape(rightCheek)}`)}
        ${region("face-nose", shape(nose))}
        ${region("face-upper-lip", shape(upperLip))}
        ${region("face-beard-line", '<path class="face-region-hitarea" d="M369 505c14 65 54 122 95 135m195-135c-14 65-54 122-95 135"/><path class="face-region-stroke" d="M369 505c14 65 54 122 95 135m195-135c-14 65-54 122-95 135"/>')}
        ${region("face-chin", shape(chin))}
        <path class="face-anatomy-landmark face-eye-landmark" d="${eyeLandmarks}"/>
        <circle class="face-anatomy-pupil" cx="417" cy="382" r="5"/>
        <circle class="face-anatomy-pupil" cx="607" cy="382" r="5"/>
        <path class="face-anatomy-landmark face-feature-landmark" d="${facialLandmarks}"/>
      </g>
    </svg>`;
  }

  function renderBodySelector() {
    const visible = visibleFamilies();
    const visibleIds = new Set(visible.map((family) => family.id));
    let selectedRegion = bodyRegionDefinition();
    const regionMatchesContext = selectedRegion
      && selectedRegion.side === activeBodySide
      && selectedRegion.familyId === activeFamily
      && visibleIds.has(selectedRegion.familyId);
    if (!regionMatchesContext) {
      selectedRegion = BODY_FAMILY_IDS.has(activeFamily)
        ? firstVisibleBodyRegion(activeBodySide, visibleIds, activeFamily)
        : null;
      if (selectedRegion) selectBodyRegion(selectedRegion.id);
      else activeBodyRegion = null;
    }
    let selectedFamily = visible.find((family) => family.id === activeFamily);
    if (!selectedFamily) {
      selectedRegion = firstVisibleBodyRegion(activeBodySide, visibleIds);
      if (selectedRegion) {
        selectBodyRegion(selectedRegion.id);
        selectedFamily = visible.find((family) => family.id === selectedRegion.familyId);
      } else {
        selectedFamily = visible[0];
        activeFamily = selectedFamily?.id || "visage";
        expandedFamily = activeFamily;
        activeBodyRegion = null;
      }
    }
    const faceDetailActive = activeBodyDetail === "face"
      && activeBodySide === "front"
      && activeBodyRegion === "front-visage"
      && activeFamily === "visage";
    if (!faceDetailActive) {
      activeBodyDetail = "body";
      activeFaceRegion = "";
    }
    const selectedFaceRegion = faceDetailActive ? faceRegionDefinition() : null;
    const needle = normalize(searchQuery);
    const visibleCategoryIds = new Set(visible.flatMap((family) => family.categoryIds.map(Number)));
    const services = needle
      ? allServices().filter((item) => visibleCategoryIds.has(Number(item.categoryId)) && serviceMatchesSearch(item, needle))
      : selectedFaceRegion
        ? servicesForFaceRegion(selectedFaceRegion)
      : selectedRegion
        ? servicesForBodyRegion(selectedRegion, selectedFamily)
        : allServices().filter((item) => selectedFamily && serviceInFamily(item, selectedFamily));
    const resultTitle = needle ? "Résultats" : selectedFaceRegion?.title || selectedRegion?.title || selectedFamily?.name || "Soins";
    const mapMarkup = faceDetailActive ? faceMapMarkup() : bodyMapMarkup(activeBodySide, visibleIds);
    const modelToggle = `<div class="body-model-toggle" role="group" aria-label="Morphologie du corps"><button type="button" data-body-model-choice="female" aria-pressed="${activeBodyModel === "female"}">Femme</button><button type="button" data-body-model-choice="male" aria-pressed="${activeBodyModel === "male"}">Homme</button></div>`;
    const mapHint = faceDetailActive
      ? '<p class="body-map-hint"><svg aria-hidden="true"><use href="#icon-body"></use></svg>Sélectionnez une zone précise du visage ou revenez au corps complet.</p>'
      : "";
    const options = services.length
      ? `<div class="family-options body-service-options" role="group" aria-label="Soins ${escapeHTML(resultTitle)}">${services.map(familyServiceOption).join("")}</div>`
      : `<div class="body-results-empty"><svg aria-hidden="true"><use href="#icon-search"></use></svg><strong>Aucun soin dans cette zone</strong><small>${needle ? "Essayez un autre terme." : "Cette famille est vide ou masquée dans les réglages."}</small></div>`;
    const auxiliary = BODY_AUXILIARY_FAMILY_IDS.map((id) => visible.find((family) => family.id === id)).filter(Boolean);
    $("#familyList").innerHTML = `<div class="body-selector" data-body-side="${activeBodySide}" data-body-model="${activeBodyModel}">
      <div class="body-selector-layout">
        <section class="body-map-card" aria-label="Sélecteur des zones corporelles">
          <div class="body-map-card-head">
            ${faceDetailActive ? '<button class="body-detail-back" type="button" data-body-detail="body"><span aria-hidden="true">←</span> Corps complet</button>' : modelToggle}
            <div class="body-map-head-actions">
              <div class="body-map-controls"><div class="body-side-toggle" role="group" aria-label="Orientation du corps"><button type="button" data-body-side="front" aria-pressed="${activeBodySide === "front"}">Face</button><button type="button" data-body-side="back" aria-pressed="${activeBodySide === "back"}">Dos</button></div></div>
            </div>
          </div>
          <div class="body-map-stage${faceDetailActive ? " face-detail-active" : ""}">${mapMarkup}</div>
          ${mapHint}
        </section>
        <section class="body-results" aria-live="polite" aria-label="Soins : ${escapeHTML(resultTitle)}" data-body-results-title="${escapeHTML(resultTitle)}">${options}</section>
      </div>
      ${auxiliary.length ? `<div class="body-auxiliary"><div>${auxiliary.map((family) => `<button type="button" data-body-family="${family.id}" class="${!activeBodyRegion && activeFamily === family.id ? "active" : ""}"><svg aria-hidden="true"><use href="${prestationIconHref(family.icon)}"></use></svg><strong>${escapeHTML(family.name)}</strong><small>${plural(allServices().filter((item) => serviceInFamily(item, family)).length, "soin")}</small></button>`).join("")}</div></div>` : ""}
      <p class="body-selector-credit">Silhouette interactive adaptée du principe de <a href="https://github.com/HichamELBSI/react-native-body-highlighter" target="_blank" rel="noreferrer">react-native-body-highlighter</a> (MIT).</p>
    </div>`;
    $("#customCategorySelect").innerHTML = window.QUOTE_CATEGORIES.filter((category) => category.id !== 36).map((category) => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("");
    renderFamilyPriceToggle();
  }

  function renderFamilyPriceToggle() {
    const visible = Boolean(db.settings.showFamilyPrices);
    const panel = $("#familyPanel");
    const button = $("#familyPriceToggle");
    if (!panel || !button) return;
    panel.classList.toggle("show-family-prices", visible);
    button.classList.toggle("active", visible);
    button.setAttribute("aria-checked", String(visible));
    $("#familyPriceToggleState").textContent = visible ? "Affichés" : "Masqués";
  }

  function toggleFamilyPrices() {
    db.settings.showFamilyPrices = !Boolean(db.settings.showFamilyPrices);
    renderFamilyPriceToggle();
    analyzeTileDensity();
    saveLocal(false);
  }

  function renderCatalog() {
    closeTileDetail({ immediate: true });
    renderOfferMode();
    if (currentCatalogMode() === "body") renderBodySelector();
    else renderFamilies();
    analyzeTileDensity();
  }
  function addService(item, offerType = "single") {
    const offer = ["single", "pack", "student"].includes(offerType) ? offerType : "single";
    const existing = quote.lines.find((line) => String(line.serviceId) === String(item.id) && line.offerType === offer);
    if (existing && offer === "pack") {
      toast(`${item.name} · pack déjà ajouté`);
      return;
    }
    if (existing) existing.quantity = boundedInteger(existing.quantity + 1, 1, MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
    else {
      const basePrice = Math.max(0, Number(item.price) || 0);
      const discount = clamp(db.settings.studentDiscount, 0, 100);
      quote.lines.push({
        id: uid(), serviceId: item.id, name: item.name, categoryId: Number(item.categoryId) || 0,
        duration: Math.max(0, Number(item.duration) || 0), offerType: offer, basePrice,
        studentDiscount: discount,
        price: basePrice,
        quantity: offer === "pack" ? packDefaults().paid : 1,
        freeQuantity: offer === "pack" ? packDefaults().free : 0
      });
    }
    saveLocal(); renderCatalog(); renderCheckout();
    const offerName = offer === "pack" ? "Pack" : offer === "student" ? "Tarif étudiant" : "Séance";
    toast(existing ? `${item.name} · quantité ${existing.quantity}` : `${item.name} · ${offerName} ajouté`);
  }
  function renderClient() {
    const client = quote.client;
    const clientEmail = String(client.email || "").trim();
    const emailRecipient = $("#checkoutEmailRecipient");
    const outlookWebRecipient = $("#checkoutOutlookWebRecipient");
    const desktopEmailAvailable = typeof window.bcdevisDesktop?.composeEmail === "function"
      && typeof window.bcdevisDesktop?.savePdf === "function";
    if (outlookWebRecipient) outlookWebRecipient.textContent = clientEmail || "Destinataire à saisir";
    if (emailRecipient) {
      emailRecipient.textContent = desktopEmailAvailable
        ? clientEmail || "Destinataire à saisir"
        : "Application de bureau requise";
    }
    if (client.name) {
      const initials = client.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
      $("#clientInitials").textContent = initials || "C";
      $("#clientName").textContent = client.name;
      $("#clientDetails").textContent = [client.phone, client.email].filter(Boolean).join(" · ") || client.address || "Coordonnées à compléter";
    } else {
      $("#clientInitials").textContent = "+";
      $("#clientName").textContent = "Client";
      $("#clientDetails").textContent = "Nom, téléphone et e-mail";
    }
  }

  function quantityStepper({ kind, value, label, decreaseAction, increaseAction, minimum, maximum = MAX_LINE_QUANTITY }) {
    const singularLabel = label.toLocaleLowerCase("fr-CH");
    const packClass = ["paid", "free"].includes(kind) ? ` is-pack${kind === "free" ? " free" : ""}` : "";
    return `<span class="quantity-group quantity-group-inline${packClass}">
      ${kind === "paid" ? "<small>Payées</small>" : kind === "free" ? "<small>Offertes</small>" : ""}
      <span class="quantity-stepper" role="group" aria-label="${escapeHTML(label)}">
        <button class="quantity-stepper-button" type="button" data-line-action="${decreaseAction}" aria-label="Diminuer ${escapeHTML(singularLabel)}"${value <= minimum ? " disabled" : ""}><span aria-hidden="true">−</span></button>
        <output class="quantity-value" data-quantity-value="${kind}" aria-live="polite">${value}</output>
        <button class="quantity-stepper-button" type="button" data-line-action="${increaseAction}" aria-label="Augmenter ${escapeHTML(singularLabel)}"${value >= maximum ? " disabled" : ""}><span aria-hidden="true">+</span></button>
      </span>
    </span>`;
  }

  function renderCart() {
    const container = $("#cartLines");
    $("#cartItemCount").textContent = quote.lines.length ? plural(quote.lines.length, "soin") : "Vide";
    $("#mobileCartCount").textContent = quote.lines.length;
    if (!quote.lines.length) {
      container.innerHTML = `<div class="cart-empty"><svg><use href="#icon-empty"></use></svg><strong>Ajoutez un soin</strong><p>Les options de paiement apparaîtront ensuite.</p></div>`;
      return;
    }
    container.innerHTML = quote.lines.map((line) => {
      const category = categoryFor(line.categoryId);
      const isPack = line.offerType === "pack";
      const pack = packDefaults();
      const canAddPackOffer = line.offerType === "single" && pack.free > 0 && line.quantity >= pack.paid;
      const categoryLabel = category.short.toLocaleLowerCase("fr-CH");
      const paidControl = quantityStepper({
        kind: isPack ? "paid" : "quantity",
        value: line.quantity,
        label: isPack ? "Séances payées" : "Quantité",
        decreaseAction: "decrease",
        increaseAction: "increase",
        minimum: 1
      });
      const freeControl = isPack ? quantityStepper({
        kind: "free",
        value: line.freeQuantity,
        label: "Séances offertes",
        decreaseAction: "decrease-free",
        increaseAction: "increase-free",
        minimum: 0
      }) : "";
      const packOfferAction = canAddPackOffer ? `<button class="pack-offer-action" type="button" data-line-action="add-pack-free" aria-label="Ajouter ${pack.free} séance${pack.free > 1 ? "s" : ""} offerte${pack.free > 1 ? "s" : ""}">+${pack.free} offerte${pack.free > 1 ? "s" : ""}</button>` : "";
      return `<article class="cart-line offer-${line.offerType}" data-line-id="${line.id}">
        <div class="cart-line-delete-zone"><button class="remove-line" type="button" data-line-action="remove" aria-label="Supprimer ${escapeHTML(line.name)}" title="Supprimer ${escapeHTML(line.name)}"><svg><use href="#icon-trash"></use></svg></button></div>
        <div class="cart-line-main">
          <div class="cart-line-info"><span class="cart-line-name-row"><input class="cart-line-name" data-line-field="name" value="${escapeHTML(line.name)}" title="${escapeHTML(line.name)}" aria-label="Nom du soin : ${escapeHTML(line.name)}"></span>${packOfferAction}</div>
          <div class="cart-line-inline-controls"><span class="cart-line-category" title="${escapeHTML(category.name)}">(${escapeHTML(categoryLabel)})</span>${paidControl}${freeControl}<strong class="cart-line-price" title="Total avant offres">${money(referenceLineTotal(line))}</strong></div>
        </div>
      </article>`;
    }).join("");
  }
  function renderTotals() {
    const totals = calculateQuote(quote);
    const taxEnabled = taxInformationEnabled(quote);
    $("#subtotalValue").textContent = money(totals.subtotal);
    $("#totalDiscountRow").hidden = totals.totalDiscount <= 0;
    $("#totalDiscountValue").textContent = `− ${money(totals.totalDiscount)}`;
    $("#netTotalRow").hidden = !taxEnabled;
    $("#netTotalValue").textContent = money(totals.net);
    $("#taxTotalRow").hidden = !taxEnabled;
    $("#taxTotalLabel").textContent = `TVA ${totals.rate}%${quote.tax.mode === "included" ? " incluse" : ""}`;
    $("#taxTotalValue").textContent = money(totals.tax);
    $("#grandTotalValue").textContent = money(totals.total);
    $("#mobileTotal").textContent = money(totals.total);
    const months = installmentMonths(totals.total);
    $("#installmentTableWrap").hidden = months.length === 0;
    $("#installmentGrid").innerHTML = months.length === 0 ? "" : `
      <tr class="installment-months">${months.map((month) => `<th scope="col">${month} mois</th>`).join("")}</tr>
      <tr class="installment-amounts">${months.map((month) => `<td>${moneyValue(totals.total / month)}</td>`).join("")}</tr>`;
  }

  function renderHeader() {
    $(".brand-block .eyebrow").textContent = db.settings.companyName;
    const clientName = String(quote.client?.name || "").trim();
    document.title = clientName ? `${clientName} — BCDevis` : "BCDevis";
  }

  const KNOWN_THEMES = ["light", "night", "forest", "bordeaux"];
  const THEME_BROWSER_COLORS = {
    light: "#171512",
    night: "#090906",
    forest: "#1c3429",
    bordeaux: "#411923"
  };
  function currentTheme() { return KNOWN_THEMES.includes(db.settings.theme) ? db.settings.theme : "light"; }
  function applyTheme(theme) {
    const value = KNOWN_THEMES.includes(theme) ? theme : "light";
    document.documentElement.setAttribute("data-theme", value);
    $("#themeColorMeta")?.setAttribute("content", THEME_BROWSER_COLORS[value]);
  }
  function currentFont() { return KNOWN_FONTS.includes(db.settings.fontFamily) ? db.settings.fontFamily : "red-hat"; }
  function applyFont(font) {
    const value = KNOWN_FONTS.includes(font) ? font : "red-hat";
    document.documentElement.setAttribute("data-font", value);
    if ($("#familyList")?.children.length) scheduleTileDensityAnalysis();
  }
  function currentIpadLayoutMode() { return IPAD_LAYOUT_MODES.includes(db.settings.ipadLayoutMode) ? db.settings.ipadLayoutMode : "off"; }
  function isLikelyIpad() {
    const userAgent = String(navigator.userAgent || "");
    const platform = String(navigator.userAgentData?.platform || navigator.platform || "");
    return /iPad/i.test(userAgent) || ((/Mac/i.test(platform) || /Macintosh/i.test(userAgent)) && Number(navigator.maxTouchPoints || 0) > 1);
  }
  function applyIpadLayout(mode = currentIpadLayoutMode()) {
    const preference = IPAD_LAYOUT_MODES.includes(mode) ? mode : "off";
    const optimized = preference === "always" || (preference === "auto" && isLikelyIpad());
    document.documentElement.dataset.ipadPreference = preference;
    document.documentElement.dataset.ipadLayout = optimized ? "optimized" : "standard";
  }
  function syncViewportMetrics() {
    const height = Math.max(320, Math.round(window.visualViewport?.height || window.innerHeight || 0));
    document.documentElement.style.setProperty("--app-viewport-height", `${height}px`);
  }

  function renderCheckout() {
    const previousCouponType = quote.discount.type;
    enforceStudentCouponRule();
    if (quote.discount.type !== previousCouponType) saveLocal(false);
    const hasLines = quote.lines.length > 0;
    $("#checkoutPanel").classList.toggle("is-empty", !hasLines);
    ["saveButton", "checkoutPrintButton", "checkoutPdfButton", "checkoutTransmitButton", "checkoutWhatsAppButton", "checkoutOutlookWebButton"].forEach((id) => {
      const button = $(`#${id}`);
      if (button) button.disabled = !hasLines;
    });
    const emailButton = $("#checkoutEmailButton");
    const desktopEmailAvailable = typeof window.bcdevisDesktop?.composeEmail === "function"
      && typeof window.bcdevisDesktop?.savePdf === "function";
    if (emailButton) {
      emailButton.disabled = !hasLines || !desktopEmailAvailable;
      emailButton.title = desktopEmailAvailable
        ? "Préparer le devis par e-mail"
        : "Le PDF joint automatiquement nécessite l’application de bureau";
    }
    if (!hasLines) setTransmissionMenuOpen(false);
    renderHeader();
    renderClient();
    renderCart();
    renderTotals();
    $("#quoteDate").value = quote.date;
    const { min: quoteDateMin, max: quoteDateMax } = quoteDateBounds();
    $("#quoteDate").min = quoteDateMin;
    $("#quoteDate").max = quoteDateMax;
    if (quote.discount.code || Number(quote.discount.value) > 0) couponOpen = true;
    $("#couponToggle").hidden = couponOpen;
    $("#couponToggle").setAttribute("aria-expanded", String(couponOpen));
    $("#couponEditor").hidden = !couponOpen;
    $("#couponCode").value = quote.discount.code || "";
    $("#discountValue").value = Number(quote.discount.value) || 0;
    $("#discountSuffix").textContent = quote.discount.type === "percent" ? "%" : "CHF";
    const studentActive = studentPricingActive();
    $("#couponRule").textContent = studentActive ? "Avec Étudiant : coupon CHF uniquement" : "Réduction en % ou en CHF";
    $$("[data-discount-type]").forEach((button) => {
      const percentBlocked = studentActive && button.dataset.discountType === "percent";
      button.disabled = percentBlocked;
      button.title = percentBlocked ? "Non cumulable avec le tarif étudiant" : "";
      button.classList.toggle("active", button.dataset.discountType === quote.discount.type);
    });
    const taxToggle = $("#taxEnabled");
    const showTaxInformation = db.settings.showTaxInformation === true;
    taxToggle.checked = showTaxInformation && Boolean(quote.tax.enabled);
    taxToggle.disabled = !showTaxInformation;
    taxToggle.closest(".tax-header-toggle").hidden = !showTaxInformation;
  }

  function renderAll() {
    renderCatalog();
    renderCheckout();
  }

  function lineFromElement(element) {
    const row = element.closest("[data-line-id]");
    return quote.lines.find((line) => line.id === row?.dataset.lineId);
  }

  function updateLineInput(input) {
    const line = lineFromElement(input);
    if (!line) return;
    const field = input.dataset.lineField;
    if (field === "name") line.name = input.value.trim() || "Soin";
    saveLocal();
    renderCart();
    renderTotals();
  }

  function openLayer(id) {
    const layer = $(`#${id}`);
    if (!layer) return;
    closeTileDetail({ immediate: true });
    const previousFocus = document.activeElement;
    if (previousFocus instanceof HTMLElement) layerReturnFocus.set(id, previousFocus);
    layer.hidden = false;
    activeLayerId = id;
    [$("#appShell"), $("#mobileTabs"), $("#toastRegion")].filter(Boolean).forEach((element) => { element.inert = true; });
    const initialFocus = $("[autofocus]", layer)
      || $("[data-initial-focus]", layer)
      || $(".history-list button", layer)
      || $("button[data-close]:not(.layer-backdrop)", layer);
    if (initialFocus) window.setTimeout(() => initialFocus.focus(), 50);
  }

  function closeLayer(id) {
    const layer = $(`#${id}`);
    if (!layer || layer.hidden) return;
    if (id === "settingsLayer") {
      applyTheme(currentTheme());
      syncThemePicker(currentTheme());
      applyFont(currentFont());
      syncFontPicker(currentFont());
    }
    layer.hidden = true;
    if (activeLayerId === id) activeLayerId = "";
    const previousFocus = layerReturnFocus.get(id);
    layerReturnFocus.delete(id);
    const remainingLayer = $$(".modal-layer:not([hidden]), .drawer-layer:not([hidden])").at(-1);
    if (remainingLayer) {
      activeLayerId = remainingLayer.id;
      if (previousFocus?.isConnected) window.setTimeout(() => previousFocus.focus(), 0);
      return;
    }
    [$("#appShell"), $("#mobileTabs"), $("#toastRegion")].filter(Boolean).forEach((element) => { element.inert = false; });
    if (previousFocus?.isConnected) window.setTimeout(() => previousFocus.focus(), 0);
  }

  function focusableElements(container) {
    return $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter((element) => !element.closest("[hidden]") && element.getClientRects().length);
  }

  function trapLayerFocus(event, layer) {
    const items = focusableElements(layer);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function isTextEntryTarget(target) {
    return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
  }

  function moveRadioSelection(group, selector, current, activate) {
    const options = $$(selector, group).filter((item) => !item.disabled);
    const index = options.indexOf(current);
    if (index < 0 || !options.length) return;
    const next = options[(index + activate + options.length) % options.length];
    next.focus();
    next.click();
  }

  function openClient() {
    const form = $("#clientForm");
    for (const [key, value] of Object.entries(quote.client)) if (form.elements[key]) form.elements[key].value = value || "";
    openLayer("clientLayer");
  }

  function saveQuote() {
    const previousStatus = quote.status;
    const previousSaved = db.quotes[quote.id];
    quote.status = "saved";
    quote.updatedAt = new Date().toISOString();
    db.quotes[quote.id] = clone(quote);
    if (!saveLocal()) {
      quote.status = previousStatus;
      if (previousSaved) db.quotes[quote.id] = previousSaved;
      else delete db.quotes[quote.id];
      db.current = clone(quote);
      renderHistory();
      return false;
    }
    renderHistory();
    toast(`${quote.number} enregistré dans Mes devis`);
    return true;
  }

  function createNewQuote(force = false) {
    const hasContent = quote.lines.length || quote.client.name;
    const isArchived = Boolean(db.quotes[quote.id]);
    if (!force && hasContent && !isArchived && !window.confirm("Le brouillon actuel n’est pas enregistré dans Mes devis et sera remplacé. Créer quand même un nouveau devis ?")) return;
    quote = newQuote();
    couponOpen = false;
    activeFamily = "visage";
    expandedFamily = "visage";
    activeBodySide = "front";
    activeBodyRegion = "front-visage";
    activeBodyDetail = "body";
    activeFaceRegion = "";
    selectedOfferMode = "single";
    searchQuery = "";
    $("#catalogSearch").value = "";
    setCatalogSearchOpen(false, { clear: false });
    saveLocal();
    renderAll();
    if (window.innerWidth <= 1180) switchMobilePanel("familyPanel");
    toast("Nouveau devis prêt");
  }

  function duplicateQuote() {
    const copy = clone(quote);
    const now = new Date().toISOString();
    copy.id = uid();
    copy.status = "draft";
    copy.date = todayISO();
    copy.number = nextQuoteNumber(copy.date);
    copy.validUntil = addDaysISO(copy.date, QUOTE_VALIDITY_DAYS);
    copy.createdAt = now;
    copy.updatedAt = now;
    quote = copy;
    couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
    saveLocal();
    renderAll();
    toast(`Copie créée : ${quote.number}`);
  }

  function renderHistory() {
    const list = $("#historyList");
    const quotes = Object.values(db.quotes).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!quotes.length) {
      list.innerHTML = `<div class="history-empty"><svg><use href="#icon-history"></use></svg><strong>Aucun devis enregistré</strong><p>Le bouton Enregistrer ajoutera le devis en cours à cet historique local.</p></div>`;
      return;
    }
    list.innerHTML = quotes.map((item) => {
      const totals = calculateQuote(item);
      return `<button class="history-item ${item.id === quote.id ? "current" : ""}" type="button" data-quote-id="${item.id}">
        <span class="history-item-head"><strong>${escapeHTML(item.number)}</strong><b>${money(totals.total)}</b></span>
        <span class="history-item-client">${escapeHTML(item.client?.name || "Client à compléter")}</span>
        <span class="history-item-meta"><span>${formatDate(item.date)} · ${plural(item.lines?.length || 0, "soin")}</span><span class="history-status">Enregistré</span></span>
      </button>`;
    }).join("");
  }

  function loadHistoryQuote(id) {
    const selected = db.quotes[id];
    if (!selected) return;
    quote = sanitizeQuote(selected);
    couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
    saveLocal(false);
    renderAll();
    closeLayer("historyLayer");
    toast(`${quote.number} ouvert`);
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function readJSONFile(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return null;
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Le fichier dépasse 10 Mo et ne peut pas être restauré en toute sécurité.");
    return JSON.parse(await file.text());
  }

  function quoteNumberAlreadyUsed(number, quoteId) {
    return Object.values(db.quotes || {}).some((saved) => saved?.id !== quoteId && saved?.number === number);
  }

  function giveImportedQuoteANewIdentityIfNeeded(importedQuote) {
    if (!db.quotes?.[importedQuote.id] && !quoteNumberAlreadyUsed(importedQuote.number, importedQuote.id)) return importedQuote;
    importedQuote.id = uid();
    importedQuote.number = nextQuoteNumber(importedQuote.date);
    importedQuote.status = "draft";
    importedQuote.createdAt = new Date().toISOString();
    importedQuote.updatedAt = importedQuote.createdAt;
    return importedQuote;
  }

  function exportQuote() {
    downloadJSON(`${quote.number}.json`, { type: "atelier-devis-quote", version: APP_VERSION, exportedAt: new Date().toISOString(), quote });
    toast("Devis exporté");
  }

  function exportBackup() {
    saveLocal(false);
    downloadJSON(`sauvegarde-devis-${todayISO()}.json`, { type: "atelier-devis-backup", version: APP_VERSION, exportedAt: new Date().toISOString(), database: db });
    toast("Sauvegarde complète exportée");
  }

  function buildFamilyVisibilityGrid() {
    const grid = $("#familyVisibilityGrid");
    if (!grid) return;
    const configured = new Set(Array.isArray(db.settings.visibleFamilies) ? db.settings.visibleFamilies.filter(Boolean) : []);
    const allSelectable = selectableFamilies();
    const initiallyAll = !configured.size;
    grid.innerHTML = allSelectable.map((family) => {
      const checked = initiallyAll || configured.has(family.id);
      return `<label class="family-visibility-item" data-family-id="${family.id}">\n        <input type="checkbox" name="visibleFamilies" value="${family.id}" ${checked ? "checked" : ""}>\n        <span class="family-visibility-icon" aria-hidden="true"><svg><use href="${prestationIconHref(family.icon)}"></use></svg></span>\n        <span class="family-visibility-copy"><strong>${escapeHTML(family.name)}</strong></span>\n      </label>`;
    }).join("");
  }

  let tileIconTargetCard = null;
  let catalogIconChoiceCache = null;

  function baseCatalogService(id) {
    return baseCatalogServices().find((item) => String(item.id) === String(id));
  }

  function catalogIconLabel(icon) {
    const service = window.QUOTE_SERVICES.find((item) => item.icon === icon && item.zone);
    const family = window.QUOTE_FAMILIES.find((item) => item.icon === icon);
    const category = window.QUOTE_CATEGORIES.find((item) => item.icon === icon);
    return String(service?.zone || family?.name || category?.short || icon.replaceAll("-", " "));
  }

  function catalogIconChoices() {
    if (catalogIconChoiceCache) return catalogIconChoiceCache;
    catalogIconChoiceCache = [...document.querySelectorAll('symbol[id^="icon-map-"]')]
      .map((symbol) => symbol.id.replace(/^icon-map-/, ""))
      .filter((icon, index, icons) => /^[a-z0-9-]+$/.test(icon) && icons.indexOf(icon) === index)
      .sort((left, right) => catalogIconLabel(left).localeCompare(catalogIconLabel(right), "fr", { sensitivity: "base" }));
    return catalogIconChoiceCache;
  }

  function catalogEditorIconValue(item) {
    const icon = String(item.icon || serviceVisual(item).icon || "");
    return catalogIconChoices().includes(icon) ? icon : "skin-target";
  }

  function catalogEditorCard(base) {
    const item = { ...base, ...(db.catalogOverrides?.[String(base.id)] || {}) };
    const category = categoryFor(item.categoryId);
    const icon = catalogEditorIconValue(item);
    const packPriceField = Number.isFinite(Number(base.packAveragePrice)) || Number.isFinite(Number(item.packAveragePrice))
      ? `<label><span>Prix Pack moyen (CHF)</span><input data-tile-field="packAveragePrice" type="number" min="0" max="${MAX_LINE_PRICE}" step="0.01" value="${escapeHTML(item.packAveragePrice ?? base.packAveragePrice ?? 0)}"></label>`
      : "";
    return `<article class="tile-catalog-card" data-tile-editor-card data-service-id="${escapeHTML(base.id)}" data-tile-search="${escapeHTML(normalize(`${item.name} ${category.name} ${item.id}`))}">
      <header class="tile-catalog-card-head">
        <button class="tile-catalog-icon-button" type="button" data-tile-icon-picker aria-label="Changer le pictogramme SVG de ${escapeHTML(item.name)}" title="Choisir un pictogramme SVG">
          <span aria-hidden="true"><svg><use href="${prestationIconHref(icon)}"></use></svg></span><small>Changer le SVG</small>
        </button>
        <div><span>${escapeHTML(category.short || category.name)}</span><code>#${escapeHTML(item.id)}</code></div>
        <button class="tile-catalog-reset" type="button" data-tile-reset title="Rétablir cette tuile">Réinitialiser</button>
        <input data-tile-field="icon" type="hidden" value="${escapeHTML(icon)}">
      </header>
      <div class="tile-catalog-fields">
        <label class="tile-catalog-name"><span>Nom</span><input data-tile-field="name" type="text" maxlength="240" value="${escapeHTML(item.name)}" required></label>
        <label><span>Temps (min)</span><input data-tile-field="duration" type="number" min="0" max="1440" step="5" value="${escapeHTML(item.duration ?? 0)}" required></label>
        <label><span>Prix (CHF)</span><input data-tile-field="price" type="number" min="0" max="${MAX_LINE_PRICE}" step="0.01" value="${escapeHTML(item.price ?? 0)}" required></label>
        ${packPriceField}
      </div>
    </article>`;
  }

  function tileEditorCardOverride(card) {
    const base = baseCatalogService(card.dataset.serviceId);
    if (!base) return null;
    const name = String($('[data-tile-field="name"]', card)?.value || "").trim().slice(0, 240);
    const price = boundedNumber($('[data-tile-field="price"]', card)?.value, 0, MAX_LINE_PRICE, 0);
    const duration = boundedInteger($('[data-tile-field="duration"]', card)?.value, 0, 1440, 0);
    const icon = catalogEditorIconValue({ ...base, icon: $('[data-tile-field="icon"]', card)?.value });
    const override = {};
    if (name && name !== String(base.name)) override.name = name;
    if (price !== Number(base.price || 0)) override.price = price;
    if (duration !== Number(base.duration || 0)) override.duration = duration;
    if (icon !== catalogEditorIconValue(base)) override.icon = icon;
    const packInput = $('[data-tile-field="packAveragePrice"]', card);
    if (packInput) {
      const packAveragePrice = boundedNumber(packInput.value, 0, MAX_LINE_PRICE, 0);
      if (packAveragePrice !== Number(base.packAveragePrice || 0)) override.packAveragePrice = packAveragePrice;
    }
    return { id: String(base.id), override };
  }

  function updateTileEditorSummary() {
    const cards = $$('[data-tile-editor-card]', $("#tileCatalogEditorList"));
    const changed = cards.filter((card) => Object.keys(tileEditorCardOverride(card)?.override || {}).length).length;
    const summary = $("#tileCatalogEditorChanges");
    const saveButton = $("#tileCatalogEditorSave");
    if (summary) summary.textContent = changed ? plural(changed, "tuile modifiée", "tuiles modifiées") : "Aucune modification en attente";
    if (saveButton) saveButton.textContent = changed ? `Enregistrer ${changed}` : "Enregistrer";
  }

  function filterTileCatalogEditor() {
    const needle = normalize($("#tileCatalogEditorSearch")?.value || "");
    const cards = $$('[data-tile-editor-card]', $("#tileCatalogEditorList"));
    let visible = 0;
    cards.forEach((card) => {
      const matches = !needle || card.dataset.tileSearch.includes(needle) || normalize($('[data-tile-field="name"]', card)?.value || "").includes(needle);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    const count = $("#tileCatalogEditorCount");
    if (count) count.textContent = `${visible} / ${cards.length} tuiles`;
  }

  function buildTileCatalogEditor() {
    const list = $("#tileCatalogEditorList");
    if (!list) return;
    list.innerHTML = baseCatalogServices().map(catalogEditorCard).join("");
    const search = $("#tileCatalogEditorSearch");
    if (search) search.value = "";
    filterTileCatalogEditor();
    updateTileEditorSummary();
  }

  function openTileCatalogEditor() {
    buildTileCatalogEditor();
    openLayer("tileCatalogEditorLayer");
  }

  function renderCatalogIconPicker(selectedIcon) {
    const grid = $("#tileIconPickerGrid");
    if (!grid) return;
    grid.innerHTML = catalogIconChoices().map((icon) => {
      const selected = icon === selectedIcon;
      const label = catalogIconLabel(icon);
      return `<button type="button" data-tile-icon-choice="${escapeHTML(icon)}" aria-label="${escapeHTML(label)}" aria-pressed="${selected}" title="${escapeHTML(label)}" ${selected ? "data-initial-focus" : ""}><svg aria-hidden="true"><use href="${prestationIconHref(icon)}"></use></svg><span>${escapeHTML(label)}</span></button>`;
    }).join("");
  }

  function openCatalogIconPicker(card) {
    tileIconTargetCard = card;
    const selectedIcon = $('[data-tile-field="icon"]', card)?.value || "skin-target";
    renderCatalogIconPicker(selectedIcon);
    openLayer("tileIconPickerLayer");
  }

  function resetTileEditorCard(card) {
    const base = baseCatalogService(card.dataset.serviceId);
    if (!base) return;
    $('[data-tile-field="name"]', card).value = base.name;
    $('[data-tile-field="price"]', card).value = Number(base.price || 0);
    $('[data-tile-field="duration"]', card).value = Number(base.duration || 0);
    const packInput = $('[data-tile-field="packAveragePrice"]', card);
    if (packInput) packInput.value = Number(base.packAveragePrice || 0);
    const icon = catalogEditorIconValue(base);
    $('[data-tile-field="icon"]', card).value = icon;
    $(".tile-catalog-icon-button use", card)?.setAttribute("href", prestationIconHref(icon));
    updateTileEditorSummary();
  }

  function saveTileCatalogEditor() {
    const previousOverrides = clone(db.catalogOverrides || {});
    const nextOverrides = { ...previousOverrides };
    $$('[data-tile-editor-card]', $("#tileCatalogEditorList")).forEach((card) => {
      const result = tileEditorCardOverride(card);
      if (!result) return;
      if (Object.keys(result.override).length) nextOverrides[result.id] = result.override;
      else delete nextOverrides[result.id];
    });
    db.catalogOverrides = sanitizeCatalogOverrides(nextOverrides);
    const changed = Object.keys(db.catalogOverrides).length;
    if (!saveLocal()) {
      db.catalogOverrides = previousOverrides;
      return;
    }
    renderAll();
    closeLayer("tileCatalogEditorLayer");
    toast(changed ? `${plural(changed, "tuile personnalisée", "tuiles personnalisées")} enregistrée${changed === 1 ? "" : "s"}` : "Catalogue d’origine restauré");
  }

  let launchAtLoginState = {
    available: false,
    enabled: false,
    loading: false,
    status: "unavailable"
  };

  function launchAtLoginMessage(result) {
    if (!result?.available) {
      if (result?.status === "packaged-required") return "Version installée requise.";
      return "Application de bureau uniquement.";
    }
    if (result.status === "blocked") return "Désactivé dans Windows.";
    if (result.status === "stale") return "Emplacement à actualiser.";
    if (result.status === "requires-approval") return "Autorisation macOS requise.";
    return result.enabled
      ? `Activé · ${result.platformLabel || "cet ordinateur"}`
      : `Désactivé · ${result.platformLabel || "cet ordinateur"}`;
  }

  function applyLaunchAtLoginResult(result) {
    const input = $("#launchAtLogin");
    const status = $("#launchAtLoginStatus");
    launchAtLoginState = {
      available: Boolean(result?.available),
      enabled: Boolean(result?.enabled),
      loading: false,
      status: String(result?.status || "unavailable")
    };
    if (input) {
      input.checked = launchAtLoginState.enabled;
      input.disabled = !launchAtLoginState.available;
    }
    if (status) status.textContent = launchAtLoginMessage(result);
  }

  async function refreshLaunchAtLoginSetting() {
    const input = $("#launchAtLogin");
    const status = $("#launchAtLoginStatus");
    if (!input || !status) return;
    input.disabled = true;
    status.textContent = "Vérification…";
    launchAtLoginState.loading = true;
    if (typeof window.bcdevisDesktop?.getLaunchAtLogin !== "function") {
      applyLaunchAtLoginResult({ available: false, enabled: false, status: "desktop-required" });
      return;
    }
    try {
      applyLaunchAtLoginResult(await window.bcdevisDesktop.getLaunchAtLogin());
    } catch (error) {
      console.error("Lecture du démarrage automatique impossible.", error);
      applyLaunchAtLoginResult({ available: false, enabled: false, status: "read-error" });
      status.textContent = "Lecture impossible.";
    }
  }

  function fillSettingsForm() {
    const form = $("#settingsForm");
    Object.entries(db.settings).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    if (form.elements.showSignatures) form.elements.showSignatures.checked = db.settings.showSignatures !== false;
    if (form.elements.showTaxInformation) form.elements.showTaxInformation.checked = db.settings.showTaxInformation === true;
    if (form.elements.launchAtLogin) {
      form.elements.launchAtLogin.checked = db.settings.launchAtLogin === true;
      form.elements.launchAtLogin.disabled = true;
    }
    pendingLogos = {
      headerLogoDataUrl: safeLogoDataUrl(db.settings.headerLogoDataUrl),
      pdfLogoDataUrl: safeLogoDataUrl(db.settings.pdfLogoDataUrl)
    };
    renderLogoPreviews();
    buildFamilyVisibilityGrid();
    refreshSettingsPreview();
    syncThemePicker(currentTheme());
    syncFontPicker(currentFont());
    void refreshLaunchAtLoginSetting();
  }

  function readLogoFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(""); return; }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        reject(new Error("Format non pris en charge. Utilisez un fichier PNG, JPG ou WebP."));
        return;
      }
      if (file.size > LOGO_FILE_MAX_BYTES) {
        reject(new Error("Le logo dépasse 4 Mo. Choisissez une image plus légère."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Le fichier n’a pas pu être lu."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("L’image semble endommagée ou illisible."));
        image.onload = () => {
          const maxWidth = 1200;
          const maxHeight = 600;
          const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          const optimized = canvas.toDataURL("image/webp", 0.92);
           if (optimized.length > LOGO_UPLOAD_MAX_LENGTH || !safeLogoDataUrl(optimized)) {
            reject(new Error("Le logo reste trop volumineux après optimisation."));
            return;
          }
          resolve(optimized);
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function renderLogoPreviews() {
    const headerLogo = safeLogoDataUrl(pendingLogos.headerLogoDataUrl);
    const pdfLogo = safeLogoDataUrl(pendingLogos.pdfLogoDataUrl);
    const headerPreview = $("#headerLogoPreview");
    const pdfPreview = $("#pdfLogoPreview");
    if (headerPreview) headerPreview.src = headerLogo || DEFAULT_LOGO_PATH;
    if (pdfPreview) pdfPreview.src = pdfLogo || headerLogo || DEFAULT_LOGO_PATH;
    const headerStatus = $("#headerLogoStatus");
    const pdfStatus = $("#pdfLogoStatus");
    if (headerStatus) headerStatus.textContent = headerLogo ? "Personnalisé" : "Bellecour";
    if (pdfStatus) pdfStatus.textContent = pdfLogo ? "Personnalisé" : headerLogo ? "Logo principal" : "Bellecour";
    const removeHeader = $('[data-remove-logo="header"]');
    const removePdf = $('[data-remove-logo="pdf"]');
    if (removeHeader) removeHeader.hidden = !headerLogo;
    if (removePdf) removePdf.hidden = !pdfLogo;
  }

  function syncThemePicker(activeTheme) {
    $$("#themePicker .theme-card").forEach((card) => {
      const isActive = card.dataset.theme === activeTheme;
      card.setAttribute("aria-checked", String(isActive));
      card.tabIndex = isActive ? 0 : -1;
      const icon = card.querySelector(".theme-card-check use");
      if (icon) icon.setAttribute("href", isActive ? "#icon-check" : "");
      card.querySelector(".theme-card-check svg").style.display = isActive ? "" : "none";
    });
  }

  function syncFontPicker(activeFont) {
    $$("#fontPicker .font-card").forEach((card) => {
      const isActive = card.dataset.font === activeFont;
      card.setAttribute("aria-checked", String(isActive));
      card.tabIndex = isActive ? 0 : -1;
    });
  }

  function setSettingsTab(requestedTab, { focus = false, resetScroll = false } = {}) {
    const tabId = SETTINGS_TAB_IDS.includes(requestedTab) ? requestedTab : SETTINGS_TAB_IDS[0];
    activeSettingsTab = tabId;
    $$("#settingsTabs [role='tab']").forEach((tab) => {
      const isActive = tab.dataset.settingsTab === tabId;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (focus && isActive) tab.focus();
    });
    $$("[data-settings-panel]").forEach((panel) => {
      const isActive = panel.dataset.settingsPanel === tabId;
      panel.hidden = !isActive;
      if (isActive && resetScroll) panel.scrollTop = 0;
    });
  }

  function refreshSettingsPreview() {
    const form = $("#settingsForm");
    if (!form) return;
    const prefix = String(form.elements.quotePrefix?.value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "DEV";
    const machine = String(form.elements.machineName?.value || "").trim();
    const today = todayISO().replaceAll("-", "");
    const machinePart = compactMachineCode(machine || defaultSettings.machineName);
    const previewEl = $("#settingsQuotePreview");
    if (previewEl) previewEl.textContent = `${prefix}-${today}${machinePart}001`;
    const paid = Math.max(1, Math.round(Number(form.elements.packPaidDefault?.value) || 0));
    const free = Math.max(0, Math.round(Number(form.elements.packFreeDefault?.value) || 0));
    const totalPack = paid + free;
    const packSummary = document.querySelector('[data-summary="pack"]');
    if (packSummary) packSummary.textContent = totalPack > 0 ? `${totalPack} séance${totalPack > 1 ? "s" : ""} au total.` : "";
    const student = Math.max(0, Math.min(100, Math.round(Number(form.elements.studentDiscount?.value) || 0)));
    const studentOutput = form.querySelector("[data-student-discount]");
    if (studentOutput) studentOutput.textContent = `${student} %`;
    const studentSummary = document.querySelector('[data-summary="student"]');
    if (studentSummary) studentSummary.textContent = student > 0 ? `Prix client : ${100 - student} %${student >= 100 ? " · gratuit" : ""}.` : "";
    const familySummary = document.querySelector('[data-summary="families"]');
    if (familySummary) {
      const checkedFamilies = form.elements.visibleFamilies ? Array.from(form.elements.visibleFamilies).filter((input) => input.checked) : [];
      const total = selectableFamilies().length;
      familySummary.textContent = checkedFamilies.length === 0 && total > 0
        ? "Aucune sélection = tout afficher."
        : "";
    }
  }

  function printLayoutClass(totals, months, studentConditions) {
    const conditions = String(quote.conditions || db.settings.conditions || "").trim();
    const footerNote = String(db.settings.footerNote || "").trim();
    const conditionsLength = conditions.length + footerNote.length + studentConditions.length;
    const adjustmentRows = 2
      + (totals.totalDiscount > 0 ? 1 : 0)
      + (taxInformationEnabled(quote) ? 2 : 0);
    const longLineCount = quote.lines.filter((line) => String(line.name || "").length > 44).length;
    const singlePageEligible = quote.lines.length <= 5
      && longLineCount <= 2
      && conditionsLength <= 620
      && studentConditions.length <= 240
      && adjustmentRows <= 5
      && months.length <= 5;

    if (singlePageEligible) return "print-layout-single";
    if (quote.lines.length <= 8 && conditionsLength <= 900) return "print-layout-balanced";
    return "print-layout-extended";
  }

  function defaultLogoForPrint() {
    return DEFAULT_LOGO_PATH;
  }

  function renderPrint() {
    const totals = calculateQuote(quote);
    const taxEnabled = taxInformationEnabled(quote);
    const settings = db.settings;
    const client = quote.client;
    const months = installmentMonths(totals.total);
    const contact = [settings.companyPhone, settings.companyEmail].filter(Boolean).join(" · ");
    const clientContact = [client.phone, client.email].filter(Boolean).join(" · ");
    const rows = quote.lines.map((line) => {
      const quantityLabel = line.offerType === "pack" ? `${line.quantity} payées + ${line.freeQuantity} offerte${line.freeQuantity === 1 ? "" : "s"}` : String(line.quantity);
      const unitPrice = line.offerType === "student" ? Number(line.basePrice ?? line.price) || 0 : Number(line.price) || 0;
      return `<tr><td><span class="print-item-name">${escapeHTML(line.name)}</span><span class="print-item-meta">${escapeHTML(offerLabel(line))} · ${escapeHTML(categoryFor(line.categoryId).name)}</span></td><td>${quantityLabel}</td><td>${money(unitPrice)}</td><td>${money(referenceLineTotal(line))}</td></tr>`;
    }).join("");
    const studentConditions = quote.lines.some((line) => line.offerType === "student") ? String(settings.studentConditions || "").trim() : "";
    const customLogoSource = safeLogoDataUrl(settings.pdfLogoDataUrl) || safeLogoDataUrl(settings.headerLogoDataUrl);
    const logoSource = customLogoSource || defaultLogoForPrint();
    const logoClass = customLogoSource ? "print-logo print-logo-custom" : "print-logo print-logo-official";
    const brandCopy = customLogoSource ? `<div class="print-brand-copy"><div class="print-company-kicker">${escapeHTML(settings.companySubtitle || "Établissement")}</div><div class="print-company-name">${escapeHTML(settings.companyName)}</div></div>` : "";
    const signatureBlock = settings.showSignatures !== false
      ? `<div class="print-signature"><div><span>Date et lieu</span></div><div><span>Signature du client et mention « Bon pour accord »</span></div></div>`
      : "";
    const totalLabel = taxEnabled ? "Total à payer TTC" : "Total à payer";
    const printRoot = $("#printQuote");
    const layoutClass = printLayoutClass(totals, months, studentConditions);
    printRoot.className = `print-quote ${layoutClass}`;
    printRoot.dataset.printLayout = layoutClass.replace("print-layout-", "");
    printRoot.innerHTML = `
      <header class="print-header">
        <div class="print-brand"><img class="${logoClass}" src="${escapeHTML(logoSource)}" alt="">${brandCopy}</div>
        <div class="print-company-lines"><span class="print-contact-label">Coordonnées</span>${escapeHTML(settings.companyAddress)}<br>${escapeHTML(contact)}${settings.companyUid ? `<br>IDE : ${escapeHTML(settings.companyUid)}` : ""}</div>
      </header>
      <section class="print-hero"><div><h1>DEVIS</h1></div><div class="print-document-meta"><strong>${escapeHTML(quote.number)}</strong></div></section>
      <div class="print-overview">
        <div class="print-card print-client-card"><div class="print-label">Destinataire</div><div class="print-client-name">${escapeHTML(client.name || "Destinataire non renseigné")}</div><div class="print-muted">${escapeHTML(clientContact || "Coordonnées non renseignées")}${client.address ? `<br>${escapeHTML(client.address)}` : ""}</div></div>
        <div class="print-card"><div class="print-label">Références</div><div class="print-reference-grid"><span>Date du devis</span><span>${formatDate(quote.date)}</span><span>Valable jusqu’au</span><span>${formatDate(quote.validUntil)}</span><span>Devise</span><span>CHF</span></div></div>
      </div>
      <section class="print-services">
        <div class="print-section-heading"><div><strong>Soins</strong></div></div>
        <table class="print-table"><thead><tr><th>Soin</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <div class="print-closing">
        <div class="print-summary print-summary-totals-only"><table class="print-totals"><tr><td>Total avant offres</td><td>${money(totals.subtotal)}</td></tr>${totals.totalDiscount > 0 ? `<tr class="discount"><td>Rabais total</td><td>− ${money(totals.totalDiscount)}</td></tr>` : ""}${taxEnabled ? `<tr><td>Net HT</td><td>${money(totals.net)}</td></tr><tr><td>TVA ${totals.rate} %${quote.tax.mode === "included" ? " incluse" : ""}</td><td>${money(totals.tax)}</td></tr>` : ""}<tr class="total"><td>${totalLabel}</td><td>${money(totals.total)}</td></tr></table></div>
        <section class="print-followup">
          ${totals.total > 0 ? `<div class="print-section-heading"><div><strong>Modalités de paiement</strong></div></div><p class="print-installment-intro">Les mensualités présentées ci-dessous sont indicatives. Toute demande d’échelonnement est soumise à l’acceptation préalable du partenaire financier.</p><div class="print-installments">${months.map((month) => `<div class="print-installment"><b>${month} mois</b><span>${money(totals.total / month)}</span><small>mensualité indicative</small></div>`).join("")}</div>` : ""}
          <div class="print-legal-block">
            <div class="print-section-heading print-legal-heading"><div><strong>Conditions et acceptation</strong></div></div>
            <div class="print-conditions print-conditions-single"><div><strong>Conditions de règlement</strong>${escapeHTML(quote.conditions || settings.conditions)}${studentConditions ? `<div class="print-student-conditions"><strong>Conditions du tarif étudiant</strong>${escapeHTML(studentConditions)}</div>` : ""}${settings.footerNote ? `<div class="print-legal-note">${escapeHTML(settings.footerNote)}</div>` : ""}</div></div>
            ${signatureBlock}
          </div>
        </section>
        <footer class="print-footer"><span>${escapeHTML(settings.companyName)} · ${escapeHTML(quote.number)}</span><span>Valable jusqu’au ${formatDate(quote.validUntil)}</span></footer>
      </div>`;
  }

  function printQuote() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant l’impression.", "error"); return; }
    saveQuote();
    renderPrint();
    window.setTimeout(() => window.print(), 80);
  }

  async function waitForPdfLayout() {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = $$("img", $("#printQuote"));
    await Promise.all(images.map(async (image) => {
      if (image.complete && image.naturalWidth) return;
      if (typeof image.decode === "function") {
        try {
          await image.decode();
          return;
        } catch (_) {
          // The PDF can still be generated when an optional logo cannot load.
        }
      }
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function downloadPdf() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant le téléchargement.", "error"); return; }
    saveQuote();
    renderPrint();
    if (typeof window.bcdevisDesktop?.savePdf !== "function") {
      printQuote();
      toast("Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.");
      return;
    }
    const buttons = ["#downloadPdfButton", "#checkoutPdfButton"].map((selector) => $(selector)).filter(Boolean);
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    });
    try {
      await waitForPdfLayout();
      const result = await window.bcdevisDesktop.savePdf(`${quote.number}.pdf`);
      if (result?.saved) toast(`PDF téléchargé : ${result.fileName || `${quote.number}.pdf`}`);
    } catch (error) {
      console.error(error);
      toast("Le PDF n’a pas pu être enregistré.", "error");
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      });
    }
  }

  function transmissionMessage() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant le transfert.", "error"); return; }
    const totals = calculateQuote(quote);
    const clientName = String(quote.client?.name || "").trim();
    const lines = quote.lines.map((line) => {
      const name = String(line.name || "Soin").trim().replace(/[\s—–-]+$/u, "").trim() || "Soin";
      const quantity = Math.max(0, Number(line.quantity) || 0);
      const unitPrice = line.offerType === "student"
        ? Math.max(0, Number(line.basePrice ?? line.price) || 0)
        : Math.max(0, Number(line.price) || 0);
      if (line.offerType === "pack") {
        const paid = `${quantity} payée${quantity > 1 ? "s" : ""}`;
        const offeredQuantity = Math.max(0, Number(line.freeQuantity) || 0);
        const offered = offeredQuantity ? ` et ${offeredQuantity} offerte${offeredQuantity > 1 ? "s" : ""}` : "";
        return `• ${name} : ${paid}${offered}, ${money(unitPrice)} par séance, soit ${money(referenceLineTotal(line))} avant offre`;
      }
      return `• ${name} : ${quantity} × ${money(unitPrice)}, soit ${money(referenceLineTotal(line))}`;
    });
    const summary = [`Total avant offres : ${money(totals.subtotal)}`];
    if (totals.totalDiscount > 0) summary.push(`Rabais total : − ${money(totals.totalDiscount)}`);
    if (taxInformationEnabled(quote) && totals.tax > 0) {
      summary.push(`TVA ${totals.rate} %${quote.tax.mode === "included" ? " incluse" : ""} : ${money(totals.tax)}`);
    }
    summary.push(`Total à payer : ${money(totals.total)}`);
    const message = [
      `Bonjour${clientName ? ` ${clientName}` : ""},`,
      "",
      `Voici votre devis ${quote.number}, émis le ${formatDate(quote.date)}.`,
      "",
      ...lines,
      "",
      ...summary,
      `Valable jusqu’au ${formatDate(quote.validUntil)}.`,
      "",
      "Bien cordialement,",
      String(db.settings.companyName || "Clinique Bellecour").trim()
    ].join("\n");
    return message;
  }

  async function prepareTransmissionPdf() {
    if (typeof window.bcdevisDesktop?.savePdf !== "function") return null;
    await waitForPdfLayout();
    return window.bcdevisDesktop.savePdf(`${quote.number}.pdf`);
  }

  async function openExternalUrl(url) {
    if (typeof window.bcdevisDesktop?.openExternal === "function") {
      await window.bcdevisDesktop.openExternal(url);
      return;
    }
    const popup = window.open(url, "_blank", "noopener");
    if (!popup) window.location.assign(url);
  }

  function emailSubject() {
    return `Votre devis ${quote.number} — ${String(db.settings.companyName || "Clinique Bellecour").trim()}`;
  }

  function outlookWebComposeUrl(recipient, subject, body) {
    return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function setTransmissionBusy(busy) {
    ["#checkoutTransmitButton", "#checkoutWhatsAppButton", "#checkoutOutlookWebButton", "#checkoutEmailButton"]
      .map((selector) => $(selector))
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = busy;
        if (busy) button.setAttribute("aria-busy", "true");
        else button.removeAttribute("aria-busy");
      });
  }

  async function shareQuoteViaWhatsApp() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant le transfert.", "error"); return; }
    saveQuote();
    renderPrint();
    setTransmissionMenuOpen(false);
    setTransmissionBusy(true);
    const message = transmissionMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      const result = await prepareTransmissionPdf();
      await openExternalUrl(url);
      toast(result?.saved ? "PDF créé dans Téléchargements — joignez-le dans WhatsApp." : "WhatsApp ouvert — créez puis joignez le PDF avant l’envoi.");
    } catch (error) {
      console.error(error);
      toast("WhatsApp n’a pas pu être ouvert.", "error");
    } finally {
      setTransmissionBusy(false);
    }
  }

  async function shareQuoteViaEmail() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant le transfert.", "error"); return; }
    saveQuote();
    renderPrint();
    setTransmissionMenuOpen(false);
    setTransmissionBusy(true);
    const message = transmissionMessage();
    const recipient = String(quote.client?.email || "").trim();
    try {
      const result = await prepareTransmissionPdf();
      if (!result?.saved || !result.filePath) throw new Error("Le PDF du devis n’a pas pu être créé.");
      if (typeof window.bcdevisDesktop?.composeEmail !== "function") {
        throw new Error("La création d’un brouillon avec pièce jointe n’est pas disponible.");
      }
      const composed = await window.bcdevisDesktop.composeEmail({
        to: recipient,
        subject: emailSubject(),
        body: message,
        attachmentPath: result.filePath
      });
      if (!composed?.opened || !composed?.attached) {
        throw new Error("Le client e-mail n’a pas confirmé la pièce jointe.");
      }
      toast(recipient
        ? `E-mail prêt pour ${recipient} — PDF joint.`
        : "E-mail prêt avec le PDF joint — saisissez le destinataire.");
    } catch (error) {
      console.error(error);
      toast("Impossible d’ouvrir un e-mail avec le PDF joint. Le PDF reste dans Téléchargements.", "error");
    } finally {
      setTransmissionBusy(false);
    }
  }

  async function shareQuoteViaOutlookWeb() {
    if (!quote.lines.length) { toast("Ajoutez un soin avant le transfert.", "error"); return; }
    saveQuote();
    renderPrint();
    setTransmissionMenuOpen(false);
    setTransmissionBusy(true);
    const message = transmissionMessage();
    const recipient = String(quote.client?.email || "").trim();
    try {
      const result = await prepareTransmissionPdf();
      await openExternalUrl(outlookWebComposeUrl(recipient, emailSubject(), message));
      toast(result?.saved
        ? `Outlook Web ouvert — joignez ${result.fileName || "le PDF"} depuis Téléchargements.`
        : "Outlook Web ouvert — créez puis joignez le PDF avant l’envoi.");
    } catch (error) {
      console.error(error);
      toast("Outlook Web n’a pas pu être ouvert. Le PDF reste dans Téléchargements.", "error");
    } finally {
      setTransmissionBusy(false);
    }
  }

  function switchMobilePanel(id) {
    closeTileDetail({ immediate: true });
    $("#familyPanel").classList.toggle("active-panel", id === "familyPanel");
    $("#checkoutPanel").classList.toggle("active-panel", id === "checkoutPanel");
    $$(".mobile-tabs [data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === id));
    syncToastPlacement();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "familyPanel") scheduleTileDensityAnalysis();
  }

  function syncPermanentCheckoutLayout() {
    const panel = $("#checkoutPanel");
    const permanent = window.matchMedia("(min-width: 1181px)").matches;
    panel.classList.toggle("is-full-height", permanent);
    document.documentElement.classList.toggle("checkout-focus", permanent);
    document.body.classList.toggle("checkout-focus", permanent);
  }

  function appMenuItems() {
    return $$('[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])', $("#appActionsMenu"));
  }

  function quoteMenuItems() {
    return $$('[role="menuitem"]:not([disabled])', $("#quoteActionMenu"));
  }

  function transmissionMenuItems() {
    return $$('[role="menuitem"]:not([disabled])', $("#checkoutTransmissionMenu"));
  }

  function syncContextMenuState() {
    const catalogMenuOpen = !$("#appActionsMenu").hidden;
    const hasOpenMenu = ["#appActionsMenu", "#quoteActionMenu", "#checkoutTransmissionMenu"]
      .some((selector) => !$(selector).hidden);
    document.documentElement.classList.toggle("bcdevis-catalog-menu-open", catalogMenuOpen);
    document.documentElement.classList.toggle("bcdevis-context-menu-open", hasOpenMenu);
  }

  function setTransmissionMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    const menu = $("#checkoutTransmissionMenu");
    const trigger = $("#checkoutTransmitButton");
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "Fermer les choix d’envoi" : "Choisir comment envoyer le devis");
    if (open) {
      closeTileDetail({ immediate: true });
      setAppMenuOpen(false);
      setQuoteMenuOpen(false);
    }
    syncContextMenuState();
    if (open && focusFirst) transmissionMenuItems()[0]?.focus();
    if (!open && restoreFocus) trigger.focus();
  }

  function setQuoteMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    const menu = $("#quoteActionMenu");
    const trigger = $("#moreQuoteButton");
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "Fermer les actions du devis" : "Ouvrir les actions du devis");
    if (open) {
      closeTileDetail({ immediate: true });
      setAppMenuOpen(false);
      setTransmissionMenuOpen(false);
    }
    syncContextMenuState();
    if (open && focusFirst) quoteMenuItems()[0]?.focus();
    if (!open && restoreFocus) trigger.focus();
  }

  function setAppMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    const menu = $("#appActionsMenu");
    const trigger = $("#appMenuButton");
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "Fermer le menu principal" : "Ouvrir le menu principal");
    if (open) {
      closeTileDetail({ immediate: true });
      setQuoteMenuOpen(false);
      setTransmissionMenuOpen(false);
    }
    syncContextMenuState();
    if (open && focusFirst) appMenuItems()[0]?.focus();
    if (!open && restoreFocus) trigger.focus();
  }

  function closeContextMenus() {
    if (!$("#appActionsMenu").hidden) setAppMenuOpen(false);
    if (!$("#quoteActionMenu").hidden) setQuoteMenuOpen(false);
    if (!$("#checkoutTransmissionMenu").hidden) setTransmissionMenuOpen(false);
  }

  function openHistoryLayer() {
    renderHistory();
    openLayer("historyLayer");
  }

  function openCustomItemLayer() {
    $("#customItemForm").reset();
    $("#customItemForm").elements.price.value = 0;
    $("#customItemForm").elements.duration.value = 30;
    $("#customItemForm").elements.saveToCatalog.checked = true;
    openLayer("customItemLayer");
  }

  function openSettingsLayer() {
    pendingTheme = currentTheme();
    pendingFont = currentFont();
    fillSettingsForm();
    setSettingsTab(activeSettingsTab, { resetScroll: true });
    openLayer("settingsLayer");
  }

  function closeMenusForShortcut() {
    closeContextMenus();
  }

  function setCatalogSearchOpen(open, { focus = false, clear = true } = {}) {
    const panel = $("#catalogSearchPanel");
    const toggle = $("#catalogSearchToggle");
    const input = $("#catalogSearch");
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer la recherche" : "Rechercher un soin");
    toggle.title = open ? "Fermer la recherche" : "Rechercher un soin";
    toggle.querySelector("use").setAttribute("href", open ? "#icon-x" : "#icon-search");
    if (!open && clear && searchQuery) {
      searchQuery = "";
      input.value = "";
      renderCatalog();
    }
    if (open && focus) window.setTimeout(() => input.focus(), 0);
  }

  $("#catalogSearch").addEventListener("input", (event) => { searchQuery = event.target.value; renderCatalog(); });
  $("#catalogSearchToggle").addEventListener("click", () => {
    const shouldOpen = $("#catalogSearchPanel").hidden;
    setCatalogSearchOpen(shouldOpen, { focus: shouldOpen });
  });
  $("#familyPriceToggle").addEventListener("click", toggleFamilyPrices);
  $("#offerModeSelector").addEventListener("click", (event) => {
    const button = event.target.closest("[data-offer-mode]");
    if (!button) return;
    requestOfferMode(button.dataset.offerMode);
  });
  $("#offerModeSelector").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) return;
    const button = event.target.closest("[data-offer-mode]");
    if (!button) return;
    event.preventDefault();
    moveRadioSelection(event.currentTarget, "[data-offer-mode]", button, ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
  });
  $("#familyList").addEventListener("click", (event) => {
    const detailToggle = event.target.closest("[data-tile-detail-toggle]");
    if (detailToggle) {
      const shell = detailToggle.closest("[data-density-card]");
      if (!shell) return;
      if (tileDetailPinned && tileDetailServiceId === shell.dataset.densityServiceId) closeTileDetail({ restoreFocus: true });
      else openTileDetail(shell, { pinned: true, focusCard: true });
      return;
    }
    const bodyModelButton = event.target.closest("button[data-body-model-choice]");
    if (bodyModelButton) {
      const model = bodyModelButton.dataset.bodyModelChoice;
      setBodyModel(model, `[data-body-model-choice="${model}"]`);
      return;
    }
    const serviceButton = event.target.closest("[data-family-service-id]");
    if (serviceButton) {
      const item = allServices().find((service) => String(service.id) === serviceButton.dataset.familyServiceId);
      if (item) addService(item, selectedOfferMode);
      return;
    }
    const bodyDetailButton = event.target.closest("button[data-body-detail]");
    if (bodyDetailButton) {
      activeBodyDetail = "body";
      activeFaceRegion = "";
      renderCatalog();
      window.setTimeout(() => $('[data-body-region="front-visage"]')?.focus(), 0);
      return;
    }
    const bodySideButton = event.target.closest("[data-body-side]");
    if (bodySideButton && bodySideButton.matches("button")) {
      const nextSide = bodySideButton.dataset.bodySide === "back" ? "back" : "front";
      if (nextSide !== activeBodySide && activeBodyRegion) {
        const visibleIds = new Set(visibleFamilyIds());
        const nextRegion = firstVisibleBodyRegion(nextSide, visibleIds, activeFamily);
        if (nextRegion) selectBodyRegion(nextRegion.id);
      }
      activeBodySide = nextSide;
      activeBodyDetail = "body";
      activeFaceRegion = "";
      renderCatalog();
      window.setTimeout(() => $(`[data-body-side="${activeBodySide}"]`)?.focus(), 0);
      return;
    }
    const faceRegion = event.target.closest("[data-face-region]");
    if (faceRegion) {
      const nextFaceRegion = faceRegionDefinition(faceRegion.dataset.faceRegion);
      if (!nextFaceRegion) return;
      activeFaceRegion = nextFaceRegion.id;
      searchQuery = "";
      $("#catalogSearch").value = "";
      setCatalogSearchOpen(false, { clear: false });
      renderCatalog();
      window.setTimeout(() => $(`[data-face-region="${nextFaceRegion.id}"]`)?.focus(), 0);
      return;
    }
    const bodyRegion = event.target.closest("[data-body-region]");
    if (bodyRegion) {
      const nextRegion = bodyRegionDefinition(bodyRegion.dataset.bodyRegion);
      if (!nextRegion || !visibleFamilyIds().includes(nextRegion.familyId)) return;
      selectBodyRegion(nextRegion.id);
      searchQuery = "";
      $("#catalogSearch").value = "";
      setCatalogSearchOpen(false, { clear: false });
      activeBodyDetail = nextRegion.id === "front-visage" ? "face" : "body";
      activeFaceRegion = "";
      renderCatalog();
      window.setTimeout(() => (activeBodyDetail === "face" ? $("[data-face-region]") : $(`[data-body-region="${nextRegion.id}"]`))?.focus(), 0);
      return;
    }
    const bodyFamily = event.target.closest("[data-body-family]");
    if (bodyFamily) {
      const nextFamily = bodyFamily.dataset.bodyFamily;
      if (!visibleFamilyIds().includes(nextFamily)) return;
      activeBodyRegion = null;
      activeBodyDetail = "body";
      activeFaceRegion = "";
      activeFamily = nextFamily;
      expandedFamily = nextFamily;
      searchQuery = "";
      $("#catalogSearch").value = "";
      setCatalogSearchOpen(false, { clear: false });
      renderCatalog();
      window.setTimeout(() => $(`button[data-body-family="${nextFamily}"]`)?.focus(), 0);
      return;
    }
    const button = event.target.closest("[data-family]");
    if (!button) return;
    const nextFamily = button.dataset.family;
    if (activeFamily === nextFamily) expandedFamily = expandedFamily === nextFamily ? null : nextFamily;
    else {
      activeFamily = nextFamily;
      expandedFamily = nextFamily;
    }
    searchQuery = "";
    $("#catalogSearch").value = "";
    setCatalogSearchOpen(false, { clear: false });
    renderCatalog();
  });
  $("#familyList").addEventListener("keydown", (event) => {
    const interactiveRegion = event.target.closest("svg [data-body-region], svg [data-face-region]");
    if (!interactiveRegion || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    interactiveRegion.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  $("#familyList").addEventListener("pointerover", (event) => {
    if (isCoarseTileInterface() || event.pointerType === "touch") return;
    const toggle = event.target.closest("[data-tile-detail-toggle]");
    if (!toggle || toggle.contains(event.relatedTarget) || tileDetailPinned) return;
    scheduleTileDetailOpenFromEye(toggle);
  });
  $("#familyList").addEventListener("pointerout", (event) => {
    if (isCoarseTileInterface() || event.pointerType === "touch") return;
    const toggle = event.target.closest("[data-tile-detail-toggle]");
    if (!toggle || toggle.contains(event.relatedTarget) || $("#tileDetailCard")?.contains(event.relatedTarget)) return;
    scheduleTileDetailClose();
  });
  $("#familyList").addEventListener("scroll", () => closeTileDetail({ immediate: true }), { passive: true });
  $("#tileDetailLayer").addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-tile-detail-add]");
    if (addButton) {
      const item = allServices().find((service) => String(service.id) === addButton.dataset.tileDetailAdd);
      if (item) addService(item, selectedOfferMode);
      closeTileDetail({ immediate: true });
      return;
    }
    if (event.target.closest("[data-tile-detail-close]")) closeTileDetail({ restoreFocus: true });
  });
  $("#tileDetailCard").addEventListener("pointerenter", () => window.clearTimeout(tileDetailCloseTimer));
  $("#tileDetailCard").addEventListener("pointerleave", () => scheduleTileDetailClose());
  document.addEventListener("pointerdown", (event) => {
    if (!tileDetailPinned) return;
    const activeShell = tileDetailServiceId ? $(`[data-density-service-id="${CSS.escape(tileDetailServiceId)}"]`) : null;
    if (event.target.closest("[data-tile-detail-close]") || $("#tileDetailCard").contains(event.target) || activeShell?.contains(event.target)) return;
    closeTileDetail();
  }, true);

  function closeCartDeleteActions(exceptLine = null) {
    $$(".cart-line.is-delete-revealed", $("#cartLines")).forEach((line) => {
      if (line === exceptLine) return;
      line.classList.remove("is-delete-revealed", "is-swiping");
      line.style.removeProperty("--cart-line-swipe-offset");
    });
  }

  function finishCartSwipe(event, { cancelled = false } = {}) {
    if (!cartSwipeState || event.pointerId !== cartSwipeState.pointerId) return;
    const state = cartSwipeState;
    cartSwipeState = null;
    const deltaX = event.clientX - state.startX;
    const baseOffset = state.startedRevealed ? -CART_DELETE_REVEAL_WIDTH : 0;
    const finalOffset = Math.max(-CART_DELETE_REVEAL_WIDTH, Math.min(0, baseOffset + deltaX));
    let shouldReveal = state.startedRevealed;
    if (!cancelled && state.horizontal) shouldReveal = finalOffset <= -(CART_DELETE_REVEAL_WIDTH / 2);
    if (!cancelled && !state.horizontal && !state.cancelledForScroll && state.startedRevealed) shouldReveal = false;
    state.line.classList.remove("is-swiping");
    state.line.classList.toggle("is-delete-revealed", shouldReveal);
    state.line.style.removeProperty("--cart-line-swipe-offset");
    try {
      if (state.captureElement.hasPointerCapture?.(event.pointerId)) state.captureElement.releasePointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events used by tests do not always own a real capture.
    }
  }

  $("#cartLines").addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || !["touch", "pen"].includes(event.pointerType) || event.button > 0) return;
    if (event.target.closest("button, input, textarea, select, a, label")) return;
    const main = event.target.closest(".cart-line-main");
    const line = main?.closest(".cart-line");
    if (!main || !line) return;
    closeCartDeleteActions(line);
    cartSwipeState = {
      pointerId: event.pointerId,
      line,
      captureElement: main,
      startX: event.clientX,
      startY: event.clientY,
      startedRevealed: line.classList.contains("is-delete-revealed"),
      horizontal: false,
      cancelledForScroll: false
    };
    try {
      main.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; the delegated listeners still work.
    }
  });

  $("#cartLines").addEventListener("pointermove", (event) => {
    const state = cartSwipeState;
    if (!state || event.pointerId !== state.pointerId || state.cancelledForScroll) return;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.horizontal) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < CART_SWIPE_START_THRESHOLD) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        state.cancelledForScroll = true;
        return;
      }
      state.horizontal = true;
      state.line.classList.add("is-swiping");
    }
    event.preventDefault();
    const baseOffset = state.startedRevealed ? -CART_DELETE_REVEAL_WIDTH : 0;
    const offset = Math.max(-CART_DELETE_REVEAL_WIDTH, Math.min(0, baseOffset + deltaX));
    state.line.style.setProperty("--cart-line-swipe-offset", `${offset}px`);
  });

  $("#cartLines").addEventListener("pointerup", (event) => finishCartSwipe(event));
  $("#cartLines").addEventListener("pointercancel", (event) => finishCartSwipe(event, { cancelled: true }));
  document.addEventListener("pointerdown", (event) => {
    const revealedLine = event.target.closest(".cart-line.is-delete-revealed");
    closeCartDeleteActions(revealedLine);
  }, true);

  $("#cartLines").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-line-action]");
    if (!actionButton) return;
    const line = lineFromElement(actionButton);
    if (!line) return;
    const action = actionButton.dataset.lineAction;
    if (action === "add-pack-free") {
      const pack = packDefaults();
      if (line.offerType !== "single" || pack.free <= 0 || line.quantity < pack.paid) return;
      line.offerType = "pack";
      line.freeQuantity = pack.free;
      selectedOfferMode = "pack";
      saveLocal(); renderCatalog(); renderCheckout();
      toast(`${line.name} · ${line.quantity} payées + ${line.freeQuantity} offerte${line.freeQuantity > 1 ? "s" : ""}`);
      return;
    }
    if (action === "increase") line.quantity = boundedInteger(line.quantity + 1, 1, MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
    if (action === "decrease") line.quantity = Math.max(1, line.quantity - 1);
    if (action === "increase-free") line.freeQuantity = boundedInteger(line.freeQuantity + 1, 0, MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
    if (action === "decrease-free") line.freeQuantity = Math.max(0, line.freeQuantity - 1);
    if (action === "remove") quote.lines = quote.lines.filter((item) => item.id !== line.id);
    saveLocal(); renderCatalog(); renderCheckout();
    if (["increase", "decrease", "increase-free", "decrease-free"].includes(action)) {
      let restoredControl = $(`[data-line-id="${line.id}"] [data-line-action="${action}"]`);
      if (restoredControl?.disabled) {
        const fallbackAction = action.startsWith("decrease") ? action.replace("decrease", "increase") : action.replace("increase", "decrease");
        restoredControl = $(`[data-line-id="${line.id}"] [data-line-action="${fallbackAction}"]`);
      }
      if (restoredControl) window.setTimeout(() => restoredControl.focus(), 0);
    }
  });
  $("#cartLines").addEventListener("change", (event) => { if (event.target.matches("[data-line-field]")) updateLineInput(event.target); });
  $("#cartLines").addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $(".cart-line.is-delete-revealed", $("#cartLines"))) {
      event.preventDefault();
      closeCartDeleteActions();
      return;
    }
    if (event.key === "Enter" && event.target.matches("[data-line-field]")) { event.preventDefault(); event.target.blur(); }
  });
  $("#quoteDate").addEventListener("change", (event) => {
    const previousDate = quote.date;
    quote.date = boundedQuoteDate(event.target.value);
    quote.validUntil = addDaysISO(quote.date, QUOTE_VALIDITY_DAYS);
    if (quote.date !== previousDate) quote.number = nextQuoteNumber(quote.date);
    event.target.value = quote.date;
    saveLocal();
  });
  $$("[data-discount-type]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.discountType === "percent" && studentPricingActive()) {
      toast("Le coupon en % n’est pas cumulable avec le tarif étudiant");
      return;
    }
    quote.discount.type = button.dataset.discountType;
    saveLocal();
    renderCheckout();
  }));
  $("#couponCode").addEventListener("input", (event) => {
    const code = String(event.target.value || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
    event.target.value = code;
    quote.discount.code = code;
    saveLocal();
    renderTotals();
  });
  $("#discountValue").addEventListener("input", (event) => { quote.discount.value = Math.max(0, Number(event.target.value) || 0); saveLocal(); renderCheckout(); });
  $("#couponToggle").addEventListener("click", () => {
    couponOpen = true;
    renderCheckout();
    window.setTimeout(() => $("#couponCode").focus(), 0);
  });
  $("#taxEnabled").addEventListener("change", (event) => { quote.tax.enabled = event.target.checked; saveLocal(); renderCheckout(); });

  $("#clientButton").addEventListener("click", openClient);
  $("#clientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    quote.client = { name: String(data.get("name") || "").trim(), phone: String(data.get("phone") || "").trim(), email: String(data.get("email") || "").trim(), address: String(data.get("address") || "").trim() };
    saveLocal(); renderClient(); renderHeader(); closeLayer("clientLayer"); toast("Client mis à jour");
  });
  $("#clearClientButton").addEventListener("click", () => { quote.client = { name: "", phone: "", email: "", address: "" }; saveLocal(); renderClient(); renderHeader(); closeLayer("clientLayer"); });

  $("#customItemForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = { id: `custom-${uid()}`, name: String(data.get("name") || "").trim(), price: Math.max(0, Number(data.get("price")) || 0), duration: Math.max(0, Number(data.get("duration")) || 0), categoryId: Number(data.get("category")) || 0, custom: true };
    if (!item.name) return;
    if (data.get("saveToCatalog")) db.customServices.push(clone(item));
    addService(item, selectedOfferMode); closeLayer("customItemLayer");
  });

  $("#tariffChangeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const layer = $("#tariffChangeLayer");
    const requestedMode = layer.dataset.requestedMode;
    if (!["single", "pack", "student"].includes(requestedMode)) return;
    db.settings.skipTariffChangeConfirmation = $("#tariffChangeSkipConfirmation").checked;
    closeLayer("tariffChangeLayer");
    applyOfferMode(requestedMode);
  });
  if (typeof window.bcdevisDesktop?.savePdf !== "function") {
    const button = $("#checkoutPdfButton");
    if (button) {
      button.title = "Ouvrir l’impression pour enregistrer au format PDF";
      button.setAttribute("aria-label", "Imprimer ou enregistrer au format PDF");
    }
  }
  $("#historyList").addEventListener("click", (event) => { const button = event.target.closest("[data-quote-id]"); if (button) loadHistoryQuote(button.dataset.quoteId); });
  $("#checkoutPrintButton").addEventListener("click", printQuote);
  $("#checkoutPdfButton").addEventListener("click", downloadPdf);
  $("#checkoutTransmitButton").addEventListener("click", (event) => {
    event.stopPropagation();
    setTransmissionMenuOpen($("#checkoutTransmissionMenu").hidden);
  });
  $("#checkoutTransmitButton").addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    setTransmissionMenuOpen(true, { focusFirst: true });
  });
  $("#checkoutTransmissionMenu").addEventListener("keydown", (event) => {
    const items = transmissionMenuItems();
    const index = items.indexOf(document.activeElement);
    let nextIndex = -1;
    if (event.key === "ArrowDown") nextIndex = index < 0 ? 0 : (index + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  });
  $("#checkoutWhatsAppButton").addEventListener("click", () => {
    setTransmissionMenuOpen(false);
    shareQuoteViaWhatsApp();
  });
  $("#checkoutOutlookWebButton").addEventListener("click", () => {
    setTransmissionMenuOpen(false);
    shareQuoteViaOutlookWeb();
  });
  $("#checkoutEmailButton").addEventListener("click", () => {
    setTransmissionMenuOpen(false);
    shareQuoteViaEmail();
  });
  $(".checkout-primary-actions").addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!$(".checkout-primary-actions").contains(document.activeElement)) setTransmissionMenuOpen(false);
    }, 0);
  });
  $("#themePicker").addEventListener("click", (event) => {
    const card = event.target.closest(".theme-card");
    if (!card) return;
    pendingTheme = card.dataset.theme;
    applyTheme(pendingTheme);
    syncThemePicker(pendingTheme);
  });
  $("#themePicker").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) return;
    const card = event.target.closest(".theme-card");
    if (!card) return;
    event.preventDefault();
    moveRadioSelection(event.currentTarget, ".theme-card", card, ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
  });
  $("#fontPicker").addEventListener("click", (event) => {
    const card = event.target.closest(".font-card");
    if (!card) return;
    pendingFont = card.dataset.font;
    applyFont(pendingFont);
    syncFontPicker(pendingFont);
  });
  $("#fontPicker").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) return;
    const card = event.target.closest(".font-card");
    if (!card) return;
    event.preventDefault();
    moveRadioSelection(event.currentTarget, ".font-card", card, ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
  });
  $("#settingsTabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-settings-tab]");
    if (tab) setSettingsTab(tab.dataset.settingsTab, { focus: true, resetScroll: true });
  });
  $("#settingsTabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = $$("#settingsTabs [role='tab']");
    const current = event.target.closest("[data-settings-tab]");
    const index = tabs.indexOf(current);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
    setSettingsTab(tabs[nextIndex].dataset.settingsTab, { focus: true, resetScroll: true });
  });
  $("#tileCatalogEditorButton").addEventListener("click", openTileCatalogEditor);
  $("#tileCatalogEditorSearch").addEventListener("input", filterTileCatalogEditor);
  $("#tileCatalogEditorList").addEventListener("input", (event) => {
    if (!event.target.closest("[data-tile-field]")) return;
    updateTileEditorSummary();
    if (event.target.matches('[data-tile-field="name"]')) filterTileCatalogEditor();
  });
  $("#tileCatalogEditorList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-tile-editor-card]");
    if (!card) return;
    if (event.target.closest("[data-tile-icon-picker]")) openCatalogIconPicker(card);
    if (event.target.closest("[data-tile-reset]")) resetTileEditorCard(card);
  });
  $("#tileCatalogEditorForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    saveTileCatalogEditor();
  });
  $("#tileCatalogResetAllButton").addEventListener("click", () => {
    if (!Object.keys(db.catalogOverrides || {}).length) {
      toast("Le catalogue utilise déjà ses valeurs d’origine");
      return;
    }
    if (!window.confirm("Rétablir le nom, le temps, le prix et le pictogramme d’origine de toutes les tuiles ?")) return;
    const previousOverrides = clone(db.catalogOverrides);
    db.catalogOverrides = {};
    if (!saveLocal()) {
      db.catalogOverrides = previousOverrides;
      return;
    }
    buildTileCatalogEditor();
    renderAll();
    toast("Toutes les tuiles ont été réinitialisées");
  });
  $("#tileIconPickerGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tile-icon-choice]");
    if (!button || !tileIconTargetCard?.isConnected) return;
    const icon = button.dataset.tileIconChoice;
    $('[data-tile-field="icon"]', tileIconTargetCard).value = icon;
    $(".tile-catalog-icon-button use", tileIconTargetCard)?.setAttribute("href", prestationIconHref(icon));
    updateTileEditorSummary();
    closeLayer("tileIconPickerLayer");
    tileIconTargetCard = null;
  });
  $("#settingsForm").addEventListener("input", (event) => {
    const name = event.target?.name;
    if (["quotePrefix", "machineName", "packPaidDefault", "packFreeDefault", "studentDiscount"].includes(name)) refreshSettingsPreview();
    if (name === "visibleFamilies") refreshSettingsPreview();
  });
  $$("[data-logo-input]").forEach((input) => input.addEventListener("change", async (event) => {
    const target = event.currentTarget;
    const kind = target.dataset.logoInput;
    const key = kind === "pdf" ? "pdfLogoDataUrl" : "headerLogoDataUrl";
    try {
      const value = await readLogoFile(target.files?.[0]);
      if (value) pendingLogos[key] = value;
      renderLogoPreviews();
      toast(kind === "pdf" ? "Logo du PDF prêt à être enregistré" : "Logo principal prêt à être enregistré");
    } catch (error) {
      toast(error.message || "Impossible d’ajouter ce logo.", "error");
    } finally {
      target.value = "";
    }
  }));
  $$("[data-logo-picker]").forEach((button) => button.addEventListener("click", () => {
    $(`[data-logo-input="${button.dataset.logoPicker}"]`)?.click();
  }));
  $$("[data-remove-logo]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.removeLogo === "pdf" ? "pdfLogoDataUrl" : "headerLogoDataUrl";
    pendingLogos[key] = "";
    renderLogoPreviews();
  }));
  $("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const desiredLaunchAtLogin = data.has("launchAtLogin");
    let savedLaunchAtLogin = db.settings.launchAtLogin === true;
    const submitButton = $('button[type="submit"]', event.currentTarget);
    if (launchAtLoginState.available && typeof window.bcdevisDesktop?.setLaunchAtLogin === "function") {
      submitButton.disabled = true;
      const previousSubmitLabel = submitButton.textContent;
      submitButton.textContent = "Application au système…";
      try {
        let result = {
          available: true,
          enabled: launchAtLoginState.enabled,
          status: launchAtLoginState.status
        };
        if (desiredLaunchAtLogin !== launchAtLoginState.enabled) {
          result = await window.bcdevisDesktop.setLaunchAtLogin(desiredLaunchAtLogin);
        }
        applyLaunchAtLoginResult(result);
        if (!result?.available || Boolean(result.enabled) !== desiredLaunchAtLogin) {
          throw new Error(launchAtLoginMessage(result));
        }
        savedLaunchAtLogin = Boolean(result.enabled);
      } catch (error) {
        console.error("Modification du démarrage automatique impossible.", error);
        toast(error?.message || "Le démarrage automatique n’a pas pu être modifié.", "error");
        return;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = previousSubmitLabel;
      }
    }
    const oldConditions = db.settings.conditions;
    db.settings = { ...db.settings,
      companyName: String(data.get("companyName") || "").trim() || defaultSettings.companyName,
      companySubtitle: String(data.get("companySubtitle") || "").trim(), companyAddress: String(data.get("companyAddress") || "").trim(),
      companyPhone: String(data.get("companyPhone") || "").trim(), companyEmail: String(data.get("companyEmail") || "").trim(), companyUid: String(data.get("companyUid") || "").trim(),
      headerLogoDataUrl: safeLogoDataUrl(pendingLogos.headerLogoDataUrl),
      pdfLogoDataUrl: safeLogoDataUrl(pendingLogos.pdfLogoDataUrl),
      quotePrefix: String(data.get("quotePrefix") || "DEV").trim().toUpperCase(), machineName: String(data.get("machineName") || "").trim() || defaultSettings.machineName, validityDays: QUOTE_VALIDITY_DAYS,
      taxRate: configuredTaxRate({ taxRate: data.get("taxRate") }),
      taxMode: data.get("taxMode") === "excluded" ? "excluded" : "included",
      showTaxInformation: data.has("showTaxInformation"),
      theme: KNOWN_THEMES.includes(pendingTheme) ? pendingTheme : currentTheme(),
      fontFamily: KNOWN_FONTS.includes(pendingFont) ? pendingFont : currentFont(),
      catalogMode: data.get("catalogMode") === "body" ? "body" : "tiles",
      ipadLayoutMode: IPAD_LAYOUT_MODES.includes(data.get("ipadLayoutMode")) ? data.get("ipadLayoutMode") : "off",
      launchAtLogin: savedLaunchAtLogin,
      packPaidDefault: boundedInteger(data.get("packPaidDefault"), 1, 24, 6), packFreeDefault: boundedInteger(data.get("packFreeDefault"), 0, 12, 0),
      studentDiscount: clamp(data.get("studentDiscount"), 0, 100),
      conditions: String(data.get("conditions") || "").trim(), studentConditions: String(data.get("studentConditions") || "").trim(), footerNote: String(data.get("footerNote") || "").trim(),
      showSignatures: data.has("showSignatures")
    };
    if (!quote.conditions || quote.conditions === oldConditions) quote.conditions = db.settings.conditions;
    const checkedFamilies = data.getAll("visibleFamilies").map(String).filter(Boolean);
    db.settings.visibleFamilies = checkedFamilies;
    const visibleIds = new Set(visibleFamilyIds());
    if (visibleIds.has(activeFamily)) expandedFamily = activeFamily;
    else { const first = visibleFamilies()[0]; activeFamily = first?.id || "all"; expandedFamily = first?.id || "all"; }
    applyTheme(db.settings.theme);
    applyFont(db.settings.fontFamily);
    applyIpadLayout(db.settings.ipadLayoutMode);
    if (!saveLocal()) return;
    renderAll(); closeLayer("settingsLayer"); toast("Réglages enregistrés");
  });

  $("#appMenuButton").addEventListener("click", (event) => {
    event.stopPropagation();
    setAppMenuOpen($("#appActionsMenu").hidden);
  });
  $("#appMenuButton").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setAppMenuOpen(true, { focusFirst: true });
  });
  $("#appActionsMenu").addEventListener("keydown", (event) => {
    const items = appMenuItems();
    const index = items.indexOf(document.activeElement);
    let nextIndex = -1;
    if (event.key === "ArrowDown") nextIndex = index < 0 ? 0 : (index + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  });
  $("#appActionsMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-app-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.appAction;
    setAppMenuOpen(false, { restoreFocus: true });
    if (action === "custom") openCustomItemLayer();
  });
  $("#settingsButton").addEventListener("click", openSettingsLayer);
  $("#shortcutHelpButton").addEventListener("click", () => openLayer("shortcutHelpLayer"));
  $("#newQuoteButton").addEventListener("click", createNewQuote);
  $("#saveButton").addEventListener("click", saveQuote);
  $("#historyButton").addEventListener("click", openHistoryLayer);
  $("#appActions").addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!$("#appActions").contains(document.activeElement)) setAppMenuOpen(false);
    }, 0);
  });
  $("#moreQuoteButton").addEventListener("click", (event) => {
    event.stopPropagation();
    setQuoteMenuOpen($("#quoteActionMenu").hidden);
  });
  $("#moreQuoteButton").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setQuoteMenuOpen(true, { focusFirst: true });
  });
  $("#quoteActionMenu").addEventListener("keydown", (event) => {
    const items = quoteMenuItems();
    const index = items.indexOf(document.activeElement);
    let nextIndex = -1;
    if (event.key === "ArrowDown") nextIndex = index < 0 ? 0 : (index + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  });
  $("#quoteActionMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    setQuoteMenuOpen(false, { restoreFocus: true });
    if (action === "duplicate") duplicateQuote();
    if (action === "export") exportQuote();
    if (action === "import") $("#quoteImportInput").click();
    if (action === "clear" && (quote.lines.length === 0 || window.confirm("Vider tous les soins de ce devis ?"))) {
      quote.lines = [];
      saveLocal();
      renderAll();
    }
  });
  $("#quoteHeadActions").addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!$("#quoteHeadActions").contains(document.activeElement)) setQuoteMenuOpen(false);
    }, 0);
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!$("#appActionsMenu").hidden && !target.closest("#appMenuButton, #appActionsMenu")) setAppMenuOpen(false);
    if (!$("#quoteActionMenu").hidden && !target.closest("#moreQuoteButton, #quoteActionMenu")) setQuoteMenuOpen(false);
    if (!$("#checkoutTransmissionMenu").hidden && !target.closest("#checkoutTransmitButton, #checkoutTransmissionMenu")) setTransmissionMenuOpen(false);
  }, true);
  window.addEventListener("blur", closeContextMenus);

  $("#quoteImportInput").addEventListener("change", async (event) => {
    try { const payload = await readJSONFile(event.target); if (!payload) return; quote = giveImportedQuoteANewIdentityIfNeeded(sanitizeQuote(payload.quote || payload)); couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0); if (!saveLocal()) return; renderAll(); toast("Devis importé"); }
    catch (error) { toast(error.message || "Import impossible", "error"); }
  });
  $("#exportBackupButton").addEventListener("click", exportBackup);
  $("#importBackupButton").addEventListener("click", () => $("#backupImportInput").click());
  $("#backupImportInput").addEventListener("change", async (event) => {
    try {
      const payload = await readJSONFile(event.target);
      if (!payload?.database || payload.type !== "atelier-devis-backup") throw new Error("Cette sauvegarde n’est pas compatible");
      if (!window.confirm("Restaurer cette sauvegarde remplacera les données locales actuelles. Continuer ?")) return;
      const previousDatabase = db;
      const previousQuote = quote;
      const previousCouponOpen = couponOpen;
      db = migrateDatabase({
        ...freshDatabase(),
        ...payload.database,
        version: APP_VERSION,
        settings: { ...defaultSettings, ...(isRecord(payload.database.settings) ? payload.database.settings : {}) },
        quoteCounters: isRecord(payload.database.quoteCounters) ? payload.database.quoteCounters : {},
        customServices: sanitizeCustomServices(payload.database.customServices),
        catalogOverrides: sanitizeCatalogOverrides(payload.database.catalogOverrides),
        quotes: isRecord(payload.database.quotes) ? payload.database.quotes : {}
      }, payload.database.version);
      normalizeSavedQuotes();
      quote = db.current ? sanitizeQuote(db.current) : newQuote();
      couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
      applyTheme(currentTheme());
      applyFont(currentFont());
      applyIpadLayout(currentIpadLayoutMode());
      if (!saveLocal()) {
        db = previousDatabase;
        quote = previousQuote;
        couponOpen = previousCouponOpen;
        applyTheme(currentTheme());
        applyFont(currentFont());
        applyIpadLayout(currentIpadLayoutMode());
        renderAll();
        renderHistory();
        return;
      }
      renderAll(); renderHistory(); closeLayer("historyLayer"); toast("Sauvegarde restaurée");
    } catch (error) { toast(error.message || "Restauration impossible", "error"); }
  });

  $$('[data-close]').forEach((button) => button.addEventListener("click", () => closeLayer(button.dataset.close)));
  $$(".mobile-tabs [data-panel]").forEach((button) => button.addEventListener("click", () => switchMobilePanel(button.dataset.panel)));
  document.addEventListener("keydown", (event) => {
    const layer = activeLayerId ? $(`#${activeLayerId}`) : null;
    if (event.key === "Tab" && layer && !layer.hidden) { trapLayerFocus(event, layer); return; }
    if (event.key === "Escape") {
      if (tileDetailServiceId) { event.preventDefault(); closeTileDetail({ restoreFocus: true }); return; }
      if (!$("#checkoutTransmissionMenu").hidden) { event.preventDefault(); setTransmissionMenuOpen(false, { restoreFocus: true }); return; }
      if (!$("#appActionsMenu").hidden) { event.preventDefault(); setAppMenuOpen(false, { restoreFocus: true }); return; }
      if (!$("#quoteActionMenu").hidden) { event.preventDefault(); setQuoteMenuOpen(false, { restoreFocus: true }); return; }
      if (layer && !layer.hidden) { event.preventDefault(); closeLayer(layer.id); return; }
      if (!$("#catalogSearchPanel").hidden) { event.preventDefault(); setCatalogSearchOpen(false); }
      else $$(".modal-layer:not([hidden]), .drawer-layer:not([hidden])").forEach((layer) => closeLayer(layer.id));
      return;
    }
    if (layer && !layer.hidden) return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (!command && event.altKey && event.code === "KeyM") {
      event.preventDefault();
      const shouldOpen = $("#appActionsMenu").hidden;
      setAppMenuOpen(shouldOpen, { focusFirst: shouldOpen, restoreFocus: !shouldOpen });
      return;
    }
    if (!command && event.altKey && event.code === "KeyP") {
      event.preventDefault();
      closeMenusForShortcut();
      switchMobilePanel("familyPanel");
      toggleFamilyPrices();
      return;
    }
    if (command && !event.altKey && key === "k") { event.preventDefault(); closeMenusForShortcut(); switchMobilePanel("familyPanel"); setCatalogSearchOpen(true, { focus: true }); return; }
    if (command && !event.altKey && key === "s" && !event.shiftKey) { event.preventDefault(); closeMenusForShortcut(); saveQuote(); return; }
    if (command && !event.altKey && event.shiftKey && key === "n") { event.preventDefault(); closeMenusForShortcut(); openCustomItemLayer(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "n") { event.preventDefault(); closeMenusForShortcut(); createNewQuote(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "h") { event.preventDefault(); closeMenusForShortcut(); openHistoryLayer(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "d") { event.preventDefault(); closeMenusForShortcut(); duplicateQuote(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "o") { event.preventDefault(); closeMenusForShortcut(); $("#quoteImportInput").click(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "e") { event.preventDefault(); closeMenusForShortcut(); exportQuote(); return; }
    if (command && !event.altKey && !event.shiftKey && key === "p") { event.preventDefault(); closeMenusForShortcut(); printQuote(); return; }
    if (command && !event.altKey && event.shiftKey && key === "s") { event.preventDefault(); closeMenusForShortcut(); downloadPdf(); return; }
    if (command && event.altKey && !event.shiftKey && event.code === "KeyW") { event.preventDefault(); closeMenusForShortcut(); shareQuoteViaWhatsApp(); return; }
    if (command && !event.altKey && !event.shiftKey && event.key === ",") { event.preventDefault(); closeMenusForShortcut(); openSettingsLayer(); return; }
    if (!command && !event.altKey && !isTextEntryTarget(event.target) && event.key === "/") { event.preventDefault(); closeMenusForShortcut(); switchMobilePanel("familyPanel"); setCatalogSearchOpen(true, { focus: true }); return; }
    if (!command && !event.altKey && !isTextEntryTarget(event.target) && event.key === "?") { event.preventDefault(); closeMenusForShortcut(); openLayer("shortcutHelpLayer"); }
  });
  window.addEventListener("beforeprint", renderPrint);
  window.addEventListener("beforeunload", () => saveLocal(false));
  window.addEventListener("resize", syncPermanentCheckoutLayout);
  window.addEventListener("resize", syncToastPlacement);
  window.addEventListener("resize", syncViewportMetrics);
  window.visualViewport?.addEventListener("resize", syncViewportMetrics);
  window.addEventListener("resize", () => {
    closeTileDetail({ immediate: true });
    scheduleTileDensityAnalysis();
  });
  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("PWA indisponible", error)));
  }

  const desktopWindow = window.bcdevisDesktop;
  const windowControls = $("#windowControls");
  if (windowControls && typeof desktopWindow?.minimizeWindow === "function") {
    const syncWindowControlState = (isMaximized) => {
      windowControls.dataset.maximized = String(Boolean(isMaximized));
      const maximizeButton = $("#windowMaximizeButton");
      const nextAction = isMaximized ? "Passer en mode tablette" : "Agrandir la fenêtre";
      maximizeButton.setAttribute("aria-label", nextAction);
      maximizeButton.title = nextAction;
    };
    $("#windowMinimizeButton").addEventListener("click", () => desktopWindow.minimizeWindow());
    $("#windowMaximizeButton").addEventListener("click", async () => syncWindowControlState(await desktopWindow.toggleMaximizeWindow()));
    $("#windowCloseButton").addEventListener("click", () => desktopWindow.closeWindow());
    desktopWindow.onWindowMaximized?.(syncWindowControlState);
    desktopWindow.isWindowMaximized?.().then(syncWindowControlState);
  }

  applyTheme(currentTheme());
  applyFont(currentFont());
  applyIpadLayout();
  syncViewportMetrics();
  syncPermanentCheckoutLayout();
  syncToastPlacement();
  saveLocal(false);
  renderAll();
  showReleaseNotesOnce();
})();
