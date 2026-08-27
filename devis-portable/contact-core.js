(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisContacts = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTACT_FIELDS = ["name", "phone", "email", "company", "address", "postalCode", "city", "country", "birthDate", "language", "reference", "notes"];
  const CSV_HEADERS = ["Nom", "Téléphone", "E-mail", "Société", "Adresse", "NPA", "Ville", "Pays", "Date de naissance", "Langue", "Référence", "Notes"];
  const FIELD_ALIASES = {
    name: ["nom", "nomcomplet", "name", "fullname", "fn"],
    phone: ["telephone", "tel", "phone", "mobile", "portable"],
    email: ["email", "courriel", "mail"],
    company: ["societe", "entreprise", "company", "organization", "organisation", "org"],
    address: ["adresse", "address", "street", "rue"],
    postalCode: ["npa", "codepostal", "postalcode", "zip", "zipcode"],
    city: ["ville", "city", "localite"],
    country: ["pays", "country"],
    birthDate: ["datedenaissance", "naissance", "birthdate", "birthday", "bday"],
    language: ["langue", "language", "lang"],
    reference: ["reference", "ref", "identifiant", "internalreference"],
    notes: ["note", "notes", "commentaire", "commentaires", "comments"]
  };

  function clean(value, maximum = 500) {
    return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum);
  }

  function normalize(value) {
    return clean(value, 1000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "");
  }

  function safeId(value) {
    return clean(value, 128).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96);
  }

  function generatedId() {
    if (globalThis.crypto?.randomUUID) return `contact-${globalThis.crypto.randomUUID()}`;
    return `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function timestamp(value, fallback) {
    return Number.isNaN(Date.parse(value)) ? fallback : new Date(value).toISOString();
  }

  function isoDate(value) {
    const candidate = clean(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
    const parsed = new Date(`${candidate}T12:00:00Z`);
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate ? "" : candidate;
  }

  function sanitizeContact(source, options = {}) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const now = timestamp(options.now, new Date().toISOString());
    const company = clean(source.company ?? source.organization ?? source.org, 240);
    const name = clean(source.name ?? source.fullName ?? source.fn, 240) || company;
    if (!name) return null;
    const createId = typeof options.idFactory === "function" ? options.idFactory : generatedId;
    const id = safeId(source.id ?? source.contactId ?? source.uid) || safeId(createId()) || generatedId();
    return {
      id,
      name,
      phone: clean(source.phone ?? source.tel ?? source.mobile, 80),
      email: clean(source.email ?? source.mail, 320).toLocaleLowerCase("fr"),
      company,
      address: clean(source.address ?? source.street, 500),
      postalCode: clean(source.postalCode ?? source.zip ?? source.npa, 32),
      city: clean(source.city ?? source.locality, 120),
      country: clean(source.country, 120),
      birthDate: isoDate(source.birthDate ?? source.birthday ?? source.bday),
      language: clean(source.language ?? source.lang, 40),
      reference: clean(source.reference ?? source.ref, 80),
      notes: clean(source.notes ?? source.note, 2000),
      createdAt: timestamp(source.createdAt, now),
      updatedAt: timestamp(source.updatedAt, now)
    };
  }

  function matchKey(source) {
    const contact = sanitizeContact(source, { idFactory: () => "contact-match" });
    if (!contact) return "";
    const email = normalize(contact.email);
    if (email) return `email:${email}`;
    const phone = contact.phone.replace(/\D/g, "");
    if (phone.length >= 6) return `phone:${phone}`;
    return `name:${normalize(contact.name)}:${normalize(contact.postalCode)}:${normalize(contact.city)}`;
  }

  function mergeContacts(currentSource, incomingSource, options = {}) {
    const current = sanitizeContact(currentSource, options);
    const incoming = sanitizeContact(incomingSource, options);
    if (!current) return incoming;
    if (!incoming) return current;
    const now = timestamp(options.now, new Date().toISOString());
    const merged = { ...current };
    CONTACT_FIELDS.forEach((field) => {
      if (incoming[field]) merged[field] = incoming[field];
    });
    merged.id = current.id;
    merged.createdAt = current.createdAt;
    merged.updatedAt = now;
    return merged;
  }

  function csvDelimiter(text) {
    const line = String(text || "").split(/\r?\n/).find((item) => item.trim()) || "";
    const counts = [[";", (line.match(/;/g) || []).length], [",", (line.match(/,/g) || []).length], ["\t", (line.match(/\t/g) || []).length]];
    return counts.sort((left, right) => right[1] - left[1])[0][1] ? counts[0][0] : ";";
  }

  function parseDelimited(text, delimiter = csvDelimiter(text)) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        row.push(value);
        value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some((item) => String(item).trim())) rows.push(row);
        row = [];
        value = "";
      } else value += character;
    }
    row.push(value);
    if (row.some((item) => String(item).trim())) rows.push(row);
    return rows;
  }

  function fieldForHeader(header) {
    const candidate = normalize(header);
    return Object.keys(FIELD_ALIASES).find((field) => FIELD_ALIASES[field].includes(candidate)) || "";
  }

  function parseCsv(text) {
    const rows = parseDelimited(text);
    if (rows.length < 2) return [];
    const fields = rows[0].map(fieldForHeader);
    return rows.slice(1).map((row) => {
      const source = {};
      fields.forEach((field, index) => { if (field) source[field] = row[index] || ""; });
      return sanitizeContact(source);
    }).filter(Boolean);
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function toCsv(contacts) {
    const rows = [CSV_HEADERS, ...(contacts || []).map((item) => {
      const contact = sanitizeContact(item);
      return contact ? CONTACT_FIELDS.map((field) => contact[field]) : [];
    }).filter((row) => row.length)];
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  }

  function vcardUnescape(value) {
    return String(value || "")
      .replace(/\\\\/g, "\x00")
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\x00/g, "\\");
  }

  function vcardEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function parseVCard(text) {
    const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
    const blocks = unfolded.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
    return blocks.map((block) => {
      const source = {};
      block.split(/\r?\n/).forEach((line) => {
        const separator = line.indexOf(":");
        if (separator < 0) return;
        const property = line.slice(0, separator).split(";")[0].toUpperCase();
        const value = vcardUnescape(line.slice(separator + 1));
        if (property === "FN") source.name = value;
        else if (property === "ORG") source.company = value.split(";")[0];
        else if (property === "TEL" && !source.phone) source.phone = value;
        else if (property === "EMAIL" && !source.email) source.email = value;
        else if (property === "ADR") {
          const parts = value.split(";");
          source.address = parts[2] || "";
          source.city = parts[3] || "";
          source.postalCode = parts[5] || "";
          source.country = parts[6] || "";
        } else if (property === "BDAY") source.birthDate = value;
        else if (property === "LANG") source.language = value;
        else if (property === "NOTE") source.notes = value;
        else if (property === "X-BCDEVIS-REFERENCE") source.reference = value;
        else if (property === "UID") source.id = value;
      });
      return sanitizeContact(source);
    }).filter(Boolean);
  }

  function toVCard(contacts) {
    return (contacts || []).map((item) => sanitizeContact(item)).filter(Boolean).map((contact) => [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `UID:${vcardEscape(contact.id)}`,
      `FN:${vcardEscape(contact.name)}`,
      contact.company ? `ORG:${vcardEscape(contact.company)}` : "",
      contact.phone ? `TEL;TYPE=CELL:${vcardEscape(contact.phone)}` : "",
      contact.email ? `EMAIL;TYPE=INTERNET:${vcardEscape(contact.email)}` : "",
      [contact.address, contact.city, contact.postalCode, contact.country].some(Boolean)
        ? `ADR;TYPE=HOME:;;${vcardEscape(contact.address)};${vcardEscape(contact.city)};;${vcardEscape(contact.postalCode)};${vcardEscape(contact.country)}`
        : "",
      contact.birthDate ? `BDAY:${contact.birthDate}` : "",
      contact.language ? `LANG:${vcardEscape(contact.language)}` : "",
      contact.reference ? `X-BCDEVIS-REFERENCE:${vcardEscape(contact.reference)}` : "",
      contact.notes ? `NOTE:${vcardEscape(contact.notes)}` : "",
      "END:VCARD"
    ].filter(Boolean).join("\r\n")).join("\r\n");
  }

  function parseJson(text) {
    const parsed = JSON.parse(String(text || "{}"));
    const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed.contacts) ? parsed.contacts : [];
    return source.map((item) => sanitizeContact(item)).filter(Boolean);
  }

  function toJson(contacts) {
    return JSON.stringify({ type: "bcdevis-contacts", version: 1, exportedAt: new Date().toISOString(), contacts: (contacts || []).map((item) => sanitizeContact(item)).filter(Boolean) }, null, 2);
  }

  function parseContactFile(filename, text) {
    const name = clean(filename, 240).toLocaleLowerCase("fr");
    if (name.endsWith(".vcf") || name.endsWith(".vcard") || /BEGIN:VCARD/i.test(text)) return parseVCard(text);
    if (name.endsWith(".json") || /^\s*[\[{]/.test(text)) return parseJson(text);
    return parseCsv(text);
  }

  return { CONTACT_FIELDS, sanitizeContact, matchKey, mergeContacts, parseCsv, toCsv, parseVCard, toVCard, parseJson, toJson, parseContactFile };
}));
