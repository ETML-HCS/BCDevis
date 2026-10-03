"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const i18n = require("../pdf-i18n.js");

const catalog = fs.readFileSync(path.join(__dirname, "..", "catalog.js"), "utf8");
const serviceIds = [...catalog.matchAll(/service\((\d+),/g)].map((match) => Number(match[1]));
const categoryIds = [...catalog.matchAll(/\{ id: (\d+), name: "[^"]+", short:/g)].map((match) => Number(match[1]));

// Huit langues, dans un ordre stable : les touches 1 à 8 du sélecteur en dépendent.
assert.deepEqual(i18n.CODES, ["fr", "en", "de", "it", "es", "pt", "uk", "ru"]);
assert.equal(i18n.languageInfo("uk").short, "UA", "L’ukrainien ne doit pas s’afficher « UK », lu comme Royaume-Uni");
assert.equal(i18n.normalizeLanguage("xx"), "fr", "Une langue inconnue revient au français");
assert.equal(i18n.normalizeLanguage("DE"), "de");
assert.equal(i18n.nextLanguage("ru"), "fr");

// Chaque texte du PDF existe dans chaque langue.
const frenchKeys = Object.keys(i18n.strings("fr")).sort();
for (const code of i18n.CODES) {
  const text = i18n.strings(code);
  assert.deepEqual(Object.keys(text).sort(), frenchKeys, `Textes incomplets pour ${code}`);
  for (const [key, value] of Object.entries(text)) {
    const sample = typeof value === "function" ? value(6, 1) : value;
    assert.ok(String(sample).trim(), `Texte vide : ${code}.${key}`);
  }
}

// Le PDF français reprend exactement les libellés de la caisse.
assert.equal(i18n.strings("fr").totalBeforeOffers, "Total avant offres");
assert.equal(i18n.strings("fr").totalDiscount, "Rabais total");
assert.equal(i18n.strings("fr").totalToPay, "Total à payer");

// Tous les soins et toutes les catégories du catalogue sont traduits (l’anglais reste dans catalog.js).
for (const code of ["de", "it", "es", "pt", "uk", "ru"]) {
  for (const id of serviceIds) assert.ok(i18n.SERVICE_NAMES[code][id], `Soin ${id} sans nom en ${code}`);
  for (const id of categoryIds) assert.ok(i18n.CATEGORY_NAMES[code][id], `Catégorie ${id} sans nom en ${code}`);
}
assert.equal(i18n.serviceName(88, "Acide hyaluronique", "de"), "Hyaluronsäure");
assert.equal(i18n.serviceName(88, "Acide hyaluronique", "fr"), "Acide hyaluronique", "Le français garde le nom du catalogue");
assert.equal(i18n.serviceName(88, "Acide hyaluronique", "en", { 88: "Hyaluronic acid" }), "Hyaluronic acid", "L’anglais reprend QUOTE_SERVICE_NAMES_EN");
assert.equal(i18n.serviceName(9999, "Soin sur mesure", "it"), "Soin sur mesure", "Un soin personnalisé garde son libellé");
assert.equal(i18n.categoryName(13, "Épilation laser", "ru"), "Лазерная эпиляция");

// Allemand de Suisse : « Offerte », « MWST », pas de ß.
const germanTexts = [
  ...Object.values(i18n.strings("de")).map((value) => (typeof value === "function" ? value(6, 1) : value)),
  ...Object.values(i18n.SERVICE_NAMES.de),
  ...Object.values(i18n.CATEGORY_NAMES.de),
  i18n.defaultText("payment", "de"), i18n.defaultText("student", "de"), i18n.defaultText("footer", "de")
].join(" ");
assert.doesNotMatch(germanTexts, /ß/, "L’allemand de Suisse s’écrit sans ß");
assert.equal(i18n.strings("de").title, "OFFERTE");
assert.equal(i18n.strings("de").vat, "MWST");

// Pluriels : les langues slaves accordent « mois » selon le nombre.
assert.deepEqual([3, 4, 6, 10, 12].map((n) => i18n.strings("ru").months(n)), ["месяца", "месяца", "месяцев", "месяцев", "месяцев"]);
assert.deepEqual([3, 6].map((n) => i18n.strings("uk").months(n)), ["місяці", "місяців"]);
assert.equal(i18n.strings("fr").packQuantity(1, 1), "1 payée + 1 offerte", "Le français accorde « payée » au singulier");
assert.equal(i18n.strings("fr").packQuantity(6, 2), "6 payées + 2 offertes");
assert.equal(i18n.strings("pt").packQuantity(1, 1), "1 paga + 1 grátis");

// Montants en CHF selon les usages de chaque langue, sans espace fine insécable (absente de certaines polices).
assert.match(i18n.formatMoney(3420.5, "de"), /^CHF\u00a03.420\.50$/, "Un montant ne doit jamais être coupé entre CHF et le nombre");
assert.match(i18n.formatMoney(3420.5, "en"), /^CHF\u00a03,420\.50$/);
assert.match(i18n.formatMoney(3420.5, "ru"), /^3\u00a0420,50\u00a0CHF$/);
assert.doesNotMatch(i18n.formatMoney(3420.5, "uk"), /\u202f/);

// Mentions par défaut traduites ; le français garde le texte des réglages.
for (const kind of ["payment", "student", "footer"]) {
  assert.equal(i18n.defaultText(kind, "fr"), "", "Le français n’a pas de traduction à substituer");
  for (const code of i18n.CODES.filter((value) => value !== "fr")) assert.ok(i18n.defaultText(kind, code), `Mention ${kind} manquante en ${code}`);
}

// Langue du contact → langue du PDF.
assert.equal(i18n.languageFromName("Italien"), "it");
assert.equal(i18n.languageFromName("ukrainien"), "uk");
assert.equal(i18n.languageFromName("Español"), "es");
assert.equal(i18n.languageFromName("Klingon"), "");

// Le cyrillique demande une police dédiée.
assert.deepEqual(i18n.CODES.filter((code) => i18n.usesCyrillic(code)), ["uk", "ru"]);

console.log("PDF_I18N_TESTS_OK");
