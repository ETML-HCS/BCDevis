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
assert.match(html, /<script src="tracking-core\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/, "Le moteur de conversion doit être chargé avant l’application");

for (const setting of [
  "quoteTrackingEnabled",
  "validityDays",
  "trackingDefaultFollowUpDays",
  "trackingRemindersOnStartup",
  "trackingShowFilters"
]) {
  assert.match(html, new RegExp(`name="${setting}"`), `Réglage de suivi absent : ${setting}`);
  assert.match(app, new RegExp(setting), `Persistance du réglage absente : ${setting}`);
}

assert.match(html, /id="historyTabs" role="tablist"[\s\S]*?data-history-view="tracking"[^>]*>À faire[\s\S]*?data-history-view="history"[^>]*>Tous les devis[\s\S]*?data-history-view="stats"/, "À faire, Tous les devis et Statistiques doivent être des vues accessibles, la liste de travail en premier");
assert.match(app, /function openHistoryLayer\(\) \{[\s\S]*?activeHistoryView = "tracking";[\s\S]*?activeTrackingFilter = "today";/, "Mes devis doit s’ouvrir sur la liste À faire lorsque le suivi est actif");
assert.match(app, /historyCardView: false/, "Le tableau doit être l’affichage par défaut");
assert.match(html, /id="historyCardsOption"[\s\S]*?Affichage en cartes/, "Une option doit proposer l’affichage en cartes");
assert.doesNotMatch(html, /historyCompactOption/, "L’affichage compact est remplacé par le tableau");
assert.match(app, /function renderHistoryTable\(items, trackingActive\)[\s\S]*?aria-sort[\s\S]*?data-history-sort/, "Tous les devis doit être un tableau triable par colonne, avec l’état du tri annoncé");
assert.match(app, /HISTORY_COLUMNS = \[\s*\{ key: "client"[\s\S]*?\{ key: "date"[\s\S]*?\{ key: "number"[\s\S]*?\{ key: "lines"[\s\S]*?\{ key: "amount"[\s\S]*?\{ key: "status"/, "Le client doit être la première colonne du tableau");
assert.match(app, /function renderTrackingTable\(items\)[\s\S]*?tracking-detail-row[\s\S]*?data-detail-for/, "La liste À faire doit être un tableau dont le détail s’ouvre sous la ligne");
assert.match(app, /const searching = Boolean\(historyQuery\.trim\(\)\);[\s\S]*?const queueView = enabled && activeHistoryView === "tracking" && !searching/, "Une recherche doit porter sur tous les devis, pas seulement la liste À faire");
assert.match(app, /TRACKING_SECTION_LIMIT = 5;[\s\S]*?data-tracking-more/, "Une section de la liste À faire doit rester courte et se déplier à la demande");
assert.match(app, /let activeStatsPeriod = "year"/, "Les statistiques doivent s’ouvrir sur 12 mois, plus stables qu’un seul mois");
assert.match(app, /tracking-stats-caution/, "Un faible volume de devis doit être signalé dans les statistiques");
assert.match(styles, /#historyLayer #historyList\.history-list--table\{display:block/, "Le tableau doit occuper toute la largeur de l’espace de travail");
assert.match(styles, /@media screen and \(max-width:700px\)\{[\s\S]*?\.history-row\{display:grid/, "Le tableau doit se transformer en lignes lisibles sur téléphone");
assert.match(styles, /\.tracking-due--late\{color:#a54f00\}/, "Un retard ne doit pas s’afficher en rouge d’alerte");
assert.match(html, /class="drawer history-workspace"[\s\S]*?id="historyWorkspaceDescription"/, "Le suivi doit disposer d’un espace de travail autonome dans l’interface");
assert.match(html, /id="historySearch"[\s\S]*?N° devis, client, téléphone ou e-mail/, "L’historique doit pouvoir rechercher les coordonnées et la référence du devis");
assert.match(html, /id="historySort"[\s\S]*?value="updated"[\s\S]*?value="date"[\s\S]*?value="client"[\s\S]*?value="amount"/, "L’historique doit proposer les tris métier");
assert.match(app, /function historySearchMatches\(item[\s\S]*?item\.client\?\.phone[\s\S]*?item\.client\?\.email/, "La recherche d’historique doit couvrir numéro, client, téléphone et e-mail");
assert.match(app, /function sortHistoryQuotes\(items\)[\s\S]*?historySort === "date"[\s\S]*?historySort === "client"[\s\S]*?historySort === "amount"/, "Les tris d’historique doivent être calculés dans le renderer");
assert.match(app, /const \{ startDate, endDate \} = periodRange\(activeStatsPeriod, todayISO\(\)\);\s*const stats = summarizeConversion\(quotes, \{ startDate, endDate, amountOf: quoteAmount \}\)/, "Les statistiques doivent réutiliser le calcul de conversion testé sur la période choisie");
assert.match(app, /data-stats-period[\s\S]*?data-stats-export/, "Les statistiques doivent proposer un choix de période et un export CSV");
assert.match(app, /monthlyConversion\(quotes, \{ endDate: todayISO\(\), months: 6, amountOf: quoteAmount \}\)/, "La tendance mensuelle doit réutiliser le moteur testé");
assert.match(app, /filters\.hidden = !enabled \|\| activeHistoryView !== "tracking" \|\| db\.settings\.trackingShowFilters !== true/, "Les filtres avancés doivent être facultatifs");
assert.match(app, /statsTab\.hidden = !enabled;/, "L’onglet Statistiques doit être disponible avec le suivi");
assert.doesNotMatch(html, /id="trackingSummary"|name="trackingShowCounters"|name="trackingShowStats"/, "Le suivi ne doit pas afficher ni configurer de statistiques");
for (const filter of ["today", "all", "draft", "ready", "sent", "follow-up", "accepted", "refused", "expired"]) {
  assert.match(html, new RegExp(`data-tracking-filter="${filter}"`), `Filtre de suivi absent : ${filter}`);
}
assert.match(app, /function trackingTodaySections\(items\)[\s\S]*?À relancer[\s\S]*?Acceptés à facturer[\s\S]*?Prêts à envoyer[\s\S]*?Brouillons à terminer/, "La vue Aujourd’hui doit prioriser les quatre files d’action");
assert.match(app, /tracking-today-section[\s\S]*?const todayQueue = queueView && activeTrackingFilter === "today"/, "Le filtre Aujourd’hui doit afficher des sections d’action dédiées");
assert.match(app, /let activeTrackingFilter = "today"/, "La file Aujourd’hui doit ouvrir le suivi par défaut");
assert.match(app, /tracking-today-action[\s\S]*?data-tracking-toggle/, "Chaque élément de la file Aujourd’hui doit proposer une action directe de traitement");
assert.match(app, /En attente de réponse[\s\S]*?actionable: false/, "Les devis envoyés sans relance due doivent rester visibles sans compter comme des actions");
for (const action of ["ready", "sent", "contact", "accepted", "refused", "invoiced"]) {
  assert.match(app, new RegExp(`(quick|data-tracking-quick=)\\("?${action}"?`), `Action rapide absente : ${action}`);
}
assert.doesNotMatch(app, /action === "accepted"\) \{\s*if \(!window\.confirm/, "Une acceptation rapide ne doit pas interrompre par une boîte de dialogue");
assert.match(app, /action === "invoiced"\) \{\s*if \(!window\.confirm/, "La facturation, qui sort le devis du suivi, doit rester confirmée");
assert.match(app, /trackingDetailedView: false/, "Le suivi doit s’ouvrir en affichage simple par défaut");
assert.match(html, /id="historyDetailedTrackingOption"[\s\S]*?Affichage détaillé du suivi/, "Une option doit réafficher tous les détails du suivi");
assert.match(app, /escapeHTML\(item\.client\?\.name \|\| item\.number\)\}<\/strong><b>\$\{money\(totals\.total\)\}<\/b><\/span>[\s\S]{0,200}?escapeHTML\(progress\.short\)/, "La fiche simple ne montre que le client, le montant et l’échéance");
assert.match(app, /data-tracking-refuse="\$\{reason\}"/, "Le refus doit proposer les motifs en un clic");
assert.match(app, /const collapsible = !section\.actionable;[\s\S]*?waitingSectionOpen/, "Les devis en attente de réponse doivent être repliés en affichage simple");
assert.match(app, /<details class="tracking-stats-more" data-stats-more/, "Les statistiques avancées doivent être repliées en affichage simple");
assert.match(app, /actionLabel: "Annuler", onAction: \(\) => restoreTrackedQuote\(before\)/, "Une action rapide réversible doit pouvoir être annulée depuis la notification");
assert.match(app, /function recordTrackingContact\(item[\s\S]*?type: "contact"/, "Une relance confirmée doit être enregistrée dans la chronologie");
assert.match(app, /type: \["status", "note", "follow-up", "contact"\]\.includes\(type\)/, "Les relances confirmées doivent survivre au nettoyage des événements");
assert.match(app, /lossReason: \["refused", "expired"\]\.includes\(status\) \? lossReasonKey\(source\.lossReason\) : ""/, "Le motif de perte importé doit être borné");
assert.match(app, /name="trackingReason"/, "Le refus doit proposer un motif structuré");
assert.match(app, /data-tracking-contact[\s\S]*?prepareWhatsAppShare\(\{ phone: number, text: message \}\)/, "La relance WhatsApp doit ouvrir la conversation avec un message prérempli");
assert.match(app, /centralArchiveConnected\(\)[\s\S]*?data-tracking-invoice[\s\S]*?quick\("invoiced"/, "Un poste local doit pouvoir clôturer un devis accepté sans archivage central");
assert.match(styles, /history-list\.tracking-today-queue[\s\S]*?flex-direction:column/, "La file Aujourd’hui doit garder ses sections verticalement lisibles");
assert.match(app, /data-tracking-toggle[\s\S]*?aria-expanded/, "Le triangle doit exposer son état aux technologies d’assistance");
assert.match(app, /function isTouchTrackingActivation\(event\)[\s\S]*?event\?\.pointerType === "touch"[\s\S]*?hover: none/, "Un toucher sur la fiche doit être distingué du clic avec une souris");
assert.match(app, /touchCard && isTouchTrackingActivation\(event\)[\s\S]*?toggleTrackingDetails\(touchCard\.dataset\.quoteId\)/, "La fiche tactile doit ouvrir ou refermer son suivi");
assert.match(app, /data-tracking-open-quote/, "Le détail doit conserver une action explicite pour ouvrir le devis");
assert.match(app, /expanded \? "is-expanded" : ""/, "Le devis ouvert doit pouvoir occuper toute la largeur de l’espace de suivi");
assert.match(app, /class="history-item history-item--archive/, "L’Historique doit utiliser une carte d’archive compacte");
assert.match(app, /const queueView = enabled && activeHistoryView === "tracking" && !searching/, "Les fiches de suivi détaillées doivent rester réservées à l’onglet Suivi");
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
assert.match(styles, /\.quote-save-state\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?font-size:10px/, "L’état d’enregistrement doit rester discret mais lisible dans la caisse");
assert.match(html, /id="invoiceLibraryButton"[\s\S]*?data-tooltip="Factures partagées"[\s\S]*?#icon-invoice/, "La vue Factures centrale doit utiliser un pictogramme pertinent");
assert.match(html, /id="pdfLibraryPrintButton"/, "Une facture archivée doit pouvoir être imprimée");

for (const status of ["draft", "ready", "sent", "follow-up", "accepted", "refused", "expired", "invoiced"]) {
  assert.match(styles, new RegExp(`\\.history-item--${status.replace("-", "\\-")}\\{--tracking-color:`), `Couleur de statut absente : ${status}`);
}
assert.match(app, /class="history-status">\$\{escapeHTML\(visual\.label\)\}/, "Chaque couleur doit rester accompagnée du libellé du statut");
assert.match(styles, /\.history-item--tracked[\s\S]*?border-left:5px solid var\(--tracking-color\)/, "La couleur du dernier statut doit apparaître dans le suivi commercial");
assert.match(styles, /\.history-item--archive \.history-status--commercial\{color:#fff;background:var\(--tracking-color\)/, "Le tag de statut doit rester visible dans l’Historique compact");
assert.match(styles, /html\[data-theme\] \.history-item\.history-item--tracked\{[^}]*border-left-color:var\(--tracking-color\)/, "Le thème ne doit pas masquer la couleur du dernier statut");
assert.match(styles, /html\[data-theme\] \.history-item--tracked \.history-status,html\[data-theme\] \.history-item--archive \.history-status--commercial\{color:#fff;background:var\(--tracking-color\)/, "Le thème ne doit pas noircir les tags de statut");
assert.match(styles, /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?#historyList \.tracking-quick,#historyList \.tracking-period button\{min-height:44px\}[\s\S]*?#historyList \.tracking-contact\{width:44px;height:44px\}/, "Les actions rapides doivent offrir des cibles tactiles de 44 px");
assert.match(html, /<symbol id="icon-phone"/, "La relance téléphonique doit disposer d’un pictogramme");
assert.match(styles, /@media \(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\.history-disclosure\{opacity:0[\s\S]*?\.history-item--tracked:hover \.history-disclosure/, "Le bouton d’ouverture doit apparaître au survol avec une souris");
assert.match(styles, /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?\.history-item-summary\{grid-template-columns:1fr\}[\s\S]*?\.history-disclosure\{display:none\}/, "La fiche complète doit devenir la cible sur écran tactile");
assert.match(styles, /#historyLayer\.tracking-enabled \.history-workspace\{[\s\S]*?width:min\(1180px,calc\(100vw - 48px\)\)[\s\S]*?height:min\(900px,calc\(100vh - 48px\)\)/, "Le suivi doit utiliser un véritable espace de travail large");
assert.match(styles, /\.history-item--tracked\.is-expanded[\s\S]*?grid-column:1\/-1[\s\S]*?grid-template-columns:minmax\(270px,\.7fr\) minmax\(0,2fr\)/, "La fiche ouverte doit séparer son résumé de sa zone de travail");

console.log("QUOTE_TRACKING_TESTS_OK");
