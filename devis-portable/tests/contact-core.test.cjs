"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contacts = require("../contact-core.js");

const appRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");

const source = {
  id: "contact-1",
  name: "Camille Martin",
  phone: "+41 79 000 00 00",
  email: "CAMILLE@EXEMPLE.CH",
  company: "Bellecour",
  address: "Rue du Rhône 1",
  postalCode: "1204",
  city: "Genève",
  country: "Suisse",
  birthDate: "1990-05-12",
  language: "fr",
  reference: "C-001",
  notes: "Contact administratif"
};

const clean = contacts.sanitizeContact(source, { now: "2026-08-07T10:00:00.000Z" });
assert.equal(clean.email, "camille@exemple.ch");
assert.equal(contacts.matchKey(clean), "email:camilleexemplech");
assert.equal(contacts.sanitizeContact({ name: "", company: "" }), null);
assert.equal(contacts.sanitizeContact({ name: "Test", birthDate: "31.12.1990" }).birthDate, "");

const merged = contacts.mergeContacts(clean, { ...clean, phone: "+41 78 111 22 33", city: "Lausanne" }, { now: "2026-08-07T11:00:00.000Z" });
assert.equal(merged.id, clean.id);
assert.equal(merged.phone, "+41 78 111 22 33");
assert.equal(merged.city, "Lausanne");
assert.equal(merged.createdAt, clean.createdAt);

const csv = contacts.toCsv([source]);
const csvRoundTrip = contacts.parseCsv(csv);
assert.equal(csvRoundTrip.length, 1);
assert.equal(csvRoundTrip[0].name, source.name);
assert.equal(csvRoundTrip[0].postalCode, source.postalCode);
assert.equal(csvRoundTrip[0].notes, source.notes);

const vcard = contacts.toVCard([source]);
const vcardRoundTrip = contacts.parseVCard(vcard);
assert.equal(vcardRoundTrip.length, 1);
assert.equal(vcardRoundTrip[0].email, source.email.toLowerCase());
assert.equal(vcardRoundTrip[0].address, source.address);
assert.equal(vcardRoundTrip[0].city, source.city);
assert.equal(vcardRoundTrip[0].reference, source.reference);

const json = contacts.toJson([source]);
assert.equal(contacts.parseContactFile("contacts.json", json)[0].reference, source.reference);
assert.equal(contacts.parseContactFile("contacts.csv", csv)[0].company, source.company);
assert.equal(contacts.parseContactFile("contacts.vcf", vcard)[0].phone, source.phone);
assert.throws(() => contacts.parseJson("not-json"));

for (const id of ["contactSearch", "contactList", "newContactButton", "contactImportButton", "contactImportInput", "contactMoreDetails", "deleteContactButton"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} doit être présent dans le répertoire`);
}
for (const field of contacts.CONTACT_FIELDS) assert.match(html, new RegExp(`name="${field}"`), `Le champ ${field} doit être disponible`);
for (const format of ["csv", "vcf", "json"]) assert.match(html, new RegExp(`data-contact-export="${format}"`));
assert.ok(html.indexOf("contact-core.js") < html.indexOf("app.js"), "Le moteur de contacts doit être chargé avant l’application");
assert.match(app, /const APP_VERSION = 25;/);
assert.match(app, /contacts: \{\}/, "Une base neuve doit initialiser le répertoire");
assert.match(app, /function sanitizeClientSnapshot/, "Le devis doit conserver un instantané explicite du client");
assert.match(app, /function importContactsFromInput/, "L’import doit être relié à l’interface");
assert.match(app, /ContactCore\.matchKey/, "Les doublons doivent être détectés avant ajout");

console.log("CONTACT_CORE_TESTS_OK");
