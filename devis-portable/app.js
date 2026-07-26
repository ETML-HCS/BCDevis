(() => {
  "use strict";

  const STORAGE_KEY = "bcdevis-v1";
  // Keep the former names here so an update retains every existing quote.
  const LEGACY_STORAGE_KEYS = ["bellecour-atelier-devis-v3", "bellecour-atelier-devis-v2", "bellecour-atelier-devis-v1"];
  const APP_VERSION = 19;
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
  const LEGACY_DEFAULT_PAYMENT_CONDITIONS = "Le règlement peut s’effectuer à chaque séance ou par l’achat d’un pack. Les paiements sont acceptés par carte, en espèces, via TWINT, par virement bancaire ou par paiement échelonné. L’échelonnement est soumis à l’accord du partenaire financier.";
  const DEFAULT_PAYMENT_CONDITIONS = "Le règlement est exigible au fur et à mesure des séances ou lors de l’achat d’un forfait. Les moyens de paiement acceptés sont les cartes de paiement, les espèces, TWINT et le virement bancaire. Toute solution de paiement échelonné est soumise à l’acceptation préalable du partenaire financier.";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const { roundMoney, clamp, calculate, installmentMonths } = window.QuoteCore;
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
    showFamilyPrices: false,
    skipTariffChangeConfirmation: false,
    catalogMode: "tiles",
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

  function freshDatabase() {
    return { version: APP_VERSION, sequence: 0, quoteCounters: {}, settings: clone(defaultSettings), customServices: [], quotes: {}, current: null };
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
  let selectedOfferMode = "single";
  let searchQuery = "";
  let couponOpen = false;
  let toastTimer = null;
  let activeToast = null;
  let pendingTheme = "light";
  let pendingFont = "red-hat";
  let pendingLogos = { headerLogoDataUrl: "", pdfLogoDataUrl: "" };
  let activeLayerId = "";
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
      tax: { enabled: true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
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
      tax: { enabled: true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
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
        enabled: source.tax?.enabled !== false,
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
          name: String(line.name || line.description || "Prestation").trim().slice(0, 240) || "Prestation",
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

  function toast(message, type = "success") {
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

  function allServices() {
    return [...window.QUOTE_SERVICES, ...db.customServices].filter((item) => Number(item.categoryId) !== 36);
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
    return `#${document.getElementById(bodyMapId) ? bodyMapId : `icon-${normalized}`}`;
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
    if (mode === "student") return `Le rabais étudiant de ${rate}% sera appliqué à toutes les prestations. Les séances offertes des packs seront retirées.`;
    if (mode === "pack") return "Le rabais étudiant sera retiré de toutes les prestations. Chaque ligne passera au Pack avec les quantités configurées dans les réglages.";
    return "Le rabais étudiant sera retiré de toutes les prestations et les prix Séance seront rétablis.";
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
      single: { top: "Séance unique", hint: "Prix par séance" },
      pack: { top: `Pack ${paid} + ${free}`, hint: `${paid} payées + ${free} offerte${free === 1 ? "" : "s"}` },
      student: { top: `Étudiant −${studentDiscount}%`, hint: `Rabais de ${studentDiscount}% appliqué au total` }
    }[selectedOfferMode] || { top: "Séance unique", hint: "Prix par séance" };
    $$("[data-offer-mode]").forEach((button) => {
      const active = button.dataset.offerMode === selectedOfferMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
      button.tabIndex = active ? 0 : -1;
      button.title = "";
    });
    $("[data-offer-mode=\"pack\"] small").textContent = `${paid} + ${free} offerte${free === 1 ? "" : "s"}`;
    $("[data-offer-mode=\"student\"] small").textContent = `−${studentDiscount} %`;
    $("#activeOfferHint").textContent = content.hint;
    const currentOfferTop = $("#currentOfferTop");
    if (currentOfferTop) currentOfferTop.textContent = content.top;
  }
  function serviceMatchesSearch(item, needle = normalize(searchQuery)) {
    if (!needle) return true;
    const category = categoryFor(item.categoryId);
    return normalize(`${item.name} ${category.name} ${item.duration} ${item.price}`).includes(needle);
  }

  function familyServiceOption(item) {
    const display = offerDisplay();
    const added = quote.lines.some((line) => String(line.serviceId) === String(item.id) && line.offerType === selectedOfferMode);
    const durationLabel = item.duration ? ` (${item.duration} min)` : "";
    const visual = serviceVisual(item);
    return `<button class="family-option ${added ? "added" : ""}" type="button" data-family-service-id="${escapeHTML(item.id)}" aria-label="Ajouter ${escapeHTML(item.name)}${escapeHTML(durationLabel)} · Zone : ${escapeHTML(visual.zone)} · ${escapeHTML(display.label)}">
      <span class="service-zone-icon" title="${escapeHTML(visual.zone)}" aria-hidden="true"><svg><use href="${prestationIconHref(visual.icon)}"></use></svg></span>
      <span class="family-option-copy"><strong>${escapeHTML(item.name)}${escapeHTML(durationLabel)}</strong><small>${escapeHTML(visual.zone)}</small></span>
      <b class="family-option-price">${money(item.price)}</b>
      <svg class="family-option-add" aria-hidden="true"><use href="#icon-plus"></use></svg>
    </button>`;
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
  const BODY_SIDE_FAMILY_IDS = {
    front: new Set(["visage", "bras", "torse", "maillot", "jambes"]),
    back: new Set(["bras", "dos", "maillot", "jambes"])
  };
  const BODY_AUXILIARY_FAMILY_IDS = ["electrolyse", "medecine", "combinees", "consultations"];

  function bodyRegionMarkup(familyId, label, shapes, visibleIds) {
    const enabled = visibleIds.has(familyId);
    const active = activeFamily === familyId;
    return `<g class="body-region${active ? " active" : ""}${enabled ? "" : " disabled"}" ${enabled ? `data-body-family="${familyId}" role="button" tabindex="0" aria-label="${escapeHTML(label)}" aria-pressed="${active}"` : 'aria-hidden="true"'}>${shapes}</g>`;
  }

  function bodyMapMarkup(side, visibleIds) {
    const region = (familyId, label, shapes) => bodyRegionMarkup(familyId, label, shapes, visibleIds);
    if (side === "back") {
      return `<svg class="interactive-body-map" viewBox="0 0 220 560" role="group" aria-labelledby="bodyMapBackTitle bodyMapBackDescription">
        <title id="bodyMapBackTitle">Corps humain vu de dos</title>
        <desc id="bodyMapBackDescription">Choisissez une zone du corps pour afficher les prestations correspondantes.</desc>
        ${region("medecine", "Cuir chevelu", '<path class="body-region-shape" d="M84 39c0-22 10-34 26-34s26 12 26 34c0 14-5 26-12 33H96c-7-7-12-19-12-33Z"/>')}
        ${region("dos", "Nuque et dos", '<path class="body-region-shape" d="M96 70h28l4 14 25 10c13 5 19 17 17 32l-11 111c-13 11-30 17-49 17s-36-6-49-17L50 126c-2-15 4-27 17-32l25-10 4-14Z"/><path class="body-region-detail" d="M110 82v154M69 119c24 13 58 13 82 0M64 179c29-10 63-10 92 0"/>')}
        ${region("bras", "Bras, avant-bras et mains", '<path class="body-region-shape" d="M65 94c-12 1-21 9-25 23L17 242c-2 12 13 16 18 5l38-108 7-35-15-10Zm90 0c12 1 21 9 25 23l23 125c2 12-13 16-18 5l-38-108-7-35 15-10Z"/><path class="body-region-shape" d="M14 241c-7 9-7 24 0 34l11 14c5 6 14 0 11-7l-5-15 9 12c5 6 13-1 9-7l-15-28-20-3Zm192 0c7 9 7 24 0 34l-11 14c-5 6-14 0-11-7l5-15-9 12c-5 6-13-1-9-7l15-28 20-3Z"/>')}
        ${region("jambes", "Fesses, cuisses, jambes et pieds", '<path class="body-region-shape" d="M61 230c8 21 25 32 49 32s41-11 49-32l5 47-18 108-8 143H91L74 385 56 277l5-47Z"/><path class="body-region-detail" d="M66 258c11-10 26-8 44 7 18-15 33-17 44-7M110 265v263M74 385h72"/><path class="body-region-shape" d="M91 520h31l-3 30H77c-6 0-8-8-3-11l17-19Zm38 0h-31l3 30h42c6 0 8-8 3-11l-17-19Z"/>')}
        ${region("maillot", "Sillon interfessier", '<path class="body-region-focus" d="M110 264v53"/><circle class="body-region-target" cx="110" cy="290" r="12"/>')}
      </svg>`;
    }
    return `<svg class="interactive-body-map" viewBox="0 0 220 560" role="group" aria-labelledby="bodyMapFrontTitle bodyMapFrontDescription">
      <title id="bodyMapFrontTitle">Corps humain vu de face</title>
      <desc id="bodyMapFrontDescription">Choisissez une zone du corps pour afficher les prestations correspondantes.</desc>
      ${region("visage", "Visage et cou", '<path class="body-region-shape" d="M84 39c0-22 10-34 26-34s26 12 26 34c0 20-11 38-26 43-15-5-26-23-26-43Z"/><path class="body-region-shape" d="M97 74h26l4 24H93l4-24Z"/><path class="body-region-detail" d="M96 39h8m12 0h8M103 61c5 3 9 3 14 0"/>')}
      ${region("torse", "Torse et ventre", '<path class="body-region-shape" d="M93 84c9 7 25 7 34 0l27 11c13 5 18 17 16 32l-11 112c-13 9-29 14-49 14s-36-5-49-14L50 127c-2-15 3-27 16-32l27-11Z"/><path class="body-region-detail" d="M70 126c24-13 56-13 80 0M64 177c29-8 63-8 92 0M110 130v109"/><circle class="body-region-detail-fill" cx="110" cy="194" r="3"/>')}
      ${region("bras", "Aisselles, bras, avant-bras et mains", '<path class="body-region-shape" d="M65 94c-12 1-21 9-25 23L17 242c-2 12 13 16 18 5l38-108 7-35-15-10Zm90 0c12 1 21 9 25 23l23 125c2 12-13 16-18 5l-38-108-7-35 15-10Z"/><circle class="body-region-detail-fill" cx="69" cy="123" r="7"/><circle class="body-region-detail-fill" cx="151" cy="123" r="7"/><path class="body-region-shape" d="M14 241c-7 9-7 24 0 34l11 14c5 6 14 0 11-7l-5-15 9 12c5 6 13-1 9-7l-15-28-20-3Zm192 0c7 9 7 24 0 34l-11 14c-5 6-14 0-11-7l5-15-9 12c-5 6-13-1-9-7l15-28 20-3Z"/>')}
      ${region("maillot", "Maillot et zone intime", '<path class="body-region-shape" d="M61 230c13 9 29 14 49 14s36-5 49-14l4 47-29 44h-48l-29-44 4-47Z"/><path class="body-region-detail" d="M61 253 110 296l49-43M110 296v21"/>')}
      ${region("jambes", "Cuisses, genoux, jambes, pieds et orteils", '<path class="body-region-shape" d="M57 274 86 315l9 68-13 145h38l-2-145-8-67-8 67-2 145h38l-13-145 9-68 29-41-4 4-25 43H86l-25-43-4-4Z"/><circle class="body-region-detail-fill" cx="91" cy="383" r="9"/><circle class="body-region-detail-fill" cx="129" cy="383" r="9"/><path class="body-region-shape" d="M82 520h38l-2 30H76c-6 0-8-8-3-11l9-19Zm56 0h-38l2 30h42c6 0 8-8 3-11l-9-19Z"/>')}
    </svg>`;
  }

  function renderBodySelector() {
    const visible = visibleFamilies();
    const visibleIds = new Set(visible.map((family) => family.id));
    let selectedFamily = visible.find((family) => family.id === activeFamily);
    if (!selectedFamily) {
      selectedFamily = visible.find((family) => BODY_FAMILY_IDS.has(family.id)) || visible[0];
      activeFamily = selectedFamily?.id || "visage";
      expandedFamily = activeFamily;
    }
    const needle = normalize(searchQuery);
    const visibleCategoryIds = new Set(visible.flatMap((family) => family.categoryIds.map(Number)));
    const services = needle
      ? allServices().filter((item) => visibleCategoryIds.has(Number(item.categoryId)) && serviceMatchesSearch(item, needle))
      : allServices().filter((item) => selectedFamily && serviceInFamily(item, selectedFamily));
    const resultTitle = needle ? "Résultats de recherche" : selectedFamily?.name || "Prestations";
    const resultDescription = needle
      ? `${plural(services.length, "soin")} correspondant à « ${searchQuery.trim()} »`
      : selectedFamily?.description || "Choisissez une zone sur la silhouette.";
    const options = services.length
      ? `<div class="family-options body-service-options" role="group" aria-label="Soins ${escapeHTML(resultTitle)}">${services.map(familyServiceOption).join("")}</div>`
      : `<div class="body-results-empty"><svg aria-hidden="true"><use href="#icon-search"></use></svg><strong>Aucun soin dans cette zone</strong><small>${needle ? "Essayez un autre terme." : "Cette famille est vide ou masquée dans les réglages."}</small></div>`;
    const auxiliary = BODY_AUXILIARY_FAMILY_IDS.map((id) => visible.find((family) => family.id === id)).filter(Boolean);
    $("#familyList").innerHTML = `<div class="body-selector" data-body-side="${activeBodySide}">
      <div class="body-selector-layout">
        <section class="body-map-card" aria-labelledby="bodySelectorTitle">
          <div class="body-map-card-head"><div><span>Navigation corporelle</span><strong id="bodySelectorTitle">Sélectionnez une zone</strong></div><div class="body-side-toggle" role="group" aria-label="Vue du corps"><button type="button" data-body-side="front" aria-pressed="${activeBodySide === "front"}">Avant</button><button type="button" data-body-side="back" aria-pressed="${activeBodySide === "back"}">Arrière</button></div></div>
          <div class="body-map-stage">${bodyMapMarkup(activeBodySide, visibleIds)}</div>
          <p class="body-map-hint"><svg aria-hidden="true"><use href="#icon-body"></use></svg>Cliquez ou utilisez Tab puis Entrée sur une partie du corps.</p>
        </section>
        <section class="body-results" aria-live="polite" aria-labelledby="bodyResultsTitle">
          <div class="body-results-head"><span>Zone sélectionnée</span><h3 id="bodyResultsTitle">${escapeHTML(resultTitle)}</h3><p>${escapeHTML(resultDescription)}</p></div>
          ${options}
        </section>
      </div>
      ${auxiliary.length ? `<div class="body-auxiliary"><span>Autres prestations</span><div>${auxiliary.map((family) => `<button type="button" data-body-family="${family.id}" class="${activeFamily === family.id ? "active" : ""}"><svg aria-hidden="true"><use href="${prestationIconHref(family.icon)}"></use></svg><strong>${escapeHTML(family.name)}</strong><small>${plural(allServices().filter((item) => serviceInFamily(item, family)).length, "soin")}</small></button>`).join("")}</div></div>` : ""}
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
    saveLocal(false);
  }

  function renderCatalog() {
    renderOfferMode();
    if (currentCatalogMode() === "body") renderBodySelector();
    else renderFamilies();
  }
  function addService(item, offerType = "single") {
    const offer = ["single", "pack", "student"].includes(offerType) ? offerType : "single";
    const existing = quote.lines.find((line) => String(line.serviceId) === String(item.id) && line.offerType === offer);
    if (existing && offer === "pack") {
      toast(`${item.name} · ce pack est déjà dans la caisse`);
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
    const desktopEmailAvailable = typeof window.bcdevisDesktop?.composeEmail === "function"
      && typeof window.bcdevisDesktop?.savePdf === "function";
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
      $("#clientName").textContent = "Ajouter un client";
      $("#clientDetails").textContent = "Nom, téléphone et e-mail";
    }
  }

  function renderCart() {
    const container = $("#cartLines");
    $("#cartItemCount").textContent = quote.lines.length ? plural(quote.lines.length, "prestation") : "Aucune prestation";
    $("#mobileCartCount").textContent = quote.lines.length;
    if (!quote.lines.length) {
      container.innerHTML = `<div class="cart-empty"><svg><use href="#icon-empty"></use></svg><strong>Ajoutez une prestation</strong><p>Les options de paiement apparaîtront ensuite.</p></div>`;
      return;
    }
    container.innerHTML = quote.lines.map((line) => {
      const category = categoryFor(line.categoryId);
      const isPack = line.offerType === "pack";
      const pack = packDefaults();
      const canAddPackOffer = line.offerType === "single" && pack.free > 0 && line.quantity >= pack.paid;
      const categoryLabel = category.short.toLocaleLowerCase("fr-CH");
      const paidControl = `<span class="quantity-group quantity-group-inline${isPack ? " is-pack" : ""}">${isPack ? "<small>Payées</small>" : ""}<button class="quantity-value" type="button" data-quantity-gesture="paid" aria-label="${line.quantity} séance${line.quantity > 1 ? "s" : ""} payée${line.quantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.quantity}</button></span>`;
      const freeControl = isPack ? `<span class="quantity-group quantity-group-inline is-pack free"><small>Offertes</small><button class="quantity-value" type="button" data-quantity-gesture="free" aria-label="${line.freeQuantity} séance${line.freeQuantity > 1 ? "s" : ""} offerte${line.freeQuantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.freeQuantity}</button></span>` : "";
      const packOfferAction = canAddPackOffer ? `<button class="pack-offer-action" type="button" data-line-action="add-pack-free" aria-label="Ajouter ${pack.free} séance${pack.free > 1 ? "s" : ""} offerte${pack.free > 1 ? "s" : ""}">Ajouter ${pack.free} offerte${pack.free > 1 ? "s" : ""}</button>` : "";
      return `<article class="cart-line offer-${line.offerType}" data-line-id="${line.id}">
        <div class="cart-line-info"><span class="cart-line-name-row"><input class="cart-line-name" data-line-field="name" value="${escapeHTML(line.name)}" title="${escapeHTML(line.name)}" aria-label="Nom de la prestation : ${escapeHTML(line.name)}"></span>${packOfferAction}</div>
        <div class="cart-line-inline-controls"><span class="cart-line-category" title="${escapeHTML(category.name)}">(${escapeHTML(categoryLabel)})</span>${paidControl}${freeControl}<strong class="cart-line-price">${money(line.price)}</strong><button class="remove-line" type="button" data-line-action="remove" aria-label="Supprimer"><svg><use href="#icon-trash"></use></svg></button></div>
      </article>`;
    }).join("");
  }
  function renderTotals() {
    const totals = calculate(quote);
    $("#subtotalValue").textContent = money(totals.subtotal);
    $("#studentDiscountTotalRow").hidden = totals.studentDiscount <= 0;
    $("#studentDiscountTotalLabel").textContent = `Rabais étudiant (${totals.studentRate}%)`;
    $("#studentDiscountTotalValue").textContent = `− ${money(totals.studentDiscount)}`;
    $("#discountTotalRow").hidden = totals.discount <= 0;
    $("#discountTotalLabel").textContent = quote.discount.code ? `Coupon · ${quote.discount.code}` : "Coupon";
    $("#discountTotalValue").textContent = `− ${money(totals.discount)}`;
    $("#netTotalRow").hidden = !quote.tax.enabled;
    $("#netTotalValue").textContent = money(totals.net);
    $("#taxTotalRow").hidden = !quote.tax.enabled;
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
  }

  function renderCheckout() {
    const previousCouponType = quote.discount.type;
    enforceStudentCouponRule();
    if (quote.discount.type !== previousCouponType) saveLocal(false);
    const hasLines = quote.lines.length > 0;
    $("#checkoutPanel").classList.toggle("is-empty", !hasLines);
    ["saveButton", "checkoutPrintButton", "checkoutPdfButton", "checkoutTransmitButton", "checkoutWhatsAppButton"].forEach((id) => {
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
    $("#taxEnabled").checked = Boolean(quote.tax.enabled);
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
    if (field === "name") line.name = input.value.trim() || "Prestation";
    if (field === "quantity") line.quantity = boundedInteger(input.value, 1, MAX_LINE_QUANTITY, 1);
    if (field === "price") line.price = boundedNumber(input.value, 0, MAX_LINE_PRICE, 0);
    if (field === "freeQuantity") line.freeQuantity = boundedInteger(input.value, 0, MAX_LINE_QUANTITY, 0);
    saveLocal();
    renderCart();
    renderTotals();
  }

  function openLayer(id) {
    const layer = $(`#${id}`);
    if (!layer) return;
    const previousFocus = document.activeElement;
    if (previousFocus instanceof HTMLElement) layerReturnFocus.set(id, previousFocus);
    layer.hidden = false;
    activeLayerId = id;
    [$("#appShell"), $("#mobileTabs"), $("#toastRegion")].filter(Boolean).forEach((element) => { element.inert = true; });
    const initialFocus = $("[autofocus], [data-initial-focus], .history-list button, button[data-close]", layer);
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
    const remainingLayer = $$(".modal-layer:not([hidden]), .drawer-layer:not([hidden])").at(-1);
    if (remainingLayer) {
      activeLayerId = remainingLayer.id;
      return;
    }
    [$("#appShell"), $("#mobileTabs"), $("#toastRegion")].filter(Boolean).forEach((element) => { element.inert = false; });
    const previousFocus = layerReturnFocus.get(id);
    layerReturnFocus.delete(id);
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
      const totals = calculate(item);
      return `<button class="history-item ${item.id === quote.id ? "current" : ""}" type="button" data-quote-id="${item.id}">
        <span class="history-item-head"><strong>${escapeHTML(item.number)}</strong><b>${money(totals.total)}</b></span>
        <span class="history-item-client">${escapeHTML(item.client?.name || "Client à compléter")}</span>
        <span class="history-item-meta"><span>${formatDate(item.date)} · ${plural(item.lines?.length || 0, "prestation")}</span><span class="history-status">Enregistré</span></span>
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
      return `<label class="family-visibility-item" data-family-id="${family.id}">\n        <input type="checkbox" name="visibleFamilies" value="${family.id}" ${checked ? "checked" : ""}>\n        <span class="family-visibility-icon" aria-hidden="true"><svg><use href="${prestationIconHref(family.icon)}"></use></svg></span>\n        <span class="family-visibility-copy"><strong>${escapeHTML(family.name)}</strong><small>${escapeHTML(family.description || "")}</small></span>\n      </label>`;
    }).join("");
  }

  function fillSettingsForm() {
    const form = $("#settingsForm");
    Object.entries(db.settings).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    if (form.elements.showSignatures) form.elements.showSignatures.checked = db.settings.showSignatures !== false;
    pendingLogos = {
      headerLogoDataUrl: safeLogoDataUrl(db.settings.headerLogoDataUrl),
      pdfLogoDataUrl: safeLogoDataUrl(db.settings.pdfLogoDataUrl)
    };
    renderLogoPreviews();
    buildFamilyVisibilityGrid();
    refreshSettingsPreview();
    syncThemePicker(currentTheme());
    syncFontPicker(currentFont());
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
    if (headerStatus) headerStatus.textContent = headerLogo ? "Logo personnalisé prêt" : "Logo Bellecour par défaut";
    if (pdfStatus) pdfStatus.textContent = pdfLogo ? "Logo PDF personnalisé prêt" : headerLogo ? "Logo de l’application réutilisé" : "Logo Bellecour par défaut";
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
    if (packSummary) packSummary.textContent = totalPack > 0 ? `${paid} payée${paid > 1 ? "s" : ""} + ${free} offerte${free > 1 ? "s" : ""} = ${totalPack} séance${totalPack > 1 ? "s" : ""}${free > 0 ? ` (1 séance gratuite pour ${Math.round(totalPack / free)} achetées en moy.)` : ""}` : "";
    const student = Math.max(0, Math.min(100, Math.round(Number(form.elements.studentDiscount?.value) || 0)));
    const studentOutput = form.querySelector("[data-student-discount]");
    if (studentOutput) studentOutput.textContent = `${student} %`;
    const studentSummary = document.querySelector('[data-summary="student"]');
    if (studentSummary) studentSummary.textContent = student > 0 ? `Le client paie ${100 - student}% du prix séance${student >= 100 ? " (gratuit)" : ""}.` : "";
    const familySummary = document.querySelector('[data-summary="families"]');
    if (familySummary) {
      const checkedFamilies = form.elements.visibleFamilies ? Array.from(form.elements.visibleFamilies).filter((input) => input.checked) : [];
      const total = selectableFamilies().length;
      familySummary.textContent = checkedFamilies.length === 0
        ? `Aucune famille sélectionnée — le catalogue affichera l’intégralité des prestations par défaut.`
        : `${checkedFamilies.length} famille${checkedFamilies.length === 1 ? "" : "s"} visible${checkedFamilies.length === 1 ? "" : "s"} sur ${total}.`;
    }
  }

  function printLayoutClass(totals, months, studentConditions) {
    const conditions = String(quote.conditions || db.settings.conditions || "").trim();
    const footerNote = String(db.settings.footerNote || "").trim();
    const conditionsLength = conditions.length + footerNote.length + studentConditions.length;
    const adjustmentRows = 2
      + (totals.studentDiscount > 0 ? 1 : 0)
      + (totals.discount > 0 ? 1 : 0)
      + (quote.tax.enabled ? 2 : 0);
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
    const totals = calculate(quote);
    const settings = db.settings;
    const client = quote.client;
    const months = installmentMonths(totals.total);
    const contact = [settings.companyPhone, settings.companyEmail].filter(Boolean).join(" · ");
    const clientContact = [client.phone, client.email].filter(Boolean).join(" · ");
    const rows = quote.lines.map((line) => {
      const quantityLabel = line.offerType === "pack" ? `${line.quantity} payées + ${line.freeQuantity} offerte${line.freeQuantity === 1 ? "" : "s"}` : String(line.quantity);
      const unitPrice = line.offerType === "student" ? Number(line.basePrice ?? line.price) || 0 : Number(line.price) || 0;
      return `<tr><td><span class="print-item-name">${escapeHTML(line.name)}</span><span class="print-item-meta">${escapeHTML(offerLabel(line))} · ${escapeHTML(categoryFor(line.categoryId).name)}</span></td><td>${quantityLabel}</td><td>${money(unitPrice)}</td><td>${money(unitPrice * line.quantity)}</td></tr>`;
    }).join("");
    const couponName = quote.discount.code ? `Coupon ${quote.discount.code}` : "Coupon";
    const discountLabel = quote.discount.type === "percent" ? `${couponName} (${Number(quote.discount.value) || 0} %)` : couponName;
    const studentConditions = quote.lines.some((line) => line.offerType === "student") ? String(settings.studentConditions || "").trim() : "";
    const customLogoSource = safeLogoDataUrl(settings.pdfLogoDataUrl) || safeLogoDataUrl(settings.headerLogoDataUrl);
    const logoSource = customLogoSource || defaultLogoForPrint();
    const logoClass = customLogoSource ? "print-logo print-logo-custom" : "print-logo print-logo-official";
    const brandCopy = customLogoSource ? `<div class="print-brand-copy"><div class="print-company-kicker">${escapeHTML(settings.companySubtitle || "Établissement")}</div><div class="print-company-name">${escapeHTML(settings.companyName)}</div></div>` : "";
    const signatureBlock = settings.showSignatures !== false
      ? `<div class="print-signature"><div><span>Date et lieu</span></div><div><span>Signature du client et mention « Bon pour accord »</span></div></div>`
      : "";
    const totalLabel = quote.tax.enabled ? "Total TTC" : "Total";
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
        <div class="print-section-heading"><div><strong>Détail des prestations</strong></div></div>
        <table class="print-table"><thead><tr><th>Prestation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <div class="print-closing">
        <div class="print-summary print-summary-totals-only"><table class="print-totals"><tr><td>Sous-total</td><td>${money(totals.subtotal)}</td></tr>${totals.studentDiscount > 0 ? `<tr class="discount"><td>Rabais étudiant (${totals.studentRate} %)</td><td>− ${money(totals.studentDiscount)}</td></tr>` : ""}${totals.discount > 0 ? `<tr class="discount"><td>${escapeHTML(discountLabel)}</td><td>− ${money(totals.discount)}</td></tr>` : ""}${quote.tax.enabled ? `<tr><td>Net HT</td><td>${money(totals.net)}</td></tr><tr><td>TVA ${totals.rate} %${quote.tax.mode === "included" ? " incluse" : ""}</td><td>${money(totals.tax)}</td></tr>` : ""}<tr class="total"><td>${totalLabel}</td><td>${money(totals.total)}</td></tr></table></div>
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
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant l’impression.", "error"); return; }
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
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant le téléchargement.", "error"); return; }
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
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant le transfert.", "error"); return; }
    const totals = calculate(quote);
    const clientName = String(quote.client?.name || "").trim();
    const lines = quote.lines.map((line) => {
      const name = String(line.name || "Prestation").trim().replace(/[\s—–-]+$/u, "").trim() || "Prestation";
      const quantity = Math.max(0, Number(line.quantity) || 0);
      const unitPrice = line.offerType === "student"
        ? Math.max(0, Number(line.basePrice ?? line.price) || 0)
        : Math.max(0, Number(line.price) || 0);
      if (line.offerType === "pack") {
        const paid = `${quantity} payée${quantity > 1 ? "s" : ""}`;
        const offeredQuantity = Math.max(0, Number(line.freeQuantity) || 0);
        const offered = offeredQuantity ? ` et ${offeredQuantity} offerte${offeredQuantity > 1 ? "s" : ""}` : "";
        return `• ${name} : ${paid}${offered}, ${money(unitPrice)} par séance, soit ${money(unitPrice * quantity)}`;
      }
      return `• ${name} : ${quantity} × ${money(unitPrice)}, soit ${money(unitPrice * quantity)}`;
    });
    const summary = [`Sous-total : ${money(totals.subtotal)}`];
    if (totals.studentDiscount > 0) summary.push(`Rabais étudiant (${totals.studentRate} %) : ${money(totals.studentDiscount)}`);
    if (totals.discount > 0) {
      const label = quote.discount.code ? `Coupon ${quote.discount.code}` : "Réduction";
      summary.push(`${label} : ${money(totals.discount)}`);
    }
    if (quote.tax.enabled && totals.tax > 0) {
      summary.push(`TVA ${totals.rate} %${quote.tax.mode === "included" ? " incluse" : ""} : ${money(totals.tax)}`);
    }
    summary.push(`Total : ${money(totals.total)}`);
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

  function setTransmissionBusy(busy) {
    ["#checkoutTransmitButton", "#checkoutWhatsAppButton", "#checkoutEmailButton"]
      .map((selector) => $(selector))
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = busy;
        if (busy) button.setAttribute("aria-busy", "true");
        else button.removeAttribute("aria-busy");
      });
  }

  async function shareQuoteViaWhatsApp() {
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant le transfert.", "error"); return; }
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
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant le transfert.", "error"); return; }
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

  function switchMobilePanel(id) {
    $("#familyPanel").classList.toggle("active-panel", id === "familyPanel");
    $("#checkoutPanel").classList.toggle("active-panel", id === "checkoutPanel");
    $$(".mobile-tabs [data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function setTransmissionMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    const menu = $("#checkoutTransmissionMenu");
    const trigger = $("#checkoutTransmitButton");
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "Fermer les choix d’envoi" : "Choisir comment envoyer le devis");
    if (open) {
      setAppMenuOpen(false);
      setQuoteMenuOpen(false);
    }
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
      setAppMenuOpen(false);
      setTransmissionMenuOpen(false);
    }
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
      setQuoteMenuOpen(false);
      setTransmissionMenuOpen(false);
    }
    if (open && focusFirst) appMenuItems()[0]?.focus();
    if (!open && restoreFocus) trigger.focus();
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
    openLayer("settingsLayer");
  }

  function closeMenusForShortcut() {
    if (!$("#appActionsMenu").hidden) setAppMenuOpen(false);
    if (!$("#quoteActionMenu").hidden) setQuoteMenuOpen(false);
    if (!$("#checkoutTransmissionMenu").hidden) setTransmissionMenuOpen(false);
  }

  function setCatalogSearchOpen(open, { focus = false, clear = true } = {}) {
    const panel = $("#catalogSearchPanel");
    const toggle = $("#catalogSearchToggle");
    const input = $("#catalogSearch");
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer la recherche" : "Rechercher une prestation");
    toggle.title = open ? "Fermer la recherche" : "Rechercher une prestation";
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
    const serviceButton = event.target.closest("[data-family-service-id]");
    if (serviceButton) {
      const item = allServices().find((service) => String(service.id) === serviceButton.dataset.familyServiceId);
      if (item) addService(item, selectedOfferMode);
      return;
    }
    const bodySideButton = event.target.closest("[data-body-side]");
    if (bodySideButton && bodySideButton.matches("button")) {
      const nextSide = bodySideButton.dataset.bodySide === "back" ? "back" : "front";
      if (nextSide !== activeBodySide && BODY_FAMILY_IDS.has(activeFamily) && !BODY_SIDE_FAMILY_IDS[nextSide].has(activeFamily)) {
        const preferredFamily = nextSide === "back" ? "dos" : "visage";
        const sideFamilies = BODY_SIDE_FAMILY_IDS[nextSide];
        activeFamily = visibleFamilyIds().find((familyId) => familyId === preferredFamily)
          || visibleFamilyIds().find((familyId) => sideFamilies.has(familyId))
          || activeFamily;
        expandedFamily = activeFamily;
      }
      activeBodySide = nextSide;
      renderCatalog();
      window.setTimeout(() => $(`[data-body-side="${activeBodySide}"]`)?.focus(), 0);
      return;
    }
    const bodyRegion = event.target.closest("[data-body-family]");
    if (bodyRegion) {
      const nextFamily = bodyRegion.dataset.bodyFamily;
      if (!visibleFamilyIds().includes(nextFamily)) return;
      activeFamily = nextFamily;
      expandedFamily = nextFamily;
      searchQuery = "";
      $("#catalogSearch").value = "";
      setCatalogSearchOpen(false, { clear: false });
      renderCatalog();
      window.setTimeout(() => $(`[data-body-family="${nextFamily}"]`)?.focus(), 0);
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
    const bodyRegion = event.target.closest("svg [data-body-family]");
    if (!bodyRegion || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    bodyRegion.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  function changeQuantityFromGesture(control, increase) {
    const line = lineFromElement(control);
    if (!line) return;
    const kind = control.dataset.quantityGesture;
    if (kind === "free") {
      line.freeQuantity = boundedInteger(line.freeQuantity + (increase ? 1 : -1), 0, MAX_LINE_QUANTITY, 0);
    } else {
      line.quantity = boundedInteger(line.quantity + (increase ? 1 : -1), 1, MAX_LINE_QUANTITY, 1);
    }
    saveLocal(); renderCatalog(); renderCheckout();
    const quantity = kind === "free" ? line.freeQuantity : line.quantity;
    const restoredControl = $(`[data-line-id="${line.id}"] [data-quantity-gesture="${kind}"]`);
    if (restoredControl) window.setTimeout(() => restoredControl.focus(), 0);
    toast(`${kind === "free" ? "Séances offertes" : "Quantité"} : ${quantity}`);
  }
  $("#cartLines").addEventListener("click", (event) => {
    const quantityGesture = event.target.closest("[data-quantity-gesture]");
    if (quantityGesture) { changeQuantityFromGesture(quantityGesture, false); return; }
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
  });
  $("#cartLines").addEventListener("contextmenu", (event) => {
    const quantityGesture = event.target.closest("[data-quantity-gesture]");
    if (!quantityGesture) return;
    event.preventDefault();
    changeQuantityFromGesture(quantityGesture, true);
  });
  $("#cartLines").addEventListener("change", (event) => { if (event.target.matches("[data-line-field]")) updateLineInput(event.target); });
  $("#cartLines").addEventListener("keydown", (event) => {
    const quantityGesture = event.target.closest("[data-quantity-gesture]");
    if (quantityGesture && ["ArrowUp", "ArrowRight", "+", "=", "ArrowDown", "ArrowLeft", "-"].includes(event.key)) {
      event.preventDefault();
      changeQuantityFromGesture(quantityGesture, ["ArrowUp", "ArrowRight", "+", "="].includes(event.key));
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
  $("#checkoutWhatsAppButton").addEventListener("click", shareQuoteViaWhatsApp);
  $("#checkoutEmailButton").addEventListener("click", shareQuoteViaEmail);
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#checkoutTransmitButton, #checkoutTransmissionMenu")) setTransmissionMenuOpen(false);
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
      toast(kind === "pdf" ? "Logo du PDF prêt à être enregistré" : "Logo de l’application prêt à être enregistré");
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
  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
      theme: KNOWN_THEMES.includes(pendingTheme) ? pendingTheme : currentTheme(),
      fontFamily: KNOWN_FONTS.includes(pendingFont) ? pendingFont : currentFont(),
      catalogMode: data.get("catalogMode") === "body" ? "body" : "tiles",
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
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#appActions")) setAppMenuOpen(false);
  });
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
    if (action === "clear" && (quote.lines.length === 0 || window.confirm("Vider toutes les prestations de ce devis ?"))) {
      quote.lines = [];
      saveLocal();
      renderAll();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#quoteHeadActions")) setQuoteMenuOpen(false);
  });
  $("#quoteHeadActions").addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!$("#quoteHeadActions").contains(document.activeElement)) setQuoteMenuOpen(false);
    }, 0);
  });

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
        quotes: isRecord(payload.database.quotes) ? payload.database.quotes : {}
      }, payload.database.version);
      normalizeSavedQuotes();
      quote = db.current ? sanitizeQuote(db.current) : newQuote();
      couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
      applyTheme(currentTheme());
      applyFont(currentFont());
      if (!saveLocal()) {
        db = previousDatabase;
        quote = previousQuote;
        couponOpen = previousCouponOpen;
        applyTheme(currentTheme());
        applyFont(currentFont());
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
  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("PWA indisponible", error)));
  }

  applyTheme(currentTheme());
  applyFont(currentFont());
  syncPermanentCheckoutLayout();
  saveLocal(false);
  renderAll();
})();
