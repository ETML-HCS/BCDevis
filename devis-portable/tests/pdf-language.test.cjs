"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const appRoot = path.join(projectRoot, "devis-portable");
const text = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

const html = text("index.html");
const app = text("app.js");
const centralSync = text("central-sync.js");
const catalog = text("catalog.js");

// Le menu « ... » de la caisse propose le toggle en première position.
const quoteMenu = html.match(/<div class="action-menu" id="quoteActionMenu"[\s\S]*?<\/div>/)?.[0] || "";
assert.ok(quoteMenu, "Le menu des actions du devis doit être présent");
const actionIndex = quoteMenu.indexOf('data-action="pdf-language"');
const duplicateIndex = quoteMenu.indexOf('data-action="duplicate"');
assert.ok(actionIndex >= 0 && actionIndex < duplicateIndex, "Le toggle PDF doit être la première action du menu");
assert.match(quoteMenu, /data-action="pdf-language"[^>]*id="pdfLanguageMenuAction"/, "Le toggle doit exposer un identifiant dédié");
assert.match(quoteMenu, /id="pdfLanguageMenuLabel">PDF : FR<\/span>/, "Le toggle doit démarrer en français");
assert.equal((quoteMenu.match(/role="menuitem"/g) || []).length, 6, "Le menu doit proposer six actions");

// Le réglage par défaut est le français.
assert.match(app, /pdfLanguage: "fr"/, "Le PDF doit être en français par défaut");

// Le rendu du PDF lit la langue configurée pour basculer en anglais.
assert.match(app, /function pdfEnglish\(\)[\s\S]*?db\.settings\.pdfLanguage === "en"/, "Le rendu du PDF doit lire la langue configurée");

// Le libellé du toggle alterne FR et EN.
assert.match(app, /function syncPdfLanguageMenu\(\)[\s\S]*?PDF : \$\{english \? "EN" : "FR"\}/, "Le libellé du toggle doit alterner FR et EN");

// Un clic bascule la langue, la mémorise et resynchronise le libellé.
assert.match(app, /db\.settings\.pdfLanguage = db\.settings\.pdfLanguage === "en" \? "fr" : "en"/, "Un clic doit basculer la langue du PDF");
assert.match(app, /function togglePdfLanguage\(\)[\s\S]*?saveLocal\(\)[\s\S]*?syncPdfLanguageMenu\(\)/, "La bascule doit être factorisée en une fonction réutilisable");
assert.match(app, /if \(action === "pdf-language"\) togglePdfLanguage\(\)/, "Le menu doit appeler la bascule factorisée");
assert.match(app, /key === "l"\) \{ event\.preventDefault\(\); closeMenusForShortcut\(\); togglePdfLanguage\(\)/, "Le raccourci Ctrl+L doit basculer la langue du PDF");

// Le menu rafraîchit son libellé à chaque ouverture.
assert.match(app, /function setQuoteMenuOpen\(open[\s\S]*?if \(open\) \{\s*syncPdfLanguageMenu\(\)/, "L’ouverture du menu doit rafraîchir le libellé de langue");

// Le PDF en anglais traduit aussi les noms des soins.
const englishNames = catalog.match(/window\.QUOTE_SERVICE_NAMES_EN = \{([\s\S]*?)\};/)?.[1] || "";
assert.ok(englishNames, "Le catalogue doit fournir les noms anglais des soins");
const serviceIds = [...catalog.matchAll(/service\((\d+),/g)].map((match) => match[1]);
assert.ok(serviceIds.length >= 80, "Le catalogue doit contenir les soins à traduire");
for (const id of serviceIds) {
  assert.match(englishNames, new RegExp(`^\\s*${id}: "`, "m"), `Le soin ${id} doit avoir un nom anglais`);
}
assert.match(app, /function printServiceName\(line\)[\s\S]*?window\.QUOTE_SERVICE_NAMES_EN/, "Le rendu du PDF doit lire les noms anglais des soins");
assert.match(app, /printServiceName\(line\)/, "Le tableau du PDF doit afficher le nom traduit du soin");
assert.match(app, /function pdfMoney\(value\)[\s\S]*?Intl\.NumberFormat\("en-GB"[\s\S]*?currency: "CHF"/, "Le PDF en anglais doit formater les montants en CHF anglais");
assert.match(app, /pdfEnglish\(\) \? printServiceName\(line\)/, "La mise en page du PDF doit tenir compte des noms de soins traduits");

// Le réglage est partagé entre les postes centralisés.
assert.match(centralSync, /"pdfLanguage"/, "La langue du PDF doit être synchronisée avec la base centrale");
