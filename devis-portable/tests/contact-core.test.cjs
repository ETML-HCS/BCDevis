"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contacts = require("../contact-core.js");

const appRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "contacts-controller.js"), "utf8");
const service = fs.readFileSync(path.join(appRoot, "contact-service.js"), "utf8");

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

// Export d'agenda ou de caisse : prénom et nom en colonnes séparées, en-têtes variés.
const agenda = contacts.parseCsv("Prénom;Nom;Natel;Adresse e-mail;Code postal\nMarie;Dupont;079 000 00 00;MARIE@EXEMPLE.CH;1204\n;Martin;;;\n");
assert.equal(agenda.length, 2);
assert.equal(agenda[0].name, "Marie Dupont", "Le prénom ne doit pas être perdu à l’import");
assert.equal(agenda[0].phone, "079 000 00 00");
assert.equal(agenda[0].email, "marie@exemple.ch");
assert.equal(agenda[0].postalCode, "1204");
assert.equal(agenda[1].name, "Martin");
assert.equal(contacts.parseCsv("Nom;Téléphone\nCamille Martin;079\n")[0].name, "Camille Martin", "Sans colonne prénom, « Nom » reste le nom complet");
assert.equal(contacts.parseVCard("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Dupont;Marie;;;\r\nEND:VCARD")[0].name, "Marie Dupont", "Une vCard sans FN garde le nom structuré");

// Demandes du site : fichier produit par « Exporter pour BCDevis » dans l’administration du site.
const siteCsv = String.fromCharCode(0xFEFF) + "Nom;Téléphone;E-mail;Provenance;Demande;Date de la demande\r\nMarie Dupont;+41 79 000 00 00;marie@exemple.ch;Site internet;Rendez-vous : Épilation laser définitive (demande n° 12 sur le site);2026-10-05T08:30:00+00:00\r\n";
const [lead] = contacts.parseCsv(siteCsv);
assert.equal(lead.source, "Site internet");
assert.equal(lead.request, "Rendez-vous : Épilation laser définitive (demande n° 12 sur le site)");
assert.equal(lead.requestedAt, "2026-10-05T08:30:00.000Z");
assert.equal(contacts.hasOpenRequest(lead), true);
assert.equal(contacts.sanitizeContact({ name: "X", requestedAt: "05.10.2026 14:30" }).requestedAt, new Date(2026, 9, 5, 14, 30).toISOString(), "Le format suisse est accepté");
assert.equal(contacts.sanitizeContact({ name: "X", requestedAt: "31.02.2026" }).requestedAt, "", "Une date impossible est ignorée");
assert.equal(contacts.sanitizeContact({ name: "X", requestedAt: "demain" }).requestedAt, "");
assert.equal(contacts.hasOpenRequest(clean), false, "Un contact sans demande n’est pas à traiter");

// Fusion : provenance d’origine conservée, demande la plus récente, traitement jamais effacé par un import.
const handled = { ...lead, id: "contact-lead", source: "Bouche-à-oreille", requestHandledAt: "2026-10-05T09:00:00.000Z" };
assert.equal(contacts.hasOpenRequest(handled), false, "Une demande traitée sort de la file");
const reimported = contacts.mergeContacts(handled, lead);
assert.equal(reimported.source, "Bouche-à-oreille", "Le premier canal reste la provenance");
assert.equal(reimported.requestHandledAt, handled.requestHandledAt, "Réimporter la même demande ne la rouvre pas");
assert.equal(contacts.hasOpenRequest(reimported), false);
const newRequest = contacts.mergeContacts(handled, { ...lead, request: "Message du formulaire de contact (n° 3 sur le site)", requestedAt: "2026-10-12T10:00:00Z" });
assert.equal(newRequest.request, "Message du formulaire de contact (n° 3 sur le site)");
assert.equal(contacts.hasOpenRequest(newRequest), true, "Une nouvelle demande rouvre le contact");
assert.equal(contacts.mergeContacts(newRequest, lead).requestedAt, newRequest.requestedAt, "Une demande plus ancienne ne remplace pas la récente");

// File « Nouvelles demandes » : un devis créé après la demande la referme, un devis plus ancien non.
const open = { ...lead, id: "contact-open" };
const other = contacts.sanitizeContact({ name: "Léa Roux", email: "lea@exemple.ch", requestedAt: "2026-10-01T08:00:00Z" });
assert.deepEqual(contacts.pendingRequests([open, other]).map((item) => item.name), ["Léa Roux", "Marie Dupont"], "La demande la plus ancienne d’abord");
assert.equal(contacts.pendingRequests([open], [{ client: { contactId: "contact-open" }, createdAt: "2026-10-06T08:00:00Z" }]).length, 0, "Un devis lié referme la demande");
assert.equal(contacts.pendingRequests([open], [{ client: { name: "M. Dupont", email: "MARIE@exemple.ch" }, createdAt: "2026-10-06T08:00:00Z" }]).length, 0, "Les mêmes coordonnées suffisent");
assert.equal(contacts.pendingRequests([open], [{ client: { contactId: "contact-open" }, createdAt: "2026-09-01T08:00:00Z" }]).length, 1, "Un ancien devis ne traite pas une nouvelle demande");

// Allers-retours : provenance et demande survivent aux trois formats.
for (const [label, parsed] of [["CSV", contacts.parseCsv(contacts.toCsv([handled]))], ["vCard", contacts.parseVCard(contacts.toVCard([handled]))], ["JSON", contacts.parseJson(contacts.toJson([handled]))]]) {
  assert.equal(parsed[0].source, handled.source, `${label} : provenance`);
  assert.equal(parsed[0].request, handled.request, `${label} : demande`);
  assert.equal(parsed[0].requestedAt, handled.requestedAt, `${label} : date de la demande`);
  assert.equal(parsed[0].requestHandledAt, handled.requestHandledAt, `${label} : date de traitement`);
}

for (const id of ["contactSearch", "contactList", "newContactButton", "contactImportButton", "contactImportInput", "contactMoreDetails", "deleteContactButton"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} doit être présent dans le répertoire`);
}
for (const field of contacts.CONTACT_FIELDS) assert.match(html, new RegExp(`name="${field}"`), `Le champ ${field} doit être disponible`);
for (const format of ["csv", "vcf", "json"]) assert.match(html, new RegExp(`data-contact-export="${format}"`));
assert.ok(html.indexOf("contact-core.js") < html.indexOf("app.js"), "Le moteur de contacts doit être chargé avant l’application");
assert.match(app, /const APP_VERSION = 25;/);
assert.match(app, /contacts: \{\}/, "Une base neuve doit initialiser le répertoire");
assert.match(app, /function sanitizeClientSnapshot/, "Le devis doit conserver un instantané explicite du client");
assert.match(controller, /function importContactsFromInput/, "L’import doit être relié à l’interface");
assert.match(controller, /service\.importFile/, "L'interface doit déléguer l'import au service");
assert.match(app, /contactsController\.bind\(\)/, "Le répertoire doit être relié à l'application");
assert.match(service, /ContactCore\.matchKey/, "Les doublons doivent être détectés avant ajout");
for (const script of ["contact-service.js", "contacts-controller.js"]) {
  assert.ok(html.indexOf(script) > html.indexOf("contact-core.js") && html.indexOf(script) < html.indexOf("app.js"), `${script} doit être chargé après le moteur et avant l'application`);
}

console.log("CONTACT_CORE_TESTS_OK");
