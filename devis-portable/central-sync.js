(function exposeCentralSync(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisCentral = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function centralSyncFactory() {
  "use strict";

  const CONFIG_KEY = "bcdevis-central-v1";
  const SCHEMA_VERSION = 1;
  const REQUEST_TIMEOUT_MS = 15000;
  const SHARED_SETTING_KEYS = [
    "companyName", "companySubtitle", "companyAddress", "companyPhone", "companyEmail", "companyUid",
    "headerLogoDataUrl", "pdfLogoDataUrl", "quotePrefix", "validityDays", "packPaidDefault", "packFreeDefault",
    "studentDiscount", "taxRate", "taxMode", "showTaxInformation", "visibleFamilies", "quoteDateEditable",
    "quoteTrackingEnabled", "trackingDefaultFollowUpDays", "trackingRemindersOnStartup", "trackingShowCounters",
    "conditions", "studentConditions", "footerNote", "showSignatures", "centralUniqueQuoteNumbers"
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const identifier = () => globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeEndpoint(value) {
    const input = String(value || "").trim();
    if (!input) throw new Error("Indiquez l’adresse HTTPS du serveur BCDevis.");
    let url;
    try {
      url = new URL(input.endsWith("/") ? input : `${input}/`);
    } catch {
      throw new Error("L’adresse du serveur est invalide.");
    }
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error("Le serveur doit utiliser HTTPS. HTTP est accepté uniquement sur cet appareil pour les essais.");
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function freshConfig() {
    return {
      version: 1,
      enabled: false,
      endpoint: "",
      email: "",
      token: "",
      tokenExpiresAt: "",
      deviceId: identifier(),
      deviceName: "Poste BCDevis",
      deviceCode: "",
      revision: 0,
      lastSyncAt: "",
      quoteNumberPool: []
    };
  }

  function loadConfig(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(CONFIG_KEY) || "null");
      if (!isRecord(parsed)) return freshConfig();
      return {
        ...freshConfig(),
        ...parsed,
        enabled: parsed.enabled === true,
        endpoint: String(parsed.endpoint || ""),
        email: String(parsed.email || "").slice(0, 320),
        token: String(parsed.token || ""),
        deviceId: /^[a-zA-Z0-9_-]{8,128}$/.test(String(parsed.deviceId || "")) ? String(parsed.deviceId) : identifier(),
        deviceName: String(parsed.deviceName || "Poste BCDevis").slice(0, 80),
        deviceCode: String(parsed.deviceCode || "").slice(0, 16),
        revision: Math.max(0, Number(parsed.revision) || 0),
        quoteNumberPool: Array.isArray(parsed.quoteNumberPool)
          ? parsed.quoteNumberPool.filter((item) => isRecord(item)
            && /^[A-Z0-9-]{1,24}$/.test(String(item.prefix || ""))
            && /^\d{8}$/.test(String(item.quoteDay || ""))
            && /^[A-Z0-9-]{8,64}$/.test(String(item.number || ""))).slice(0, 250).map((item) => ({ prefix: String(item.prefix), quoteDay: String(item.quoteDay), number: String(item.number) }))
          : []
      };
    } catch {
      return freshConfig();
    }
  }

  function sharedSnapshot(database) {
    const source = isRecord(database) ? database : {};
    const settings = Object.fromEntries(SHARED_SETTING_KEYS
      .filter((key) => Object.hasOwn(source.settings || {}, key))
      .map((key) => [key, clone(source.settings[key])]));
    return {
      schemaVersion: SCHEMA_VERSION,
      quoteCounters: clone(isRecord(source.quoteCounters) ? source.quoteCounters : {}),
      settings,
      customServices: clone(Array.isArray(source.customServices) ? source.customServices : []),
      catalogOverrides: clone(isRecord(source.catalogOverrides) ? source.catalogOverrides : {}),
      quotes: clone(isRecord(source.quotes) ? source.quotes : {})
    };
  }

  function applySharedSnapshot(database, snapshot) {
    if (!isRecord(database) || !isRecord(snapshot)) throw new Error("La réponse centrale ne contient pas une base compatible.");
    const source = sharedSnapshot(snapshot);
    database.quoteCounters = source.quoteCounters;
    database.settings = { ...(database.settings || {}), ...source.settings };
    database.customServices = source.customServices;
    database.catalogOverrides = source.catalogOverrides;
    database.quotes = source.quotes;
    return database;
  }

  function createController(options) {
    const storage = options.storage;
    const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    if (!storage || typeof storage.getItem !== "function") throw new Error("Stockage de configuration central indisponible.");
    if (typeof fetchImpl !== "function") throw new Error("Connexion réseau indisponible.");
    let config = loadConfig(storage);
    let syncTimer = 0;
    let activeSync = null;
    let sessionGeneration = 0;
    let state = {
      status: config.enabled ? (config.token ? "offline" : "disconnected") : "local",
      message: config.enabled ? (config.token ? "Connexion en attente" : "Identification requise") : "Données conservées uniquement sur cet appareil",
      conflicts: [],
      revision: config.revision,
      lastSyncAt: config.lastSyncAt
    };

    function publicConfig() {
      const { token, quoteNumberPool, ...safe } = config;
      return { ...clone(safe), connected: Boolean(token), reservedQuoteNumbers: quoteNumberPool.length };
    }

    function persist() {
      storage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    function publish(patch) {
      state = { ...state, ...patch, revision: config.revision, lastSyncAt: config.lastSyncAt };
      options.onState?.(clone(state), publicConfig());
      return state;
    }

    function configure(patch) {
      const previousEndpoint = config.endpoint;
      const previousEmail = config.email;
      config = {
        ...config,
        ...patch,
        endpoint: patch.endpoint === undefined ? config.endpoint : normalizeEndpoint(patch.endpoint),
        email: patch.email === undefined ? config.email : String(patch.email || "").trim().toLowerCase().slice(0, 320),
        deviceName: patch.deviceName === undefined ? config.deviceName : String(patch.deviceName || "Poste BCDevis").trim().slice(0, 80) || "Poste BCDevis"
      };
      if (config.endpoint !== previousEndpoint || config.email !== previousEmail) {
        config.quoteNumberPool = [];
        config.deviceCode = "";
        config.revision = 0;
      }
      persist();
      if (patch.enabled === true && state.status === "local") publish({ status: "disconnected", message: "Centralisation activée · identification requise", conflicts: [] });
      else publish({});
      return publicConfig();
    }

    async function request(route, { method = "GET", body, authenticated = true, endpoint = config.endpoint } = {}) {
      const base = normalizeEndpoint(endpoint);
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetchImpl(new URL(`api/v1/${route.replace(/^\/+/, "")}`, base), {
          method,
          headers: {
            accept: "application/json",
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(authenticated && config.token ? { authorization: `Bearer ${config.token}` } : {})
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        });
        let payload = {};
        try { payload = await response.json(); } catch { payload = {}; }
        if (!response.ok) {
          const error = new Error(payload.message || `Le serveur a répondu ${response.status}.`);
          error.status = response.status;
          error.code = payload.code;
          error.payload = payload;
          throw error;
        }
        return payload;
      } catch (error) {
        if (error.name === "AbortError") throw new Error("Le serveur central ne répond pas dans le délai prévu.");
        throw error;
      } finally {
        globalThis.clearTimeout(timeout);
      }
    }

    async function requestBinary(route) {
      const base = normalizeEndpoint(config.endpoint);
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetchImpl(new URL(`api/v1/${route.replace(/^\/+/, "")}`, base), {
          headers: { accept: "application/pdf", ...(config.token ? { authorization: `Bearer ${config.token}` } : {}) },
          signal: controller.signal
        });
        if (!response.ok) {
          let payload = {};
          try { payload = await response.json(); } catch { payload = {}; }
          const error = new Error(payload.message || `Le serveur a répondu ${response.status}.`);
          error.status = response.status;
          error.code = payload.code;
          throw error;
        }
        return response.blob();
      } catch (error) {
        if (error.name === "AbortError") throw new Error("Le serveur central ne répond pas dans le délai prévu.");
        throw error;
      } finally {
        globalThis.clearTimeout(timeout);
      }
    }

    async function testConnection(endpoint = config.endpoint) {
      publish({ status: "connecting", message: "Vérification du serveur…", conflicts: [] });
      try {
        const result = await request("health", { authenticated: false, endpoint });
        if (result.service !== "BCDevis Central") throw new Error("Ce serveur ne fournit pas le service BCDevis Central attendu.");
        if (result.database !== "ready" || result.databaseEngine !== "postgresql") throw new Error("La base PostgreSQL du serveur n’est pas prête.");
        publish({ status: config.token ? "online" : "disconnected", message: `Serveur BCDevis ${result.version} disponible · PostgreSQL prêt` });
        return result;
      } catch (error) {
        publish({ status: "error", message: error.message, conflicts: [] });
        throw error;
      }
    }

    async function connect({ endpoint, email, password, deviceName }) {
      configure({ enabled: true, endpoint, email, deviceName });
      if (!String(password || "")) throw new Error("Saisissez le mot de passe du compte central.");
      await testConnection(config.endpoint);
      publish({ status: "connecting", message: "Identification du poste…", conflicts: [] });
      try {
        const session = await request("auth/login", {
          method: "POST",
          authenticated: false,
          body: { email: config.email, password: String(password), deviceId: config.deviceId, deviceName: config.deviceName }
        });
        config = {
          ...config,
          enabled: true,
          token: String(session.token || ""),
          tokenExpiresAt: String(session.expiresAt || ""),
          deviceCode: String(session.device?.code || ""),
          deviceName: String(session.device?.name || config.deviceName)
        };
        sessionGeneration += 1;
        persist();
        if (config.deviceCode) options.onDeviceCode?.(config.deviceCode);
        publish({ status: "online", message: `Connecté · ${session.organization?.name || "BCDevis Central"}`, conflicts: [] });
        return sync();
      } catch (error) {
        config.token = "";
        config.tokenExpiresAt = "";
        persist();
        publish({ status: "error", message: error.message, conflicts: [] });
        throw error;
      }
    }

    async function performSync(conflictStrategy = "conflict") {
      if (!config.enabled || !config.token) {
        publish({ status: config.enabled ? "disconnected" : "local", message: config.enabled ? "Identification requise" : "Mode local actif", conflicts: [] });
        return { skipped: true };
      }
      if (globalThis.navigator && globalThis.navigator.onLine === false) {
        publish({ status: "offline", message: "Hors connexion · modifications conservées localement" });
        return { offline: true };
      }
      const syncGeneration = sessionGeneration;
      publish({ status: "syncing", message: conflictStrategy === "conflict" ? "Synchronisation…" : "Résolution du conflit…" });
      try {
        const result = await request("sync", {
          method: "POST",
          body: { snapshot: sharedSnapshot(options.getDatabase()), conflictStrategy }
        });
        if (syncGeneration !== sessionGeneration) return { skipped: true };
        options.applySnapshot(result.snapshot);
        config.revision = Math.max(0, Number(result.revision) || 0);
        config.lastSyncAt = String(result.synchronizedAt || new Date().toISOString());
        persist();
        publish({ status: "online", message: result.changed ? "Données centralisées à jour" : "Aucune modification à envoyer", conflicts: [] });
        return result;
      } catch (error) {
        if (syncGeneration !== sessionGeneration) return { skipped: true };
        if (error.status === 409) {
          publish({ status: "conflict", message: error.message, conflicts: Array.isArray(error.payload?.conflicts) ? error.payload.conflicts : [] });
          return { conflict: true, ...error.payload };
        }
        if (error.status === 401) {
          sessionGeneration += 1;
          config.token = "";
          config.tokenExpiresAt = "";
          persist();
          publish({ status: "disconnected", message: "Session expirée · reconnectez ce poste", conflicts: [] });
          return { authenticationRequired: true };
        }
        publish({ status: "offline", message: `${error.message} · données conservées localement` });
        throw error;
      }
    }

    function sync(conflictStrategy = "conflict") {
      if (activeSync) return activeSync;
      activeSync = performSync(conflictStrategy).finally(() => { activeSync = null; });
      return activeSync;
    }

    function schedule(delay = 1200) {
      if (!config.enabled || !config.token || state.status === "conflict") return;
      globalThis.clearTimeout(syncTimer);
      syncTimer = globalThis.setTimeout(() => void sync().catch(() => {}), Math.max(0, delay));
      if (delay > 0) publish({ status: "pending", message: "Modification locale en attente de synchronisation" });
    }

    async function disconnect() {
      globalThis.clearTimeout(syncTimer);
      sessionGeneration += 1;
      if (config.token) {
        try { await request("auth/logout", { method: "POST" }); } catch { /* La session expirera côté serveur. */ }
      }
      config = { ...config, enabled: false, token: "", tokenExpiresAt: "", revision: 0, lastSyncAt: "" };
      persist();
      publish({ status: "local", message: "Mode local actif · les données de ce poste sont conservées", conflicts: [] });
    }

    async function initialize() {
      publish({});
      if (!config.enabled || !config.token) return { skipped: true };
      if (config.deviceCode) options.onDeviceCode?.(config.deviceCode);
      return sync();
    }

    function quoteNumberKey({ prefix, date }) {
      const normalizedPrefix = String(prefix || "DEV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "DEV";
      const quoteDay = String(date || "").replace(/[^0-9]/g, "").slice(0, 8);
      if (!/^\d{8}$/.test(quoteDay)) throw new Error("La date du devis est invalide pour réserver un numéro.");
      return { prefix: normalizedPrefix, quoteDay };
    }

    function reservedQuoteNumberCount(values) {
      const key = quoteNumberKey(values);
      return config.quoteNumberPool.filter((item) => item.prefix === key.prefix && item.quoteDay === key.quoteDay).length;
    }

    async function reserveQuoteNumbers(values, minimum = 12) {
      const key = quoteNumberKey(values);
      const available = reservedQuoteNumberCount(values);
      if (available >= minimum) return { numbers: [], available };
      if (!config.enabled || !config.token) throw new Error("Connectez ce poste avant d’activer la numérotation unique.");
      const count = Math.min(50, Math.max(20, minimum - available));
      const result = await request("quote-numbers/reserve", { method: "POST", body: { prefix: key.prefix, quoteDay: key.quoteDay, count } });
      const known = new Set(config.quoteNumberPool.map((item) => item.number));
      for (const number of Array.isArray(result.numbers) ? result.numbers : []) {
        const normalized = String(number || "").trim().toUpperCase();
        if (/^[A-Z0-9-]{8,64}$/.test(normalized) && !known.has(normalized)) {
          config.quoteNumberPool.push({ ...key, number: normalized });
          known.add(normalized);
        }
      }
      config.quoteNumberPool = config.quoteNumberPool.slice(-250);
      persist();
      publish({});
      return { ...result, available: reservedQuoteNumberCount(values) };
    }

    function takeReservedQuoteNumber(values) {
      const key = quoteNumberKey(values);
      const index = config.quoteNumberPool.findIndex((item) => item.prefix === key.prefix && item.quoteDay === key.quoteDay);
      if (index < 0) return "";
      const [reserved] = config.quoteNumberPool.splice(index, 1);
      persist();
      publish({});
      return reserved.number;
    }

    async function listDocuments() {
      if (!config.enabled || !config.token) throw new Error("Connectez ce poste pour ouvrir les documents PDF.");
      return request("documents?limit=500");
    }

    async function uploadDocument(document) {
      if (!config.enabled || !config.token) throw new Error("Connectez ce poste pour archiver un document PDF.");
      return request("documents", { method: "POST", body: document });
    }

    async function loadDocument(documentId) {
      if (!config.enabled || !config.token) throw new Error("Connectez ce poste pour afficher ce document PDF.");
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(documentId || ""))) throw new Error("Identifiant de document invalide.");
      return requestBinary(`documents/${documentId}/content`);
    }

    return {
      configure,
      connect,
      disconnect,
      getConfig: publicConfig,
      getState: () => clone(state),
      initialize,
      listDocuments,
      loadDocument,
      reservedQuoteNumberCount,
      reserveQuoteNumbers,
      resolveWithDevice: () => sync("local"),
      resolveWithServer: () => sync("server"),
      schedule,
      sync,
      takeReservedQuoteNumber,
      testConnection,
      uploadDocument
    };
  }

  return {
    CONFIG_KEY,
    SCHEMA_VERSION,
    SHARED_SETTING_KEYS,
    applySharedSnapshot,
    createController,
    loadConfig,
    normalizeEndpoint,
    sharedSnapshot
  };
});
