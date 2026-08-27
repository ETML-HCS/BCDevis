(() => {
  "use strict";

  const STORAGE_KEY = "bcdevis-v1";
  const RELEASE_VERSION = "7.1.2";
  const RELEASE_NOTES_REVISION = "7.1.2";
  const RELEASE_NOTES_SEEN_KEY = "bcdevis-release-notes-last-seen";
  const CART_SWIPE_HINT_SEEN_KEY = "bcdevis-cart-swipe-hint-seen-v1";
  // Keep the former names here so an update retains every existing quote.
  const LEGACY_STORAGE_KEYS = ["bellecour-atelier-devis-v3", "bellecour-atelier-devis-v2", "bellecour-atelier-devis-v1"];
  const APP_VERSION = 25;
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
  const MAX_PDF_ARCHIVE_BYTES = 8 * 1024 * 1024;
  const MAX_LINE_QUANTITY = 999;
  const MAX_LINE_PRICE = 1000000;
  const MAX_CUSTOM_SERVICES = 500;
  const MAX_CONTACTS = 10000;
  const CART_DELETE_REVEAL_WIDTH = 56;
  const CART_SWIPE_START_THRESHOLD = 8;
  const LEGACY_DEFAULT_PAYMENT_CONDITIONS = "Le règlement peut s’effectuer à chaque séance ou par l’achat d’un pack. Les paiements sont acceptés par carte, en espèces, via TWINT, par virement bancaire ou par paiement échelonné. L’échelonnement est soumis à l’accord du partenaire financier.";
  const DEFAULT_PAYMENT_CONDITIONS = "Le règlement est exigible au fur et à mesure des séances ou lors de l’achat d’un forfait. Les moyens de paiement acceptés sont les cartes de paiement, les espèces, TWINT et le virement bancaire. Toute solution de paiement échelonné est soumise à l’acceptation préalable du partenaire financier.";
  const DEFAULT_STUDENT_CONDITIONS = "Le tarif étudiant est accordé sur présentation d’un justificatif étudiant en cours de validité.";
  const DEFAULT_FOOTER_NOTE = "Prix exprimés en francs suisses. Ce devis ne vaut pas facture.";
  const DEFAULT_PAYMENT_CONDITIONS_EN = "Payment is due as treatments are provided or upon purchase of a package. Accepted payment methods are payment cards, cash, TWINT and bank transfer. Any installment payment solution is subject to the prior acceptance of the financial partner.";
  const DEFAULT_STUDENT_CONDITIONS_EN = "The student rate is granted upon presentation of a valid student ID.";
  const DEFAULT_FOOTER_NOTE_EN = "Prices are expressed in Swiss francs. This quote is not an invoice.";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const windowShell = new URLSearchParams(window.location.search).get("windowShell");
  if (["custom", "windows"].includes(windowShell)) {
    document.documentElement.classList.add("bcdevis-window-overlay");
  } else if (windowShell === "mac") {
    document.documentElement.classList.add("bcdevis-window-mac");
  }
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const { roundMoney, clamp, calculate, installmentMonths, referenceLineTotal, cleanDocumentPrefix, relatedDocumentNumber } = window.QuoteCore;
  const ContactCore = window.BCDevisContacts;
  const {
    DEFAULT_TARGET_URL: DEFAULT_SITE_MIGRATION_TARGET,
    MIGRATION_QUERY_KEY,
    TRANSFER_TYPE: SITE_TRANSFER_TYPE,
    createTransferPackage,
    migrationArrivalUrl,
    normalizeSiteUrl,
    readTransferPackage,
    targetMatchesCurrentSite
  } = window.BCDevisSiteMigration;
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
  const DISPLAY_MODE_PREFERENCES = ["auto", "smartphone", "full"];
  const SMARTPHONE_LAYOUT_MAX_WIDTH = 600;
  const SETTINGS_TAB_IDS = ["interface", "company", "pricing", "document", "data"];
  const TRACKING_STATUSES = ["draft", "ready", "sent", "accepted", "refused", "expired", "invoiced"];
  const TRACKING_STATUS_META = {
    draft: { label: "Brouillon", eventLabel: "Brouillon créé" },
    ready: { label: "Prêt à envoyer", eventLabel: "Prêt à envoyer" },
    sent: { label: "Envoyé", eventLabel: "Devis envoyé" },
    accepted: { label: "Accepté", eventLabel: "Devis accepté" },
    refused: { label: "Refusé", eventLabel: "Devis refusé" },
    expired: { label: "Expiré", eventLabel: "Devis expiré" },
    invoiced: { label: "Facture envoyée", eventLabel: "Facture envoyée" }
  };
  const TRACKING_FILTERS = ["all", "draft", "ready", "sent", "follow-up", "accepted", "refused", "expired"];
  const TRACKING_TERMINAL_STATUSES = ["accepted", "refused", "expired", "invoiced"];
  const TRACKING_TRANSITIONS = {
    draft: ["ready"],
    ready: ["sent", "expired"],
    sent: ["accepted", "refused", "expired"],
    accepted: ["invoiced"],
    refused: [],
    expired: [],
    invoiced: []
  };
  const MAX_TRACKING_EVENTS = 300;
  const CLIENT_SNAPSHOT_FIELDS = ["name", "phone", "email", "company", "address", "postalCode", "city", "country", "birthDate", "language", "reference", "notes"];
  const CLIENT_FIELD_LIMITS = { name: 240, phone: 80, email: 320, company: 240, address: 500, postalCode: 32, city: 120, country: 120, birthDate: 10, language: 40, reference: 80, notes: 2000 };

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
    invoicePrefix: "FAC",
    machineName: "A",
    theme: "white",
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
    ipadLayoutMode: "auto",
    displayMode: "auto",
    launchAtLogin: false,
    visibleFamilies: [],
    quoteDateEditable: false,
    quoteTrackingEnabled: false,
    trackingDefaultFollowUpDays: 7,
    trackingRemindersOnStartup: true,
    trackingShowCounters: true,
    conditions: DEFAULT_PAYMENT_CONDITIONS,
    studentConditions: DEFAULT_STUDENT_CONDITIONS,
    footerNote: DEFAULT_FOOTER_NOTE,
    showSignatures: true,
    pdfLanguage: "fr",
    centralUniqueQuoteNumbers: false
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
    return { version: APP_VERSION, sequence: 0, quoteCounters: {}, settings: clone(defaultSettings), customServices: [], catalogOverrides: {}, contacts: {}, quotes: {}, current: null };
  }

  function configuredValidityDays(settings = defaultSettings) {
    return boundedInteger(settings?.validityDays, 1, 365, QUOTE_VALIDITY_DAYS);
  }

  function configuredFollowUpDays(settings = defaultSettings) {
    return boundedInteger(settings?.trackingDefaultFollowUpDays, 1, 90, 7);
  }

  function trackingActorFields() {
    const config = centralController?.getConfig?.() || {};
    return {
      actor: String(config.connected && config.email ? config.email : "Utilisateur local").trim().slice(0, 320),
      device: String(config.deviceName || db?.settings?.machineName || "Ce poste").trim().slice(0, 80)
    };
  }

  function trackingEvent({ id = "", type = "status", status = "draft", at = new Date().toISOString(), note = "", channel = "", followUpAt = "", actor = "", device = "" } = {}) {
    return {
      id: safeLocalId(id) || uid(),
      type: ["status", "note", "follow-up"].includes(type) ? type : "status",
      status: TRACKING_STATUSES.includes(status) ? status : "draft",
      at: validTimestamp(at),
      note: String(note || "").trim().slice(0, 1000),
      channel: String(channel || "").trim().slice(0, 80),
      followUpAt: followUpAt ? validISODate(followUpAt, "") : "",
      actor: String(actor || "").trim().slice(0, 320),
      device: String(device || "").trim().slice(0, 80)
    };
  }

  function freshTracking(createdAt = new Date().toISOString()) {
    return {
      status: "draft",
      nextFollowUpAt: "",
      note: "",
      sentAt: "",
      acceptedAt: "",
      refusedAt: "",
      invoicedAt: "",
      events: [trackingEvent({ status: "draft", at: createdAt, ...trackingActorFields() })]
    };
  }

  function sanitizeTracking(source, createdAt = new Date().toISOString()) {
    const fallback = freshTracking(createdAt);
    if (!isRecord(source)) return fallback;
    const status = TRACKING_STATUSES.includes(source.status) ? source.status : "draft";
    const events = Array.isArray(source.events)
      ? source.events.filter(isRecord).slice(-MAX_TRACKING_EVENTS).map((event) => trackingEvent(event))
      : [];
    if (!events.length) events.push(trackingEvent({ status, at: createdAt }));
    return {
      status,
      nextFollowUpAt: source.nextFollowUpAt ? validISODate(source.nextFollowUpAt, "") : "",
      note: String(source.note || "").trim().slice(0, 1000),
      sentAt: source.sentAt ? validTimestamp(source.sentAt, "") : "",
      acceptedAt: source.acceptedAt ? validTimestamp(source.acceptedAt, "") : "",
      refusedAt: source.refusedAt ? validTimestamp(source.refusedAt, "") : "",
      invoicedAt: source.invoicedAt ? validTimestamp(source.invoicedAt, "") : "",
      events
    };
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

  function emptyClientSnapshot() {
    return { contactId: "", ...Object.fromEntries(CLIENT_SNAPSHOT_FIELDS.map((field) => [field, ""])) };
  }

  function sanitizeClientSnapshot(source) {
    const input = isRecord(source) ? source : {};
    const snapshot = emptyClientSnapshot();
    snapshot.contactId = safeLocalId(input.contactId || input.id);
    CLIENT_SNAPSHOT_FIELDS.forEach((field) => {
      snapshot[field] = String(input[field] || "").replace(/\u0000/g, "").trim().slice(0, CLIENT_FIELD_LIMITS[field]);
    });
    snapshot.email = snapshot.email.toLocaleLowerCase("fr");
    snapshot.birthDate = snapshot.birthDate ? validISODate(snapshot.birthDate, "") : "";
    return snapshot;
  }

  function sanitizeContactRecord(source) {
    return ContactCore.sanitizeContact(source, { idFactory: () => `contact-${uid()}` });
  }

  function sanitizeContacts(source) {
    const records = Array.isArray(source) ? source : isRecord(source) ? Object.values(source) : [];
    const contacts = {};
    const matchedIds = new Map();
    records.slice(0, MAX_CONTACTS).forEach((record) => {
      const contact = sanitizeContactRecord(record);
      if (!contact) return;
      const match = ContactCore.matchKey(contact);
      const matchedId = match ? matchedIds.get(match) : "";
      if (matchedId && contacts[matchedId]) {
        contacts[matchedId] = ContactCore.mergeContacts(contacts[matchedId], contact, { now: contact.updatedAt });
        return;
      }
      while (contacts[contact.id]) contact.id = `contact-${uid()}`;
      contacts[contact.id] = contact;
      if (match) matchedIds.set(match, contact.id);
    });
    return contacts;
  }

  function seedContactsFromQuotes(database) {
    database.contacts = sanitizeContacts(database.contacts);
    const matchedIds = new Map(Object.values(database.contacts).map((contact) => [ContactCore.matchKey(contact), contact.id]).filter(([key]) => key));
    const records = [...Object.values(isRecord(database.quotes) ? database.quotes : {}), database.current].filter(isRecord);
    records.forEach((record) => {
      const snapshot = sanitizeClientSnapshot(record.client);
      const candidate = sanitizeContactRecord({ ...snapshot, id: snapshot.contactId });
      if (!candidate) {
        record.client = snapshot;
        return;
      }
      const match = ContactCore.matchKey(candidate);
      const contactId = (snapshot.contactId && database.contacts[snapshot.contactId] ? snapshot.contactId : "") || matchedIds.get(match) || candidate.id;
      if (!database.contacts[contactId] && Object.keys(database.contacts).length < MAX_CONTACTS) {
        candidate.id = contactId;
        database.contacts[contactId] = candidate;
        if (match) matchedIds.set(match, contactId);
      }
      record.client = { ...snapshot, contactId };
    });
    return database;
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
    if (version < 25) seedContactsFromQuotes(database);
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
        contacts: sanitizeContacts(parsed.contacts),
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
  let centralSyncApplying = false;
  let centralState = null;
  const centralController = window.BCDevisCentral.createController({
    storage: localStorage,
    getDatabase: () => db,
    applySnapshot: (snapshot) => {
      centralSyncApplying = true;
      try {
        window.BCDevisCentral.applySharedSnapshot(db, snapshot);
        normalizeSavedQuotes();
        saveLocal(false);
        renderAll();
        renderHistory();
        if (!$("#settingsLayer")?.hidden) fillSettingsForm();
        if (db.settings.centralUniqueQuoteNumbers === true) window.setTimeout(() => void ensureCentralQuoteNumberPool().catch(() => {}), 0);
      } finally {
        centralSyncApplying = false;
      }
    },
    onDeviceCode: (code) => {
      if (!code || db.settings.machineName === code) return;
      centralSyncApplying = true;
      try {
        db.settings.machineName = code;
        saveLocal(false);
      } finally {
        centralSyncApplying = false;
      }
    },
    onState: (state, config) => {
      centralState = state;
      renderCentralizationState(state, config);
    }
  });
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
  let cartSwipeHintSeenThisSession = false;
  let pendingTheme = "white";
  let pendingFont = "red-hat";
  let pendingLogos = { headerLogoDataUrl: "", pdfLogoDataUrl: "" };
  let centralDocuments = [];
  let centralDocumentSearch = "";
  let centralDocumentObjectUrl = "";
  let selectedCentralDocumentId = "";
  let activeCentralDocumentView = "documents";
  let pendingInvoiceQuoteId = "";
  let preparedSiteMigrationTarget = "";
  let activeSettingsTab = "interface";
  let activeHistoryView = "history";
  let activeTrackingFilter = "all";
  let selectedContactId = "";
  let contactQuery = "";
  const expandedTrackingQuotes = new Set();
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

  function invoiceNumberForQuote(item) {
    return relatedDocumentNumber(item?.number, cleanDocumentPrefix(db.settings.invoicePrefix, "FAC"));
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
    if (db.settings.centralUniqueQuoteNumbers === true && centralController.getConfig().enabled) {
      const reserved = centralController.takeReservedQuoteNumber({ prefix, date });
      if (reserved) {
        void ensureCentralQuoteNumberPool({ date, prefix }).catch(() => {});
        return reserved;
      }
      void ensureCentralQuoteNumberPool({ date, prefix, required: 1 }).catch(() => {});
    }
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
    const createdAt = new Date().toISOString();
    const id = uid();
    return {
      id,
      number: nextQuoteNumber(date),
      status: "draft",
      rootQuoteId: id,
      previousQuoteId: "",
      revisionNumber: 1,
      date,
      validUntil: addDaysISO(date, configuredValidityDays(db.settings)),
      client: emptyClientSnapshot(),
      lines: [],
      discount: { code: "", type: "percent", value: 0 },
      tax: { enabled: db.settings.showTaxInformation === true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
      conditions: db.settings.conditions,
      note: "",
      tracking: freshTracking(createdAt),
      createdAt,
      updatedAt: createdAt
    };
  }

  function sanitizeQuote(source) {
    if (!isRecord(source) || !Array.isArray(source.lines)) throw new Error("Format de devis non reconnu");
    const date = todayISO();
    const base = {
      id: uid(), number: "", status: "draft", rootQuoteId: "", previousQuoteId: "", revisionNumber: 1, date,
      validUntil: addDaysISO(date, configuredValidityDays(db.settings)),
      client: emptyClientSnapshot(),
      lines: [], discount: { code: "", type: "percent", value: 0 },
      tax: { enabled: db.settings.showTaxInformation === true, rate: configuredTaxRate(db.settings), mode: db.settings.taxMode === "excluded" ? "excluded" : "included" },
      conditions: db.settings.conditions, note: "", tracking: freshTracking(),
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
    const sanitizedId = safeLocalId(source.id) || uid();
    const sanitized = {
      ...base,
      ...source,
      id: sanitizedId,
      number: importedNumber || nextQuoteNumber(quoteDate),
      status: source.status === "saved" ? "saved" : "draft",
      rootQuoteId: safeLocalId(source.rootQuoteId) || sanitizedId,
      previousQuoteId: safeLocalId(source.previousQuoteId),
      revisionNumber: boundedInteger(source.revisionNumber, 1, 999, 1),
      date: quoteDate,
      validUntil: source.validUntil
        ? validISODate(source.validUntil, addDaysISO(quoteDate, configuredValidityDays(db.settings)))
        : addDaysISO(quoteDate, configuredValidityDays(db.settings)),
      client: sanitizeClientSnapshot(source.client),
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
      tracking: sanitizeTracking(source.tracking, source.createdAt || base.createdAt),
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
    db.contacts = sanitizeContacts(db.contacts);
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

  function saveLocal(touchCurrent = true) {
    if (touchCurrent) quote.updatedAt = new Date().toISOString();
    db.current = clone(quote);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      if (!centralSyncApplying) centralController.schedule();
      renderQuoteSaveState();
      return true;
    } catch (error) {
      const isQuotaError = error?.name === "QuotaExceededError" || /quota|storage/i.test(String(error?.message || ""));
      toast(isQuotaError ? "Sauvegarde pleine : exportez une sauvegarde puis allégez les logos ou l’historique." : "Le stockage local de BCDevis est indisponible.", "error");
      console.error(error);
      renderQuoteSaveState();
      return false;
    }
  }

  let saveLocalTimer = 0;
  function scheduleSaveLocal() {
    clearTimeout(saveLocalTimer);
    saveLocalTimer = setTimeout(() => saveLocal(), 200);
  }

  function showReleaseNotesOnce() {
    try {
      if (localStorage.getItem(RELEASE_NOTES_SEEN_KEY) === RELEASE_NOTES_REVISION) return false;
      localStorage.setItem(RELEASE_NOTES_SEEN_KEY, RELEASE_NOTES_REVISION);
    } catch (error) {
      console.warn("État des nouveautés indisponible", error);
    }
    openLayer("releaseNotesLayer");
    return true;
  }

  function syncToastPlacement() {
    const region = $("#toastRegion");
    if (!region) return;
    if (region.parentElement !== document.body) document.body.append(region);
  }

  function toast(message, type = "success", options = {}) {
    syncToastPlacement();
    const region = $("#toastRegion");
    const actionLabel = String(options?.actionLabel || "").trim();
    const onAction = typeof options?.onAction === "function" ? options.onAction : null;
    const duration = Math.max(1200, Number(options?.duration) || (type === "error" ? 5600 : 2600));
    window.clearTimeout(toastTimer);
    if (activeToast) activeToast.remove();
    const item = document.createElement("div");
    item.className = `toast ${type === "error" ? "error" : ""}`;
    item.classList.toggle("has-action", Boolean(actionLabel && onAction));
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
    item.append(symbol, copy);
    if (actionLabel && onAction) {
      const action = document.createElement("button");
      action.className = "toast-action";
      action.type = "button";
      action.textContent = actionLabel;
      action.addEventListener("click", () => {
        dismiss();
        onAction();
      });
      item.append(action);
    }
    item.append(close);
    region.replaceChildren(item);
    activeToast = item;
    toastTimer = window.setTimeout(dismiss, duration);
  }

  function centralDateTime(value) {
    if (!value || Number.isNaN(Date.parse(value))) return "Jamais";
    return new Intl.DateTimeFormat("fr-CH", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }

  function renderCentralizationState(state = centralState || centralController.getState(), config = centralController.getConfig()) {
    $$('[data-central-library]').forEach((button) => {
      button.hidden = config.connected !== true;
      button.disabled = config.connected !== true;
    });
    const enabled = $("#centralEnabled");
    if (!enabled) return;
    enabled.checked = config.enabled === true;
    const endpoint = $("#centralEndpoint");
    const email = $("#centralEmail");
    const deviceName = $("#centralDeviceName");
    if (endpoint && document.activeElement !== endpoint) endpoint.value = config.endpoint || "";
    if (email && document.activeElement !== email) email.value = config.email || "";
    if (deviceName && document.activeElement !== deviceName) deviceName.value = config.deviceName || "Poste BCDevis";
    const details = $("#centralConnectionDetails");
    if (details) details.hidden = !config.enabled;
    const status = $("#centralStatus");
    if (status) {
      status.dataset.status = state.status;
      $("[data-central-status-copy]", status).textContent = state.message;
    }
    const revision = $("#centralRevision");
    const lastSync = $("#centralLastSync");
    const deviceCode = $("#centralDeviceCode");
    const databaseStatus = $("#centralDatabaseStatus");
    if (revision) revision.textContent = String(config.revision || 0);
    if (lastSync) lastSync.textContent = centralDateTime(config.lastSyncAt);
    if (deviceCode) deviceCode.textContent = config.deviceCode || "Attribué lors de la connexion";
    if (databaseStatus) databaseStatus.textContent = ["online", "pending", "syncing"].includes(state.status) ? "PostgreSQL · prête" : "PostgreSQL · à tester";
    const connect = $("#centralConnectButton");
    const synchronize = $("#centralSyncButton");
    const disconnect = $("#centralDisconnectButton");
    if (connect) connect.textContent = config.connected ? "Reconnecter" : "Se connecter";
    if (synchronize) synchronize.disabled = !config.connected || ["connecting", "syncing"].includes(state.status);
    if (disconnect) disconnect.hidden = !config.enabled;
    const uniqueNumbers = $("#centralUniqueQuoteNumbers");
    const numberPoolStatus = $("#centralNumberPoolStatus");
    if (uniqueNumbers) {
      uniqueNumbers.checked = db.settings.centralUniqueQuoteNumbers === true;
      uniqueNumbers.disabled = !config.connected;
    }
    if (numberPoolStatus) {
      const prefix = (db.settings.quotePrefix || "DEV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "DEV";
      let available = 0;
      try { available = centralController.reservedQuoteNumberCount({ prefix, date: todayISO() }); } catch { available = 0; }
      numberPoolStatus.textContent = config.connected
        ? `${plural(available, "numéro réservé")} pour aujourd’hui`
        : "Disponible après la connexion du poste";
    }
    const conflict = $("#centralConflict");
    if (conflict) {
      conflict.hidden = state.status !== "conflict";
      const count = state.conflicts?.length || 0;
      $("[data-central-conflict-copy]", conflict).textContent = count
        ? `${plural(count, "élément")} modifié des deux côtés. Choisissez la version à conserver pour ces conflits.`
        : "Les données centrales et locales demandent une décision.";
    }
  }

  function centralFormValues() {
    return {
      endpoint: $("#centralEndpoint").value,
      email: $("#centralEmail").value,
      deviceName: $("#centralDeviceName").value
    };
  }

  async function ensureCentralQuoteNumberPool({ date = todayISO(), prefix = db.settings.quotePrefix, required = 6 } = {}) {
    const config = centralController.getConfig();
    if (!config.enabled || !config.connected) throw new Error("La connexion centrale est nécessaire pour réserver des numéros.");
    const values = { prefix, date };
    const available = centralController.reservedQuoteNumberCount(values);
    if (available >= required) {
      if (available < 12) void centralController.reserveQuoteNumbers(values, 20).catch(() => {});
      return available;
    }
    const result = await centralController.reserveQuoteNumbers(values, 20);
    renderCentralizationState();
    return result.available;
  }

  function backupBeforeCentralResolution() {
    downloadJSON(`sauvegarde-avant-conflit-${todayISO()}.json`, {
      type: "atelier-devis-backup",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      database: db
    });
  }

  function formatDocumentSize(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} Mo`;
  }

  function releaseCentralDocumentPreview() {
    if (centralDocumentObjectUrl) URL.revokeObjectURL(centralDocumentObjectUrl);
    centralDocumentObjectUrl = "";
    const frame = $("#pdfPreviewFrame");
    if (frame) {
      frame.src = "about:blank";
      frame.hidden = true;
    }
    $("#pdfPreviewEmpty")?.removeAttribute("hidden");
    const download = $("#pdfLibraryDownloadButton");
    if (download) download.disabled = true;
    const print = $("#pdfLibraryPrintButton");
    if (print) print.disabled = true;
  }

  function centralDocumentKind(item) {
    return item?.kind === "invoice" ? "invoice" : "document";
  }

  function renderCentralDocumentView() {
    const invoices = activeCentralDocumentView === "invoices";
    $("#pdfLibraryTitle").textContent = invoices ? "Factures" : "Documents PDF";
    $("#pdfLibraryIntro").textContent = invoices
      ? "Importez, retrouvez, téléchargez et imprimez les factures envoyées."
      : "Importez, retrouvez et consultez les PDF partagés avec les postes autorisés.";
    $("#pdfLibraryImportButton").lastChild.textContent = invoices ? "Importer une facture" : "Importer un PDF";
    $("#pdfLibraryList").setAttribute("aria-label", invoices ? "Factures disponibles" : "Documents PDF disponibles");
    $$("[data-pdf-library-view]").forEach((button) => {
      const selected = button.dataset.pdfLibraryView === activeCentralDocumentView;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function renderCentralDocuments() {
    const list = $("#pdfLibraryList");
    if (!list) return;
    const query = normalize(centralDocumentSearch);
    const expectedKind = activeCentralDocumentView === "invoices" ? "invoice" : "document";
    const visibleDocuments = centralDocuments.filter((item) => centralDocumentKind(item) === expectedKind);
    const items = visibleDocuments.filter((item) => !query || normalize([item.title, item.filename, item.quoteNumber, item.clientName].join(" ")).includes(query));
    const singular = expectedKind === "invoice" ? "facture" : "document";
    $("#pdfLibraryStatus").textContent = query
      ? `${plural(items.length, singular)} sur ${visibleDocuments.length}`
      : plural(visibleDocuments.length, expectedKind === "invoice" ? "facture" : "document partagé");
    if (!items.length) {
      const emptyTitle = expectedKind === "invoice" ? "Aucune facture" : "Aucun document";
      const emptyCopy = expectedKind === "invoice" ? "Importez la première facture envoyée." : "Importez le premier PDF dans la base centrale.";
      list.innerHTML = `<div class="pdf-library-empty"><svg aria-hidden="true"><use href="#icon-pdf"></use></svg><strong>${query ? "Aucun résultat" : emptyTitle}</strong><span>${query ? "Essayez une autre recherche." : emptyCopy}</span></div>`;
      return;
    }
    list.innerHTML = items.map((item) => {
      const date = centralDateTime(item.createdAt);
      const reference = [item.quoteNumber, item.clientName].filter(Boolean).join(" · ") || "Document général";
      return `<button class="pdf-library-item" type="button" data-pdf-document-id="${escapeHTML(item.id)}" aria-current="${item.id === selectedCentralDocumentId}"><svg aria-hidden="true"><use href="#icon-pdf"></use></svg><span class="pdf-library-item-copy"><strong>${escapeHTML(item.title || item.filename)}</strong><small>${escapeHTML(reference)}</small><small>${escapeHTML(date)} · ${escapeHTML(formatDocumentSize(item.byteSize))}</small></span></button>`;
    }).join("");
  }

  async function refreshCentralDocuments({ selectId = "" } = {}) {
    $("#pdfLibraryStatus").textContent = "Chargement des documents…";
    const result = await centralController.listDocuments();
    centralDocuments = Array.isArray(result.documents) ? result.documents : [];
    renderCentralDocuments();
    const targetId = selectId || (centralDocuments.some((item) => item.id === selectedCentralDocumentId) ? selectedCentralDocumentId : "");
    if (targetId) await selectCentralDocument(targetId);
  }

  async function openPdfLibrary(view = "documents", { selectId = "" } = {}) {
    if (!centralController.getConfig().connected) {
      activeSettingsTab = "data";
      openSettingsLayer();
      toast("Connectez ce poste pour accéder aux documents PDF.", "error");
      return;
    }
    activeCentralDocumentView = view === "invoices" ? "invoices" : "documents";
    centralDocumentSearch = "";
    $("#pdfLibrarySearch").value = "";
    renderCentralDocumentView();
    openLayer("pdfLibraryLayer");
    try {
      await refreshCentralDocuments({ selectId });
    } catch (error) {
      console.error("Bibliothèque PDF indisponible", error);
      $("#pdfLibraryStatus").textContent = error.message || "Bibliothèque indisponible";
      $("#pdfLibraryList").innerHTML = `<div class="pdf-library-empty"><svg aria-hidden="true"><use href="#icon-pdf"></use></svg><strong>Connexion impossible</strong><span>${escapeHTML(error.message || "Réessayez dans quelques instants.")}</span></div>`;
    }
  }

  async function selectCentralDocument(documentId) {
    const document = centralDocuments.find((item) => item.id === documentId);
    if (!document) return;
    selectedCentralDocumentId = documentId;
    renderCentralDocuments();
    $("#pdfPreviewTitle").textContent = document.title || document.filename;
    $("#pdfPreviewMeta").textContent = [[document.quoteNumber, document.clientName].filter(Boolean).join(" · "), formatDocumentSize(document.byteSize), centralDateTime(document.createdAt)].filter(Boolean).join(" · ");
    $("#pdfPreviewEmpty").innerHTML = '<svg aria-hidden="true"><use href="#icon-pdf"></use></svg><strong>Chargement du PDF…</strong><span>Le document reste dans la base centrale.</span>';
    $("#pdfPreviewEmpty").hidden = false;
    $("#pdfPreviewFrame").hidden = true;
    $("#pdfLibraryDownloadButton").disabled = true;
    $("#pdfLibraryPrintButton").disabled = true;
    try {
      const blob = await centralController.loadDocument(documentId);
      if (selectedCentralDocumentId !== documentId || $("#pdfLibraryLayer").hidden) return;
      releaseCentralDocumentPreview();
      centralDocumentObjectUrl = URL.createObjectURL(blob);
      $("#pdfPreviewFrame").src = centralDocumentObjectUrl;
      $("#pdfPreviewFrame").hidden = false;
      $("#pdfPreviewEmpty").hidden = true;
      $("#pdfLibraryDownloadButton").disabled = false;
      $("#pdfLibraryPrintButton").disabled = false;
    } catch (error) {
      console.error("Lecture PDF impossible", error);
      $("#pdfPreviewEmpty").innerHTML = `<svg aria-hidden="true"><use href="#icon-pdf"></use></svg><strong>PDF indisponible</strong><span>${escapeHTML(error.message || "Le document n’a pas pu être chargé.")}</span>`;
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }

  async function readPdfArchiveFile(file) {
    if (!file) return null;
    if (file.size <= 0 || file.size > MAX_PDF_ARCHIVE_BYTES) throw new Error("Le PDF doit peser au maximum 8 Mo.");
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new Error("Sélectionnez un fichier PDF.");
    const buffer = await file.arrayBuffer();
    const signature = new TextDecoder("ascii").decode(buffer.slice(0, 5));
    if (signature !== "%PDF-") throw new Error("Le fichier sélectionné n’est pas un PDF valide.");
    return { filename: file.name, title: file.name.replace(/\.pdf$/i, ""), contentBase64: arrayBufferToBase64(buffer) };
  }

  async function importCentralPdf(file, { quoteId = quote.id, completeWorkflow = false } = {}) {
    const input = await readPdfArchiveFile(file);
    if (!input) return;
    const kind = activeCentralDocumentView === "invoices" ? "invoice" : "document";
    const linkedQuote = db.quotes[quoteId] || (quote.id === quoteId ? quote : null);
    const invoiceNumber = kind === "invoice" && linkedQuote ? invoiceNumberForQuote(linkedQuote) : "";
    const archiveInput = invoiceNumber
      ? { ...input, filename: `${invoiceNumber}.pdf`, title: invoiceNumber }
      : input;
    const button = $("#pdfLibraryImportButton");
    button.disabled = true;
    $("#pdfLibraryStatus").textContent = kind === "invoice" ? "Import de la facture dans PostgreSQL…" : "Import du PDF dans PostgreSQL…";
    try {
      const result = await centralController.uploadDocument({
        ...archiveInput,
        kind,
        quoteId: linkedQuote?.id || "",
        quoteNumber: linkedQuote?.number || "",
        clientName: linkedQuote?.client?.name || ""
      });
      if (kind === "invoice" && completeWorkflow && linkedQuote?.tracking?.status === "accepted") {
        if (!updateQuoteTracking(linkedQuote, { status: "invoiced", note: `Facture ${archiveInput.filename} envoyée` })) {
          throw new Error("La facture est archivée, mais le devis n’a pas pu quitter le workflow.");
        }
        if (!persistTrackedQuote(linkedQuote)) throw new Error("La facture est archivée, mais le suivi local n’a pas pu être enregistré.");
        renderCheckout();
        renderHistory();
      }
      await refreshCentralDocuments({ selectId: result.document?.id || "" });
      toast(kind === "invoice"
        ? `Facture archivée${completeWorkflow && linkedQuote?.tracking?.status === "invoiced" ? " · devis sorti du suivi" : ""} : ${result.document?.filename || archiveInput.filename}`
        : `PDF archivé : ${result.document?.filename || archiveInput.filename}`);
      return result;
    } finally {
      button.disabled = false;
    }
  }

  function downloadSelectedCentralDocument() {
    if (!centralDocumentObjectUrl || !selectedCentralDocumentId) return;
    const item = centralDocuments.find((document) => document.id === selectedCentralDocumentId);
    if (!item) return;
    const link = document.createElement("a");
    link.href = centralDocumentObjectUrl;
    link.download = item.filename || "document.pdf";
    document.body.append(link);
    link.click();
    link.remove();
  }

  function printSelectedCentralDocument() {
    if (!centralDocumentObjectUrl || !selectedCentralDocumentId) return;
    const frame = $("#pdfPreviewFrame");
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch (error) {
      console.warn("Impression intégrée indisponible", error);
      const printWindow = window.open(centralDocumentObjectUrl, "_blank", "noopener");
      if (!printWindow) toast("Autorisez l’ouverture du PDF pour l’imprimer.", "error");
    }
  }

  async function runCentralAction(button, pendingLabel, action) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = pendingLabel;
    try {
      return await action();
    } catch (error) {
      console.error("Action centrale impossible.", error);
      toast(error?.message || "Le serveur central n’a pas pu traiter la demande.", "error");
      return null;
    } finally {
      button.disabled = false;
      button.textContent = previous;
      renderCentralizationState();
    }
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
    if (!ensureQuoteEditable()) return;
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
    if (!ensureQuoteEditable()) return;
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
      button.disabled = quoteIsLocked();
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
          <span class="family-button-copy"><strong>${escapeHTML(family.name)}</strong><small>${countLabel}</small></span>
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
    if (!ensureQuoteEditable()) return;
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
    const clientName = String(client.name || "").trim();
    const outlookWebRecipient = $("#checkoutOutlookWebRecipient");
    if (outlookWebRecipient) outlookWebRecipient.textContent = clientEmail || "Destinataire à saisir";
    const clientButton = $("#clientButton");
    const clientNameLabel = $("#clientName");
    const clientAddIcon = $("#clientInitials");
    const clientDetails = $("#clientDetails");
    const hasClient = Boolean(clientName);
    const locked = quoteIsLocked();
    const actionLabel = hasClient ? `Modifier le client ${clientName}` : "Ajouter un client";
    clientButton.classList.toggle("has-client", hasClient);
    clientButton.classList.toggle("is-empty", !hasClient);
    clientButton.setAttribute("aria-label", locked ? `${actionLabel}. Devis verrouillé, créez une nouvelle version pour le modifier.` : actionLabel);
    clientButton.setAttribute("aria-disabled", String(locked));
    clientButton.classList.toggle("is-locked", locked);
    clientButton.title = locked ? "Devis verrouillé · créez une nouvelle version pour modifier le client" : actionLabel;
    clientButton.dataset.tooltip = clientButton.title;
    clientNameLabel.textContent = clientName;
    clientNameLabel.hidden = !hasClient;
    clientAddIcon.hidden = hasClient;
    clientDetails.textContent = hasClient
      ? [client.company, client.phone, client.email].filter(Boolean).join(" · ") || [client.address, client.postalCode, client.city].filter(Boolean).join(" ") || "Coordonnées à compléter"
      : "Nom, téléphone et e-mail";
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
    const swipeHint = cartSwipeHintSeen() ? "" : `<aside class="cart-swipe-hint" id="cartSwipeHint" role="note">
      <svg aria-hidden="true"><use href="#icon-swipe-left"></use></svg>
      <span><strong>Suppression tactile</strong><small>Balayez une ligne vers la gauche, puis touchez la corbeille.</small></span>
      <button type="button" data-cart-swipe-hint-dismiss>Compris</button>
    </aside>`;
    container.innerHTML = swipeHint + quote.lines.map((line) => {
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
    if (quoteIsLocked()) $$('input, button', container).forEach((control) => { control.disabled = true; });
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
    renderQuoteSaveState();
  }

  function stableQuoteValue(value) {
    if (Array.isArray(value)) return value.map(stableQuoteValue);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableQuoteValue(value[key])]));
  }

  function quoteSaveFingerprint(source) {
    if (!isRecord(source)) return "";
    const comparable = { ...source };
    delete comparable.status;
    delete comparable.updatedAt;
    return JSON.stringify(stableQuoteValue(comparable));
  }

  function currentQuoteSaveState() {
    const archived = db.quotes[quote.id];
    if (!archived) {
      return {
        key: "draft",
        label: "Non archivé",
        detail: "Ce devis n’est pas encore enregistré dans Mes devis."
      };
    }
    if (quoteSaveFingerprint(archived) !== quoteSaveFingerprint(quote)) {
      return {
        key: "modified",
        label: "À enregistrer",
        detail: "Ce devis a été modifié depuis son dernier enregistrement."
      };
    }
    return {
      key: "saved",
      label: "Enregistré",
      detail: "Ce devis est à jour dans Mes devis."
    };
  }

  function renderQuoteSaveState() {
    const stateElement = $("#quoteSaveState");
    const stateLabel = $("#quoteSaveStateLabel");
    const saveButton = $("#saveButton");
    if (!stateElement || !stateLabel || !saveButton) return;
    const state = currentQuoteSaveState();
    stateElement.dataset.state = state.key;
    stateElement.setAttribute("aria-label", `${state.label}. ${state.detail}`);
    stateElement.title = state.detail;
    stateLabel.textContent = state.label;
    saveButton.dataset.saveState = state.key;
    saveButton.dataset.tooltip = state.label;
    saveButton.setAttribute("aria-label", state.key === "modified"
      ? "Enregistrer les modifications"
      : state.key === "saved"
        ? "Devis enregistré, enregistrer à nouveau"
        : "Enregistrer le brouillon");
  }

  function renderQuoteDate() {
    const control = $("#quoteDateControl");
    const display = $("#quoteDateDisplay");
    const input = $("#quoteDate");
    const editable = db.settings.quoteDateEditable === true && !quoteIsLocked();
    const formattedDate = formatDate(quote.date);
    control.dataset.editable = String(editable);
    control.closest(".checkout-card")?.classList.toggle("quote-date-editable", editable);
    display.hidden = editable;
    display.dateTime = quote.date;
    display.textContent = formattedDate;
    display.setAttribute("aria-label", `Date du devis : ${formattedDate}`);
    input.hidden = !editable;
    input.disabled = !editable;
    input.value = quote.date;
    const { min, max } = quoteDateBounds();
    input.min = min;
    input.max = max;
  }

  const KNOWN_THEMES = ["white", "light", "night", "forest", "bordeaux"];
  const THEME_BROWSER_COLORS = {
    white: "#ffffff",
    light: "#171512",
    night: "#090906",
    forest: "#1c3429",
    bordeaux: "#411923"
  };
  function currentTheme() { return KNOWN_THEMES.includes(db.settings.theme) ? db.settings.theme : "white"; }
  function applyTheme(theme) {
    const value = KNOWN_THEMES.includes(theme) ? theme : "white";
    document.documentElement.setAttribute("data-theme", value);
    $("#themeColorMeta")?.setAttribute("content", THEME_BROWSER_COLORS[value]);
  }
  function currentFont() { return KNOWN_FONTS.includes(db.settings.fontFamily) ? db.settings.fontFamily : "red-hat"; }
  function applyFont(font) {
    const value = KNOWN_FONTS.includes(font) ? font : "red-hat";
    document.documentElement.setAttribute("data-font", value);
    if ($("#familyList")?.children.length) scheduleTileDensityAnalysis();
  }
  function currentIpadLayoutMode() { return IPAD_LAYOUT_MODES.includes(db.settings.ipadLayoutMode) ? db.settings.ipadLayoutMode : "auto"; }
  function isLikelyIpad() {
    const userAgent = String(navigator.userAgent || "");
    const platform = String(navigator.userAgentData?.platform || navigator.platform || "");
    return /iPad/i.test(userAgent) || ((/Mac/i.test(platform) || /Macintosh/i.test(userAgent)) && Number(navigator.maxTouchPoints || 0) > 1);
  }
  function applyIpadLayout(mode = currentIpadLayoutMode()) {
    const preference = IPAD_LAYOUT_MODES.includes(mode) ? mode : "auto";
    const optimized = preference === "always" || (preference === "auto" && isLikelyIpad());
    document.documentElement.dataset.ipadPreference = preference;
    document.documentElement.dataset.ipadLayout = optimized ? "optimized" : "standard";
  }
  function currentDisplayModePreference() {
    return DISPLAY_MODE_PREFERENCES.includes(db.settings.displayMode) ? db.settings.displayMode : "auto";
  }
  function resolvedDisplayMode(preference = currentDisplayModePreference()) {
    return preference === "smartphone" || (preference === "auto" && window.innerWidth <= SMARTPHONE_LAYOUT_MAX_WIDTH)
      ? "smartphone"
      : "full";
  }
  function renderDisplayModeMenu() {
    const preference = currentDisplayModePreference();
    const effectiveMode = resolvedDisplayMode(preference);
    $$('[data-display-mode-option]').forEach((button) => {
      const selected = button.dataset.displayModeOption === preference;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const autoState = $("#displayModeAutoState");
    if (autoState) autoState.textContent = effectiveMode === "smartphone" ? "Mobile actif" : "Bureau actif";
  }
  function applyDisplayMode(preference = currentDisplayModePreference()) {
    const normalizedPreference = DISPLAY_MODE_PREFERENCES.includes(preference) ? preference : "auto";
    document.documentElement.dataset.displayPreference = normalizedPreference;
    document.documentElement.dataset.displayMode = resolvedDisplayMode(normalizedPreference);
    renderDisplayModeMenu();
  }
  function setDisplayModePreference(preference) {
    const nextPreference = DISPLAY_MODE_PREFERENCES.includes(preference) ? preference : "auto";
    const previousPreference = currentDisplayModePreference();
    db.settings.displayMode = nextPreference;
    applyDisplayMode(nextPreference);
    syncPermanentCheckoutLayout();
    if (!saveLocal(false)) {
      db.settings.displayMode = previousPreference;
      applyDisplayMode(previousPreference);
      syncPermanentCheckoutLayout();
      return;
    }
    if (resolvedDisplayMode(nextPreference) === "smartphone") switchMobilePanel("familyPanel");
    scheduleTileDensityAnalysis();
    const labels = { auto: "Affichage automatique", smartphone: "Affichage smartphone", full: "Affichage complet" };
    toast(`${labels[nextPreference]} activé`);
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
    const locked = quoteIsLocked();
    $("#checkoutPanel").classList.toggle("is-empty", !hasLines);
    $("#checkoutPanel").classList.toggle("quote-locked", locked);
    ["checkoutPrintButton", "checkoutPdfButton", "checkoutTransmitButton", "checkoutWhatsAppButton", "checkoutOutlookWebButton"].forEach((id) => {
      const button = $(`#${id}`);
      if (button) button.disabled = !hasLines;
    });
    const emailButton = $("#checkoutEmailButton");
    const desktopEmailAvailable = typeof window.bcdevisDesktop?.composeEmail === "function"
      && typeof window.bcdevisDesktop?.savePdf === "function";
    if (emailButton) {
      emailButton.disabled = !hasLines || !desktopEmailAvailable;
      emailButton.title = desktopEmailAvailable
        ? "E-mail avec PDF joint"
        : "Le PDF joint automatiquement nécessite l’application de bureau";
    }
    if (!hasLines) setTransmissionMenuOpen(false);
    renderHeader();
    renderClient();
    renderCart();
    renderTotals();
    renderQuoteDate();
    if (quote.discount.code || Number(quote.discount.value) > 0) couponOpen = true;
    $("#couponToggle").hidden = couponOpen;
    $("#couponToggle").disabled = locked;
    $("#couponToggle").setAttribute("aria-expanded", String(couponOpen));
    $("#couponEditor").hidden = !couponOpen;
    $("#couponCode").value = quote.discount.code || "";
    $("#discountValue").value = Number(quote.discount.value) || 0;
    $("#discountSuffix").textContent = quote.discount.type === "percent" ? "%" : "CHF";
    const studentActive = studentPricingActive();
    $("#couponRule").textContent = studentActive ? "Avec Étudiant : coupon CHF uniquement" : "Réduction en % ou en CHF";
    $$("[data-discount-type]").forEach((button) => {
      const percentBlocked = studentActive && button.dataset.discountType === "percent";
      button.disabled = locked || percentBlocked;
      button.title = locked ? "Devis verrouillé" : percentBlocked ? "Non cumulable avec le tarif étudiant" : "";
      button.classList.toggle("active", button.dataset.discountType === quote.discount.type);
    });
    const taxToggle = $("#taxEnabled");
    const showTaxInformation = db.settings.showTaxInformation === true;
    taxToggle.checked = showTaxInformation && Boolean(quote.tax.enabled);
    taxToggle.disabled = locked || !showTaxInformation;
    taxToggle.closest(".tax-header-toggle").hidden = !showTaxInformation;
    $("#clientButton").disabled = false;
    $("#saveButton").disabled = locked;
    $("#couponCode").disabled = locked;
    $("#discountValue").disabled = locked;
    const clearAction = $('[data-action="clear"]', $("#quoteActionMenu"));
    if (clearAction) clearAction.disabled = locked;
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
    if (!ensureQuoteEditable()) return;
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

  function openHelp(topic = "overview") {
    const allowedTopics = ["overview", "quotes", "tracking", "invoices", "central", "pdf", "shortcuts"];
    const requestedTopic = allowedTopics.includes(topic) ? topic : "overview";
    const frame = $("#helpFrame");
    const source = `help.html#${requestedTopic}`;
    closeContextMenus();
    if (frame) {
      try {
        if (frame.contentWindow?.location) frame.contentWindow.location.hash = requestedTopic;
        else frame.src = source;
      } catch {
        frame.src = source;
      }
    }
    openLayer("helpLayer");
  }

  function closeLayer(id) {
    const layer = $(`#${id}`);
    if (!layer || layer.hidden) return;
    if (id === "tileCatalogEditorLayer" && tileEditorPendingCount()
      && !window.confirm("Abandonner les modifications non enregistrées de l’éditeur des tuiles ?")) return false;
    if (id === "settingsLayer") {
      applyTheme(currentTheme());
      syncThemePicker(currentTheme());
      applyFont(currentFont());
      syncFontPicker(currentFont());
    }
    if (id === "pdfLibraryLayer") {
      selectedCentralDocumentId = "";
      releaseCentralDocumentPreview();
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
    if (id === "releaseNotesLayer") window.setTimeout(showTrackingReminders, 250);
    return true;
  }
  function isTouchLayoutMode() {
    return document.documentElement.dataset.ipadLayout === "optimized"
      || document.documentElement.dataset.displayMode === "smartphone";
  }

  function focusableElements(container) {
    return $$('button:not([disabled]), [href], iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
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

  function contactValues() {
    return Object.values(isRecord(db.contacts) ? db.contacts : {}).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" }));
  }

  function contactInitials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  }

  function fillContactForm(source = {}) {
    const form = $("#clientForm");
    const values = { ...emptyClientSnapshot(), country: "Suisse", ...source };
    form.reset();
    form.elements.contactId.value = safeLocalId(values.contactId || values.id);
    CLIENT_SNAPSHOT_FIELDS.forEach((field) => { if (form.elements[field]) form.elements[field].value = values[field] || ""; });
    const hasDetails = ["company", "address", "postalCode", "city", "birthDate", "language", "reference", "notes"].some((field) => Boolean(values[field]));
    $("#contactMoreDetails").open = hasDetails;
    $("#contactFormTitle").textContent = selectedContactId ? "Modifier le contact" : values.name ? "Client du devis" : "Nouveau contact";
    $("#deleteContactButton").hidden = !selectedContactId || !db.contacts[selectedContactId];
  }

  function renderContactDirectory() {
    const contacts = contactValues();
    const query = normalize(contactQuery);
    const visible = query ? contacts.filter((contact) => normalize([contact.name, contact.company, contact.phone, contact.email, contact.city, contact.reference].join(" ")).includes(query)) : contacts;
    $("#contactCount").textContent = query ? `${visible.length} / ${plural(contacts.length, "contact")}` : plural(contacts.length, "contact");
    $("#contactEmpty").hidden = visible.length > 0;
    $("#contactEmpty").textContent = contacts.length ? "Aucun résultat." : "Aucun contact. Importez un fichier ou créez le premier.";
    $("#contactList").innerHTML = visible.map((contact) => {
      const detail = contact.company || contact.email || contact.phone || contact.city || "Aucune autre information";
      return `<button class="contact-list-item" type="button" role="option" aria-selected="${contact.id === selectedContactId}" data-contact-id="${escapeHTML(contact.id)}"><span class="contact-list-initials" aria-hidden="true">${escapeHTML(contactInitials(contact.name))}</span><span class="contact-list-copy"><strong>${escapeHTML(contact.name)}</strong><small>${escapeHTML(detail)}</small></span></button>`;
    }).join("");
  }

  function selectContact(contactId, { focusName = false } = {}) {
    const contact = db.contacts?.[contactId];
    if (!contact) return;
    selectedContactId = contact.id;
    fillContactForm(contact);
    renderContactDirectory();
    if (focusName) window.setTimeout(() => $("#clientForm").elements.name.focus(), 0);
  }

  function prepareNewContact({ focusName = true } = {}) {
    selectedContactId = "";
    fillContactForm({ country: "Suisse" });
    renderContactDirectory();
    if (focusName) window.setTimeout(() => $("#clientForm").elements.name.focus(), 0);
  }

  function openClient() {
    if (!ensureQuoteEditable()) return;
    contactQuery = "";
    $("#contactSearch").value = "";
    const linked = quote.client.contactId && db.contacts?.[quote.client.contactId];
    selectedContactId = linked ? linked.id : "";
    fillContactForm(linked || quote.client);
    renderContactDirectory();
    openLayer("clientLayer");
    window.setTimeout(() => $("#contactSearch").focus(), 0);
  }

  function upsertContactFromForm(form) {
    const data = Object.fromEntries(new FormData(form));
    const requestedId = safeLocalId(data.contactId);
    const current = requestedId ? db.contacts?.[requestedId] : null;
    const candidate = sanitizeContactRecord({ ...data, id: requestedId, createdAt: current?.createdAt, updatedAt: new Date().toISOString() });
    if (!candidate) throw new Error("Le nom du contact est requis.");
    const duplicate = contactValues().find((contact) => contact.id !== requestedId && ContactCore.matchKey(contact) === ContactCore.matchKey(candidate));
    if (duplicate) {
      const merged = ContactCore.mergeContacts(duplicate, candidate);
      db.contacts[duplicate.id] = merged;
      if (requestedId && requestedId !== duplicate.id) delete db.contacts[requestedId];
      return { contact: merged, merged: true };
    }
    db.contacts[candidate.id] = candidate;
    return { contact: candidate, merged: false };
  }

  async function importContactsFromInput(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Le fichier dépasse 10 Mo.");
    const imported = ContactCore.parseContactFile(file.name, await file.text());
    if (!imported.length) throw new Error("Aucun contact valide trouvé dans ce fichier.");
    const previousContacts = clone(db.contacts);
    let added = 0;
    let merged = 0;
    const matches = new Map(contactValues().map((contact) => [ContactCore.matchKey(contact), contact.id]).filter(([key]) => key));
    imported.slice(0, MAX_CONTACTS).forEach((source) => {
      const contact = sanitizeContactRecord(source);
      if (!contact) return;
      const match = ContactCore.matchKey(contact);
      const existingId = matches.get(match);
      if (existingId && db.contacts[existingId]) {
        db.contacts[existingId] = ContactCore.mergeContacts(db.contacts[existingId], contact);
        merged += 1;
      } else if (Object.keys(db.contacts).length < MAX_CONTACTS) {
        while (db.contacts[contact.id]) contact.id = `contact-${uid()}`;
        db.contacts[contact.id] = contact;
        if (match) matches.set(match, contact.id);
        added += 1;
      }
    });
    if (!saveLocal(false)) {
      db.contacts = previousContacts;
      return;
    }
    renderContactDirectory();
    toast(`${plural(added, "contact")} ajouté${added === 1 ? "" : "s"}${merged ? ` · ${merged} fusionné${merged === 1 ? "" : "s"}` : ""}`);
  }

  function exportContacts(format) {
    const contacts = contactValues();
    if (!contacts.length) {
      toast("Aucun contact à exporter.", "error");
      return;
    }
    const exports = {
      csv: { extension: "csv", type: "text/csv;charset=utf-8", content: ContactCore.toCsv(contacts) },
      vcf: { extension: "vcf", type: "text/vcard;charset=utf-8", content: ContactCore.toVCard(contacts) },
      json: { extension: "json", type: "application/json;charset=utf-8", content: ContactCore.toJson(contacts) }
    };
    const selected = exports[format];
    if (!selected) return;
    downloadText(`contacts-bcdevis-${todayISO()}.${selected.extension}`, selected.content, selected.type);
    toast(`${plural(contacts.length, "contact")} exporté${contacts.length === 1 ? "" : "s"}`);
  }

  function trackingEnabled() {
    return db.settings.quoteTrackingEnabled === true;
  }

  function quoteIsLocked(item = quote) {
    return TRACKING_TERMINAL_STATUSES.includes(item?.tracking?.status);
  }

  function ensureQuoteEditable() {
    if (!quoteIsLocked()) return true;
    toast(`${TRACKING_STATUS_META[quote.tracking.status].label} · créez une V${Math.max(2, Number(quote.revisionNumber || 1) + 1)} pour modifier ce devis.`, "error");
    return false;
  }

  function formatDateTime(timestamp) {
    if (!timestamp || Number.isNaN(Date.parse(timestamp))) return "—";
    return new Intl.DateTimeFormat("fr-CH", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(new Date(timestamp));
  }

  function isFollowUpDue(item, referenceDate = todayISO()) {
    const tracking = item?.tracking;
    return tracking?.status === "sent" && Boolean(tracking.nextFollowUpAt) && tracking.nextFollowUpAt <= referenceDate;
  }

  function isFollowUpLate(item, referenceDate = todayISO()) {
    return isFollowUpDue(item, referenceDate) && item.tracking.nextFollowUpAt < referenceDate;
  }

  function trackingVisualStatus(item) {
    if (isFollowUpDue(item)) return { key: "follow-up", label: "À relancer" };
    const status = TRACKING_STATUSES.includes(item?.tracking?.status) ? item.tracking.status : "draft";
    return { key: status, label: TRACKING_STATUS_META[status].label };
  }

  function appendTrackingEvent(tracking, event) {
    tracking.events = [...(tracking.events || []), trackingEvent({ ...event, ...trackingActorFields() })].slice(-MAX_TRACKING_EVENTS);
  }

  function trackingTransitionAllowed(from, to) {
    return from === to || Boolean(TRACKING_TRANSITIONS[from]?.includes(to));
  }

  function updateQuoteTracking(item, { status, nextFollowUpAt, note = "", channel = "" } = {}) {
    item.tracking = sanitizeTracking(item.tracking, item.createdAt);
    const tracking = item.tracking;
    const previousStatus = tracking.status;
    const previousFollowUp = tracking.nextFollowUpAt;
    const nextStatus = TRACKING_STATUSES.includes(status) ? status : previousStatus;
    if (!trackingTransitionAllowed(previousStatus, nextStatus)) return false;
    const at = new Date().toISOString();
    const cleanNote = String(note || "").trim().slice(0, 1000);
    const followUpProvided = nextFollowUpAt !== undefined;
    let requestedFollowUp = followUpProvided ? String(nextFollowUpAt || "") : previousFollowUp;
    requestedFollowUp = requestedFollowUp ? validISODate(requestedFollowUp, "") : "";
    if (nextStatus !== "sent") requestedFollowUp = "";
    if (nextStatus === "sent" && !requestedFollowUp && !followUpProvided) requestedFollowUp = addDaysISO(todayISO(), configuredFollowUpDays(db.settings));

    tracking.status = nextStatus;
    tracking.nextFollowUpAt = requestedFollowUp;
    if (cleanNote) tracking.note = cleanNote;
    if (nextStatus === "sent" && !tracking.sentAt) tracking.sentAt = at;
    if (nextStatus === "accepted") tracking.acceptedAt = at;
    if (nextStatus === "refused") tracking.refusedAt = at;
    if (nextStatus === "invoiced") tracking.invoicedAt = at;

    if (nextStatus !== previousStatus) {
      appendTrackingEvent(tracking, { type: "status", status: nextStatus, at, note: cleanNote, channel, followUpAt: requestedFollowUp });
    } else if (requestedFollowUp !== previousFollowUp) {
      appendTrackingEvent(tracking, { type: "follow-up", status: nextStatus, at, note: cleanNote, channel, followUpAt: requestedFollowUp });
    } else if (cleanNote) {
      appendTrackingEvent(tracking, { type: "note", status: nextStatus, at, note: cleanNote, channel, followUpAt: requestedFollowUp });
    } else {
      return false;
    }
    item.updatedAt = at;
    return true;
  }

  function persistTrackedQuote(item) {
    db.quotes[item.id] = clone(item);
    if (item.id === quote.id) {
      quote = clone(item);
      db.current = clone(quote);
    }
    return saveLocal(false);
  }

  function expireTrackedQuotes() {
    if (!trackingEnabled()) return false;
    let changed = false;
    Object.values(db.quotes || {}).forEach((item) => {
      item.tracking = sanitizeTracking(item.tracking, item.createdAt);
      if (!["ready", "sent"].includes(item.tracking.status) || !item.validUntil || item.validUntil >= todayISO()) return;
      if (updateQuoteTracking(item, { status: "expired", note: "Date de validité dépassée" })) {
        db.quotes[item.id] = clone(item);
        if (item.id === quote.id) quote = clone(item);
        changed = true;
      }
    });
    if (changed) saveLocal(false);
    return changed;
  }

  function promptMarkCurrentQuoteAsSent(channel) {
    if (!trackingEnabled() || quote.tracking?.status === "sent") return;
    if (!["draft", "ready"].includes(quote.tracking?.status)) {
      toast(`${TRACKING_STATUS_META[quote.tracking?.status]?.label || "Ce devis"} ne peut pas revenir au statut Envoyé.`, "error");
      return;
    }
    if (!window.confirm(`Marquer ${quote.number} comme envoyé et programmer une relance ?`)) return;
    if (quote.tracking?.status === "draft" && !updateQuoteTracking(quote, { status: "ready", note: "Devis finalisé avant envoi" })) return;
    if (!updateQuoteTracking(quote, { status: "sent", channel })) return;
    db.quotes[quote.id] = clone(quote);
    saveLocal(false);
    renderHistory();
    toast(`Devis marqué comme envoyé · relance le ${formatDate(quote.tracking.nextFollowUpAt)}`);
  }

  function saveQuote() {
    if (!ensureQuoteEditable()) return false;
    if (!quote.lines.length) {
      toast("Ajoutez une prestation avant d’enregistrer.", "error");
      return false;
    }
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
    copy.validUntil = addDaysISO(copy.date, configuredValidityDays(db.settings));
    copy.rootQuoteId = copy.id;
    copy.previousQuoteId = "";
    copy.revisionNumber = 1;
    copy.tracking = freshTracking(now);
    copy.createdAt = now;
    copy.updatedAt = now;
    quote = copy;
    couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
    saveLocal();
    renderAll();
    toast(`Copie créée : ${quote.number}`);
  }

  function createQuoteRevision(item = quote) {
    const source = sanitizeQuote(item);
    const copy = clone(source);
    const now = new Date().toISOString();
    copy.id = uid();
    copy.status = "draft";
    copy.rootQuoteId = source.rootQuoteId || source.id;
    copy.previousQuoteId = source.id;
    copy.revisionNumber = Math.max(1, Number(source.revisionNumber) || 1) + 1;
    copy.date = todayISO();
    copy.number = nextQuoteNumber(copy.date);
    copy.validUntil = addDaysISO(copy.date, configuredValidityDays(db.settings));
    copy.tracking = freshTracking(now);
    copy.createdAt = now;
    copy.updatedAt = now;
    quote = copy;
    couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0);
    saveLocal();
    renderAll();
    closeLayer("historyLayer");
    toast(`V${copy.revisionNumber} créée : ${copy.number}`);
  }

  function trackingFilterMatches(item, filter) {
    if (item.tracking?.status === "invoiced") return false;
    if (filter === "all") return true;
    if (filter === "follow-up") return isFollowUpDue(item);
    return item.tracking?.status === filter;
  }

  function trackingCounts(items) {
    const counts = Object.fromEntries(TRACKING_FILTERS.map((filter) => [filter, 0]));
    counts.all = items.filter((item) => item.tracking?.status !== "invoiced").length;
    items.forEach((item) => {
      const status = TRACKING_STATUSES.includes(item.tracking?.status) ? item.tracking.status : "draft";
      if (Object.hasOwn(counts, status)) counts[status] += 1;
      if (isFollowUpDue(item)) counts["follow-up"] += 1;
    });
    return counts;
  }

  function trackingEventCopy(event) {
    if (event.type === "note") return { title: "Note ajoutée", detail: event.note };
    if (event.type === "follow-up") {
      return {
        title: event.followUpAt ? `Relance prévue le ${formatDate(event.followUpAt)}` : "Relance annulée",
        detail: event.note
      };
    }
    const status = TRACKING_STATUS_META[event.status] || TRACKING_STATUS_META.draft;
    const details = [event.channel ? `Canal : ${event.channel}` : "", event.note].filter(Boolean).join(" · ");
    return { title: status.eventLabel, detail: details };
  }

  function renderTrackingTimeline(item) {
    const events = [...(item.tracking?.events || [])].sort((left, right) => String(left.at).localeCompare(String(right.at)));
    return `<ol class="tracking-timeline">${events.map((event) => {
      const copy = trackingEventCopy(event);
      const actor = [event.actor, event.device].filter(Boolean).join(" · ");
      return `<li><span class="tracking-timeline-dot" aria-hidden="true"></span><div><time datetime="${escapeHTML(event.at)}">${escapeHTML(formatDateTime(event.at))}</time><strong>${escapeHTML(copy.title)}</strong>${copy.detail ? `<p>${escapeHTML(copy.detail)}</p>` : ""}${actor ? `<small>${escapeHTML(actor)}</small>` : ""}</div></li>`;
    }).join("")}</ol>`;
  }

  function renderTrackingEditor(item) {
    const selectableStatuses = [item.tracking.status, ...(TRACKING_TRANSITIONS[item.tracking.status] || []).filter((status) => status !== "invoiced")];
    const options = selectableStatuses.map((status) => `<option value="${status}" ${item.tracking.status === status ? "selected" : ""}>${escapeHTML(TRACKING_STATUS_META[status].label)}</option>`).join("");
    const canUndo = !quoteIsLocked(item) && (item.tracking.events || []).length > 1;
    const followUpDisabled = item.tracking.status !== "sent";
    const invoiceAction = item.tracking.status === "accepted"
      ? `<button class="button primary" type="button" data-tracking-invoice>Importer la facture envoyée</button>`
      : "";
    const revisionAction = quoteIsLocked(item)
      ? `<button class="button secondary" type="button" data-tracking-revision>Créer une V${Math.max(2, Number(item.revisionNumber || 1) + 1)}</button>`
      : "";
    const openAction = `<button class="button ghost" type="button" data-tracking-open-quote data-quote-id="${escapeHTML(item.id)}">Ouvrir le devis</button>`;
    return `<form class="tracking-editor" data-tracking-form data-tracking-quote-id="${escapeHTML(item.id)}">
      <label><span>Dernier statut</span><select name="trackingStatus">${options}</select></label>
      <label><span>Prochaine relance</span><input name="trackingFollowUpAt" type="date" min="${todayISO()}" value="${escapeHTML(item.tracking.nextFollowUpAt || "")}" ${followUpDisabled ? "disabled" : ""}></label>
      <label class="tracking-editor-note"><span>Note interne ou motif</span><textarea name="trackingNote" rows="2" maxlength="1000" placeholder="Ajouter une information à la chronologie…"></textarea></label>
      <div class="tracking-editor-workflow-actions">${openAction}${invoiceAction}${revisionAction}</div>
      <div class="tracking-editor-actions"><button class="button ghost" type="button" data-tracking-undo ${canUndo ? "" : "disabled"}>Annuler le dernier changement</button><button class="button primary" type="submit">Enregistrer le suivi</button></div>
    </form>`;
  }

  function rebuildTrackingFromEvents(item, sourceEvents) {
    const events = sourceEvents.map((event) => trackingEvent(event));
    const tracking = {
      status: "draft", nextFollowUpAt: "", note: "", sentAt: "", acceptedAt: "", refusedAt: "", invoicedAt: "", events
    };
    events.forEach((event) => {
      if (event.type === "status") {
        tracking.status = TRACKING_STATUSES.includes(event.status) ? event.status : tracking.status;
        tracking.nextFollowUpAt = tracking.status === "sent" ? event.followUpAt || tracking.nextFollowUpAt : "";
        if (tracking.status === "sent" && !tracking.sentAt) tracking.sentAt = event.at;
        if (tracking.status === "accepted") tracking.acceptedAt = event.at;
        if (tracking.status === "refused") tracking.refusedAt = event.at;
        if (tracking.status === "invoiced") tracking.invoicedAt = event.at;
      }
      if (event.type === "follow-up") tracking.nextFollowUpAt = event.followUpAt || "";
      if (event.note) tracking.note = event.note;
    });
    item.tracking = tracking;
    item.updatedAt = new Date().toISOString();
  }

  function undoLastTrackingChange(item) {
    const events = item.tracking?.events || [];
    if (events.length <= 1) return false;
    rebuildTrackingFromEvents(item, events.slice(0, -1));
    return persistTrackedQuote(item);
  }

  function renderHistoryItem(item, trackingView, trackingActive = false) {
    const totals = calculateQuote(item);
    const revision = Number(item.revisionNumber) > 1 ? ` · V${Number(item.revisionNumber)}` : "";
    const visual = trackingVisualStatus(item);
    if (!trackingView) {
      return `<button class="history-item history-item--archive ${trackingActive ? `history-item--${visual.key}` : ""} ${item.id === quote.id ? "current" : ""}" type="button" data-quote-id="${escapeHTML(item.id)}">
        <span class="history-item-head"><strong>${escapeHTML(item.number)}${escapeHTML(revision)}</strong><b>${money(totals.total)}</b></span>
        <span class="history-item-client">${escapeHTML(item.client?.name || "Client à compléter")}</span>
        <span class="history-item-meta"><span>${formatDate(item.date)} · ${plural(item.lines?.length || 0, "soin")}</span>${trackingActive ? `<span class="history-status history-status--commercial">${escapeHTML(visual.label)}</span>` : ""}</span>
      </button>`;
    }
    const expanded = expandedTrackingQuotes.has(item.id);
    const followUpCopy = item.tracking.nextFollowUpAt
      ? `${isFollowUpLate(item) ? "Relance en retard" : "Relance"} · ${formatDate(item.tracking.nextFollowUpAt)}`
      : `Valable jusqu’au ${formatDate(item.validUntil)}`;
    return `<article class="history-item history-item--tracked history-item--${visual.key} ${item.id === quote.id ? "current" : ""} ${expanded ? "is-expanded" : ""}" data-history-item="${escapeHTML(item.id)}">
      <div class="history-item-summary">
        <button class="history-disclosure" type="button" data-tracking-toggle="${escapeHTML(item.id)}" aria-expanded="${expanded}" aria-controls="tracking-detail-${escapeHTML(item.id)}" aria-label="${expanded ? "Masquer" : "Afficher"} l’historique des statuts de ${escapeHTML(item.number)}"><svg aria-hidden="true"><use href="#icon-chevron"></use></svg></button>
        <button class="history-item-open" type="button" data-quote-id="${escapeHTML(item.id)}">
          <span class="history-item-head"><strong>${escapeHTML(item.number)}${escapeHTML(revision)}</strong><b>${money(totals.total)}</b></span>
          <span class="history-item-client">${escapeHTML(item.client?.name || "Client à compléter")}</span>
          <span class="history-item-meta"><span>${formatDate(item.date)} · ${plural(item.lines?.length || 0, "soin")}</span><span class="history-status">${escapeHTML(visual.label)}</span></span>
          <span class="history-follow-up">${escapeHTML(followUpCopy)}</span>
        </button>
      </div>
      <div class="tracking-detail" id="tracking-detail-${escapeHTML(item.id)}" ${expanded ? "" : "hidden"}>${renderTrackingTimeline(item)}${renderTrackingEditor(item)}</div>
    </article>`;
  }

  function renderTrackingNavigation(items) {
    const enabled = trackingEnabled();
    const tabs = $("#historyTabs");
    const filters = $("#trackingFilters");
    const summary = $("#trackingSummary");
    $("#historyLayer").classList.toggle("tracking-enabled", enabled);
    tabs.hidden = !enabled;
    if (!enabled) activeHistoryView = "history";
    $$('[data-history-view]', tabs).forEach((tab) => {
      const selected = tab.dataset.historyView === activeHistoryView;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $("#historyList").setAttribute("aria-labelledby", activeHistoryView === "tracking" ? "historyViewTrackingTab" : "historyViewHistoryTab");
    $("#historyWorkspaceDescription").textContent = activeHistoryView === "tracking"
      ? "Gérez les statuts, les relances et la chronologie des devis commerciaux actifs."
      : "Retrouvez tous les devis enregistrés et rouvrez celui que vous souhaitez consulter.";
    const counts = trackingCounts(items);
    const dueBadge = $("#trackingDueCount");
    dueBadge.textContent = String(counts["follow-up"] || "");
    dueBadge.hidden = counts["follow-up"] === 0;
    filters.hidden = !enabled || activeHistoryView !== "tracking";
    summary.hidden = !enabled || activeHistoryView !== "tracking" || db.settings.trackingShowCounters !== true;
    if (!filters.hidden) {
      $$('[data-tracking-filter]', filters).forEach((button) => {
        const filter = button.dataset.trackingFilter;
        const selected = filter === activeTrackingFilter;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
        const count = $("[data-filter-count]", button);
        if (count) count.textContent = counts[filter] || 0;
      });
    }
    if (!summary.hidden) {
      const acceptedThisMonth = items.filter((item) => item.tracking?.status === "accepted" && String(item.tracking.acceptedAt || "").slice(0, 7) === todayISO().slice(0, 7)).length;
      summary.innerHTML = `<div><strong>${counts.ready}</strong><span>À envoyer</span></div><div><strong>${counts["follow-up"]}</strong><span>À relancer</span></div><div><strong>${items.filter((item) => isFollowUpLate(item)).length}</strong><span>En retard</span></div><div><strong>${acceptedThisMonth}</strong><span>Acceptés ce mois</span></div>`;
    }
  }

  function renderHistory() {
    expireTrackedQuotes();
    const list = $("#historyList");
    const enabled = trackingEnabled();
    let quotes = Object.values(db.quotes);
    renderTrackingNavigation(quotes);
    if (enabled && activeHistoryView === "tracking") {
      quotes = quotes.filter((item) => trackingFilterMatches(item, activeTrackingFilter));
      quotes.sort((left, right) => {
        const leftDue = isFollowUpDue(left) ? left.tracking.nextFollowUpAt : "9999-12-31";
        const rightDue = isFollowUpDue(right) ? right.tracking.nextFollowUpAt : "9999-12-31";
        return leftDue.localeCompare(rightDue) || String(right.updatedAt).localeCompare(String(left.updatedAt));
      });
    } else {
      quotes.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    }
    if (!quotes.length) {
      const filtered = enabled && activeHistoryView === "tracking" && activeTrackingFilter !== "all";
      list.innerHTML = `<div class="history-empty"><svg><use href="#icon-history"></use></svg><strong>${filtered ? "Aucun devis dans ce statut" : "Aucun devis enregistré"}</strong><p>${filtered ? "Choisissez un autre filtre de suivi." : "Le bouton Enregistrer ajoutera le devis en cours à cet historique local."}</p></div>`;
      return;
    }
    const trackingView = enabled && activeHistoryView === "tracking";
    list.innerHTML = quotes.map((item) => renderHistoryItem(item, trackingView, enabled)).join("");
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

  function toggleTrackingDetails(id, { focus = false } = {}) {
    if (!id || !db.quotes[id]) return;
    if (expandedTrackingQuotes.has(id)) expandedTrackingQuotes.delete(id);
    else expandedTrackingQuotes.add(id);
    renderHistory();
    if (focus) $(`[data-tracking-toggle="${id}"]`, $("#historyList"))?.focus();
  }

  function isTouchTrackingActivation(event) {
    return event?.pointerType === "touch" || window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  function downloadText(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function downloadJSON(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
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
    importedQuote.tracking = freshTracking(importedQuote.createdAt);
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

  function currentSiteLabel() {
    return window.location.origin && window.location.origin !== "null"
      ? window.location.origin
      : "Application locale installée";
  }

  function refreshSiteMigrationPanel(message = "") {
    const input = $("#siteMigrationTarget");
    const current = $("#siteMigrationCurrent");
    const status = $("#siteMigrationStatus");
    const openButton = $("#siteMigrationOpenButton");
    if (!input || !current || !status || !openButton) return;
    if (!input.value) input.value = DEFAULT_SITE_MIGRATION_TARGET;
    current.textContent = currentSiteLabel();
    let normalizedTarget = "";
    try { normalizedTarget = normalizeSiteUrl(input.value); } catch { /* Le message précis sera affiché au clic. */ }
    const prepared = Boolean(normalizedTarget && preparedSiteMigrationTarget === normalizedTarget);
    openButton.disabled = !prepared;
    status.dataset.state = prepared ? "ready" : "idle";
    status.textContent = message || (prepared
      ? "Fichier prêt. Vous pouvez ouvrir la nouvelle adresse."
      : "Commencez par télécharger le fichier de transfert le plus récent.");
  }

  function exportSiteMigration() {
    const targetUrl = normalizeSiteUrl($("#siteMigrationTarget")?.value);
    const currentOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "";
    if (currentOrigin && new URL(targetUrl).origin === currentOrigin) {
      throw new Error("Cette adresse est déjà celle du site actuellement ouvert.");
    }
    if (!saveLocal(false)) return false;
    const payload = createTransferPackage({
      database: db,
      centralConfig: centralController.getConfig(),
      releaseVersion: RELEASE_VERSION,
      appVersion: APP_VERSION,
      sourceUrl: window.location.href,
      targetUrl
    });
    const targetHost = new URL(targetUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
    downloadJSON(`transfert-bcdevis-vers-${targetHost}-${todayISO()}.json`, payload);
    preparedSiteMigrationTarget = targetUrl;
    refreshSiteMigrationPanel("Fichier de transfert téléchargé. Conservez-le jusqu’à la vérification de la nouvelle adresse.");
    toast("Transfert du site préparé");
    return true;
  }

  async function openSiteMigrationTarget() {
    const targetUrl = normalizeSiteUrl($("#siteMigrationTarget")?.value);
    if (preparedSiteMigrationTarget !== targetUrl) {
      throw new Error("Téléchargez d’abord un fichier de transfert à jour.");
    }
    await openExternalUrl(migrationArrivalUrl(targetUrl));
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
    const duration = Number(item.duration || 0);
    const packPriceField = Number.isFinite(Number(base.packAveragePrice)) || Number.isFinite(Number(item.packAveragePrice))
      ? `<label><span>Prix Pack moyen (CHF)</span><input data-tile-field="packAveragePrice" type="number" inputmode="decimal" min="0" max="${MAX_LINE_PRICE}" step="0.01" value="${escapeHTML(item.packAveragePrice ?? base.packAveragePrice ?? 0)}"></label>`
      : "";
    return `<article class="tile-catalog-card" data-tile-editor-card data-service-id="${escapeHTML(base.id)}" data-tile-category-id="${escapeHTML(item.categoryId)}" data-tile-search="${escapeHTML(normalize(`${item.name} ${category.name} ${item.id} ${item.duration} ${item.price}`))}">
      <header class="tile-catalog-card-head">
        <div class="tile-catalog-live-preview" aria-label="Aperçu de la tuile ${escapeHTML(item.name)}">
          <button class="tile-catalog-icon-button" type="button" data-tile-icon-picker aria-label="Changer le pictogramme SVG de ${escapeHTML(item.name)}" title="Choisir un pictogramme SVG">
            <span aria-hidden="true"><svg><use href="${prestationIconHref(icon)}"></use></svg></span><small>Changer</small>
          </button>
          <span class="tile-catalog-preview-copy"><strong data-tile-preview-name>${escapeHTML(item.name)}</strong><small data-tile-preview-duration>${duration ? `${escapeHTML(duration)} min` : "Sans durée"}</small></span>
          <span class="tile-catalog-preview-price"><small>Séance</small><b data-tile-preview-price>${money(item.price)}</b></span>
        </div>
        <div class="tile-catalog-card-meta">
          <span class="tile-catalog-card-reference"><span>${escapeHTML(category.short || category.name)}</span><code>#${escapeHTML(item.id)}</code></span>
          <span class="tile-catalog-card-status" data-tile-editor-status>D’origine</span>
          <button class="tile-catalog-reset" type="button" data-tile-reset title="Rétablir cette tuile">Réinitialiser</button>
        </div>
        <input data-tile-field="icon" type="hidden" value="${escapeHTML(icon)}">
      </header>
      <div class="tile-catalog-fields">
        <label class="tile-catalog-name"><span>Nom</span><input data-tile-field="name" type="text" autocapitalize="sentences" maxlength="240" value="${escapeHTML(item.name)}" required></label>
        <label><span>Temps (min)</span><input data-tile-field="duration" type="number" inputmode="numeric" min="0" max="1440" step="5" value="${escapeHTML(item.duration ?? 0)}" required></label>
        <label><span>Prix (CHF)</span><input data-tile-field="price" type="number" inputmode="decimal" min="0" max="${MAX_LINE_PRICE}" step="0.01" value="${escapeHTML(item.price ?? 0)}" required></label>
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

  function tileEditorRawSignature(card) {
    return JSON.stringify($$("[data-tile-field]", card).map((input) => [input.dataset.tileField, input.value]));
  }

  function tileEditorCardState(card) {
    const result = tileEditorCardOverride(card);
    const customized = Boolean(result && Object.keys(result.override).length);
    const pending = tileEditorRawSignature(card) !== card.dataset.tileInitialSignature;
    return { ...result, customized, pending, modified: customized || pending };
  }

  function updateTileEditorCard(card) {
    const base = baseCatalogService(card.dataset.serviceId);
    if (!base) return { customized: false, pending: false, modified: false };
    const state = tileEditorCardState(card);
    const name = String($('[data-tile-field="name"]', card)?.value || "").trim() || "Sans nom";
    const duration = boundedInteger($('[data-tile-field="duration"]', card)?.value, 0, 1440, 0);
    const price = boundedNumber($('[data-tile-field="price"]', card)?.value, 0, MAX_LINE_PRICE, 0);
    const icon = catalogEditorIconValue({ ...base, icon: $('[data-tile-field="icon"]', card)?.value });
    $("[data-tile-preview-name]", card).textContent = name;
    $("[data-tile-preview-duration]", card).textContent = duration ? `${duration} min` : "Sans durée";
    $("[data-tile-preview-price]", card).textContent = money(price);
    $(".tile-catalog-icon-button use", card)?.setAttribute("href", prestationIconHref(icon));
    const category = categoryFor(base.categoryId);
    card.dataset.tileSearch = normalize(`${name} ${category.name} ${base.id} ${duration} ${price}`);
    card.dataset.tileModified = String(state.modified);
    card.classList.toggle("is-customized", state.customized);
    card.classList.toggle("is-pending", state.pending);
    const status = $("[data-tile-editor-status]", card);
    if (status) status.textContent = state.pending ? "À enregistrer" : state.customized ? "Personnalisée" : "D’origine";
    const reset = $("[data-tile-reset]", card);
    if (reset) reset.disabled = !state.modified;
    return state;
  }

  function tileEditorPendingCount() {
    return $$('[data-tile-editor-card]', $("#tileCatalogEditorList"))
      .filter((card) => tileEditorRawSignature(card) !== card.dataset.tileInitialSignature).length;
  }

  function updateTileEditorSummary() {
    const cards = $$('[data-tile-editor-card]', $("#tileCatalogEditorList"));
    const states = cards.map(updateTileEditorCard);
    const pending = states.filter((state) => state.pending).length;
    const modified = states.filter((state) => state.modified).length;
    const summary = $("#tileCatalogEditorChanges");
    const saveButton = $("#tileCatalogEditorSave");
    const modifiedCount = $("#tileCatalogCustomizedCount");
    const resetAll = $("#tileCatalogResetAllButton");
    if (summary) summary.textContent = pending ? plural(pending, "changement en attente", "changements en attente") : "Tout est enregistré";
    if (saveButton) {
      saveButton.disabled = !pending;
      saveButton.textContent = pending ? `Enregistrer ${pending}` : "Enregistré";
    }
    if (modifiedCount) modifiedCount.textContent = modified;
    if (resetAll) resetAll.disabled = !modified;
    filterTileCatalogEditor();
  }

  function filterTileCatalogEditor() {
    const needle = normalize($("#tileCatalogEditorSearch")?.value || "");
    const categoryId = $("#tileCatalogEditorCategory")?.value || "";
    const modifiedOnly = $("#tileCatalogCustomizedFilter")?.getAttribute("aria-pressed") === "true";
    const cards = $$('[data-tile-editor-card]', $("#tileCatalogEditorList"));
    let visible = 0;
    cards.forEach((card) => {
      const matchesSearch = !needle || card.dataset.tileSearch.includes(needle);
      const matchesCategory = !categoryId || card.dataset.tileCategoryId === categoryId;
      const matchesModified = !modifiedOnly || card.dataset.tileModified === "true";
      const matches = matchesSearch && matchesCategory && matchesModified;
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    const count = $("#tileCatalogEditorCount");
    if (count) count.textContent = visible === cards.length ? plural(cards.length, "tuile") : `${visible} sur ${cards.length} tuiles`;
    const empty = $("#tileCatalogEditorEmpty");
    if (empty) {
      empty.hidden = visible > 0;
      $("strong", empty).textContent = modifiedOnly ? "Aucune tuile modifiée" : "Aucune tuile trouvée";
      $("span", empty).textContent = modifiedOnly ? "Modifiez une tuile ou affichez de nouveau tout le catalogue." : "Essayez un autre nom ou une autre catégorie.";
    }
  }

  function buildTileCatalogEditor() {
    const list = $("#tileCatalogEditorList");
    if (!list) return;
    const services = baseCatalogServices();
    list.innerHTML = `${services.map(catalogEditorCard).join("")}<div class="tile-catalog-empty" id="tileCatalogEditorEmpty" hidden><svg aria-hidden="true"><use href="#icon-search"></use></svg><strong>Aucune tuile trouvée</strong><span>Essayez un autre nom ou une autre catégorie.</span></div>`;
    $$('[data-tile-editor-card]', list).forEach((card) => { card.dataset.tileInitialSignature = tileEditorRawSignature(card); });
    const search = $("#tileCatalogEditorSearch");
    if (search) search.value = "";
    const categorySelect = $("#tileCatalogEditorCategory");
    if (categorySelect) {
      const categories = [...new Map(services.map((item) => {
        const category = categoryFor(item.categoryId);
        return [String(item.categoryId), category];
      })).entries()].sort((left, right) => left[1].name.localeCompare(right[1].name, "fr", { sensitivity: "base" }));
      categorySelect.innerHTML = `<option value="">Toutes les catégories</option>${categories.map(([id, category]) => `<option value="${escapeHTML(id)}">${escapeHTML(category.name)}</option>`).join("")}`;
      categorySelect.value = "";
    }
    $("#tileCatalogCustomizedFilter")?.setAttribute("aria-pressed", "false");
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

  function resetTileEditorCard(card, { refresh = true } = {}) {
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
    if (refresh) updateTileEditorSummary();
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
    const previousCentralSyncApplying = centralSyncApplying;
    centralSyncApplying = true;
    const restoredLocally = saveLocal();
    centralSyncApplying = previousCentralSyncApplying;
    if (!restoredLocally) {
      db.catalogOverrides = previousOverrides;
      return;
    }
    $$('[data-tile-editor-card]', $("#tileCatalogEditorList")).forEach((card) => { card.dataset.tileInitialSignature = tileEditorRawSignature(card); });
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

  function applyPdfDirectoryState(result) {
    const pathElement = $("#pdfDirectoryPath");
    const statusElement = $("#pdfDirectoryStatus");
    const chooseButton = $("#choosePdfDirectoryButton");
    const resetButton = $("#resetPdfDirectoryButton");
    const available = Boolean(result?.available);
    if (pathElement) {
      pathElement.textContent = available ? String(result.directory || "Téléchargements") : "Réglages du navigateur";
      pathElement.title = pathElement.textContent;
    }
    if (statusElement) {
      statusElement.textContent = available
        ? (result.isDefault ? "Dossier Téléchargements de ce poste (par défaut)." : "Dossier personnalisé de ce poste uniquement.")
        : "Dans la version web/PWA, le navigateur choisit le dossier de téléchargement.";
    }
    if (chooseButton) chooseButton.hidden = !available;
    if (resetButton) {
      resetButton.hidden = !available;
      resetButton.disabled = !available || result.isDefault === true;
    }
  }

  async function refreshPdfDirectorySetting() {
    if (typeof window.bcdevisDesktop?.getPdfDirectory !== "function") {
      applyPdfDirectoryState({ available: false });
      return;
    }
    try {
      applyPdfDirectoryState(await window.bcdevisDesktop.getPdfDirectory());
    } catch (error) {
      console.error("Lecture du dossier PDF impossible.", error);
      applyPdfDirectoryState({ available: false });
      const status = $("#pdfDirectoryStatus");
      if (status) status.textContent = "Le dossier PDF de ce poste n’a pas pu être lu.";
    }
  }

  async function runPdfDirectoryAction(button, action, successMessage) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    let result;
    try {
      result = await action();
      if (!result?.canceled) toast(successMessage);
    } catch (error) {
      console.error("Modification du dossier PDF impossible.", error);
      toast(error?.message || "Le dossier PDF n’a pas pu être modifié.", "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
    if (result) applyPdfDirectoryState(result);
  }

  function fillSettingsForm() {
    const form = $("#settingsForm");
    Object.entries(db.settings).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    if (form.elements.showSignatures) form.elements.showSignatures.checked = db.settings.showSignatures !== false;
    if (form.elements.showTaxInformation) form.elements.showTaxInformation.checked = db.settings.showTaxInformation === true;
    if (form.elements.quoteDateEditable) form.elements.quoteDateEditable.checked = db.settings.quoteDateEditable === true;
    if (form.elements.quoteTrackingEnabled) form.elements.quoteTrackingEnabled.checked = db.settings.quoteTrackingEnabled === true;
    if (form.elements.trackingRemindersOnStartup) form.elements.trackingRemindersOnStartup.checked = db.settings.trackingRemindersOnStartup !== false;
    if (form.elements.trackingShowCounters) form.elements.trackingShowCounters.checked = db.settings.trackingShowCounters !== false;
    if (form.elements.centralUniqueQuoteNumbers) form.elements.centralUniqueQuoteNumbers.checked = db.settings.centralUniqueQuoteNumbers === true;
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
    syncTrackingSettingsState();
    renderCentralizationState();
    refreshSiteMigrationPanel();
    if ($("#centralPassword")) $("#centralPassword").value = "";
    void refreshLaunchAtLoginSetting();
    void refreshPdfDirectorySetting();
  }

  function syncTrackingSettingsState() {
    const form = $("#settingsForm");
    const details = $("#trackingSettingsDetails");
    if (!form || !details) return;
    const enabled = form.elements.quoteTrackingEnabled?.checked === true;
    details.hidden = !enabled;
    $$('input, select', details).forEach((control) => { control.disabled = !enabled; });
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
    const prefix = cleanDocumentPrefix(form.elements.quotePrefix?.value, "DEV");
    const invoicePrefix = cleanDocumentPrefix(form.elements.invoicePrefix?.value, "FAC");
    const machine = String(form.elements.machineName?.value || "").trim();
    const today = todayISO().replaceAll("-", "");
    const machinePart = compactMachineCode(machine || defaultSettings.machineName);
    const previewEl = $("#settingsQuotePreview");
    if (previewEl) previewEl.textContent = `${prefix}-${today}${machinePart}001`;
    const invoicePreviewEl = $("#settingsInvoicePreview");
    if (invoicePreviewEl) invoicePreviewEl.textContent = `${invoicePrefix}-${today}${machinePart}001`;
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

  function pdfEnglish() {
    return db.settings.pdfLanguage === "en";
  }

  function printOfferLabel(line) {
    if (pdfEnglish()) {
      if (line.offerType === "pack") return `Pack ${line.quantity} + ${line.freeQuantity} free`;
      if (line.offerType === "student") return "Student rate";
      return "Single session";
    }
    return offerLabel(line);
  }

  function printCategoryName(category) {
    if (!pdfEnglish()) return category.name;
    const englishNames = {
      13: "Laser hair removal",
      32: "Microneedling · Mesotherapy · Peels",
      7: "Initial consultation",
      16: "Injection treatments",
      17: "Laser treatments",
      35: "Combined areas",
      15: "Electrolysis hair removal",
      9: "Aesthetic medicine with Dr. Poiraud",
      20: "Face",
      8: "Permanent hair removal",
      21: "Chest and abdomen",
      22: "Back",
      23: "Arms",
      24: "Bikini (intimate area)",
      25: "Legs",
      36: "Students"
    };
    return englishNames[category.id] || category.name;
  }

  function renderPrint() {
    const totals = calculateQuote(quote);
    const taxEnabled = taxInformationEnabled(quote);
    const settings = db.settings;
    const en = pdfEnglish();
    const client = quote.client;
    const months = installmentMonths(totals.total);
    const contact = [settings.companyPhone, settings.companyEmail].filter(Boolean).join(" · ");
    const clientContact = [client.phone, client.email].filter(Boolean).join(" · ");
    const clientAddressParts = [client.address, [client.postalCode, client.city].filter(Boolean).join(" "), client.country].filter(Boolean).map(escapeHTML);
    const rows = quote.lines.map((line) => {
      const quantityLabel = line.offerType === "pack"
        ? (en ? `${line.quantity} paid + ${line.freeQuantity} free` : `${line.quantity} payées + ${line.freeQuantity} offerte${line.freeQuantity === 1 ? "" : "s"}`)
        : String(line.quantity);
      const unitPrice = line.offerType === "student" ? Number(line.basePrice ?? line.price) || 0 : Number(line.price) || 0;
      const meta = `${escapeHTML(printOfferLabel(line))} · ${escapeHTML(printCategoryName(categoryFor(line.categoryId)))}`;
      return `<tr><td><span class="print-item-name">${escapeHTML(line.name)}</span><span class="print-item-meta">${meta}</span></td><td>${quantityLabel}</td><td>${money(unitPrice)}</td><td>${money(referenceLineTotal(line))}</td></tr>`;
    }).join("");
    const studentConditionsSource = quote.lines.some((line) => line.offerType === "student") ? String(settings.studentConditions || "").trim() : "";
    const studentConditions = en && studentConditionsSource === DEFAULT_STUDENT_CONDITIONS ? DEFAULT_STUDENT_CONDITIONS_EN : studentConditionsSource;
    const conditionsSource = String(quote.conditions || settings.conditions);
    const conditions = en && (conditionsSource === DEFAULT_PAYMENT_CONDITIONS || conditionsSource === LEGACY_DEFAULT_PAYMENT_CONDITIONS) ? DEFAULT_PAYMENT_CONDITIONS_EN : conditionsSource;
    const footerNoteSource = String(settings.footerNote || "").trim();
    const footerNote = en && footerNoteSource === DEFAULT_FOOTER_NOTE ? DEFAULT_FOOTER_NOTE_EN : footerNoteSource;
    const customLogoSource = safeLogoDataUrl(settings.pdfLogoDataUrl) || safeLogoDataUrl(settings.headerLogoDataUrl);
    const logoSource = customLogoSource || DEFAULT_LOGO_PATH;
    const logoClass = customLogoSource ? "print-logo print-logo-custom" : "print-logo print-logo-official";
    const brandCopy = customLogoSource ? `<div class="print-brand-copy"><div class="print-company-kicker">${escapeHTML(settings.companySubtitle || (en ? "Establishment" : "Établissement"))}</div><div class="print-company-name">${escapeHTML(settings.companyName)}</div></div>` : "";
    const signatureBlock = settings.showSignatures !== false
      ? `<div class="print-signature"><div><span>${en ? "Date and place" : "Date et lieu"}</span></div><div><span>${en ? "Client signature and “Approved” mention" : "Signature du client et mention « Bon pour accord »"}</span></div></div>`
      : "";
    const totalLabel = taxEnabled ? (en ? "Total to pay incl. VAT" : "Total à payer TTC") : (en ? "Total to pay" : "Total à payer");
    const printRoot = $("#printQuote");
    const layoutClass = printLayoutClass(totals, months, studentConditions);
    printRoot.className = `print-quote ${layoutClass}`;
    printRoot.dataset.printLayout = layoutClass.replace("print-layout-", "");
    printRoot.innerHTML = `
      <header class="print-header">
        <div class="print-brand"><img class="${logoClass}" src="${escapeHTML(logoSource)}" alt="">${brandCopy}</div>
        <div class="print-company-lines"><span class="print-contact-label">${en ? "Contact details" : "Coordonnées"}</span>${escapeHTML(settings.companyAddress)}<br>${escapeHTML(contact)}${settings.companyUid ? `<br>${en ? "UID" : "IDE"} : ${escapeHTML(settings.companyUid)}` : ""}</div>
      </header>
      <section class="print-hero"><div><h1>${en ? "QUOTE" : "DEVIS"}</h1></div><div class="print-document-meta"><strong>${escapeHTML(quote.number)}</strong></div></section>
      <div class="print-overview">
        <div class="print-card print-client-card"><div class="print-label">${en ? "Client" : "Destinataire"}</div><div class="print-client-name">${escapeHTML(client.name || (en ? "Client not specified" : "Destinataire non renseigné"))}</div><div class="print-muted">${client.company ? `${escapeHTML(client.company)}<br>` : ""}${escapeHTML(clientContact || (en ? "Contact details not provided" : "Coordonnées non renseignées"))}${clientAddressParts.length ? `<br>${clientAddressParts.join("<br>")}` : ""}</div></div>
        <div class="print-card"><div class="print-label">${en ? "References" : "Références"}</div><div class="print-reference-grid"><span>${en ? "Quote date" : "Date du devis"}</span><span>${formatDate(quote.date)}</span><span>${en ? "Valid until" : "Valable jusqu’au"}</span><span>${formatDate(quote.validUntil)}</span><span>${en ? "Currency" : "Devise"}</span><span>CHF</span></div></div>
      </div>
      <section class="print-services">
        <div class="print-section-heading"><div><strong>${en ? "Treatments" : "Soins"}</strong></div></div>
        <table class="print-table"><thead><tr><th>${en ? "Treatment" : "Soin"}</th><th>${en ? "Quantity" : "Quantité"}</th><th>${en ? "Unit price" : "Prix unitaire"}</th><th>${en ? "Total" : "Total"}</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <div class="print-closing">
        <div class="print-summary print-summary-totals-only"><table class="print-totals"><tr><td>${en ? "Total before offers" : "Total avant offres"}</td><td>${money(totals.subtotal)}</td></tr>${totals.totalDiscount > 0 ? `<tr class="discount"><td>${en ? "Total discount" : "Rabais total"}</td><td>− ${money(totals.totalDiscount)}</td></tr>` : ""}${taxEnabled ? `<tr><td>${en ? "Net excl. VAT" : "Net HT"}</td><td>${money(totals.net)}</td></tr><tr><td>${en ? "VAT" : "TVA"} ${totals.rate} %${quote.tax.mode === "included" ? (en ? " included" : " incluse") : ""}</td><td>${money(totals.tax)}</td></tr>` : ""}<tr class="total"><td>${totalLabel}</td><td>${money(totals.total)}</td></tr></table></div>
        <section class="print-followup">
          ${totals.total > 0 ? `<div class="print-section-heading"><div><strong>${en ? "Payment terms" : "Modalités de paiement"}</strong></div></div><p class="print-installment-intro">${en ? "The installments shown below are indicative. Any installment plan is subject to prior acceptance by the financial partner." : "Les mensualités présentées ci-dessous sont indicatives. Toute demande d’échelonnement est soumise à l’acceptation préalable du partenaire financier."}</p><div class="print-installments">${months.map((month) => `<div class="print-installment"><b>${month} ${en ? "months" : "mois"}</b><span>${money(totals.total / month)}</span><small>${en ? "indicative installment" : "mensualité indicative"}</small></div>`).join("")}</div>` : ""}
          <div class="print-legal-block">
            <div class="print-section-heading print-legal-heading"><div><strong>${en ? "Terms and acceptance" : "Conditions et acceptation"}</strong></div></div>
            <div class="print-conditions print-conditions-single"><div><strong>${en ? "Payment conditions" : "Conditions de règlement"}</strong>${escapeHTML(conditions)}${studentConditions ? `<div class="print-student-conditions"><strong>${en ? "Student rate conditions" : "Conditions du tarif étudiant"}</strong>${escapeHTML(studentConditions)}</div>` : ""}${footerNote ? `<div class="print-legal-note">${escapeHTML(footerNote)}</div>` : ""}</div></div>
            ${signatureBlock}
          </div>
        </section>
        <footer class="print-footer"><span>${escapeHTML(settings.companyName)} · ${escapeHTML(quote.number)}</span><span>${en ? "Valid until" : "Valable jusqu’au"} ${formatDate(quote.validUntil)}</span></footer>
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
      if (result?.saved) toast(`PDF enregistré : ${result.fileName || `${quote.number}.pdf`} · ${result.directory || "Téléchargements"}`);
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
      toast(result?.saved ? `PDF créé dans ${result.directory || "Téléchargements"} — joignez-le dans WhatsApp.` : "WhatsApp ouvert — créez puis joignez le PDF avant l’envoi.");
      promptMarkCurrentQuoteAsSent("WhatsApp");
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
      promptMarkCurrentQuoteAsSent("E-mail");
    } catch (error) {
      console.error(error);
      toast("Impossible d’ouvrir un e-mail avec le PDF joint. Le PDF reste dans le dossier PDF configuré.", "error");
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
        ? `Outlook Web ouvert — joignez ${result.fileName || "le PDF"} depuis ${result.directory || "Téléchargements"}.`
        : "Outlook Web ouvert — créez puis joignez le PDF avant l’envoi.");
      promptMarkCurrentQuoteAsSent("Outlook Web");
    } catch (error) {
      console.error(error);
      toast("Outlook Web n’a pas pu être ouvert. Le PDF reste dans le dossier PDF configuré.", "error");
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
    const permanent = document.documentElement.dataset.displayMode !== "smartphone"
      && window.matchMedia("(min-width: 1181px)").matches;
    panel.classList.toggle("is-full-height", permanent);
    document.documentElement.classList.toggle("checkout-focus", permanent);
    document.body.classList.toggle("checkout-focus", permanent);
  }

  function appMenuItems() {
    return $$('[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled]), [role="menuitemradio"]:not([disabled])', $("#appActionsMenu"));
  }

  function quoteMenuItems() {
    return $$('[role="menuitem"]:not([disabled])', $("#quoteActionMenu"));
  }

  function transmissionMenuItems() {
    return $$('[role="menuitem"]:not([disabled])', $("#checkoutTransmissionMenu"));
  }

  function handleMenuKeydown(event, getItems) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = getItems();
    const index = items.indexOf(document.activeElement);
    let nextIndex = -1;
    if (event.key === "ArrowDown") nextIndex = index < 0 ? 0 : (index + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    items[nextIndex]?.focus();
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
    trigger.setAttribute("aria-label", open ? "Fermer les envois avec PDF à joindre" : "Choisir un envoi avec PDF à joindre");
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
    if (open) renderDisplayModeMenu();
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

  function showTrackingReminders() {
    if (!trackingEnabled() || db.settings.trackingRemindersOnStartup === false) return;
    if (expireTrackedQuotes()) renderCheckout();
    const due = Object.values(db.quotes || {}).filter((item) => isFollowUpDue(item));
    if (!due.length) return;
    const late = due.filter((item) => isFollowUpLate(item)).length;
    toast(`${plural(due.length, "devis à relancer")} aujourd’hui${late ? ` · ${late} en retard` : ""}`);
  }

  function refreshExpiredTracking() {
    if (!expireTrackedQuotes()) return;
    renderCheckout();
    if (!$("#historyLayer")?.hidden) renderHistory();
  }

  function openCustomItemLayer() {
    if (!ensureQuoteEditable()) return;
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

  function openSiteMigrationArrival() {
    const url = new URL(window.location.href);
    if (url.searchParams.get(MIGRATION_QUERY_KEY) !== "1") return false;
    url.searchParams.delete(MIGRATION_QUERY_KEY);
    window.history.replaceState(null, "", url.toString());
    activeSettingsTab = "data";
    openSettingsLayer();
    refreshSiteMigrationPanel("Nouvelle adresse ouverte. Importez maintenant le fichier préparé sur l’ancien site.");
    window.setTimeout(() => $("#siteMigrationImportButton")?.focus(), 0);
    toast("Nouvelle adresse détectée · importez votre transfert");
    return true;
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

  function cartSwipeHintSeen() {
    if (cartSwipeHintSeenThisSession) return true;
    try {
      return localStorage.getItem(CART_SWIPE_HINT_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markCartSwipeHintSeen() {
    if (!isTouchLayoutMode() || cartSwipeHintSeen()) return;
    cartSwipeHintSeenThisSession = true;
    try {
      localStorage.setItem(CART_SWIPE_HINT_SEEN_KEY, "1");
    } catch (error) {
      console.warn("État de l’aide au balayage indisponible", error);
    }
    $("#cartSwipeHint")?.remove();
  }

  function undoRemovedLine(removedLine, index, quoteId) {
    if (quote.id !== quoteId || quote.lines.some((item) => item.id === removedLine.id)) {
      toast("Cette suppression ne peut plus être annulée.", "error");
      return;
    }
    const restoredIndex = Math.max(0, Math.min(index, quote.lines.length));
    quote.lines.splice(restoredIndex, 0, removedLine);
    if (!saveLocal()) {
      quote.lines = quote.lines.filter((item) => item.id !== removedLine.id);
      return;
    }
    renderCatalog();
    renderCheckout();
    toast(`${removedLine.name} restauré`);
    window.setTimeout(() => $(`[data-line-id="${CSS.escape(removedLine.id)}"] .cart-line-name`)?.focus(), 0);
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
    if (shouldReveal) markCartSwipeHintSeen();
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
    const hintDismiss = event.target.closest("[data-cart-swipe-hint-dismiss]");
    if (hintDismiss) {
      markCartSwipeHintSeen();
      return;
    }
    const actionButton = event.target.closest("[data-line-action]");
    if (!actionButton) return;
    if (!ensureQuoteEditable()) return;
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
    if (action === "decrease") {
      line.quantity = Math.max(1, line.quantity - 1);
      if (line.offerType === "pack" && line.quantity < packDefaults().paid) {
        line.offerType = "single";
        line.freeQuantity = 0;
        if (!quote.lines.some((item) => item.offerType === "pack")) selectedOfferMode = "single";
      }
    }
    if (action === "increase-free") line.freeQuantity = boundedInteger(line.freeQuantity + 1, 0, MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
    if (action === "decrease-free") line.freeQuantity = Math.max(0, line.freeQuantity - 1);
    if (action === "remove") {
      const removedIndex = quote.lines.findIndex((item) => item.id === line.id);
      const removedLine = clone(line);
      const quoteId = quote.id;
      quote.lines.splice(removedIndex, 1);
      if (!saveLocal()) {
        quote.lines.splice(removedIndex, 0, line);
        return;
      }
      renderCatalog();
      renderCheckout();
      if (isTouchLayoutMode()) {
        toast(`${removedLine.name} supprimé`, "success", {
          actionLabel: "Annuler",
          duration: 6000,
          onAction: () => undoRemovedLine(removedLine, removedIndex, quoteId)
        });
      }
      return;
    }
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
    if (!ensureQuoteEditable()) { event.target.value = quote.date; return; }
    if (db.settings.quoteDateEditable !== true) {
      event.target.value = quote.date;
      return;
    }
    const previousDate = quote.date;
    quote.date = boundedQuoteDate(event.target.value);
    quote.validUntil = addDaysISO(quote.date, configuredValidityDays(db.settings));
    if (quote.date !== previousDate) quote.number = nextQuoteNumber(quote.date);
    event.target.value = quote.date;
    saveLocal();
  });
  $$("[data-discount-type]").forEach((button) => button.addEventListener("click", () => {
    if (!ensureQuoteEditable()) return;
    if (button.dataset.discountType === "percent" && studentPricingActive()) {
      toast("Le coupon en % n’est pas cumulable avec le tarif étudiant");
      return;
    }
    quote.discount.type = button.dataset.discountType;
    saveLocal();
    renderCheckout();
  }));
  $("#couponCode").addEventListener("input", (event) => {
    if (!ensureQuoteEditable()) return;
    const code = String(event.target.value || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
    event.target.value = code;
    quote.discount.code = code;
    scheduleSaveLocal();
    renderTotals();
  });
  $("#discountValue").addEventListener("input", (event) => { if (!ensureQuoteEditable()) return; quote.discount.value = Math.max(0, Number(event.target.value) || 0); scheduleSaveLocal(); renderCheckout(); });
  $("#couponToggle").addEventListener("click", () => {
    if (!ensureQuoteEditable()) return;
    couponOpen = true;
    renderCheckout();
    window.setTimeout(() => $("#couponCode").focus(), 0);
  });
  $("#taxEnabled").addEventListener("change", (event) => { if (!ensureQuoteEditable()) return; quote.tax.enabled = event.target.checked; saveLocal(); renderCheckout(); });

  $("#clientButton").addEventListener("click", openClient);
  $("#clientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!ensureQuoteEditable()) return;
    const previousContacts = clone(db.contacts);
    const previousClient = clone(quote.client);
    try {
      const result = upsertContactFromForm(event.currentTarget);
      selectedContactId = result.contact.id;
      quote.client = sanitizeClientSnapshot({ ...result.contact, contactId: result.contact.id });
      if (!saveLocal()) {
        db.contacts = previousContacts;
        quote.client = previousClient;
        return;
      }
      renderClient();
      renderHeader();
      closeLayer("clientLayer");
      toast(result.merged ? "Contact fusionné et utilisé" : "Contact enregistré et utilisé");
    } catch (error) {
      db.contacts = previousContacts;
      quote.client = previousClient;
      toast(error.message || "Contact impossible à enregistrer", "error");
    }
  });
  $("#clearClientButton").addEventListener("click", () => { if (!ensureQuoteEditable()) return; quote.client = emptyClientSnapshot(); saveLocal(); renderClient(); renderHeader(); closeLayer("clientLayer"); toast("Client retiré du devis"); });
  $("#newContactButton").addEventListener("click", () => prepareNewContact());
  $("#contactSearch").addEventListener("input", (event) => { contactQuery = event.target.value; renderContactDirectory(); });
  $("#contactList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-contact-id]");
    if (button) selectContact(button.dataset.contactId);
  });
  $("#contactImportButton").addEventListener("click", () => $("#contactImportInput").click());
  $("#contactImportInput").addEventListener("change", (event) => void importContactsFromInput(event.target).catch((error) => toast(error.message || "Import de contacts impossible", "error")));
  $$('[data-contact-export]').forEach((button) => button.addEventListener("click", () => exportContacts(button.dataset.contactExport)));
  $("#deleteContactButton").addEventListener("click", () => {
    const contact = db.contacts?.[selectedContactId];
    if (!contact || !window.confirm(`Supprimer ${contact.name} du répertoire ? Le devis conservera ses coordonnées.`)) return;
    const previousContacts = clone(db.contacts);
    const previousClient = clone(quote.client);
    delete db.contacts[selectedContactId];
    if (quote.client.contactId === selectedContactId) quote.client.contactId = "";
    selectedContactId = "";
    if (!saveLocal()) {
      db.contacts = previousContacts;
      quote.client = previousClient;
      return;
    }
    prepareNewContact({ focusName: false });
    renderClient();
    toast("Contact supprimé du répertoire");
  });

  $("#customItemForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!ensureQuoteEditable()) return;
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
  $("#historyTabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-history-view]");
    if (!tab) return;
    activeHistoryView = tab.dataset.historyView === "tracking" ? "tracking" : "history";
    renderHistory();
    $(`[data-history-view="${activeHistoryView}"]`, $("#historyTabs"))?.focus();
  });
  $("#historyTabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = $$('[data-history-view]', event.currentTarget);
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].click();
  });
  $("#trackingFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tracking-filter]");
    if (!button || !TRACKING_FILTERS.includes(button.dataset.trackingFilter)) return;
    activeTrackingFilter = button.dataset.trackingFilter;
    expandedTrackingQuotes.clear();
    renderHistory();
    $(`[data-tracking-filter="${activeTrackingFilter}"]`, $("#trackingFilters"))?.focus();
  });
  $("#historyList").addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-tracking-toggle]");
    if (toggle) {
      toggleTrackingDetails(toggle.dataset.trackingToggle, { focus: true });
      return;
    }
    const touchCard = event.target.closest(".history-item--tracked .history-item-open[data-quote-id]");
    if (touchCard && isTouchTrackingActivation(event)) {
      toggleTrackingDetails(touchCard.dataset.quoteId);
      return;
    }
    const undo = event.target.closest("[data-tracking-undo]");
    if (undo) {
      const form = undo.closest("[data-tracking-form]");
      const item = db.quotes[form?.dataset.trackingQuoteId];
      if (!item || !undoLastTrackingChange(item)) return;
      renderHistory();
      if (item.id === quote.id) renderCheckout();
      toast("Dernier changement de suivi annulé");
      return;
    }
    const invoice = event.target.closest("[data-tracking-invoice]");
    if (invoice) {
      const form = invoice.closest("[data-tracking-form]");
      const item = db.quotes[form?.dataset.trackingQuoteId];
      if (!item || item.tracking?.status !== "accepted") return;
      if (!centralController.getConfig().connected) {
        closeLayer("historyLayer");
        activeSettingsTab = "data";
        openSettingsLayer();
        toast("Connectez ce poste pour archiver la facture envoyée.", "error");
        return;
      }
      pendingInvoiceQuoteId = item.id;
      $("#trackingInvoiceInput").click();
      return;
    }
    const revision = event.target.closest("[data-tracking-revision]");
    if (revision) {
      const form = revision.closest("[data-tracking-form]");
      const item = db.quotes[form?.dataset.trackingQuoteId];
      if (item) createQuoteRevision(item);
      return;
    }
    const openQuote = event.target.closest("[data-tracking-open-quote][data-quote-id]");
    if (openQuote) {
      loadHistoryQuote(openQuote.dataset.quoteId);
      return;
    }
    const button = event.target.closest(".history-item-open[data-quote-id], .history-item[data-quote-id]");
    if (button) loadHistoryQuote(button.dataset.quoteId);
  });
  $("#historyList").addEventListener("change", (event) => {
    if (!event.target.matches('[name="trackingStatus"]')) return;
    const form = event.target.closest("[data-tracking-form]");
    const followUp = form?.elements.trackingFollowUpAt;
    if (!followUp) return;
    followUp.disabled = event.target.value !== "sent";
    if (!followUp.disabled && !followUp.value) followUp.value = addDaysISO(todayISO(), configuredFollowUpDays(db.settings));
    if (followUp.disabled) followUp.value = "";
  });
  $("#historyList").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-tracking-form]");
    if (!form) return;
    event.preventDefault();
    const item = db.quotes[form.dataset.trackingQuoteId];
    if (!item) return;
    const data = new FormData(form);
    const requestedStatus = data.get("trackingStatus");
    const changed = updateQuoteTracking(item, {
      status: requestedStatus,
      nextFollowUpAt: requestedStatus === "sent" ? data.get("trackingFollowUpAt") ?? undefined : undefined,
      note: data.get("trackingNote")
    });
    if (!changed) { toast("Aucun changement de suivi"); return; }
    if (!persistTrackedQuote(item)) return;
    renderHistory();
    if (item.id === quote.id) renderCheckout();
    toast(`Suivi mis à jour · ${TRACKING_STATUS_META[item.tracking.status].label}`);
  });
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
    handleMenuKeydown(event, transmissionMenuItems);
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
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const tabs = $$("#settingsTabs [role='tab']");
    const current = event.target.closest("[data-settings-tab]");
    const index = tabs.indexOf(current);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
    setSettingsTab(tabs[nextIndex].dataset.settingsTab, { focus: true, resetScroll: true });
  });
  $("#centralEnabled").addEventListener("change", async (event) => {
    if (event.target.checked) {
      centralController.configure({ enabled: true });
      renderCentralizationState();
      window.setTimeout(() => $("#centralEndpoint")?.focus(), 0);
      return;
    }
    await centralController.disconnect();
    renderCentralizationState();
    toast("Mode local réactivé · aucune donnée locale supprimée");
  });
  $("#centralTestButton").addEventListener("click", async (event) => {
    await runCentralAction(event.currentTarget, "Test en cours…", async () => {
      const values = centralFormValues();
      centralController.configure({ enabled: true, ...values });
      const result = await centralController.testConnection(values.endpoint);
      toast(`Serveur BCDevis ${result.version} disponible · PostgreSQL prêt`);
    });
  });
  $("#centralConnectButton").addEventListener("click", async (event) => {
    await runCentralAction(event.currentTarget, "Connexion…", async () => {
      const values = centralFormValues();
      if (!values.email || !$("#centralEmail").checkValidity()) throw new Error("Indiquez l’adresse e-mail du compte central.");
      const password = $("#centralPassword").value;
      const result = await centralController.connect({ ...values, password });
      $("#centralPassword").value = "";
      if (db.settings.centralUniqueQuoteNumbers === true) await ensureCentralQuoteNumberPool({ required: 1 });
      if (!result?.conflict) toast("Poste connecté et données synchronisées");
    });
  });
  $("#centralSyncButton").addEventListener("click", async (event) => {
    await runCentralAction(event.currentTarget, "Synchronisation…", async () => {
      const result = await centralController.sync();
      if (!result?.conflict && !result?.authenticationRequired) toast("Synchronisation terminée");
    });
  });
  $("#centralDisconnectButton").addEventListener("click", async (event) => {
    await runCentralAction(event.currentTarget, "Déconnexion…", async () => {
      await centralController.disconnect();
      toast("Mode local réactivé · aucune donnée locale supprimée");
    });
  });
  $("#centralUseServerButton").addEventListener("click", async (event) => {
    backupBeforeCentralResolution();
    await runCentralAction(event.currentTarget, "Résolution…", async () => {
      const result = await centralController.resolveWithServer();
      if (!result?.conflict) toast("Version centrale conservée");
    });
  });
  $("#centralUseDeviceButton").addEventListener("click", async (event) => {
    backupBeforeCentralResolution();
    await runCentralAction(event.currentTarget, "Résolution…", async () => {
      const result = await centralController.resolveWithDevice();
      if (!result?.conflict) toast("Modifications de ce poste conservées");
    });
  });
  $("#tileCatalogEditorButton").addEventListener("click", openTileCatalogEditor);
  $("#tileCatalogEditorSearch").addEventListener("input", filterTileCatalogEditor);
  $("#tileCatalogEditorCategory").addEventListener("change", filterTileCatalogEditor);
  $("#tileCatalogCustomizedFilter").addEventListener("click", (event) => {
    const pressed = event.currentTarget.getAttribute("aria-pressed") === "true";
    event.currentTarget.setAttribute("aria-pressed", String(!pressed));
    filterTileCatalogEditor();
  });
  $("#tileCatalogEditorList").addEventListener("input", (event) => {
    if (!event.target.closest("[data-tile-field]")) return;
    updateTileEditorSummary();
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
    const cards = $$('[data-tile-editor-card]', $("#tileCatalogEditorList"));
    if (!cards.some((card) => tileEditorCardState(card).modified)) {
      toast("Le catalogue utilise déjà ses valeurs d’origine");
      return;
    }
    if (!window.confirm("Préparer la réinitialisation du nom, du temps, du prix et du pictogramme de toutes les tuiles ?")) return;
    cards.forEach((card) => resetTileEditorCard(card, { refresh: false }));
    updateTileEditorSummary();
    toast("Réinitialisation préparée · enregistrez pour la confirmer");
  });
  $("#tileIconPickerGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tile-icon-choice]");
    if (!button || !tileIconTargetCard?.isConnected) return;
    const icon = button.dataset.tileIconChoice;
    $('[data-tile-field="icon"]', tileIconTargetCard).value = icon;
    updateTileEditorSummary();
    closeLayer("tileIconPickerLayer");
    tileIconTargetCard = null;
  });
  $("#choosePdfDirectoryButton").addEventListener("click", (event) => {
    if (typeof window.bcdevisDesktop?.choosePdfDirectory !== "function") return;
    void runPdfDirectoryAction(event.currentTarget, () => window.bcdevisDesktop.choosePdfDirectory(), "Dossier des devis PDF mis à jour");
  });
  $("#resetPdfDirectoryButton").addEventListener("click", (event) => {
    if (typeof window.bcdevisDesktop?.resetPdfDirectory !== "function") return;
    void runPdfDirectoryAction(event.currentTarget, () => window.bcdevisDesktop.resetPdfDirectory(), "Dossier Téléchargements rétabli");
  });
  $("#settingsForm").addEventListener("input", (event) => {
    const name = event.target?.name;
    if (["quotePrefix", "invoicePrefix", "machineName", "packPaidDefault", "packFreeDefault", "studentDiscount"].includes(name)) refreshSettingsPreview();
    if (name === "visibleFamilies") refreshSettingsPreview();
    if (name === "quoteTrackingEnabled") syncTrackingSettingsState();
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
    if ($("#centralEnabled").checked) {
      try {
        centralController.configure({ enabled: true, ...centralFormValues() });
        $("#centralPassword").value = "";
      } catch (error) {
        setSettingsTab("data", { focus: true });
        $("#centralEndpoint").focus();
        toast(error.message || "La configuration du serveur central est invalide.", "error");
        return;
      }
    }
    const data = new FormData(event.currentTarget);
    const uniqueNumberingRequested = data.has("centralUniqueQuoteNumbers");
    if (uniqueNumberingRequested && !centralController.getConfig().connected) {
      setSettingsTab("data", { focus: true });
      toast("Connectez d’abord ce poste avant d’activer les numéros uniques.", "error");
      return;
    }
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
      quotePrefix: cleanDocumentPrefix(data.get("quotePrefix"), "DEV"), invoicePrefix: cleanDocumentPrefix(data.get("invoicePrefix"), "FAC"), machineName: String(data.get("machineName") || "").trim() || defaultSettings.machineName,
      validityDays: boundedInteger(data.get("validityDays") ?? db.settings.validityDays, 1, 365, QUOTE_VALIDITY_DAYS),
      taxRate: configuredTaxRate({ taxRate: data.get("taxRate") }),
      taxMode: data.get("taxMode") === "excluded" ? "excluded" : "included",
      showTaxInformation: data.has("showTaxInformation"),
      theme: KNOWN_THEMES.includes(pendingTheme) ? pendingTheme : currentTheme(),
      fontFamily: KNOWN_FONTS.includes(pendingFont) ? pendingFont : currentFont(),
      catalogMode: data.get("catalogMode") === "body" ? "body" : "tiles",
      ipadLayoutMode: IPAD_LAYOUT_MODES.includes(data.get("ipadLayoutMode")) ? data.get("ipadLayoutMode") : "auto",
      launchAtLogin: savedLaunchAtLogin,
      quoteDateEditable: data.has("quoteDateEditable"),
      quoteTrackingEnabled: data.has("quoteTrackingEnabled"),
      trackingDefaultFollowUpDays: boundedInteger(data.get("trackingDefaultFollowUpDays") ?? db.settings.trackingDefaultFollowUpDays, 1, 90, 7),
      trackingRemindersOnStartup: data.has("trackingRemindersOnStartup"),
      trackingShowCounters: data.has("trackingShowCounters"),
      packPaidDefault: boundedInteger(data.get("packPaidDefault"), 1, 24, 6), packFreeDefault: boundedInteger(data.get("packFreeDefault"), 0, 12, 0),
      studentDiscount: clamp(data.get("studentDiscount"), 0, 100),
      conditions: String(data.get("conditions") || "").trim(), studentConditions: String(data.get("studentConditions") || "").trim(), footerNote: String(data.get("footerNote") || "").trim(),
      showSignatures: data.has("showSignatures"),
      pdfLanguage: data.get("pdfLanguage") === "en" ? "en" : "fr",
      centralUniqueQuoteNumbers: uniqueNumberingRequested
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
    if (db.settings.centralUniqueQuoteNumbers === true) {
      try {
        await ensureCentralQuoteNumberPool({ required: 1 });
      } catch (error) {
        db.settings.centralUniqueQuoteNumbers = false;
        if (event.currentTarget.elements.centralUniqueQuoteNumbers) event.currentTarget.elements.centralUniqueQuoteNumbers.checked = false;
        toast(error.message || "Impossible de réserver les premiers numéros uniques.", "error");
        return;
      }
    }
    if (!saveLocal()) return;
    renderAll(); renderHistory(); closeLayer("settingsLayer"); toast("Réglages enregistrés");
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
    handleMenuKeydown(event, appMenuItems);
  });
  $("#appActionsMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-app-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.appAction;
    setAppMenuOpen(false, { restoreFocus: true });
    if (action === "custom") openCustomItemLayer();
    if (action === "display-mode") setDisplayModePreference(button.dataset.displayModeOption);
  });
  $("#settingsButton").addEventListener("click", openSettingsLayer);
  $("#helpButton").addEventListener("click", () => openHelp("overview"));
  $("#pdfLibraryButton").addEventListener("click", () => void openPdfLibrary("documents"));
  $("#invoiceLibraryButton").addEventListener("click", () => void openPdfLibrary("invoices"));
  $("#pdfLibraryHelpButton").addEventListener("click", () => openHelp(activeCentralDocumentView === "invoices" ? "invoices" : "central"));
  $("#pdfLibraryTabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-pdf-library-view]");
    if (!tab) return;
    activeCentralDocumentView = tab.dataset.pdfLibraryView === "invoices" ? "invoices" : "documents";
    selectedCentralDocumentId = "";
    releaseCentralDocumentPreview();
    renderCentralDocumentView();
    renderCentralDocuments();
  });
  $("#pdfLibraryTabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = $$("[data-pdf-library-view]", event.currentTarget);
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].click();
    tabs[nextIndex].focus();
  });
  $("#pdfLibrarySearch").addEventListener("input", (event) => {
    centralDocumentSearch = event.target.value;
    renderCentralDocuments();
  });
  $("#pdfLibraryList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pdf-document-id]");
    if (button) void selectCentralDocument(button.dataset.pdfDocumentId);
  });
  $("#pdfLibraryImportButton").addEventListener("click", () => $("#pdfLibraryInput").click());
  $("#pdfLibraryInput").addEventListener("change", async (event) => {
    try {
      await importCentralPdf(event.target.files?.[0], {
        quoteId: quote.id,
        completeWorkflow: activeCentralDocumentView === "invoices"
      });
    } catch (error) {
      console.error("Import PDF impossible", error);
      toast(error.message || "Le PDF n’a pas pu être importé.", "error");
      $("#pdfLibraryStatus").textContent = error.message || "Import impossible";
    } finally {
      event.target.value = "";
    }
  });
  $("#pdfLibraryDownloadButton").addEventListener("click", downloadSelectedCentralDocument);
  $("#pdfLibraryPrintButton").addEventListener("click", printSelectedCentralDocument);
  $("#trackingInvoiceInput").addEventListener("change", async (event) => {
    const quoteId = pendingInvoiceQuoteId;
    pendingInvoiceQuoteId = "";
    if (!quoteId) { event.target.value = ""; return; }
    try {
      activeCentralDocumentView = "invoices";
      const result = await importCentralPdf(event.target.files?.[0], { quoteId, completeWorkflow: true });
      if (!result) return;
      closeLayer("historyLayer");
      await openPdfLibrary("invoices", { selectId: result.document?.id || "" });
    } catch (error) {
      console.error("Import de la facture impossible", error);
      toast(error.message || "La facture n’a pas pu être importée.", "error");
    } finally {
      event.target.value = "";
    }
  });
  $$('[data-help-topic]').forEach((button) => button.addEventListener("click", () => openHelp(button.dataset.helpTopic)));
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
    handleMenuKeydown(event, quoteMenuItems);
  });
  $("#quoteActionMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    setQuoteMenuOpen(false, { restoreFocus: true });
    if (action === "duplicate") duplicateQuote();
    if (action === "export") exportQuote();
    if (action === "import") $("#quoteImportInput").click();
    if (action === "clear" && ensureQuoteEditable() && (quote.lines.length === 0 || window.confirm("Vider tous les soins de ce devis ?"))) {
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

  function restoreLocalDatabase(payload) {
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
      contacts: sanitizeContacts(payload.database.contacts),
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
      return false;
    }
    renderAll();
    renderHistory();
    closeLayer("historyLayer");
    return true;
  }

  function restoreTransferredCentralConfig(config) {
    if (!config?.endpoint) return false;
    centralController.configure({
      enabled: config.enabled === true,
      endpoint: config.endpoint,
      email: config.email,
      deviceName: config.deviceName
    });
    renderCentralizationState();
    return config.enabled === true;
  }

  $("#exportBackupButton").addEventListener("click", exportBackup);
  $("#importBackupButton").addEventListener("click", () => $("#backupImportInput").click());
  $("#backupImportInput").addEventListener("change", async (event) => {
    try {
      let payload = await readJSONFile(event.target);
      if (!payload) return;
      const isSiteTransfer = payload.type === SITE_TRANSFER_TYPE;
      if (isSiteTransfer) payload = readTransferPackage(payload);
      else if (!payload.database || payload.type !== "atelier-devis-backup") throw new Error("Cette sauvegarde n’est pas compatible");
      if (isSiteTransfer && !targetMatchesCurrentSite(payload, window.location.href)) {
        const expected = payload.target?.origin || payload.target?.url || "une autre adresse";
        if (!window.confirm(`Ce transfert a été préparé pour ${expected}, mais vous consultez ${currentSiteLabel()}. L’importer quand même ?`)) return;
      }
      const confirmation = isSiteTransfer
        ? "Importer ce transfert remplacera les données locales de cette adresse. Continuer ?"
        : "Restaurer cette sauvegarde remplacera les données locales actuelles. Continuer ?";
      if (!window.confirm(confirmation) || !restoreLocalDatabase(payload)) return;
      const reconnectRequired = isSiteTransfer && restoreTransferredCentralConfig(payload.central);
      if (!$("#settingsLayer")?.hidden) fillSettingsForm();
      toast(isSiteTransfer
        ? (reconnectRequired ? "Transfert terminé · reconnectez ce poste au serveur central" : "Transfert terminé sur cette adresse")
        : "Sauvegarde restaurée");
    } catch (error) { toast(error.message || "Restauration impossible", "error"); }
  });

  $("#siteMigrationTarget").addEventListener("input", () => {
    preparedSiteMigrationTarget = "";
    refreshSiteMigrationPanel();
  });
  $("#siteMigrationExportButton").addEventListener("click", () => {
    try { exportSiteMigration(); }
    catch (error) { toast(error.message || "Le transfert n’a pas pu être préparé.", "error"); }
  });
  $("#siteMigrationOpenButton").addEventListener("click", () => {
    void openSiteMigrationTarget().catch((error) => toast(error.message || "La nouvelle adresse n’a pas pu être ouverte.", "error"));
  });
  $("#siteMigrationImportButton").addEventListener("click", () => $("#backupImportInput").click());

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
    if (!command && !event.altKey && !isTextEntryTarget(event.target) && event.key === "?") { event.preventDefault(); closeMenusForShortcut(); openHelp("shortcuts"); }
  });
  window.addEventListener("message", (event) => {
    if (event.source === $("#helpFrame")?.contentWindow && event.data?.type === "bcdevis-help-close") closeLayer("helpLayer");
  });
  window.addEventListener("beforeprint", renderPrint);
  window.addEventListener("beforeunload", () => saveLocal(false));
  window.addEventListener("resize", () => {
    applyDisplayMode();
    syncPermanentCheckoutLayout();
  });
  window.addEventListener("resize", syncToastPlacement);
  window.addEventListener("resize", syncViewportMetrics);
  window.visualViewport?.addEventListener("resize", syncViewportMetrics);
  window.addEventListener("online", () => centralController.schedule(0));
  window.addEventListener("offline", () => void centralController.sync().catch(() => {}));
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
  applyDisplayMode();
  syncViewportMetrics();
  syncPermanentCheckoutLayout();
  syncToastPlacement();
  expireTrackedQuotes();
  saveLocal(false);
  renderAll();
  window.setInterval(refreshExpiredTracking, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshExpiredTracking(); });
  void centralController.initialize()
    .then(() => db.settings.centralUniqueQuoteNumbers === true ? ensureCentralQuoteNumberPool({ required: 1 }) : null)
    .catch((error) => console.warn("Centralisation différée", error));
  const migrationArrivalOpened = openSiteMigrationArrival();
  const releaseNotesOpened = migrationArrivalOpened ? false : showReleaseNotesOnce();
  if (!migrationArrivalOpened && !releaseNotesOpened) window.setTimeout(showTrackingReminders, 250);
})();
