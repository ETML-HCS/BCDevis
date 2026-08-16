"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_TARGET_URL,
  TRANSFER_TYPE,
  createTransferPackage,
  migrationArrivalUrl,
  normalizeSiteUrl,
  readTransferPackage,
  targetMatchesCurrentSite,
  transferableCentralConfig
} = require("../site-migration.js");

assert.equal(DEFAULT_TARGET_URL, "https://bcd.athys.ch/");
assert.equal(normalizeSiteUrl("https://bcd.athys.ch"), "https://bcd.athys.ch/");
assert.equal(normalizeSiteUrl("http://127.0.0.1:4173/app"), "http://127.0.0.1:4173/app/");
assert.throws(() => normalizeSiteUrl("http://bcd.athys.ch"), /HTTPS/);
assert.throws(() => normalizeSiteUrl("https://admin:secret@bcd.athys.ch"), /identifiant/);

const safeCentral = transferableCentralConfig({
  enabled: true,
  endpoint: "https://api-user:api-secret@api.bcd.athys.ch/",
  email: "ADMIN@EXAMPLE.CH",
  deviceName: "Accueil",
  token: "secret-token",
  deviceId: "secret-device",
  quoteNumberPool: [{ number: "DEV-SECRET" }]
});
assert.deepEqual(safeCentral, {
  enabled: true,
  endpoint: "https://api.bcd.athys.ch/",
  email: "admin@example.ch",
  deviceName: "Accueil"
});

const database = {
  version: 25,
  settings: { companyName: "Clinique Bellecour" },
  contacts: { "contact-1": { id: "contact-1", name: "Camille Martin" } },
  quotes: { "quote-1": { id: "quote-1", number: "DEV-20260807A001" } },
  current: { id: "quote-draft" }
};
const transfer = createTransferPackage({
  database,
  centralConfig: { ...safeCentral, token: "must-not-leak" },
  releaseVersion: "7.1.0",
  appVersion: 25,
  sourceUrl: "https://etml-hcs.github.io/BCDevis/?old=1",
  targetUrl: "https://bcd.athys.ch/",
  exportedAt: "2026-08-07T10:00:00.000Z"
});

assert.equal(transfer.type, TRANSFER_TYPE);
assert.equal(transfer.target.origin, "https://bcd.athys.ch");
assert.equal(transfer.source.origin, "https://etml-hcs.github.io");
assert.equal(transfer.database.quotes["quote-1"].number, "DEV-20260807A001");
assert.equal(transfer.database.contacts["contact-1"].name, "Camille Martin");
assert.equal(transfer.central.endpoint, "https://api.bcd.athys.ch/");
assert.doesNotMatch(JSON.stringify(transfer), /must-not-leak|secret-token|secret-device|DEV-SECRET|api-user|api-secret/);

database.settings.companyName = "Modifiée après export";
assert.equal(transfer.database.settings.companyName, "Clinique Bellecour", "Le transfert doit figer un instantané indépendant");

const restored = readTransferPackage(JSON.parse(JSON.stringify(transfer)));
assert.equal(restored.releaseVersion, "7.1.0");
assert.equal(targetMatchesCurrentSite(restored, "https://bcd.athys.ch/index.html"), true);
assert.equal(targetMatchesCurrentSite(restored, "https://autre.example/"), false);
assert.equal(targetMatchesCurrentSite(restored, "file:///C:/BCDevis/index.html"), true);
assert.equal(migrationArrivalUrl("https://bcd.athys.ch/app/"), "https://bcd.athys.ch/app/?bcdevisMigration=1");
assert.throws(() => readTransferPackage({ type: TRANSFER_TYPE, transferVersion: 99, database: {} }), /version/);

const appRoot = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
assert.match(html, /id="siteMigrationTarget"[^>]*value="https:\/\/bcd\.athys\.ch\/"/);
assert.match(html, /id="siteMigrationExportButton"[\s\S]*?id="siteMigrationOpenButton"[\s\S]*?id="siteMigrationImportButton"/);
assert.match(html, /<script src="site-migration\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
assert.match(app, /createTransferPackage\(\{[\s\S]*?database: db,[\s\S]*?centralConfig: centralController\.getConfig\(\)/);
assert.match(app, /payload\.type === SITE_TRANSFER_TYPE[\s\S]*?restoreTransferredCentralConfig\(payload\.central\)/);
assert.match(app, /migrationArrivalUrl\(targetUrl\)/);

console.log("SITE_MIGRATION_TESTS_OK");
