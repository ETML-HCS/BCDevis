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
assert.match(app, /if \(action === "pdf-language"\)[\s\S]*?saveLocal\(\)[\s\S]*?syncPdfLanguageMenu\(\)/, "La bascule doit être mémorisée et synchronisée");

// Le menu rafraîchit son libellé à chaque ouverture.
assert.match(app, /function setQuoteMenuOpen\(open[\s\S]*?if \(open\) \{\s*syncPdfLanguageMenu\(\)/, "L’ouverture du menu doit rafraîchir le libellé de langue");

// Le réglage est partagé entre les postes centralisés.
assert.match(centralSync, /"pdfLanguage"/, "La langue du PDF doit être synchronisée avec la base centrale");
