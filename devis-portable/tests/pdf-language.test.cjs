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

// Le menu « … » ne double plus les boutons déjà présents : la langue est dans la caisse (pastille) et au clavier (Ctrl+L).
const quoteMenu = html.match(/<div class="action-menu" id="quoteActionMenu"[\s\S]*?<\/div>/)?.[0] || "";
assert.ok(quoteMenu, "Le menu des actions du devis doit être présent");
assert.doesNotMatch(quoteMenu, /pdf-language|pdfLanguageMenu/, "La langue du PDF ne doit plus figurer dans le menu des actions du devis");
assert.equal((quoteMenu.match(/role="menuitem"/g) || []).length, 5, "Le menu doit proposer cinq actions : dupliquer, exporter, importer, aide contextuelle, vider");

// Le réglage par défaut est le français.
assert.match(app, /pdfLanguage: "fr"/, "Le PDF doit être en français par défaut");

// Le rendu du PDF lit la langue configurée, bornée aux huit langues proposées.
assert.match(app, /function pdfLanguage\(\)[\s\S]*?PdfI18n\.normalizeLanguage\(db\.settings\.pdfLanguage\)/, "Le rendu du PDF doit lire la langue configurée");
assert.match(html, /<script src="pdf-i18n\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/, "Les traductions du PDF doivent être chargées avant l’application");
assert.match(app, /function renderPrint\(\)[\s\S]*?const text = PdfI18n\.strings\(language\)/, "Tous les textes du PDF doivent venir du module de traduction");
assert.doesNotMatch(app, /\ben \? "/, "Plus aucun texte du PDF ne doit dépendre d’une bascule français/anglais");

// La pastille de la caisse affiche le code de la langue choisie.
assert.match(app, /function syncPdfLanguageMenu\(\)[\s\S]*?checkoutPdfLanguageCode"\)\.textContent = info\.short/, "La pastille de la caisse doit afficher la langue choisie");
assert.doesNotMatch(app, /pdfLanguageMenu(?:Action|Label)/, "Le code ne doit plus piloter l’ancienne entrée de menu");

// Huit langues : un sélecteur remplace la bascule, au menu, à la caisse et au raccourci Ctrl+L.
assert.match(html, /id="pdfLanguageLayer"[\s\S]*?role="dialog"[\s\S]*?id="pdfLanguageOptions"/, "Le sélecteur de langue doit être une fenêtre accessible");
assert.match(html, /id="checkoutPdfLanguageButton"[^>]*aria-keyshortcuts="Control\+L Meta\+L"[\s\S]*?id="checkoutPrintButton"/, "La langue du PDF doit être visible dans la caisse, avant l’impression");
assert.match(app, /function setPdfLanguage\(code\)[\s\S]*?saveLocal\(\)[\s\S]*?syncPdfLanguageMenu\(\)/, "Le choix doit être mémorisé puis reflété partout");
assert.match(app, /\$\("#checkoutPdfLanguageButton"\)[\s\S]{0,80}openPdfLanguagePicker/, "La pastille de la caisse doit ouvrir le sélecteur");
assert.match(app, /key === "l"\) \{ event\.preventDefault\(\); if \(!event\.repeat\) \{ closeMenusForShortcut\(\); openPdfLanguagePicker\(\); \}/, "Le raccourci Ctrl+L doit ouvrir le sélecteur de langue, sans clignoter si la touche reste enfoncée");
assert.match(app, /Ctrl\+L puis un chiffre[\s\S]*?if \(!event\.altKey && !event\.shiftKey && \/\^\[1-9\]\$\/\.test\(event\.key\)\)/, "Ctrl+L puis 1 à 8 doit choisir la langue, Ctrl pouvant rester enfoncé");
assert.match(app, /function handlePdfLanguageKeydown\(event\) \{\s*if \(event\.repeat\) return true;/, "Une touche maintenue ne doit pas enchaîner plusieurs choix");
assert.match(html, /id="pdfLanguageIntro">[^<]*<kbd>Ctrl<\/kbd> <kbd>L<\/kbd> puis <kbd>1<\/kbd> à <kbd>8<\/kbd>/, "La fenêtre doit annoncer le raccourci Ctrl+L puis un chiffre");
assert.match(html, /id="helpLayer"[\s\S]*?class="button secondary help-close"[^>]*data-close="helpLayer"[\s\S]*?<span>Fermer<\/span><kbd>Échap<\/kbd>/, "L’aide doit proposer un bouton Fermer lisible plutôt qu’une simple croix");
assert.match(app, /function handlePdfLanguageKeydown\(event\)[\s\S]*?\/\^\[1-9\]\$\/[\s\S]*?ArrowDown: 2/, "Les touches 1 à 8 et les flèches doivent piloter le sélecteur");
assert.match(app, /layer\?\.id === "pdfLanguageLayer" && !layer\.hidden && handlePdfLanguageKeydown\(event\)/, "Le clavier du sélecteur doit fonctionner malgré le blocage des raccourcis dans les fenêtres");
assert.match(app, /PdfI18n\.languageFromName\(quote\.client\?\.language\)[\s\S]*?Langue du client/, "La langue renseignée sur le client doit être signalée");
assert.match(html, /name="pdfLanguage">(?:<option value="(?:fr|en|de|it|es|pt|uk|ru)">[^<]+<\/option>){8}<\/select>/, "Les réglages doivent proposer les huit langues");

// Le cyrillique dispose de sa propre police, chargée avant l’impression.
const styles = text("styles.css");
const serviceWorker = text("service-worker.js");
assert.match(styles, /@font-face\{font-family:"Roboto";src:url\("assets\/roboto-cyrillic\.woff2"\)[^}]*unicode-range:U\+0301,U\+0400-045F/, "Roboto doit fournir le cyrillique au PDF");
assert.match(styles, /\.print-quote\[data-pdf-script="cyrillic"\]\{--document-font:"Roboto"/, "Un PDF cyrillique doit garder une seule famille de caractères");
assert.match(app, /async function waitForPdfLayout\(\) \{\s*await ensurePdfFonts\(\);/, "Le PDF doit attendre la police cyrillique");
assert.match(app, /void ensurePdfFonts\(\)\.then\(\(\) => window\.setTimeout\(\(\) => window\.print\(\), 80\)\)/, "L’impression doit attendre la police cyrillique");
for (const asset of ["./pdf-i18n.js", "./assets/roboto-cyrillic.woff2", "./assets/roboto-slab-cyrillic.woff2"]) {
  assert.ok(serviceWorker.includes(`"${asset}"`), `${asset} doit être disponible hors ligne`);
}

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
assert.match(app, /function pdfMoney\(value\)[\s\S]*?PdfI18n\.formatMoney\(value, language\)/, "Le PDF doit formater les montants en CHF selon la langue");
assert.match(app, /String\(printServiceName\(line\) \|\| ""\)\.length > 44/, "La mise en page du PDF doit tenir compte des noms de soins traduits");

// Le réglage est partagé entre les postes centralisés.
assert.match(centralSync, /"pdfLanguage"/, "La langue du PDF doit être synchronisée avec la base centrale");
