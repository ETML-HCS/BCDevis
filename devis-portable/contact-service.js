(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contact-core.js"));
  else root.BCDevisContactService = factory(root.BCDevisContacts);
}(typeof globalThis !== "undefined" ? globalThis : this, function (ContactCore) {
  "use strict";

  // Les accès à l'état restent des fonctions : une restauration peut remplacer la base et le devis.
  // Ce service ne connaît ni le DOM, ni Electron, ni localStorage ; persist est fourni par l'application.
  /**
   * @param {import("../types/bcdevis").ContactServiceOptions} options
   * @returns {import("../types/bcdevis").ContactService}
   */
  function createService({ getDatabase, getQuote, persist, sanitizeClientSnapshot, emptyClientSnapshot, idFactory, maxContacts = 10000 }) {
    const sanitize = (source) => ContactCore.sanitizeContact(source, { idFactory });

    function list() {
      return Object.values(getDatabase().contacts || {}).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" }));
    }

    function get(id) {
      return getDatabase().contacts?.[id];
    }

    function client() {
      return getQuote().client;
    }

    // Préparer une nouvelle collection permet de revenir à l'état précédent sans copier tout le répertoire.
    function commit(contacts, nextClient, touchCurrent = true) {
      const database = getDatabase();
      const quote = getQuote();
      const previousContacts = database.contacts;
      const previousClient = quote.client;
      const previousCurrent = database.current;
      const previousUpdatedAt = quote.updatedAt;
      const hadUpdatedAt = Object.hasOwn(quote, "updatedAt");
      database.contacts = contacts;
      quote.client = nextClient;
      let saved = false;
      try {
        saved = persist(touchCurrent);
        return Boolean(saved);
      } finally {
        if (!saved) {
          database.contacts = previousContacts;
          database.current = previousCurrent;
          quote.client = previousClient;
          if (hadUpdatedAt) quote.updatedAt = previousUpdatedAt;
          else delete quote.updatedAt;
        }
      }
    }

    function save(data) {
      const requestedId = String(data.contactId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
      const current = requestedId ? get(requestedId) : null;
      // La demande reçue n'est pas saisie dans le formulaire : modifier la fiche doit la conserver.
      const candidate = sanitize({ ...current, ...data, id: requestedId, createdAt: current?.createdAt, updatedAt: new Date().toISOString() });
      if (!candidate) throw new Error("Le nom du contact est requis.");
      const key = ContactCore.matchKey(candidate);
      const duplicate = list().find((contact) => contact.id !== requestedId && ContactCore.matchKey(contact) === key);
      const contact = duplicate ? ContactCore.mergeContacts(duplicate, candidate) : candidate;
      const contacts = { ...getDatabase().contacts, [contact.id]: contact };
      if (duplicate && requestedId && requestedId !== duplicate.id) delete contacts[requestedId];
      if (!commit(contacts, sanitizeClientSnapshot({ ...contact, contactId: contact.id }))) return null;
      return { contact, merged: Boolean(duplicate) };
    }

    function importContacts(imported) {
      if (!imported.length) throw new Error("Aucun contact valide trouvé dans ce fichier.");
      const contacts = { ...getDatabase().contacts };
      const matches = new Map(list().map((contact) => [ContactCore.matchKey(contact), contact.id]).filter(([key]) => key));
      let count = Object.keys(contacts).length;
      let added = 0;
      let merged = 0;
      imported.slice(0, maxContacts).forEach((source) => {
        const contact = sanitize(source);
        if (!contact) return;
        const match = ContactCore.matchKey(contact);
        const existingId = matches.get(match);
        if (existingId && contacts[existingId]) {
          contacts[existingId] = ContactCore.mergeContacts(contacts[existingId], contact);
          merged += 1;
        } else if (count < maxContacts) {
          while (contacts[contact.id]) contact.id = sanitize({ ...contact, id: "" }).id;
          contacts[contact.id] = contact;
          if (match) matches.set(match, contact.id);
          count += 1;
          added += 1;
        }
      });
      return commit(contacts, client(), false) ? { added, merged } : null;
    }

    function importFile(filename, text) {
      return importContacts(ContactCore.parseContactFile(filename, text));
    }

    function remove(id) {
      if (!get(id)) return false;
      const contacts = { ...getDatabase().contacts };
      delete contacts[id];
      const nextClient = client().contactId === id ? { ...client(), contactId: "" } : client();
      return commit(contacts, nextClient);
    }

    function clearClient() {
      return commit(getDatabase().contacts, emptyClientSnapshot());
    }

    function exportFile(format) {
      const contacts = list();
      if (!contacts.length) return null;
      const formats = {
        csv: { extension: "csv", type: "text/csv;charset=utf-8", serialize: ContactCore.toCsv },
        vcf: { extension: "vcf", type: "text/vcard;charset=utf-8", serialize: ContactCore.toVCard },
        json: { extension: "json", type: "application/json;charset=utf-8", serialize: ContactCore.toJson }
      };
      const selected = Object.hasOwn(formats, format) ? formats[format] : null;
      if (!selected) return null;
      return { extension: selected.extension, type: selected.type, content: selected.serialize(contacts), count: contacts.length };
    }

    return { list, get, client, save, importContacts, importFile, remove, clearClient, exportFile };
  }

  return { createService };
}));
