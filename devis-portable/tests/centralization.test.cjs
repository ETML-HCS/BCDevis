"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { newDb } = require("pg-mem");
const { startCentralServer } = require("../../central-server/server.cjs");
const { duplicateQuoteNumbers, mergeSnapshots } = require("../../central-server/sync-merge.cjs");
const centralClient = require("../central-sync.js");

const projectRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function quote(id, number, amount, updatedAt) {
  return {
    id,
    number,
    status: "saved",
    date: "2026-08-05",
    validUntil: "2026-09-04",
    client: { name: `Client ${id}`, phone: "", email: "", address: "" },
    lines: [{ id: `line-${id}`, name: "Soin", price: amount, quantity: 1, categoryId: 1, duration: 30, offerType: "single" }],
    discount: { code: "", type: "percent", value: 0 },
    tax: { enabled: false, rate: 8.1, mode: "included" },
    conditions: "Paiement",
    note: "",
    tracking: { status: "draft", nextFollowUp: "", note: "", events: [] },
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt
  };
}

function snapshot(quotes = {}, settings = { companyName: "Clinique Bellecour", quotePrefix: "DEV" }) {
  return { schemaVersion: 1, quoteCounters: {}, settings, customServices: [], catalogOverrides: {}, contacts: {}, quotes };
}

async function api(base, route, { token, body, method = "GET" } = {}) {
  const response = await fetch(new URL(`api/v1/${route}`, base), {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function main() {
  assert.throws(() => centralClient.normalizeEndpoint("http://example.com"), /HTTPS/);
  assert.equal(centralClient.normalizeEndpoint("http://127.0.0.1:8787"), "http://127.0.0.1:8787/");

  const localDatabase = {
    settings: { companyName: "Bellecour", theme: "night", machineName: "A", quotePrefix: "DEV", invoicePrefix: "FAC", conditions: "Paiement" },
    quoteCounters: { "20260805:A": 2 },
    customServices: [], catalogOverrides: {}, contacts: { "contact-1": { id: "contact-1", name: "Camille Martin", email: "camille@example.ch" } }, quotes: {}, current: { id: "draft-local" }
  };
  const shared = centralClient.sharedSnapshot(localDatabase);
  assert.equal(shared.settings.companyName, "Bellecour");
  assert.equal(shared.settings.invoicePrefix, "FAC", "Le préfixe facture doit être partagé comme le préfixe devis");
  assert.equal(Object.hasOwn(shared.settings, "theme"), false, "Le thème doit rester propre à l’appareil");
  assert.equal(Object.hasOwn(shared, "current"), false, "Le brouillon en cours doit rester local");
  assert.equal(shared.contacts["contact-1"].name, "Camille Martin", "Le répertoire doit être partagé");
  centralClient.applySharedSnapshot(localDatabase, snapshot({}, { companyName: "Central", conditions: "Central" }));
  assert.equal(localDatabase.settings.companyName, "Central");
  assert.equal(localDatabase.settings.theme, "night");
  assert.equal(localDatabase.current.id, "draft-local");

  const base = snapshot({ q1: quote("q1", "DEV-20260805P01001", 100, "2026-08-05T08:00:00.000Z") });
  const local = snapshot({ q1: quote("q1", "DEV-20260805P01001", 120, "2026-08-05T09:00:00.000Z") });
  const remote = snapshot({ q1: quote("q1", "DEV-20260805P01001", 130, "2026-08-05T09:05:00.000Z") });
  assert.deepEqual(mergeSnapshots(base, local, remote).conflicts, ["quotes.q1"]);
  assert.equal(mergeSnapshots(base, local, remote, { strategy: "server" }).snapshot.quotes.q1.lines[0].price, 130);
  assert.equal(duplicateQuoteNumbers(snapshot({ q1: quote("q1", "DEV-1", 1, "2026-08-05T08:00:00.000Z"), q2: quote("q2", "DEV-1", 2, "2026-08-05T08:00:00.000Z") })).length, 1);
  const contactBase = snapshot();
  contactBase.contacts = { "contact-1": { id: "contact-1", name: "Camille Martin", phone: "+41 79 000 00 00" } };
  const contactLocal = structuredClone(contactBase);
  const contactRemote = structuredClone(contactBase);
  contactLocal.contacts["contact-1"].phone = "+41 79 111 11 11";
  contactRemote.contacts["contact-1"].phone = "+41 79 222 22 22";
  assert.deepEqual(mergeSnapshots(contactBase, contactLocal, contactRemote).conflicts, ["contacts.contact-1"]);
  assert.equal(mergeSnapshots(contactBase, contactLocal, contactRemote, { strategy: "local" }).snapshot.contacts["contact-1"].phone, "+41 79 111 11 11");

  const postgres = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = postgres.adapters.createPg();
  const pool = new Pool();
  const started = await startCentralServer({
    port: 0,
    pool,
    adminEmail: "admin@bellecour.test",
    adminPassword: "mot-de-passe-central-fort",
    allowedOrigins: ["*"]
  });
  try {
    const health = await api(started.url, "health");
    assert.equal(health.status, 200);
    assert.equal(health.payload.database, "ready");
    assert.equal(health.payload.databaseEngine, "postgresql");

    const failedLogin = await api(started.url, "auth/login", { method: "POST", body: { email: "admin@bellecour.test", password: "incorrect", deviceId: "device-a-0001", deviceName: "Accueil" } });
    assert.equal(failedLogin.status, 401);
    const invalidDeviceLogin = await api(started.url, "auth/login", { method: "POST", body: { email: "admin@bellecour.test", password: "mot-de-passe-central-fort", deviceId: "x", deviceName: "Accueil" } });
    assert.equal(invalidDeviceLogin.status, 400);
    const loginA = await api(started.url, "auth/login", { method: "POST", body: { email: "admin@bellecour.test", password: "mot-de-passe-central-fort", deviceId: "device-a-0001", deviceName: "Accueil" } });
    assert.equal(loginA.status, 200);
    assert.equal(loginA.payload.device.code, "P01");
    const loginB = await api(started.url, "auth/login", { method: "POST", body: { email: "admin@bellecour.test", password: "mot-de-passe-central-fort", deviceId: "device-b-0002", deviceName: "Cabinet" } });
    assert.equal(loginB.payload.device.code, "P02");

    const reservedA = await api(started.url, "quote-numbers/reserve", { method: "POST", token: loginA.payload.token, body: { prefix: "DEV", quoteDay: "20260805", count: 3 } });
    assert.equal(reservedA.status, 200);
    assert.deepEqual(reservedA.payload.numbers, ["DEV-20260805C000001", "DEV-20260805C000002", "DEV-20260805C000003"]);
    const reservedB = await api(started.url, "quote-numbers/reserve", { method: "POST", token: loginB.payload.token, body: { prefix: "DEV", quoteDay: "20260805", count: 2 } });
    assert.deepEqual(reservedB.payload.numbers, ["DEV-20260805C000004", "DEV-20260805C000005"]);

    const original = snapshot({ q1: quote("q1", "DEV-20260805P01001", 100, "2026-08-05T08:00:00.000Z") });
    const firstSync = await api(started.url, "sync", { method: "POST", token: loginA.payload.token, body: { snapshot: original } });
    assert.equal(firstSync.status, 200);
    assert.equal(firstSync.payload.revision, 1);
    const secondDevicePull = await api(started.url, "sync", { method: "POST", token: loginB.payload.token, body: { snapshot: snapshot() } });
    assert.equal(secondDevicePull.status, 200);
    assert.ok(secondDevicePull.payload.snapshot.quotes.q1);

    const changedA = snapshot({ q1: quote("q1", "DEV-20260805P01001", 120, "2026-08-05T09:00:00.000Z") });
    const pushA = await api(started.url, "sync", { method: "POST", token: loginA.payload.token, body: { snapshot: changedA } });
    assert.equal(pushA.status, 200);
    assert.equal(pushA.payload.revision, 2);
    const changedB = snapshot({ q1: quote("q1", "DEV-20260805P01001", 130, "2026-08-05T09:05:00.000Z") });
    const conflictB = await api(started.url, "sync", { method: "POST", token: loginB.payload.token, body: { snapshot: changedB } });
    assert.equal(conflictB.status, 409);
    assert.deepEqual(conflictB.payload.conflicts, ["quotes.q1"]);
    const resolveB = await api(started.url, "sync", { method: "POST", token: loginB.payload.token, body: { snapshot: changedB, conflictStrategy: "server" } });
    assert.equal(resolveB.status, 200);
    assert.equal(resolveB.payload.snapshot.quotes.q1.lines[0].price, 120);

    const browserDatabase = { settings: { companyName: "Local", theme: "forest", machineName: "A" }, quoteCounters: {}, customServices: [], catalogOverrides: {}, contacts: {}, quotes: {}, current: null };
    let assignedCode = "";
    const controller = centralClient.createController({
      storage: memoryStorage(),
      fetchImpl: fetch,
      getDatabase: () => browserDatabase,
      applySnapshot: (next) => centralClient.applySharedSnapshot(browserDatabase, next),
      onDeviceCode: (code) => { assignedCode = code; }
    });
    const connected = await controller.connect({ endpoint: started.url, email: "admin@bellecour.test", password: "mot-de-passe-central-fort", deviceName: "iPad" });
    assert.equal(connected.conflict, undefined);
    assert.equal(assignedCode, "P03");
    assert.equal(controller.getConfig().connected, true);
    assert.equal(browserDatabase.settings.theme, "forest");
    assert.ok(browserDatabase.quotes.q1);
    assert.equal(typeof browserDatabase.contacts, "object");
    const controllerReservation = await controller.reserveQuoteNumbers({ prefix: "DEV", date: "2026-08-05" }, 2);
    assert.ok(controllerReservation.available >= 2);
    assert.match(controller.takeReservedQuoteNumber({ prefix: "DEV", date: "2026-08-05" }), /^DEV-20260805C\d{6}$/);

    const pdfContents = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF", "utf8");
    const uploaded = await api(started.url, "documents", {
      method: "POST",
      token: loginA.payload.token,
      body: {
        filename: "devis-test.pdf",
        title: "Devis test",
        quoteId: "q1",
        quoteNumber: "DEV-20260805C000001",
        clientName: "Sophie Martin",
        kind: "invoice",
        contentBase64: pdfContents.toString("base64")
      }
    });
    assert.equal(uploaded.status, 201);
    const documents = await api(started.url, "documents", { token: loginB.payload.token });
    assert.equal(documents.status, 200);
    assert.equal(documents.payload.documents[0].clientName, "Sophie Martin");
    assert.equal(documents.payload.documents[0].kind, "invoice");
    const documentResponse = await fetch(new URL(`api/v1/documents/${uploaded.payload.document.id}/content`, started.url), { headers: { authorization: `Bearer ${loginB.payload.token}` } });
    assert.equal(documentResponse.status, 200);
    assert.equal(documentResponse.headers.get("content-type"), "application/pdf");
    assert.deepEqual(Buffer.from(await documentResponse.arrayBuffer()), pdfContents);
    const controllerDocuments = await controller.listDocuments();
    assert.equal(controllerDocuments.documents.length, 1);
    assert.equal((await controller.loadDocument(uploaded.payload.document.id)).type, "application/pdf");

    const audit = await api(started.url, "audit?limit=20", { token: loginA.payload.token });
    assert.equal(audit.status, 200);
    assert.ok(audit.payload.events.some((event) => event.action === "sync.merge"));
    controller.schedule(60000);
    assert.equal(controller.getState().status, "pending");
    await controller.disconnect();
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }

  const html = read("devis-portable/index.html");
  const app = read("devis-portable/app.js");
  const serviceWorker = read("devis-portable/service-worker.js");
  const schema = read("central-server/schema.sql");
  const postgresIntegration = read("devis-portable/tests/central-postgres.integration.test.cjs");
  const ciWorkflow = read(".github/workflows/ci.yml");
  const packageJson = JSON.parse(read("package.json"));
  assert.equal((html.match(/id="settingsTab[^\"]*" type="button" role="tab"/g) || []).length, 5);
  assert.match(html, /data-settings-panel="data"/);
  assert.match(html, /id="centralEnabled"/);
  assert.match(html, /id="centralUniqueQuoteNumbers"/);
  assert.match(html, /id="pdfLibraryLayer"/);
  assert.match(html, /id="pdfPreviewFrame"/);
  assert.match(html, /id="centralUseServerButton"[\s\S]*?id="centralUseDeviceButton"/);
  assert.ok(html.indexOf("central-sync.js") < html.indexOf("app.js"));
  assert.match(app, /const APP_VERSION = 25;/);
  assert.match(schema, /kind TEXT NOT NULL DEFAULT 'document'/);
  assert.match(html, /id="invoiceLibraryButton"/);
  assert.match(html, /id="pdfLibraryButton"[\s\S]*?data-central-library hidden disabled[\s\S]*?#icon-documents/);
  assert.match(html, /id="invoiceLibraryButton"[\s\S]*?data-central-library hidden disabled[\s\S]*?#icon-invoice/);
  assert.match(app, /\$\$\('\[data-central-library\]'\)[\s\S]*?button\.hidden = config\.connected !== true[\s\S]*?button\.disabled = config\.connected !== true/);
  assert.match(html, /id="pdfLibraryPrintButton"/);
  assert.match(app, /centralController\.initialize\(\)/);
  assert.match(serviceWorker, /\.\/central-sync\.js/);
  for (const table of ["users", "devices", "sessions", "shared_settings", "quotes", "quote_number_sequences", "quote_number_reservations", "documents", "audit_log"]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.equal(packageJson.scripts["test:central:postgres"], "node devis-portable/tests/central-postgres.integration.test.cjs");
  assert.equal(packageJson.scripts["check:ci"], "npm run check && npm run test:central:postgres");
  assert.match(postgresIntegration, /BCDEVIS_TEST_DATABASE_URL/);
  assert.match(postgresIntegration, /CREATE SCHEMA/);
  assert.match(postgresIntegration, /DROP SCHEMA IF EXISTS/);
  assert.match(postgresIntegration, /Promise\.all\(\[/, "Le test PostgreSQL doit exercer des réservations concurrentes");
  assert.match(ciWorkflow, /pull_request:/);
  assert.match(ciWorkflow, /image: postgres:17-alpine/);
  assert.match(ciWorkflow, /run: xvfb-run -a npm run check:ci/);
  console.log("CENTRALIZATION_TESTS_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
