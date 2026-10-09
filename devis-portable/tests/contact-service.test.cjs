"use strict";

const assert = require("node:assert/strict");
const core = require("../contact-core.js");
const { createService } = require("../contact-service.js");

const emptyClient = () => ({ contactId: "", name: "", email: "" });
const snapshotClient = (source) => ({ contactId: source.contactId, name: source.name, email: source.email });
const record = (source) => core.sanitizeContact(source, { now: "2026-10-09T10:00:00.000Z" });
const lead = record({ id: "contact-lead", name: "Marie Dupont", email: "marie@exemple.ch", source: "Site internet", request: "Rendez-vous n° 12", requestedAt: "2026-10-05T08:30:00Z", requestHandledAt: "2026-10-06T12:00:00Z" });

function fixture(maxContacts = 10000) {
  let quote = { client: snapshotClient({ ...lead, contactId: lead.id }), updatedAt: "2026-10-09T10:00:00.000Z" };
  let database = { contacts: { [lead.id]: structuredClone(lead) }, current: structuredClone(quote) };
  let generatedIds = 0;
  const calls = [];
  const state = {
    get database() { return database; },
    set database(value) { database = value; },
    get quote() { return quote; },
    set quote(value) { quote = value; },
    outcome: "success",
    calls
  };
  state.service = createService({
    getDatabase: () => database,
    getQuote: () => quote,
    persist: (touchCurrent) => {
      // Comme saveLocal : l'instantané courant est préparé avant la tentative d'écriture.
      if (touchCurrent) quote.updatedAt = "2026-10-09T11:00:00.000Z";
      database.current = structuredClone(quote);
      calls.push({ touchCurrent, contacts: structuredClone(database.contacts), client: structuredClone(quote.client) });
      if (state.outcome === "throw") throw new Error("Stockage indisponible");
      return state.outcome === "success";
    },
    sanitizeClientSnapshot: snapshotClient,
    emptyClientSnapshot: emptyClient,
    idFactory: () => `contact-generated-${++generatedIds}`,
    maxContacts
  });
  return state;
}

// Modifier le formulaire conserve les métadonnées reçues hors formulaire et associe le client au devis.
const edited = fixture();
const saved = edited.service.save({ contactId: lead.id, name: "Marie Dupont", email: lead.email, phone: "+41 79 000 00 00" });
assert.equal(saved.merged, false);
for (const field of ["source", "request", "requestedAt", "requestHandledAt", "createdAt"]) assert.equal(saved.contact[field], lead[field], field);
assert.equal(edited.quote.client.contactId, lead.id);
assert.equal(edited.calls.at(-1).client.contactId, lead.id, "Les coordonnées et le répertoire doivent être enregistrés ensemble");
assert.equal(edited.calls.at(-1).touchCurrent, true);
assert.equal(core.hasOpenRequest(saved.contact), false, "Une modification de fiche ne rouvre pas une demande traitée");
assert.throws(() => edited.service.save({ name: "" }), /nom du contact est requis/);

// Une fiche modifiée pour rejoindre un doublon garde l'identité et la première provenance du doublon.
const duplicate = fixture();
duplicate.database.contacts.other = record({ id: "other", name: "M. Dupont", email: "autre@exemple.ch", source: "Téléphone" });
const merged = duplicate.service.save({ contactId: "other", name: "Marie Dupont", email: "MARIE@exemple.ch", source: "Téléphone" });
assert.equal(merged.merged, true);
assert.equal(merged.contact.id, lead.id);
assert.equal(merged.contact.source, "Site internet");
assert.equal(duplicate.database.contacts.other, undefined);
assert.equal(duplicate.quote.client.contactId, lead.id);

// L'import accepte une fusion à la limite du répertoire ; les identifiants importés en collision sont remplacés.
const imported = fixture(2);
const incoming = [
  { ...lead, id: "csv-lead", phone: "+41 79 111 11 11" },
  { id: lead.id, name: "Léa Roux", email: "lea@exemple.ch" },
  { id: "excess", name: "Paul Martin", email: "paul@exemple.ch" }
];
assert.deepEqual(imported.service.importContacts(incoming), { added: 1, merged: 1 });
assert.equal(Object.keys(imported.database.contacts).length, 2);
const lea = imported.service.list().find((contact) => contact.name === "Léa Roux");
assert.notEqual(lea.id, lead.id);
assert.deepEqual(imported.service.importContacts([incoming[0]]), { added: 0, merged: 1 }, "Réimporter une demande ne doit pas créer de contact");
assert.equal(imported.service.get(lead.id).requestHandledAt, lead.requestHandledAt);
assert.equal(imported.calls.at(-1).touchCurrent, false, "Importer le répertoire ne modifie pas la date du devis courant");
assert.equal(incoming[1].id, lead.id, "L'import ne modifie pas le fichier reçu");
assert.throws(() => imported.service.importFile("vide.csv", "Nom;E-mail"), /Aucun contact valide/);

// Chaque opération restaure les deux références et leur contenu si le stockage refuse ou lève une erreur.
const actions = {
  save: (service) => service.save({ contactId: lead.id, name: "Marie modifiée", email: lead.email }),
  importFile: (service) => service.importFile("contacts.csv", "Nom;E-mail\nLéa Roux;lea@exemple.ch"),
  remove: (service) => service.remove(lead.id),
  clearClient: (service) => service.clearClient()
};
for (const [name, action] of Object.entries(actions)) {
  for (const outcome of ["false", "throw"]) {
    const state = fixture();
    const contactsBefore = state.database.contacts;
    const clientBefore = state.quote.client;
    const currentBefore = state.database.current;
    const contentBefore = JSON.stringify({ database: state.database, quote: state.quote });
    state.outcome = outcome;
    if (outcome === "throw") assert.throws(() => action(state.service), /Stockage indisponible/, name);
    else assert.ok(!action(state.service), `${name} ne doit pas annoncer une réussite`);
    assert.equal(state.database.contacts, contactsBefore, `${name} : répertoire restauré`);
    assert.equal(state.quote.client, clientBefore, `${name} : client restauré`);
    assert.equal(state.database.current, currentBefore, `${name} : brouillon restauré`);
    assert.equal(JSON.stringify({ database: state.database, quote: state.quote }), contentBefore, `${name} : aucun contenu perdu`);
  }
}

// Une suppression retire le lien vers la fiche mais conserve les coordonnées figées dans le devis.
const removed = fixture();
assert.equal(removed.service.remove(lead.id), true);
assert.deepEqual(removed.quote.client, { contactId: "", name: lead.name, email: lead.email });
assert.equal(removed.service.get(lead.id), undefined);
assert.equal(removed.service.remove(lead.id), false);
assert.equal(removed.service.clearClient(), true);
assert.deepEqual(removed.quote.client, emptyClient());

// Après restauration de la base et changement de devis, le service utilise toujours les nouvelles références.
const restored = fixture();
const oldDatabase = restored.database;
const oldQuote = restored.quote;
const oldContents = JSON.stringify({ database: oldDatabase, quote: oldQuote });
restored.database = { contacts: {} };
restored.quote = { client: emptyClient() };
assert.deepEqual(restored.service.list(), []);
assert.deepEqual(restored.service.importFile("contacts.csv", "Nom;E-mail;Provenance\nLéa Roux;lea@exemple.ch;Téléphone"), { added: 1, merged: 0 });
const restoredContact = restored.service.list()[0];
assert.equal(restored.service.save({ contactId: restoredContact.id, name: restoredContact.name, email: restoredContact.email }).contact.id, restoredContact.id);
assert.equal(restored.quote.client.name, "Léa Roux");
assert.equal(JSON.stringify({ database: oldDatabase, quote: oldQuote }), oldContents, "Aucune écriture dans l'état remplacé");

// Les trois exports restent lisibles par le moteur existant et ne demandent pas de sauvegarde.
const exported = fixture();
for (const format of ["csv", "vcf", "json"]) {
  const file = exported.service.exportFile(format);
  const parsed = core.parseContactFile(`contacts.${file.extension}`, file.content);
  assert.equal(file.count, 1);
  for (const field of ["name", "email", "source", "request", "requestedAt", "requestHandledAt"]) assert.equal(parsed[0][field], lead[field], `${format} : ${field}`);
}
assert.equal(exported.calls.length, 0);
for (const format of ["inconnu", "toString", "constructor", "__proto__"]) {
  assert.equal(exported.service.exportFile(format), null, `Format non pris en charge : ${format}`);
}
exported.database = { contacts: {} };
assert.equal(exported.service.exportFile("csv"), null);

console.log("CONTACT_SERVICE_TESTS_OK");
