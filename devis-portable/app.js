(() => {
  "use strict";

  const STORAGE_KEY = "bellecour-atelier-devis-v3";
  const LEGACY_STORAGE_KEYS = ["bellecour-atelier-devis-v2", "bellecour-atelier-devis-v1"];
  const APP_VERSION = 17;
  const EXAMPLE_QUOTE_NUMBER = "DEV-000002";
  const QUOTE_VALIDITY_DAYS = 30;
  const QUOTE_FUTURE_DATE_LIMIT = 14;
  const DEFAULT_LOGO_PATH = "assets/bellecour-logo.webp";
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
  const validISODate = (value, fallback = todayISO()) => {
    const candidate = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
    const date = new Date(`${candidate}T12:00:00`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate ? fallback : candidate;
  };
  const validTimestamp = (value, fallback = new Date().toISOString()) => Number.isNaN(Date.parse(value)) ? fallback : new Date(value).toISOString();

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
    validityDays: QUOTE_VALIDITY_DAYS,
    packPaidDefault: 6,
    packFreeDefault: 1,
    studentDiscount: 50,
    taxRate: 8.1,
    taxMode: "included",
    showFamilyPrices: false,
    familyFooterCollapsed: false,
    skipTariffChangeConfirmation: false,
    visibleFamilies: [],
    conditions: DEFAULT_PAYMENT_CONDITIONS,
    studentConditions: "Le tarif étudiant est accordé sur présentation d’un justificatif étudiant en cours de validité.",
    footerNote: "Prix exprimés en francs suisses. Ce devis ne vaut pas facture."
  };

  function packDefaults() {
    return {
      paid: Math.max(1, Math.round(Number(db.settings.packPaidDefault) || 6)),
      free: Math.max(0, Math.round(Number(db.settings.packFreeDefault) || 0))
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
  let selectedOfferMode = "single";
  let searchQuery = "";
  let couponOpen = false;
  let saveTimer = null;
  let toastTimer = null;
  let activeToast = null;
  let pendingTheme = "light";
  let pendingLogos = { headerLogoDataUrl: "", pdfLogoDataUrl: "" };

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
    const sanitized = {
      ...base,
      ...source,
      id: String(source.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || uid(),
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
          id: line.id || uid(),
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

  function saveLocal(showState = true) {
    quote.updatedAt = new Date().toISOString();
    db.current = clone(quote);
    if (showState) {
      const saveState = $("#saveState");
      saveState.textContent = "Sauvegarde…";
      saveState.className = "save-state saving";
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      if (showState) {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
          const saveState = $("#saveState");
          saveState.textContent = "Sauvegardé";
          saveState.className = "save-state saved";
          window.setTimeout(() => {
            saveState.textContent = "Prêt";
            saveState.className = "save-state";
          }, 1400);
        }, 160);
      }
      return true;
    } catch (error) {
      if (showState) {
        const saveState = $("#saveState");
        saveState.textContent = "Sauvegarde impossible";
        saveState.className = "save-state error";
      }
      const isQuotaError = error?.name === "QuotaExceededError" || /quota|storage/i.test(String(error?.message || ""));
      toast(isQuotaError ? "Sauvegarde pleine : exportez une sauvegarde puis allégez les logos ou l’historique." : "Le stockage local de l’application est indisponible.", "error");
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
      button.setAttribute("aria-pressed", String(active));
      button.removeAttribute("aria-disabled");
      button.title = "";
    });
    $("[data-offer-mode=\"pack\"] small").textContent = `${paid} + ${free} offerte${free === 1 ? "" : "s"}`;
    $("[data-offer-mode=\"student\"] small").textContent = `−${studentDiscount} %`;
    $("#activeOfferHint").textContent = content.hint;
    const currentOfferTop = $("#currentOfferTop");
    if (currentOfferTop) currentOfferTop.textContent = content.top;
  }
  function renderFamilies() {
    const services = allServices();
    const needle = normalize(searchQuery);
    const families = visibleFamilies();
    const groups = families.map((family) => {
      const familyServices = services.filter((item) => serviceInFamily(item, family));
      const visibleServices = needle ? familyServices.filter((item) => {
        const category = categoryFor(item.categoryId);
        return normalize(`${item.name} ${category.name} ${item.duration} ${item.price}`).includes(needle);
      }) : familyServices;
      if (needle && !visibleServices.length) return "";
      const isActive = activeFamily === family.id;
      const isOpen = needle ? visibleServices.length > 0 : isActive && expandedFamily === family.id;
      const options = isOpen ? `<div class="family-options" role="group" aria-label="Soins ${escapeHTML(family.name)}">${visibleServices.map((item) => {
        const display = offerDisplay();
        const added = quote.lines.some((line) => String(line.serviceId) === String(item.id) && line.offerType === selectedOfferMode);
        const durationLabel = item.duration ? ` (${item.duration} min)` : "";
        return `<button class="family-option ${added ? "added" : ""}" type="button" data-family-service-id="${escapeHTML(item.id)}" aria-label="Ajouter ${escapeHTML(item.name)}${escapeHTML(durationLabel)} · ${escapeHTML(display.label)}">
          <span><strong>${escapeHTML(item.name)}${escapeHTML(durationLabel)}</strong></span>
          <b class="family-option-price">${money(item.price)}</b>
          <svg><use href="#icon-plus"></use></svg>
        </button>`;
      }).join("")}</div>` : "";
      const countLabel = needle ? plural(visibleServices.length, "résultat") : plural(familyServices.length, "soin");
      return `<div class="family-group ${isOpen ? "open" : ""}">
        <button class="family-button ${isActive ? "active" : ""}" type="button" data-family="${family.id}" aria-expanded="${isOpen}">
          <span class="family-button-icon"><svg><use href="#icon-${family.icon}"></use></svg></span>
          <span><strong>${escapeHTML(family.name)}</strong><small>${countLabel}</small></span>
          <svg class="family-arrow"><use href="#icon-chevron"></use></svg>
        </button>
        ${options}
      </div>`;
    }).join("");
    $("#familyList").innerHTML = groups || `<div class="family-no-results"><svg><use href="#icon-search"></use></svg><strong>Aucun soin trouvé</strong><small>Essayez un autre terme.</small></div>`;
    $("#customCategorySelect").innerHTML = window.QUOTE_CATEGORIES.filter((category) => category.id !== 36).map((category) => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("");
    renderFamilyPriceToggle();
    renderFamilyFooterToggle();
  }

  function renderFamilyPriceToggle() {
    const visible = Boolean(db.settings.showFamilyPrices);
    const panel = $("#familyPanel");
    const button = $("#familyPriceToggle");
    if (!panel || !button) return;
    panel.classList.toggle("show-family-prices", visible);
    button.classList.toggle("active", visible);
    button.setAttribute("aria-pressed", String(visible));
    $("#familyPriceToggleState").textContent = visible ? "Affichés" : "Masqués";
  }

  function renderFamilyFooterToggle() {
    const collapsed = Boolean(db.settings.familyFooterCollapsed);
    const footer = $("#familyFooter");
    const toggle = $("#familyFooterToggle");
    if (!footer || !toggle) return;
    footer.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    $("#familyFooterToggleLabel").textContent = collapsed ? "Afficher les actions" : "Réduire les actions";
  }
  function renderCatalog() {
    renderOfferMode();
    renderFamilies();
  }
  function addService(item, offerType = "single") {
    const offer = ["single", "pack", "student"].includes(offerType) ? offerType : "single";
    const existing = quote.lines.find((line) => String(line.serviceId) === String(item.id) && line.offerType === offer);
    if (existing && offer === "pack") {
      toast(`${item.name} · ce pack est déjà dans la caisse`);
      return;
    }
    if (existing) existing.quantity += 1;
    else {
      const basePrice = Math.max(0, Number(item.price) || 0);
      const discount = clamp(db.settings.studentDiscount, 0, 100);
      quote.lines.push({
        id: uid(), serviceId: item.id, name: item.name, categoryId: Number(item.categoryId) || 0,
        duration: Math.max(0, Number(item.duration) || 0), offerType: offer, basePrice,
        studentDiscount: discount,
        price: basePrice,
        quantity: offer === "pack" ? Math.max(1, Math.round(Number(db.settings.packPaidDefault) || 6)) : 1,
        freeQuantity: offer === "pack" ? Math.max(0, Math.round(Number(db.settings.packFreeDefault) || 0)) : 0
      });
    }
    saveLocal(); renderCatalog(); renderCheckout();
    const offerName = offer === "pack" ? "Pack" : offer === "student" ? "Tarif étudiant" : "Séance";
    toast(existing ? `${item.name} · quantité ${existing.quantity}` : `${item.name} · ${offerName} ajouté`);
  }
  function renderClient() {
    const client = quote.client;
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
      const nameSize = Math.min(28, Math.max(8, Array.from(line.name).length + 1));
      const categoryLabel = category.short.toLocaleLowerCase("fr-CH");
      const paidControl = `<span class="quantity-group quantity-group-inline${isPack ? " is-pack" : ""}">${isPack ? "<small>Payées</small>" : ""}<button class="quantity-value" type="button" data-quantity-gesture="paid" aria-label="${line.quantity} séance${line.quantity > 1 ? "s" : ""} payée${line.quantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.quantity}</button></span>`;
      const freeControl = isPack ? `<span class="quantity-group quantity-group-inline is-pack free"><small>Offertes</small><button class="quantity-value" type="button" data-quantity-gesture="free" aria-label="${line.freeQuantity} séance${line.freeQuantity > 1 ? "s" : ""} offerte${line.freeQuantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.freeQuantity}</button></span>` : "";
      const packOfferAction = canAddPackOffer ? `<button class="pack-offer-action" type="button" data-line-action="add-pack-free" aria-label="Ajouter ${pack.free} séance${pack.free > 1 ? "s" : ""} offerte${pack.free > 1 ? "s" : ""}">Ajouter ${pack.free} offerte${pack.free > 1 ? "s" : ""}</button>` : "";
      return `<article class="cart-line offer-${line.offerType}" data-line-id="${line.id}">
        <div class="cart-line-info"><span class="cart-line-name-row"><input class="cart-line-name" data-line-field="name" value="${escapeHTML(line.name)}" size="${nameSize}" aria-label="Nom de la prestation"></span>${packOfferAction}</div>
        <div class="cart-line-inline-controls"><span class="cart-line-category">(${escapeHTML(categoryLabel)})</span>${paidControl}${freeControl}<strong class="cart-line-price">${money(line.price)}</strong><button class="remove-line" type="button" data-line-action="remove" aria-label="Supprimer"><svg><use href="#icon-trash"></use></svg></button></div>
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
    if (months.length > 0) {
      $("#installmentGrid").innerHTML = months.map((month) => `<div class="installment-option"><b>${month} mois</b><span>${moneyValue(totals.total / month)}</span></div>`).join("");
    } else {
      $("#installmentGrid").innerHTML = `<div class="installment-empty">Ajoutez une prestation pour afficher la simulation de paiement échelonné.</div>`;
    }
  }

  function renderHeader() {
    $(".brand-block .eyebrow").textContent = db.settings.companyName;
    const logo = $("#headerLogo");
    const customLogo = safeLogoDataUrl(db.settings.headerLogoDataUrl);
    logo.src = customLogo || DEFAULT_LOGO_PATH;
    logo.alt = `Logo ${db.settings.companyName || "de l’entreprise"}`;
    logo.closest(".brand-logo").classList.toggle("has-custom-logo", Boolean(customLogo));
    const clientName = String(quote.client?.name || "").trim();
    document.title = clientName || "Devis";
  }

  const KNOWN_THEMES = ["light", "night", "forest"];
  function currentTheme() { return KNOWN_THEMES.includes(db.settings.theme) ? db.settings.theme : "light"; }
  function applyTheme(theme) {
    const value = KNOWN_THEMES.includes(theme) ? theme : "light";
    document.documentElement.setAttribute("data-theme", value);
  }

  function renderCheckout() {
    const previousCouponType = quote.discount.type;
    enforceStudentCouponRule();
    if (quote.discount.type !== previousCouponType) saveLocal(false);
    $("#checkoutPanel").classList.toggle("is-empty", quote.lines.length === 0);
    renderHeader();
    renderClient();
    renderCart();
    renderTotals();
    $("#quoteNumber").textContent = quote.number;
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
    layer.hidden = false;
    const autofocus = $("[autofocus]", layer);
    if (autofocus) window.setTimeout(() => autofocus.focus(), 50);
  }

  function closeLayer(id) {
    const layer = $(`#${id}`);
    if (layer) layer.hidden = true;
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
    if (!force && hasContent && !isArchived && !window.confirm("Créer un nouveau devis ? Le brouillon actuel restera enregistré localement, mais ne figurera pas dans Mes devis.")) return;
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
      return `<label class="family-visibility-item" data-family-id="${family.id}">\n        <input type="checkbox" name="visibleFamilies" value="${family.id}" ${checked ? "checked" : ""}>\n        <span class="family-visibility-icon" aria-hidden="true"><svg><use href="#icon-${family.icon}"></use></svg></span>\n        <span class="family-visibility-copy"><strong>${escapeHTML(family.name)}</strong><small>${escapeHTML(family.description || "")}</small></span>\n      </label>`;
    }).join("");
  }

  function fillSettingsForm() {
    const form = $("#settingsForm");
    Object.entries(db.settings).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    pendingLogos = {
      headerLogoDataUrl: safeLogoDataUrl(db.settings.headerLogoDataUrl),
      pdfLogoDataUrl: safeLogoDataUrl(db.settings.pdfLogoDataUrl)
    };
    renderLogoPreviews();
    buildFamilyVisibilityGrid();
    refreshSettingsPreview();
    syncThemePicker(currentTheme());
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
      const icon = card.querySelector(".theme-card-check use");
      if (icon) icon.setAttribute("href", isActive ? "#icon-check" : "");
      card.querySelector(".theme-card-check svg").style.display = isActive ? "" : "none";
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
      return `<tr><td><span class="print-item-name">${escapeHTML(line.name)}</span><span class="print-item-meta">${escapeHTML(offerLabel(line))} · ${escapeHTML(categoryFor(line.categoryId).name)}${line.duration ? ` · ${line.duration} min` : ""}</span></td><td>${quantityLabel}</td><td>${money(unitPrice)}</td><td>${money(unitPrice * line.quantity)}</td></tr>`;
    }).join("");
    const couponName = quote.discount.code ? `Coupon ${quote.discount.code}` : "Coupon";
    const discountLabel = quote.discount.type === "percent" ? `${couponName} (${Number(quote.discount.value) || 0} %)` : couponName;
    const studentConditions = quote.lines.some((line) => line.offerType === "student") ? String(settings.studentConditions || "").trim() : "";
    const logoSource = safeLogoDataUrl(settings.pdfLogoDataUrl) || safeLogoDataUrl(settings.headerLogoDataUrl) || DEFAULT_LOGO_PATH;
    const totalLabel = quote.tax.enabled ? "Total TTC" : "Total";
    const printRoot = $("#printQuote");
    const layoutClass = printLayoutClass(totals, months, studentConditions);
    printRoot.className = `print-quote ${layoutClass}`;
    printRoot.dataset.printLayout = layoutClass.replace("print-layout-", "");
    printRoot.innerHTML = `
      <header class="print-header">
        <div class="print-brand"><img class="print-logo" src="${escapeHTML(logoSource)}" alt=""><div class="print-brand-copy"><div class="print-company-kicker">${escapeHTML(settings.companySubtitle || "Établissement")}</div><div class="print-company-name">${escapeHTML(settings.companyName)}</div></div></div>
        <div class="print-company-lines">${escapeHTML(settings.companyAddress)}<br>${escapeHTML(contact)}${settings.companyUid ? `<br>IDE : ${escapeHTML(settings.companyUid)}` : ""}</div>
      </header>
      <section class="print-hero"><div><h1>Devis</h1></div><div class="print-document-meta"><strong>${escapeHTML(quote.number)}</strong></div></section>
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
            <div class="print-signature"><div><span>Date et lieu</span></div><div><span>Signature du client et mention « Bon pour accord »</span></div></div>
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
    if (typeof window.bellecourDesktop?.savePdf !== "function") {
      printQuote();
      toast("Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.");
      return;
    }
    const button = $("#downloadPdfButton");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await waitForPdfLayout();
      const result = await window.bellecourDesktop.savePdf(`${quote.number}.pdf`);
      if (result?.saved) toast(`PDF téléchargé : ${result.fileName || `${quote.number}.pdf`}`);
    } catch (error) {
      console.error(error);
      toast("Le PDF n’a pas pu être enregistré.", "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  async function shareQuoteViaWhatsApp() {
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant le transfert.", "error"); return; }
    saveQuote();
    const totals = calculate(quote);
    const clientName = String(quote.client?.name || "").trim();
    const lines = quote.lines.map((line) => {
      const quantity = line.offerType === "pack"
        ? `${line.quantity} payée${line.quantity > 1 ? "s" : ""}${line.freeQuantity ? ` + ${line.freeQuantity} offerte${line.freeQuantity > 1 ? "s" : ""}` : ""}`
        : `${line.quantity} ×`;
      return `• ${line.name} — ${quantity} · ${money(line.price * line.quantity)}`;
    });
    const message = [
      `Bonjour${clientName ? ` ${clientName}` : ""},`,
      "",
      `Voici votre devis ${quote.number}, émis le ${formatDate(quote.date)}.`,
      "",
      ...lines,
      "",
      `Total : ${money(totals.total)}`,
      `Valable jusqu’au ${formatDate(quote.validUntil)}.`,
      "",
      "Le PDF peut être joint à ce message depuis le bouton Imprimer / PDF."
    ].join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      if (typeof window.bellecourDesktop?.openExternal === "function") await window.bellecourDesktop.openExternal(url);
      else {
        const popup = window.open(url, "_blank", "noopener");
        if (!popup) window.location.assign(url);
      }
      toast("Devis préparé pour WhatsApp");
    } catch (error) {
      console.error(error);
      toast("WhatsApp n’a pas pu être ouvert.", "error");
    }
  }

  function switchMobilePanel(id) {
    if (id !== "checkoutPanel") setCheckoutFocus(false);
    $("#familyPanel").classList.toggle("active-panel", id === "familyPanel");
    $("#checkoutPanel").classList.toggle("active-panel", id === "checkoutPanel");
    $$(".mobile-tabs [data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setCheckoutFocus(open) {
    const panel = $("#checkoutPanel");
    const toggle = $("#checkoutFocusToggle");
    const label = $(".checkout-focus-label");
    const state = $("#checkoutFocusState");
    panel.classList.toggle("is-full-height", open);
    document.documentElement.classList.toggle("checkout-focus", open);
    document.body.classList.toggle("checkout-focus", open);
    toggle.setAttribute("aria-pressed", String(open));
    toggle.title = open ? "Revenir à la vue normale" : "Afficher la caisse sur toute la hauteur";
    label.textContent = open ? "Réduire la caisse" : "Caisse plein écran";
    state.textContent = open ? "Vue normale" : "Plein écran";
    if (open && window.innerWidth <= 1180) switchMobilePanel("checkoutPanel");
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
  $("#familyPriceToggle").addEventListener("click", () => {
    db.settings.showFamilyPrices = !Boolean(db.settings.showFamilyPrices);
    renderFamilyPriceToggle();
    saveLocal(false);
  });
  $("#checkoutFocusToggle").addEventListener("click", () => {
    setCheckoutFocus(!$("#checkoutPanel").classList.contains("is-full-height"));
  });
  $("#familyFooterToggle").addEventListener("click", () => {
    db.settings.familyFooterCollapsed = !Boolean(db.settings.familyFooterCollapsed);
    saveLocal(false);
    renderFamilyFooterToggle();
  });
  $("#offerModeSelector").addEventListener("click", (event) => {
    const button = event.target.closest("[data-offer-mode]");
    if (!button) return;
    requestOfferMode(button.dataset.offerMode);
  });
  $("#familyList").addEventListener("click", (event) => {
    const serviceButton = event.target.closest("[data-family-service-id]");
    if (serviceButton) {
      const item = allServices().find((service) => String(service.id) === serviceButton.dataset.familyServiceId);
      if (item) addService(item, selectedOfferMode);
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
  function changeQuantityFromGesture(control, increase) {
    const line = lineFromElement(control);
    if (!line) return;
    if (control.dataset.quantityGesture === "free") line.freeQuantity = Math.max(0, line.freeQuantity + (increase ? 1 : -1));
    else line.quantity = Math.max(1, line.quantity + (increase ? 1 : -1));
    saveLocal(); renderCatalog(); renderCheckout();
    const quantity = control.dataset.quantityGesture === "free" ? line.freeQuantity : line.quantity;
    toast(`${control.dataset.quantityGesture === "free" ? "Séances offertes" : "Quantité"} : ${quantity}`);
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
      toast(`${line.name} · ${line.quantity} payées + ${line.free} offerte${line.free > 1 ? "s" : ""}`);
      return;
    }
    if (action === "increase") line.quantity += 1;
    if (action === "decrease") line.quantity = Math.max(1, line.quantity - 1);
    if (action === "increase-free") line.freeQuantity += 1;
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
  $("#cartLines").addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches("[data-line-field]")) { event.preventDefault(); event.target.blur(); } });
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

  $("#customItemButton").addEventListener("click", () => { $("#customItemForm").reset(); $("#customItemForm").elements.price.value = 0; $("#customItemForm").elements.duration.value = 30; $("#customItemForm").elements.saveToCatalog.checked = true; openLayer("customItemLayer"); });
  $("#customItemForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = { id: `custom-${uid()}`, name: String(data.get("name") || "").trim(), price: Math.max(0, Number(data.get("price")) || 0), duration: Math.max(0, Number(data.get("duration")) || 0), categoryId: Number(data.get("category")) || 0, custom: true };
    if (!item.name) return;
    if (data.get("saveToCatalog")) db.customServices.push(clone(item));
    addService(item, selectedOfferMode); closeLayer("customItemLayer");
  });

  $("#newQuoteButton").addEventListener("click", () => createNewQuote());
  $("#tariffChangeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const layer = $("#tariffChangeLayer");
    const requestedMode = layer.dataset.requestedMode;
    if (!["single", "pack", "student"].includes(requestedMode)) return;
    db.settings.skipTariffChangeConfirmation = $("#tariffChangeSkipConfirmation").checked;
    closeLayer("tariffChangeLayer");
    applyOfferMode(requestedMode);
  });
  $("#saveButton").addEventListener("click", saveQuote);
  $("#printButton").addEventListener("click", printQuote);
  $("#downloadPdfButton").addEventListener("click", downloadPdf);
  if (typeof window.bellecourDesktop?.savePdf !== "function") {
    const button = $("#downloadPdfButton");
    button.title = "Ouvrir l’impression pour enregistrer au format PDF";
    button.setAttribute("aria-label", "Imprimer ou enregistrer au format PDF");
  }
  $("#whatsAppButton").addEventListener("click", shareQuoteViaWhatsApp);
  $("#historyButton").addEventListener("click", () => { renderHistory(); openLayer("historyLayer"); });
  $("#historyList").addEventListener("click", (event) => { const button = event.target.closest("[data-quote-id]"); if (button) loadHistoryQuote(button.dataset.quoteId); });
  $("#settingsButton").addEventListener("click", () => { pendingTheme = currentTheme(); fillSettingsForm(); openLayer("settingsLayer"); });
  $("#themePicker").addEventListener("click", (event) => {
    const card = event.target.closest(".theme-card");
    if (!card) return;
    pendingTheme = card.dataset.theme;
    applyTheme(pendingTheme);
    syncThemePicker(pendingTheme);
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
      packPaidDefault: Math.max(1, Math.round(Number(data.get("packPaidDefault")) || 6)), packFreeDefault: Math.max(0, Math.round(Number(data.get("packFreeDefault")) || 0)),
      studentDiscount: clamp(data.get("studentDiscount"), 0, 100),
      conditions: String(data.get("conditions") || "").trim(), studentConditions: String(data.get("studentConditions") || "").trim(), footerNote: String(data.get("footerNote") || "").trim()
    };
    if (!quote.conditions || quote.conditions === oldConditions) quote.conditions = db.settings.conditions;
    const checkedFamilies = data.getAll("visibleFamilies").map(String).filter(Boolean);
    db.settings.visibleFamilies = checkedFamilies;
    const visibleIds = new Set(visibleFamilyIds());
    if (visibleIds.has(activeFamily)) expandedFamily = activeFamily;
    else { const first = visibleFamilies()[0]; activeFamily = first?.id || "all"; expandedFamily = first?.id || "all"; }
    applyTheme(db.settings.theme);
    if (!saveLocal()) return;
    renderAll(); closeLayer("settingsLayer"); toast("Réglages enregistrés");
  });

  $("#moreQuoteButton").addEventListener("click", (event) => { event.stopPropagation(); const menu = $("#quoteActionMenu"); menu.hidden = !menu.hidden; event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden)); });
  $("#quoteActionMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    $("#quoteActionMenu").hidden = true;
    const action = button.dataset.action;
    if (action === "duplicate") duplicateQuote();
    if (action === "export") exportQuote();
    if (action === "import") $("#quoteImportInput").click();
    if (action === "clear" && (quote.lines.length === 0 || window.confirm("Vider toutes les prestations de ce devis ?"))) { quote.lines = []; saveLocal(); renderAll(); }
  });
  document.addEventListener("click", (event) => { if (!event.target.closest("#moreQuoteButton") && !event.target.closest("#quoteActionMenu")) $("#quoteActionMenu").hidden = true; });

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
      if (!saveLocal()) {
        db = previousDatabase;
        quote = previousQuote;
        couponOpen = previousCouponOpen;
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); switchMobilePanel("familyPanel"); setCatalogSearchOpen(true, { focus: true }); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveQuote(); }
    if (event.key === "Escape") {
      if ($("#checkoutPanel").classList.contains("is-full-height")) { event.preventDefault(); setCheckoutFocus(false); return; }
      if (!$("#catalogSearchPanel").hidden) { event.preventDefault(); setCatalogSearchOpen(false); }
      else $$(".modal-layer:not([hidden]), .drawer-layer:not([hidden])").forEach((layer) => closeLayer(layer.id));
    }
  });
  window.addEventListener("beforeprint", renderPrint);
  window.addEventListener("beforeunload", () => saveLocal(false));

  applyTheme(currentTheme());
  saveLocal(false);
  renderAll();
})();
