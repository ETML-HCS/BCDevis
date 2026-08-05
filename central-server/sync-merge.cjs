"use strict";

const SNAPSHOT_SCHEMA_VERSION = 1;
const MAX_QUOTES = 10000;
const MAX_CUSTOM_SERVICES = 500;
const MAX_SETTINGS = 100;
const SAFE_KEY = /^[a-zA-Z0-9:_-]{1,128}$/;
const MISSING = Symbol("missing");

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (value === MISSING) return MISSING;
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function same(left, right) {
  if (left === MISSING || right === MISSING) return left === right;
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function safeEntries(source, limit) {
  if (!isRecord(source)) return [];
  return Object.entries(source)
    .filter(([key]) => SAFE_KEY.test(key) && !["__proto__", "prototype", "constructor"].includes(key))
    .slice(0, limit);
}

function normalizeMap(source, limit, valueFilter = isRecord) {
  const result = Object.create(null);
  for (const [key, value] of safeEntries(source, limit)) {
    if (valueFilter(value)) result[key] = clone(value);
  }
  return { ...result };
}

function normalizeSnapshot(source) {
  const input = isRecord(source) ? source : {};
  const customServices = Array.isArray(input.customServices)
    ? input.customServices.filter((item) => isRecord(item) && SAFE_KEY.test(String(item.id || ""))).slice(0, MAX_CUSTOM_SERVICES).map(clone)
    : [];
  const settings = Object.fromEntries(safeEntries(input.settings, MAX_SETTINGS).map(([key, value]) => [key, clone(value)]));
  const quoteCounters = normalizeMap(input.quoteCounters, 5000, (value) => Number.isFinite(Number(value)) && Number(value) >= 0);
  for (const key of Object.keys(quoteCounters)) quoteCounters[key] = Math.floor(Number(quoteCounters[key]));
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    quoteCounters,
    settings,
    customServices,
    catalogOverrides: normalizeMap(input.catalogOverrides, MAX_CUSTOM_SERVICES + 1000),
    quotes: normalizeMap(input.quotes, MAX_QUOTES)
  };
}

function emptySnapshot() {
  return normalizeSnapshot({});
}

function mergeChangedValue(base, local, remote, path, strategy, conflicts) {
  if (same(local, remote)) return clone(local);
  if (same(local, base)) return clone(remote);
  if (same(remote, base)) return clone(local);
  if (strategy === "local") return clone(local);
  if (strategy === "server") return clone(remote);
  conflicts.push(path);
  return clone(remote);
}

function mergeMap(baseSource, localSource, remoteSource, path, strategy, conflicts) {
  const base = isRecord(baseSource) ? baseSource : {};
  const local = isRecord(localSource) ? localSource : {};
  const remote = isRecord(remoteSource) ? remoteSource : {};
  const result = Object.create(null);
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of [...keys].filter((item) => SAFE_KEY.test(item)).sort()) {
    const merged = mergeChangedValue(
      Object.hasOwn(base, key) ? base[key] : MISSING,
      Object.hasOwn(local, key) ? local[key] : MISSING,
      Object.hasOwn(remote, key) ? remote[key] : MISSING,
      `${path}.${key}`,
      strategy,
      conflicts
    );
    if (merged !== MISSING) result[key] = merged;
  }
  return { ...result };
}

function customServicesAsMap(items) {
  const result = Object.create(null);
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || "");
    if (isRecord(item) && SAFE_KEY.test(id)) result[id] = item;
  }
  return { ...result };
}

function mergeCounters(base, local, remote) {
  const result = Object.create(null);
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const key of keys) {
    if (!SAFE_KEY.test(key)) continue;
    result[key] = Math.max(0, Number(base?.[key]) || 0, Number(local?.[key]) || 0, Number(remote?.[key]) || 0);
  }
  return { ...result };
}

function mergeSnapshots(baseSource, localSource, remoteSource, { strategy = "conflict", initial = false } = {}) {
  const base = normalizeSnapshot(baseSource);
  const local = normalizeSnapshot(localSource);
  const remote = normalizeSnapshot(remoteSource);
  const conflicts = [];
  const settings = initial
    ? clone(remote.settings)
    : mergeMap(base.settings, local.settings, remote.settings, "settings", strategy, conflicts);
  const merged = normalizeSnapshot({
    quoteCounters: mergeCounters(base.quoteCounters, local.quoteCounters, remote.quoteCounters),
    settings,
    customServices: Object.values(mergeMap(
      customServicesAsMap(base.customServices),
      customServicesAsMap(local.customServices),
      customServicesAsMap(remote.customServices),
      "customServices",
      strategy,
      conflicts
    )),
    catalogOverrides: mergeMap(base.catalogOverrides, local.catalogOverrides, remote.catalogOverrides, "catalogOverrides", strategy, conflicts),
    quotes: mergeMap(base.quotes, local.quotes, remote.quotes, "quotes", strategy, conflicts)
  });
  return { snapshot: merged, conflicts: [...new Set(conflicts)] };
}

function duplicateQuoteNumbers(snapshotSource) {
  const snapshot = normalizeSnapshot(snapshotSource);
  const known = new Map();
  const duplicates = [];
  for (const [id, quote] of Object.entries(snapshot.quotes)) {
    const number = String(quote?.number || "").trim().toUpperCase();
    if (!number) continue;
    if (known.has(number) && known.get(number) !== id) duplicates.push(number);
    else known.set(number, id);
  }
  return [...new Set(duplicates)].sort();
}

module.exports = {
  SNAPSHOT_SCHEMA_VERSION,
  duplicateQuoteNumbers,
  emptySnapshot,
  mergeSnapshots,
  normalizeSnapshot,
  same
};
