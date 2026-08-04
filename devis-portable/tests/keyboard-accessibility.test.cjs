"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

for (const shortcut of ["event.code === \"KeyM\"", "event.code === \"KeyP\"", "key === \"k\"", "key === \"s\"", "key === \"n\"", "key === \"h\"", "key === \"d\"", "key === \"o\"", "key === \"e\"", "key === \"p\"", "event.shiftKey && key === \"s\"", "event.code === \"KeyW\"", "event.key === \",\""]) {
  assert.match(app, new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Raccourci absent : ${shortcut}`);
}
assert.match(app, /trapLayerFocus/, "Les modales doivent conserver le focus au clavier");
assert.match(app, /const initialFocus = \$\("\[autofocus\]"[\s\S]*?button\[data-close\]:not\(\.layer-backdrop\)/, "Le focus initial doit ignorer le fond de modale et respecter les éléments prioritaires");
assert.match(app, /moveRadioSelection/, "Les groupes de choix doivent accepter les flèches");
assert.match(app, /function setAppMenuOpen/, "Le menu Actions doit exposer un état ouvert et fermé");
assert.match(app, /function closeContextMenus/, "Les menus contextuels doivent partager une fermeture fiable");
assert.match(app, /document\.addEventListener\("pointerdown",[\s\S]*?true\);/, "Le clic extérieur doit fermer les menus avant les actions de la page");
assert.match(styles, /\.bcdevis-context-menu-open \.topbar\{[\s\S]*?-webkit-app-region:no-drag/, "La zone de déplacement ne doit pas absorber le clic extérieur lorsqu’un menu est ouvert");
assert.match(app, /classList\.toggle\("bcdevis-catalog-menu-open", catalogMenuOpen\)/, "Le menu Catalogue doit piloter son propre niveau d’empilement");
assert.match(styles, /html\.bcdevis-catalog-menu-open \.topbar\{z-index:400\}/, "Le menu Catalogue doit élever le header au-dessus de toutes les surfaces");
assert.match(styles, /html\.bcdevis-catalog-menu-open \.app-actions-menu\{z-index:420\}/, "Le menu Catalogue doit rester au sommet du header");
assert.match(app, /event\.key === "ArrowDown"/, "Le menu Actions doit accepter les flèches");
assert.match(app, /data-logo-picker/, "Le choix de logo doit être atteignable au clavier");
assert.match(html, /id="shortcutHelpLayer"/, "L’aide des raccourcis doit être accessible dans l’interface");
assert.deepEqual(
  [...html.matchAll(/class="shortcut-group" aria-labelledby="[^"]+">\s*<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]),
  ["Catalogue", "Devis", "Impression et partage", "Application"],
  "L’aide des raccourcis doit être organisée selon les quatre zones de travail"
);
assert.equal((html.match(/<dl class="shortcut-list">/g) || []).length, 4, "Chaque zone doit avoir sa liste de raccourcis");
assert.equal((html.match(/<div><dt><kbd>/g) || []).length, 16, "Les seize raccourcis actifs doivent rester documentés");
assert.match(html, /<kbd>Alt<\/kbd><kbd>M<\/kbd><\/dt><dd>Ouvrir le menu Catalogue<\/dd>/, "Alt+M doit reprendre le nom actuel du menu Catalogue");
assert.match(html, /<kbd>Ctrl<\/kbd><kbd>Maj<\/kbd><kbd>S<\/kbd><\/dt><dd>Télécharger le PDF<\/dd>/, "Le raccourci PDF doit reprendre l’action actuelle");
assert.match(html, /id="appMenuButton"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-keyshortcuts="Alt\+M"/, "Le bouton du menu principal doit annoncer son menu et son raccourci");
assert.match(html, /id="appMenuButton"[^>]*>\s*<svg[^>]*>.*?<\/svg>\s*<\/button>/s, "Le bouton du menu principal doit rester un SVG seul");
assert.doesNotMatch(html, /id="appMenuButton"[^>]*>[\s\S]*?<span>Actions<\/span>[\s\S]*?<\/button>/, "Le titre Actions ne doit plus prendre de place dans le header");
assert.match(html, /id="appActionsMenu" role="menu" aria-label="Menu principal"/, "Le menu principal doit être identifié");
assert.doesNotMatch(html, /app-menu-status|100% local|id="saveState"/, "Le menu Actions ne doit pas contenir une ligne d’état inutile");
for (const id of ["customItemButton", "familyPriceToggle"]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*role="menuitem`), `${id} doit appartenir au menu Actions`);
}
assert.match(
  html,
  /id="customItemButton"[^>]*aria-label="Créer un soin sur mesure"[^>]*title="Créer un soin sur mesure"[\s\S]*?<strong>Sur mesure<\/strong>/,
  "Le menu compact doit afficher Sur mesure tout en exposant son libellé complet"
);
assert.match(html, /<symbol id="icon-user-plus"[\s\S]*?id="clientButton"[^>]*class="client-card is-empty"|class="client-card is-empty"[^>]*id="clientButton"/, "Le client vide doit utiliser le pictogramme client plus");
assert.match(html, /id="clientButton"[^>]*aria-label="Ajouter un client"[^>]*>[\s\S]*?<use href="#icon-user-plus">[\s\S]*?id="clientName" hidden><\/strong>/, "Le client vide doit rester une action SVG accessible et sans texte visible");
assert.match(html, /id="quoteHeadActions"[\s\S]*?id="clientButton"[\s\S]*?id="newQuoteButton"/, "Le client doit précéder les actions du devis sur la même ligne");
assert.match(app, /clientButton\.classList\.toggle\("has-client", hasClient\)[\s\S]*?clientNameLabel\.hidden = !hasClient[\s\S]*?clientAddIcon\.hidden = hasClient/, "Le client renseigné doit remplacer l’icône par son seul nom");
assert.match(app, /function saveQuote\(\) \{[\s\S]*?if \(!quote\.lines\.length\) \{[\s\S]*?Ajoutez une prestation avant d’enregistrer/, "Enregistrer doit répondre explicitement quand le devis est vide");
assert.match(html, /id="couponToggle"[^>]*aria-label="Ajouter un coupon"[\s\S]*?<span>Coupon<\/span>/, "Le coupon doit garder une action complète avec un nom court");
assert.doesNotMatch(html, /Objet sur mesure|objet sur mesure/, "L’ancien libellé Objet sur mesure ne doit plus apparaître");
assert.doesNotMatch(html, />Application<\/p>|data-app-action="settings"|data-app-action="shortcuts"/, "Les utilitaires Application ne doivent plus rester dans le menu principal");
for (const [id, label, shortcut] of [
  ["settingsButton", "Ouvrir les réglages", "Control\\+Comma Meta\\+Comma"],
  ["shortcutHelpButton", "Afficher les raccourcis clavier", "\\?"]
]) {
  assert.match(html, new RegExp(`class="topbar-utility-button" id="${id}"[^>]*aria-label="${label}"[^>]*aria-keyshortcuts="${shortcut}"[^>]*data-tooltip="[^"]+"`), `${id} doit suivre les tarifs sous forme de SVG documenté`);
  assert.match(html, new RegExp(`id="${id}"[^>]*>\\s*<svg[^>]*>[\\s\\S]*?<\\/svg>\\s*<\\/button>`), `${id} ne doit contenir que son SVG`);
}
assert.match(app, /\$\("#settingsButton"\)\.addEventListener\("click", openSettingsLayer\)/, "Le bouton Réglages du header doit fonctionner");
assert.match(app, /\$\("#shortcutHelpButton"\)\.addEventListener\("click", \(\) => openLayer\("shortcutHelpLayer"\)\)/, "Le bouton Raccourcis du header doit fonctionner");
assert.ok(
  html.indexOf('id="shortcutHelpButton"') < html.indexOf('id="appActions"'),
  "Le menu principal doit être placé après le bouton Raccourcis clavier"
);
assert.match(
  html,
  /grid-template-columns:180px minmax\(360px,1fr\) auto 48px/,
  "Le header large doit conserver le menu principal dans sa colonne de droite"
);
assert.doesNotMatch(html, />Devis<\/p>[\s\S]*?id="newQuoteButton"/, "Les actions essentielles du devis ne doivent plus être dupliquées dans le menu principal");
assert.match(html, /id="familyPriceToggle"[^>]*aria-keyshortcuts="Alt\+P"[^>]*>[\s\S]*?<kbd>Alt P<\/kbd>/, "Le basculement des prix doit annoncer Alt+P");
assert.match(html, /<kbd>Alt<\/kbd><kbd>P<\/kbd><\/dt><dd>Afficher ou masquer les prix<\/dd>/, "Alt+P doit figurer dans l’aide des raccourcis");
assert.match(html, /<kbd>Ctrl<\/kbd><kbd>K<\/kbd>[\s\S]*?<dd>Rechercher<\/dd>/, "La recherche doit utiliser un nom court");
assert.match(html, /<kbd>Ctrl<\/kbd><kbd>Maj<\/kbd><kbd>N<\/kbd><\/dt><dd>Sur mesure<\/dd>/, "Le service libre doit utiliser un nom court");
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
assert.match(html, /name="showTaxInformation" type="checkbox"/, "La visibilité et le calcul de la TVA doivent être configurables dans les réglages");
assert.match(html, /\.tax-header-toggle\[hidden\]\{display:none!important\}/, "Le contrôle TVA masqué ne doit conserver aucune place dans la caisse");
assert.match(html, /<dt>Total avant offres<\/dt>[\s\S]*?id="totalDiscountRow" hidden><dt>Rabais total<\/dt>[\s\S]*?<dt>Total à payer<\/dt>/, "La caisse doit présenter le total catalogue, le rabais global et le montant payé");
assert.doesNotMatch(html, /studentDiscountTotalRow|discountTotalRow/, "Les rabais ne doivent plus être dispersés sur plusieurs lignes de totaux");
assert.match(app, /money\(referenceLineTotal\(line\)\)/, "Chaque prestation doit afficher sa valeur complète avant offre");
assert.doesNotMatch(html, /id="quoteNumber"|class="quote-number"/, "Le numéro de devis ne doit plus encombrer l’en-tête de caisse");
assert.match(styles, /\.visually-hidden\{[\s\S]*?clip-path:inset\(50%\)/, "Les repères masqués doivent rester accessibles");
assert.match(html, /class="visually-hidden" id="familyNavTitle">Soins<[\s\S]*?class="visually-hidden" id="checkoutTitle">Devis</, "Soins et Devis doivent nommer les zones sans rester visibles");
assert.match(html, /class="family-title-row"><h2[\s\S]*?id="catalogSearchToggle"[\s\S]*?<strong class="visually-hidden" id="activeOfferHint"/, "La ligne Soins ne doit conserver visuellement que la loupe");
assert.doesNotMatch(html, />\s*(?:Prestations|Caisse|Ajouter à la caisse)\s*</, "Les noms visibles doivent rester ultra courts");
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
  ["clear", "Vider le devis"]
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
for (const id of ["checkoutPrintButton", "checkoutPdfButton", "checkoutEmailButton", "checkoutTransmitButton"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} doit rester directement accessible dans la caisse`);
  assert.match(html, new RegExp(`id="${id}"[^>]*data-tooltip="[^"]+"[^>]*>\\s*<svg[^>]*>[\\s\\S]*?<\\/svg>\\s*<\\/button>`), `${id} doit être un SVG seul avec info-bulle`);
}
assert.equal((html.match(/id="checkout(?:Print|Pdf|Email|Transmit)Button"/g) || []).length, 4, "Le devis doit contenir exactement quatre actions rapides");
assert.match(html, /id="checkoutPdfButton"[^>]*aria-label="Télécharger le PDF"[^>]*>[\s\S]*?<use href="#icon-pdf">/, "PDF doit utiliser une icône explicite");
assert.match(html, /id="checkoutEmailButton"[^>]*aria-label="Envoyer par e-mail avec le PDF joint"[^>]*>[\s\S]*?<use href="#icon-mail-attach">/, "L’e-mail avec pièce jointe doit être directement accessible");
assert.match(html, /id="checkoutTransmitButton"[^>]*aria-haspopup="menu"[^>]*aria-controls="checkoutTransmissionMenu"[^>]*aria-expanded="false"/, "Envoyer doit annoncer son menu sans texte visible");
assert.doesNotMatch(html, /id="checkout(?:Print|Pdf|Email|Transmit)Button"[^>]*>\s*<span/, "Les sorties ne doivent plus afficher de texte");
assert.match(html, /id="checkoutTransmissionMenu" role="menu" aria-label="PDF à joindre" hidden/, "Le menu d’envoi doit annoncer les pièces à joindre");
for (const id of ["checkoutWhatsAppButton", "checkoutOutlookWebButton"]) {
  assert.match(html, new RegExp(`id="${id}"[^>]*role="menuitem"`), `${id} doit appartenir au menu Envoyer`);
}
assert.match(html, /class="transmission-group transmission-group-manual" role="group"[^>]*>[\s\S]*?PDF à joindre[\s\S]*?id="checkoutWhatsAppButton"[\s\S]*?id="checkoutOutlookWebButton"/, "WhatsApp et Outlook doivent être regroupés quand le PDF reste à joindre");
assert.doesNotMatch(html, /transmission-group-auto|Joint auto|id="checkoutEmailButton"[^>]*role="menuitem"/, "Le bouton e-mail direct ne doit plus être caché dans le menu Envoyer");
assert.match(html, /id="checkoutOutlookWebButton"[^>]*>[\s\S]*?<use href="#icon-web-mail">/, "Outlook Web doit avoir une icône distincte");
assert.match(styles, /\.transmission-manual-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "Les envois avec ajout manuel doivent rester visibles côte à côte");
assert.match(html, /id="checkoutOutlookWebRecipient">Destinataire à saisir</, "Outlook Web doit expliquer le destinataire manquant");
assert.match(app, /function setTransmissionMenuOpen/, "Le menu Envoyer doit exposer un état ouvert et fermé");
assert.match(app, /function shareQuoteViaOutlookWeb/, "Le transfert par Outlook Web doit être implémenté");
assert.match(app, /https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?to=\$\{encodeURIComponent\(recipient\)\}&subject=\$\{encodeURIComponent\(subject\)\}&body=\$\{encodeURIComponent\(body\)\}/, "Outlook Web doit recevoir le destinataire, l’objet et le message encodés");
assert.match(app, /function shareQuoteViaEmail/, "Le transfert par e-mail doit être implémenté");
assert.match(app, /quote\.client\?\.email/, "L’adresse e-mail du contact doit être réutilisée lorsqu’elle existe");
assert.doesNotMatch(app, /mailto:/, "Le transfert e-mail ne doit plus ouvrir un brouillon sans pièce jointe");
assert.match(app, /bcdevisDesktop\?\.composeEmail/, "L’application de bureau doit demander un brouillon avec le PDF joint");
assert.doesNotMatch(app, /new URLSearchParams\(\{ subject, body: message \}\)/, "Le lien e-mail ne doit pas transformer les espaces en signes plus");
assert.match(main, /X-Unsent: 1/, "Un brouillon EML avec pièce jointe doit remplacer le repli mailto");
assert.match(main, /Content-Disposition: attachment/, "Le brouillon EML doit embarquer le PDF");
assert.match(app, /class="cart-line-name"[^>]*title="\$\{escapeHTML\(line\.name\)\}"/, "Le libellé complet d’une prestation tronquée doit rester disponible au survol");
assert.match(app, /class="cart-line-category"[^>]*title="\$\{escapeHTML\(category\.name\)\}"/, "La catégorie complète doit rester disponible au survol");
assert.match(app, /replace\(\/\[\\s—–-\]\+\$\/u, ""\)/, "Les séparateurs déjà présents à la fin d’une prestation doivent être nettoyés");
assert.doesNotMatch(app, /setCheckoutFocus|familyFooterCollapsed/, "L’ancien basculement de la caisse doit être supprimé");
assert.match(html, /role="radiogroup" aria-label="Tarif appliqué aux soins"/, "Le tarif doit être annoncé comme un groupe de choix");
assert.match(html, /id="themePicker" role="radiogroup" aria-label="Choix du thème"/, "Les thèmes doivent être annoncés comme un groupe de choix");
assert.equal((html.match(/class="theme-card"/g) || []).length, 4, "Les quatre thèmes doivent rester accessibles au clavier");
assert.match(html, /id="fontPicker" role="radiogroup" aria-label="Choix de la police"/, "Les polices doivent être annoncées comme un groupe de choix");
assert.equal((html.match(/class="font-card"/g) || []).length, 4, "Les quatre polices doivent rester accessibles au clavier");
assert.match(app, /moveRadioSelection\(event\.currentTarget, "\.font-card"/, "Les polices doivent accepter les flèches du clavier");
assert.match(html, /id="settingsTabs" role="tablist" aria-label="Catégories de personnalisation"/, "Les groupes de réglages doivent être annoncés comme des onglets");
assert.equal((html.match(/role="tab" aria-selected=/g) || []).length, 4, "Les quatre onglets de Personnalisation doivent exposer leur état");
assert.equal((html.match(/role="tabpanel" aria-labelledby=/g) || []).length, 4, "Chaque onglet de Personnalisation doit piloter un panneau");
assert.match(app, /const SETTINGS_TAB_IDS = \["interface", "company", "pricing", "document"\]/, "La navigation doit rester limitée aux quatre groupes prévus");
assert.match(app, /function setSettingsTab\(/, "La navigation de Personnalisation doit synchroniser onglets et panneaux");
assert.match(app, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/, "Les onglets de Personnalisation doivent accepter les flèches, Début et Fin");
assert.doesNotMatch(html, /class="layer-backdrop"[^>]*?(?<!tabindex="-1")>/, "Les fonds de modale ne doivent pas interrompre l’ordre de tabulation");
assert.doesNotMatch(html, /id="checkoutToastSlot"/, "La notification ne doit plus dépendre d’un conteneur rogné dans la caisse");
assert.match(html, /<div class="toast-region" id="toastRegion" aria-live="polite"/, "La notification doit rester dans le calque global");
assert.match(app, /if \(region\.parentElement !== document\.body\) document\.body\.append\(region\)/, "La notification doit être replacée dans le calque global");
assert.match(
  styles,
  /\.toast-region\{position:fixed;z-index:320;[\s\S]*?width:min\(340px,calc\(100vw - 32px\)\)/,
  "La notification doit rester au-dessus des calques de l’application sans sortir de l’écran"
);
assert.match(
  styles,
  /@media screen and \(max-width:1180px\)\{[\s\S]*?\.toast-region\{top:auto;bottom:88px\}/,
  "Sur tablette, la notification doit rester au-dessus de la navigation du bas"
);
console.log("KEYBOARD_ACCESSIBILITY_TESTS_OK");
