"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

assert.match(app, /const APP_VERSION = 23;/, "La V7 doit préserver et migrer la base locale");
assert.match(app, /const TRACKING_STATUSES = \["draft", "ready", "sent", "accepted", "refused", "expired"\]/, "Les statuts commerciaux doivent rester bornés");
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
for (const filter of ["all", "draft", "ready", "sent", "follow-up", "accepted", "refused", "expired"]) {
  assert.match(html, new RegExp(`data-tracking-filter="${filter}"`), `Filtre de suivi absent : ${filter}`);
}
assert.match(app, /data-tracking-toggle[\s\S]*?aria-expanded/, "Le triangle doit exposer son état aux technologies d’assistance");
assert.match(app, /renderTrackingTimeline[\s\S]*?tracking-timeline/, "La chronologie des statuts doit être rendue");
assert.match(app, /promptMarkCurrentQuoteAsSent\("E-mail"\)/, "L’envoi par e-mail doit proposer le statut Envoyé");
assert.match(app, /promptMarkCurrentQuoteAsSent\("WhatsApp"\)/, "L’envoi WhatsApp doit proposer le statut Envoyé");

for (const status of ["draft", "ready", "sent", "follow-up", "accepted", "refused", "expired"]) {
  assert.match(styles, new RegExp(`\\.history-item--${status.replace("-", "\\-")}\\{--tracking-color:`), `Couleur de statut absente : ${status}`);
}
assert.match(app, /class="history-status">\$\{escapeHTML\(visual\.label\)\}/, "Chaque couleur doit rester accompagnée du libellé du statut");
assert.match(styles, /\.history-item--tracked[\s\S]*?border-left:5px solid var\(--tracking-color\)/, "La couleur du dernier statut doit apparaître dans l’historique standard");

console.log("QUOTE_TRACKING_TESTS_OK");
