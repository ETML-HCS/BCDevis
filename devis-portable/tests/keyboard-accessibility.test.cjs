"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

for (const shortcut of ["event.code === \"KeyM\"", "event.code === \"KeyP\"", "key === \"k\"", "key === \"s\"", "key === \"n\"", "key === \"h\"", "key === \"d\"", "key === \"o\"", "key === \"e\"", "key === \"p\"", "event.shiftKey && key === \"s\"", "event.code === \"KeyW\"", "event.key === \",\""]) {
  assert.match(app, new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Raccourci absent : ${shortcut}`);
}
assert.match(app, /trapLayerFocus/, "Les modales doivent conserver le focus au clavier");
assert.match(app, /moveRadioSelection/, "Les groupes de choix doivent accepter les flèches");
assert.match(app, /function setAppMenuOpen/, "Le menu Actions doit exposer un état ouvert et fermé");
assert.match(app, /event\.key === "ArrowDown"/, "Le menu Actions doit accepter les flèches");
assert.match(app, /data-logo-picker/, "Le choix de logo doit être atteignable au clavier");
assert.match(html, /id="shortcutHelpLayer"/, "L’aide des raccourcis doit être accessible dans l’interface");
assert.match(html, /id="appMenuButton"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-keyshortcuts="Alt\+M"/, "Le bouton du menu principal doit annoncer son menu et son raccourci");
assert.match(html, /id="appMenuButton"[^>]*>\s*<svg[^>]*>.*?<\/svg>\s*<\/button>/s, "Le bouton du menu principal doit rester un SVG seul");
assert.doesNotMatch(html, /id="appMenuButton"[^>]*>[\s\S]*?<span>Actions<\/span>[\s\S]*?<\/button>/, "Le titre Actions ne doit plus prendre de place dans le header");
assert.match(html, /id="appActionsMenu" role="menu" aria-label="Menu principal"/, "Le menu principal doit être identifié");
assert.doesNotMatch(html, /app-menu-status|100% local|id="saveState"/, "Le menu Actions ne doit pas contenir une ligne d’état inutile");
for (const id of ["customItemButton", "familyPriceToggle", "settingsButton", "shortcutHelpButton"]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*role="menuitem`), `${id} doit appartenir au menu Actions`);
}
assert.doesNotMatch(html, />Devis<\/p>[\s\S]*?id="newQuoteButton"/, "Les actions essentielles du devis ne doivent plus être dupliquées dans le menu principal");
assert.match(html, /id="familyPriceToggle"[^>]*aria-keyshortcuts="Alt\+P"[^>]*>[\s\S]*?<kbd>Alt P<\/kbd>/, "Le basculement des prix doit annoncer Alt+P");
assert.match(html, /<kbd>Alt<\/kbd><kbd>P<\/kbd><\/dt><dd>Afficher ou masquer les prix<\/dd>/, "Alt+P doit figurer dans l’aide des raccourcis");
assert.match(app, /\$\("#familyPriceToggle"\)\.addEventListener\("click", toggleFamilyPrices\)/, "Le menu et le raccourci doivent partager le même basculement des prix");
for (const [id, label, shortcut] of [
  ["newQuoteButton", "Nouveau devis", "Control\\+N Meta\\+N"],
  ["saveButton", "Enregistrer le devis", "Control\\+S Meta\\+S"],
  ["historyButton", "Ouvrir l’historique", "Control\\+H Meta\\+H"]
]) {
  assert.match(html, new RegExp(`class="round-button quote-icon-button" id="${id}"[^>]*aria-label="${label}"[^>]*aria-keyshortcuts="${shortcut}"[^>]*data-tooltip="[^"]+"`), `${id} doit être une action SVG documentée de la caisse`);
  assert.match(html, new RegExp(`id="${id}"[^>]*>\\s*<svg[^>]*>[\\s\\S]*?<\\/svg>\\s*<\\/button>`), `${id} ne doit contenir que son SVG`);
}
assert.match(app, /\$\("#newQuoteButton"\)\.addEventListener\("click", createNewQuote\)/, "Le bouton Nouveau devis de la caisse doit fonctionner");
assert.match(app, /\$\("#saveButton"\)\.addEventListener\("click", saveQuote\)/, "Le bouton Enregistrer de la caisse doit fonctionner");
assert.match(app, /\$\("#historyButton"\)\.addEventListener\("click", openHistoryLayer\)/, "Le bouton Historique de la caisse doit fonctionner");
for (const [id, shortcut] of [
  ["historyButton", "Control\\+H Meta\\+H"],
  ["customItemButton", "Control\\+Shift\\+N Meta\\+Shift\\+N"],
  ["checkoutWhatsAppButton", "Control\\+Alt\\+W Meta\\+Alt\\+W"]
]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*aria-keyshortcuts="${shortcut}"`), `Raccourci non annoncé pour ${id}`);
}
assert.doesNotMatch(html, />Sortie<|id="printButton"|id="downloadPdfButton"|id="whatsAppButton"/, "Les sorties déjà présentes dans la caisse ne doivent pas être répétées dans le menu");
assert.doesNotMatch(html, />Gestion du devis</, "La gestion du devis ne doit pas être répétée dans le menu principal");
assert.match(html, /<span>TVA<\/span>/, "Le toggle de caisse doit être libellé simplement TVA");
assert.doesNotMatch(html, />Afficher TVA</, "Le libellé TVA ne doit pas être inutilement long");
assert.doesNotMatch(html, /id="quoteNumber"|class="quote-number"/, "Le numéro de devis ne doit plus encombrer l’en-tête de caisse");
assert.match(html, /\.family-title-row h2\{font-size:18px\}/, "Le titre Prestations doit être réduit avec mesure");
assert.match(html, /\.checkout-panel h2\{font-size:22px\}/, "Le titre Caisse doit être réduit avec mesure");
assert.match(html, /id="installmentTableWrap" hidden><table class="installment-table"[^>]*><tbody id="installmentGrid"/, "L’échelonnement doit utiliser un tableau compact");
assert.doesNotMatch(html, /<details class="installments"|Paiement échelonné \(CHF\)|class="installment-note"/, "La caisse ne doit plus afficher le panneau explicatif de l’échelonnement");
assert.match(app, /class="installment-months"/, "La première ligne doit afficher les mois");
assert.match(app, /class="installment-amounts"/, "La seconde ligne doit afficher les montants");
assert.match(html, /id="moreQuoteButton"[^>]*aria-haspopup="menu"[^>]*aria-controls="quoteActionMenu"[^>]*aria-expanded="false"/, "Le bouton des actions du devis doit annoncer son menu");
assert.match(html, /id="quoteActionMenu" role="menu" aria-label="Actions du devis"/, "Le menu du devis doit être identifié");
for (const [action, label] of [
  ["duplicate", "Dupliquer le devis"],
  ["export", "Exporter ce devis"],
  ["import", "Importer un devis"],
  ["clear", "Vider la caisse"]
]) {
  assert.match(html, new RegExp(`role="menuitem" data-action="${action}"[^>]*aria-label="${label}"`), `Action de devis absente : ${label}`);
}
for (const [action, shortcut] of [["duplicate", "Control\\+D Meta\\+D"], ["export", "Control\\+E Meta\\+E"], ["import", "Control\\+O Meta\\+O"]]) {
  assert.match(html, new RegExp(`data-action="${action}"[^>]*aria-keyshortcuts="${shortcut}"`), `Raccourci non annoncé pour l’action ${action}`);
}
assert.doesNotMatch(html, /data-action="clear"[^>]*aria-keyshortcuts=/, "Vider la caisse ne doit pas avoir de raccourci risqué");
assert.match(app, /function setQuoteMenuOpen/, "Le menu du devis doit exposer un état ouvert et fermé");
assert.match(app, /quoteMenuItems/, "Le menu du devis doit être navigable au clavier");
assert.doesNotMatch(html, /id="checkoutFocusToggle"|id="familyFooter"|class="checkout-actions"/, "Les anciens contrôles inférieurs doivent être retirés");
assert.match(html, /class="checkout-primary-actions" aria-label="Actions rapides du devis"/, "Les actions essentielles doivent rester dans la caisse");
for (const id of ["checkoutPrintButton", "checkoutPdfButton", "checkoutTransmitButton"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} doit rester directement accessible dans la caisse`);
}
assert.equal((html.match(/id="checkout(?:Print|Pdf|Transmit)Button"/g) || []).length, 3, "La caisse doit contenir exactement trois actions rapides");
assert.match(html, /id="checkoutTransmitButton"[^>]*aria-haspopup="menu"[^>]*aria-controls="checkoutTransmissionMenu"[^>]*aria-expanded="false"/, "Transmettre doit annoncer ses deux choix");
assert.match(html, /id="checkoutTransmissionMenu" role="menu" aria-label="Transmettre le devis" hidden/, "Le menu de transmission doit être identifié");
for (const id of ["checkoutWhatsAppButton", "checkoutEmailButton"]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*role="menuitem"`), `${id} doit appartenir au menu Transmettre`);
}
assert.match(html, /id="checkoutEmailRecipient">Destinataire à saisir</, "Le choix E-mail doit expliquer le destinataire manquant");
assert.match(app, /function setTransmissionMenuOpen/, "Le menu Transmettre doit exposer un état ouvert et fermé");
assert.match(app, /function shareQuoteViaEmail/, "Le transfert par e-mail doit être implémenté");
assert.match(app, /quote\.client\?\.email/, "L’adresse e-mail du contact doit être réutilisée lorsqu’elle existe");
assert.match(app, /mailto:/, "Le transfert e-mail doit ouvrir la messagerie configurée");
assert.doesNotMatch(app, /setCheckoutFocus|familyFooterCollapsed/, "L’ancien basculement de la caisse doit être supprimé");
assert.match(html, /role="radiogroup" aria-label="Tarif appliqué aux soins"/, "Le tarif doit être annoncé comme un groupe de choix");
assert.match(html, /id="themePicker" role="radiogroup" aria-label="Choix du thème"/, "Les thèmes doivent être annoncés comme un groupe de choix");
assert.equal((html.match(/class="theme-card"/g) || []).length, 4, "Les quatre thèmes doivent rester accessibles au clavier");
assert.match(html, /id="fontPicker" role="radiogroup" aria-label="Choix de la police"/, "Les polices doivent être annoncées comme un groupe de choix");
assert.equal((html.match(/class="font-card"/g) || []).length, 4, "Les quatre polices doivent rester accessibles au clavier");
assert.match(app, /moveRadioSelection\(event\.currentTarget, "\.font-card"/, "Les polices doivent accepter les flèches du clavier");
assert.doesNotMatch(html, /class="layer-backdrop"[^>]*?(?<!tabindex="-1")>/, "Les fonds de modale ne doivent pas interrompre l’ordre de tabulation");
console.log("KEYBOARD_ACCESSIBILITY_TESTS_OK");
