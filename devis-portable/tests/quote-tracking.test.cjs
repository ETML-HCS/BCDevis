"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

assert.match(app, /const APP_VERSION = 25;/, "La V7 doit préserver et migrer la base locale");
assert.match(app, /const TRACKING_STATUSES = \["draft", "ready", "sent", "accepted", "refused", "expired", "invoiced"\]/, "Les statuts commerciaux doivent rester bornés");
assert.match(app, /accepted: \["invoiced"\]/, "Seule une facture envoyée doit clôturer un devis accepté");
assert.match(app, /draft: \["ready"\],[\s\S]*?ready: \["sent", "expired"\],[\s\S]*?sent: \["accepted", "refused", "expired"\]/, "Le parcours commercial ne doit proposer aucune rétrogradation");
assert.match(app, /TRACKING_TERMINAL_STATUSES = \["accepted", "refused", "expired", "invoiced"\]/, "Les devis terminaux doivent être verrouillés");
assert.match(app, /const canUndo = !quoteIsLocked\(item\)/, "Un devis terminal ne doit pas pouvoir être rétrogradé par annulation");
assert.match(app, /status: "draft"[\s\S]*?tracking: freshTracking/, "Le statut de sauvegarde et le suivi commercial doivent rester séparés");
assert.match(app, /tracking: sanitizeTracking\(source\.tracking/, "Les suivis importés doivent être nettoyés");
assert.match(app, /MAX_TRACKING_EVENTS = 300/, "La chronologie locale doit rester bornée");

for (const setting of [
  "quoteTrackingEnabled",
  "validityDays",
  "trackingDefaultFollowUpDays",
  "trackingRemindersOnStartup",
  "trackingShowCounters"
]) {
  assert.match(html, new RegExp(`name="${setting}"`), `Réglage de suivi absent : ${setting}`);
  assert.match(app, new RegExp(setting), `Persistance du réglage absente : ${setting}`);
}

assert.match(html, /id="historyTabs" role="tablist"[\s\S]*?data-history-view="history"[\s\S]*?data-history-view="tracking"/, "Historique et Suivi doivent être deux vues accessibles");
assert.match(html, /class="drawer history-workspace"[\s\S]*?id="historyWorkspaceDescription"/, "Le suivi doit disposer d’un espace de travail autonome dans l’interface");
for (const filter of ["all", "draft", "ready", "sent", "follow-up", "accepted", "refused", "expired"]) {
  assert.match(html, new RegExp(`data-tracking-filter="${filter}"`), `Filtre de suivi absent : ${filter}`);
}
assert.match(app, /data-tracking-toggle[\s\S]*?aria-expanded/, "Le triangle doit exposer son état aux technologies d’assistance");
assert.match(app, /function isTouchTrackingActivation\(event\)[\s\S]*?event\?\.pointerType === "touch"[\s\S]*?hover: none/, "Un toucher sur la fiche doit être distingué du clic avec une souris");
assert.match(app, /touchCard && isTouchTrackingActivation\(event\)[\s\S]*?toggleTrackingDetails\(touchCard\.dataset\.quoteId\)/, "La fiche tactile doit ouvrir ou refermer son suivi");
assert.match(app, /data-tracking-open-quote/, "Le détail doit conserver une action explicite pour ouvrir le devis");
assert.match(app, /expanded \? "is-expanded" : ""/, "Le devis ouvert doit pouvoir occuper toute la largeur de l’espace de suivi");
assert.match(app, /class="history-item history-item--archive/, "L’Historique doit utiliser une carte d’archive compacte");
assert.match(app, /const trackingView = enabled && activeHistoryView === "tracking"/, "Les fiches de suivi détaillées doivent rester réservées à l’onglet Suivi");
assert.match(app, /trackingActive \? `<span class="history-status history-status--commercial">\$\{escapeHTML\(visual\.label\)\}<\/span>` : ""/, "L’Historique doit afficher uniquement le tag commercial lorsque le suivi est actif");
assert.match(app, /renderTrackingTimeline[\s\S]*?tracking-timeline/, "La chronologie des statuts doit être rendue");
assert.match(app, /promptMarkCurrentQuoteAsSent\("E-mail"\)/, "L’envoi par e-mail doit proposer le statut Envoyé");
assert.match(app, /promptMarkCurrentQuoteAsSent\("WhatsApp"\)/, "L’envoi WhatsApp doit proposer le statut Envoyé");
assert.match(app, /data-tracking-invoice/, "Un devis accepté doit proposer l’import de sa facture envoyée");
assert.match(app, /const result = await centralController\.uploadDocument\([\s\S]*?if \(kind === "invoice" && completeWorkflow/, "Le devis ne doit quitter le suivi qu’après l’archivage réussi de la facture");
assert.match(app, /filename: `\$\{invoiceNumber\}\.pdf`/, "Le fichier de facture doit reprendre la référence du devis avec son propre préfixe");
assert.match(app, /data-tracking-revision/, "Un devis verrouillé doit proposer une nouvelle version");
assert.match(app, /actor: String\(actor/, "Les changements de suivi doivent conserver leur auteur");
assert.match(html, /id="quoteSaveState"[\s\S]*?id="quoteDateControl"/, "La caisse doit conserver uniquement l’enregistrement et la date");
assert.doesNotMatch(html, /id="quoteTrackingState"|id="quoteLockedState"|quote-state-caption">Suivi commercial</, "Le suivi commercial, le verrouillage et la version ne doivent pas surcharger la caisse");
assert.match(styles, /\.quote-save-state\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?font-size:8px/, "L’état d’enregistrement doit rester discret dans la caisse");
assert.match(html, /id="invoiceLibraryButton"[\s\S]*?data-tooltip="Factures partagées"[\s\S]*?#icon-invoice/, "La vue Factures centrale doit utiliser un pictogramme pertinent");
assert.match(html, /id="pdfLibraryPrintButton"/, "Une facture archivée doit pouvoir être imprimée");

for (const status of ["draft", "ready", "sent", "follow-up", "accepted", "refused", "expired", "invoiced"]) {
  assert.match(styles, new RegExp(`\\.history-item--${status.replace("-", "\\-")}\\{--tracking-color:`), `Couleur de statut absente : ${status}`);
}
assert.match(app, /class="history-status">\$\{escapeHTML\(visual\.label\)\}/, "Chaque couleur doit rester accompagnée du libellé du statut");
assert.match(styles, /\.history-item--tracked[\s\S]*?border-left:5px solid var\(--tracking-color\)/, "La couleur du dernier statut doit apparaître dans le suivi commercial");
assert.match(styles, /\.history-item--archive \.history-status--commercial\{color:#fff;background:var\(--tracking-color\)/, "Le tag de statut doit rester visible dans l’Historique compact");
assert.match(styles, /@media \(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\.history-disclosure\{opacity:0[\s\S]*?\.history-item--tracked:hover \.history-disclosure/, "Le bouton d’ouverture doit apparaître au survol avec une souris");
assert.match(styles, /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?\.history-item-summary\{grid-template-columns:1fr\}[\s\S]*?\.history-disclosure\{display:none\}/, "La fiche complète doit devenir la cible sur écran tactile");
assert.match(styles, /#historyLayer\.tracking-enabled \.history-workspace\{[\s\S]*?width:min\(1180px,calc\(100vw - 48px\)\)[\s\S]*?height:min\(900px,calc\(100vh - 48px\)\)/, "Le suivi doit utiliser un véritable espace de travail large");
assert.match(styles, /\.history-item--tracked\.is-expanded[\s\S]*?grid-column:1\/-1[\s\S]*?grid-template-columns:minmax\(270px,\.7fr\) minmax\(0,2fr\)/, "La fiche ouverte doit séparer son résumé de sa zone de travail");

console.log("QUOTE_TRACKING_TESTS_OK");
