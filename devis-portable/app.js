(() => {
  "use strict";

  const STORAGE_KEY = "bellecour-atelier-devis-v3";
  const LEGACY_STORAGE_KEYS = ["bellecour-atelier-devis-v2", "bellecour-atelier-devis-v1"];
  const APP_VERSION = 15;
  const EXAMPLE_QUOTE_NUMBER = "DEV-000002";
  const QUOTE_VALIDITY_DAYS = 30;
  const QUOTE_FUTURE_DATE_LIMIT = 14;
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

  const defaultSettings = {
    companyName: "Clinique Bellecour",
    companySubtitle: "Médecine esthétique",
    companyAddress: "Rue du Mont-Blanc 20 · 1201 Genève",
    companyPhone: "+41 78 669 63 44",
    companyEmail: "contact@cliniquebellecour.ch",
    companyUid: "CHE-244.490.739",
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
    conditions: "Le règlement peut s’effectuer à chaque séance ou par l’achat d’un pack. Les paiements sont acceptés par carte, en espèces, via TWINT, par virement bancaire ou par paiement échelonné. L’échelonnement est soumis à l’accord du partenaire financier.",
    studentConditions: "Le tarif étudiant est accordé sur présentation d’un justificatif étudiant en cours de validité.",
    footerNote: "Prix exprimés en francs suisses. Ce devis ne vaut pas facture."
  };

  function configuredTaxRate(settings = defaultSettings) {
    if (settings?.taxRate === "" || settings?.taxRate === null || settings?.taxRate === undefined) return defaultSettings.taxRate;
    const rate = Number(settings.taxRate);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : defaultSettings.taxRate;
  }

  function freshDatabase() {
    return { version: APP_VERSION, sequence: 0, quoteCounters: {}, settings: clone(defaultSettings), customServices: [], quotes: {}, current: null };
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

  function migrateDatabase(database, sourceVersion) {
    const version = Number(sourceVersion || 0);
    if (version < 4) removeExampleQuote(database);
    if (version < 7) applyDefaultTax(database);
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
        customServices: Array.isArray(parsed.customServices) ? parsed.customServices : [],
        quotes: parsed.quotes && typeof parsed.quotes === "object" ? parsed.quotes : {}
      };
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
    if (!source || typeof source !== "object" || !Array.isArray(source.lines)) throw new Error("Format de devis non reconnu");
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
    const quoteDate = String(source.date || base.date);
    const sanitized = {
      ...base,
      ...source,
      id: source.id || uid(),
      number: String(source.number || nextQuoteNumber(quoteDate)),
      date: quoteDate,
      validUntil: addDaysISO(quoteDate, QUOTE_VALIDITY_DAYS),
      client: { ...base.client, ...(source.client || {}) },
      discount: {
        code: String(source.discount?.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24),
        type: source.discount?.type === "fixed" ? "fixed" : "percent",
        value: Math.max(0, Number(source.discount?.value) || 0)
      },
      tax: { ...base.tax, ...(source.tax || {}) },
      lines: source.lines.map((line) => {
        const offerType = ["single", "pack", "student"].includes(line.offerType) ? line.offerType : "single";
        const price = Math.max(0, Number(line.price ?? line.unit_price) || 0);
        const basePrice = Math.max(0, Number(line.basePrice ?? price) || 0);
        return {
          id: line.id || uid(),
          serviceId: line.serviceId ?? null,
          name: String(line.name || line.description || "Prestation"),
          categoryId: Number(line.categoryId) || 0,
          duration: Math.max(0, Number(line.duration) || 0),
          offerType,
          basePrice,
          studentDiscount: clamp(line.studentDiscount ?? db.settings.studentDiscount, 0, 100),
          price: offerType === "student" ? basePrice : price,
          quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
          freeQuantity: offerType === "pack" ? Math.max(0, Math.round(Number(line.freeQuantity) || 0)) : 0
        };
      }),      updatedAt: new Date().toISOString()
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
      toast("Le stockage local du navigateur est indisponible.", "error");
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
      const nameSize = Math.min(28, Math.max(8, Array.from(line.name).length + 1));
      const categoryLabel = category.short.toLocaleLowerCase("fr-CH");
      const paidControl = `<span class="quantity-group quantity-group-inline${isPack ? " is-pack" : ""}">${isPack ? "<small>Payées</small>" : ""}<button class="quantity-value" type="button" data-quantity-gesture="paid" aria-label="${line.quantity} séance${line.quantity > 1 ? "s" : ""} payée${line.quantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.quantity}</button></span>`;
      const freeControl = isPack ? `<span class="quantity-group quantity-group-inline is-pack free"><small>Offertes</small><button class="quantity-value" type="button" data-quantity-gesture="free" aria-label="${line.freeQuantity} séance${line.freeQuantity > 1 ? "s" : ""} offerte${line.freeQuantity > 1 ? "s" : ""}. Clic gauche pour diminuer, clic droit pour augmenter." title="Clic gauche : diminuer · clic droit : augmenter">${line.freeQuantity}</button></span>` : "";
      return `<article class="cart-line offer-${line.offerType}" data-line-id="${line.id}">
        <div class="cart-line-info"><span class="cart-line-name-row"><input class="cart-line-name" data-line-field="name" value="${escapeHTML(line.name)}" size="${nameSize}" aria-label="Nom de la prestation"></span></div>
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
    if (field === "quantity") line.quantity = Math.max(1, Math.round(Number(input.value) || 1));
    if (field === "price") line.price = Math.max(0, Number(input.value) || 0);
    if (field === "freeQuantity") line.freeQuantity = Math.max(0, Math.round(Number(input.value) || 0));
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
    quote.status = "saved";
    quote.updatedAt = new Date().toISOString();
    db.quotes[quote.id] = clone(quote);
    saveLocal();
    renderHistory();
    toast(`${quote.number} enregistré dans Mes devis`);
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
    return JSON.parse(await file.text());
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
    buildFamilyVisibilityGrid();
    refreshSettingsPreview();
    syncThemePicker(currentTheme());
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
    const savingsMessages = [];
    if (totals.studentDiscount > 0) savingsMessages.push(`Le rabais étudiant de ${totals.studentRate}% vous fait économiser ${money(totals.studentDiscount)}.`);
    if (totals.discount > 0) savingsMessages.push(`Le coupon${quote.discount.code ? ` ${escapeHTML(quote.discount.code)}` : ""} réduit encore le devis de ${money(totals.discount)}.`);
    const savingsTitle = savingsMessages.length ? "Votre économie" : "Votre devis personnalisé";
    const savingsSummary = savingsMessages.join(" ") || "Les prestations et quantités ci-dessus ont été préparées selon vos besoins.";
    const studentConditions = quote.lines.some((line) => line.offerType === "student") ? String(settings.studentConditions || "").trim() : "";
    $("#printQuote").innerHTML = `
      <header class="print-header"><div class="print-brand"><div class="print-brand-mark">${escapeHTML((settings.companyName || "B")[0])}</div><div><div class="print-company-kicker">${escapeHTML(settings.companySubtitle)}</div><div class="print-company-name">${escapeHTML(settings.companyName)}</div><div class="print-company-lines">${escapeHTML(settings.companyAddress)}<br>${escapeHTML(contact)}${settings.companyUid ? `<br>UID : ${escapeHTML(settings.companyUid)}` : ""}</div></div></div><div class="print-document-title"><h1>Devis</h1><strong>${escapeHTML(quote.number)}</strong><span>Émis le ${formatDate(quote.date)}</span></div></header>
      <div class="print-overview"><div class="print-card"><div class="print-label">Client</div><div class="print-client-name">${escapeHTML(client.name || "Client à compléter")}</div><div class="print-muted">${escapeHTML(clientContact || "Coordonnées à compléter")}${client.address ? `<br>${escapeHTML(client.address)}` : ""}</div></div><div class="print-card"><div class="print-label">Références</div><div class="print-reference-grid"><span>Date du devis</span><span>${formatDate(quote.date)}</span><span>Valable jusqu’au</span><span>${formatDate(quote.validUntil)}</span><span>Devise</span><span>CHF</span></div></div></div>
      <div class="print-section-title">Prestations sélectionnées</div><table class="print-table"><thead><tr><th>Prestation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="print-summary"><div class="print-note-card"><strong>${savingsTitle}</strong>${savingsSummary}</div><table class="print-totals"><tr><td>Sous-total</td><td>${money(totals.subtotal)}</td></tr>${totals.studentDiscount > 0 ? `<tr class="discount"><td>Rabais étudiant (${totals.studentRate}%)</td><td>− ${money(totals.studentDiscount)}</td></tr>` : ""}${totals.discount > 0 ? `<tr class="discount"><td>${escapeHTML(discountLabel)}</td><td>− ${money(totals.discount)}</td></tr>` : ""}${quote.tax.enabled ? `<tr><td>Net HT</td><td>${money(totals.net)}</td></tr><tr><td>TVA ${totals.rate}%${quote.tax.mode === "included" ? " incluse" : ""}</td><td>${money(totals.tax)}</td></tr>` : ""}<tr class="total"><td>Total</td><td>${money(totals.total)}</td></tr></table></div>
      ${totals.total > 0 ? `<div class="print-section-title">Options de paiement échelonné</div><div class="print-installments">${months.map((month) => `<div class="print-installment"><b>${month} mois</b><span>${money(totals.total / month)}</span></div>`).join("")}</div>` : ""}
      <div class="print-conditions"><div><strong>Conditions de paiement</strong>${escapeHTML(quote.conditions || settings.conditions)}${studentConditions ? `<div class="print-student-conditions"><strong>Conditions tarif étudiant</strong>${escapeHTML(studentConditions)}</div>` : ""}</div><div><strong>Remarques</strong>${escapeHTML(settings.footerNote)}\n\nCe devis reste valable jusqu’au ${formatDate(quote.validUntil)}.</div></div>
      <div class="print-signature"><div>Date et lieu</div><div>Signature du client · Bon pour accord</div></div><footer class="print-footer"><span>${escapeHTML(settings.companyName)} · ${escapeHTML(quote.number)}</span><span>Document généré avec Bellecour Devis</span></footer>`;
  }

  function printQuote() {
    if (!quote.lines.length) { toast("Ajoutez au moins une prestation avant l’impression.", "error"); return; }
    saveQuote();
    renderPrint();
    window.setTimeout(() => window.print(), 80);
  }

  function shareQuoteViaWhatsApp() {
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
    const popup = window.open(url, "_blank", "noopener");
    if (!popup) window.location.assign(url);
    toast("Devis préparé pour WhatsApp");
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
  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const oldConditions = db.settings.conditions;
    db.settings = { ...db.settings,
      companyName: String(data.get("companyName") || "").trim() || defaultSettings.companyName,
      companySubtitle: String(data.get("companySubtitle") || "").trim(), companyAddress: String(data.get("companyAddress") || "").trim(),
      companyPhone: String(data.get("companyPhone") || "").trim(), companyEmail: String(data.get("companyEmail") || "").trim(), companyUid: String(data.get("companyUid") || "").trim(),
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
    saveLocal(); renderAll(); closeLayer("settingsLayer"); toast("Réglages enregistrés");
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
    try { const payload = await readJSONFile(event.target); if (!payload) return; quote = sanitizeQuote(payload.quote || payload); if (db.quotes[quote.id]) quote.id = uid(); couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0); saveLocal(); renderAll(); toast("Devis importé"); }
    catch (error) { toast(error.message || "Import impossible", "error"); }
  });
  $("#exportBackupButton").addEventListener("click", exportBackup);
  $("#importBackupButton").addEventListener("click", () => $("#backupImportInput").click());
  $("#backupImportInput").addEventListener("change", async (event) => {
    try {
      const payload = await readJSONFile(event.target);
      if (!payload?.database || payload.type !== "atelier-devis-backup") throw new Error("Cette sauvegarde n’est pas compatible");
      if (!window.confirm("Restaurer cette sauvegarde remplacera les données locales actuelles. Continuer ?")) return;
      db = migrateDatabase({ ...freshDatabase(), ...payload.database, version: APP_VERSION, settings: { ...defaultSettings, ...(payload.database.settings || {}) } }, payload.database.version);
      quote = db.current ? sanitizeQuote(db.current) : newQuote(); couponOpen = Boolean(quote.discount.code || Number(quote.discount.value) > 0); saveLocal(); renderAll(); renderHistory(); closeLayer("historyLayer"); toast("Sauvegarde restaurée");
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
