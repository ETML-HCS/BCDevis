(function exposeSiteMigration(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisSiteMigration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function siteMigrationFactory() {
  "use strict";

  const TRANSFER_TYPE = "atelier-devis-site-transfer";
  const TRANSFER_SCHEMA_VERSION = 1;
  const DEFAULT_TARGET_URL = "https://bcd.athys.ch/";
  const MIGRATION_QUERY_KEY = "bcdevisMigration";

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function normalizeSiteUrl(value) {
    const input = String(value || "").trim();
    if (!input) throw new Error("Indiquez la nouvelle adresse HTTPS de BCDevis.");
    let url;
    try {
      url = new URL(input.endsWith("/") ? input : `${input}/`);
    } catch {
      throw new Error("La nouvelle adresse du site est invalide.");
    }
    if (url.username || url.password) throw new Error("La nouvelle adresse ne doit contenir aucun identifiant.");
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error("La nouvelle adresse doit utiliser HTTPS.");
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function sourceDescriptor(value) {
    try {
      const url = new URL(String(value || ""));
      return {
        url: url.toString(),
        origin: url.origin === "null" ? "application-locale" : url.origin
      };
    } catch {
      return { url: "", origin: "application-locale" };
    }
  }

  function transferableCentralConfig(config) {
    if (!isRecord(config)) return null;
    let endpoint = String(config.endpoint || "").trim().slice(0, 2048);
    if (endpoint) {
      try {
        const url = new URL(endpoint);
        url.username = "";
        url.password = "";
        endpoint = url.toString();
      } catch {
        endpoint = "";
      }
    }
    const email = String(config.email || "").trim().toLowerCase().slice(0, 320);
    const deviceName = String(config.deviceName || "Poste BCDevis").trim().slice(0, 80) || "Poste BCDevis";
    if (!endpoint && !email && config.enabled !== true) return null;
    return { enabled: config.enabled === true, endpoint, email, deviceName };
  }

  function createTransferPackage({ database, centralConfig, releaseVersion, appVersion, sourceUrl, targetUrl, exportedAt = new Date().toISOString() }) {
    if (!isRecord(database)) throw new Error("La base locale BCDevis est invalide.");
    const normalizedTarget = normalizeSiteUrl(targetUrl);
    const target = new URL(normalizedTarget);
    return {
      type: TRANSFER_TYPE,
      transferVersion: TRANSFER_SCHEMA_VERSION,
      version: Number(appVersion) || 0,
      releaseVersion: String(releaseVersion || ""),
      exportedAt: new Date(exportedAt).toISOString(),
      source: sourceDescriptor(sourceUrl),
      target: { url: normalizedTarget, origin: target.origin },
      central: transferableCentralConfig(centralConfig),
      database: clone(database)
    };
  }

  function readTransferPackage(payload) {
    if (!isRecord(payload) || payload.type !== TRANSFER_TYPE || !isRecord(payload.database)) {
      throw new Error("Ce fichier de transfert BCDevis n’est pas compatible.");
    }
    if (Number(payload.transferVersion) !== TRANSFER_SCHEMA_VERSION) {
      throw new Error("Cette version du fichier de transfert n’est pas prise en charge.");
    }
    const targetUrl = normalizeSiteUrl(payload.target?.url || payload.target?.origin);
    return {
      ...clone(payload),
      target: { url: targetUrl, origin: new URL(targetUrl).origin },
      central: transferableCentralConfig(payload.central)
    };
  }

  function targetMatchesCurrentSite(payload, currentUrl) {
    const transfer = readTransferPackage(payload);
    const current = sourceDescriptor(currentUrl);
    return current.origin === "application-locale" || transfer.target.origin === current.origin;
  }

  function migrationArrivalUrl(targetUrl) {
    const url = new URL(normalizeSiteUrl(targetUrl));
    url.searchParams.set(MIGRATION_QUERY_KEY, "1");
    return url.toString();
  }

  return {
    DEFAULT_TARGET_URL,
    MIGRATION_QUERY_KEY,
    TRANSFER_SCHEMA_VERSION,
    TRANSFER_TYPE,
    createTransferPackage,
    migrationArrivalUrl,
    normalizeSiteUrl,
    readTransferPackage,
    targetMatchesCurrentSite,
    transferableCentralConfig
  };
});
