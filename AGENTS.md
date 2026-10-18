# BCDevis — Guide pour Agents IA (AGENTS.md)

Ce document fournit aux agents d'intelligence artificielle (Antigravity, Claude Code, Cursor, Copilot, ChatGPT, Codex, etc.) le contexte architectural, les contrats techniques et les consignes d'exécution nécessaires pour intervenir sur le projet BCDevis sans régression.

---

## 1. Contexte & Identité du Projet

- **Produit :** BCDevis (version 8.8.2 ; évolutions locales éventuelles : voir `../JOURNAL-DES-MODIFICATIONS.md`)
- **Entreprise :** Clinique Bellecour (Genève, Suisse — Rue du Mont-Blanc 20)
- **Domaine métier :** Devis médicaux et esthétiques (épilation laser, électrolyse, injections, peelings, etc.).
- **Devise monétaire :** Franc suisse (**CHF**), format suisse (`fr-CH` avec espaces insécables ou standard).
- **Cible de déploiement :**
  - Application locale portable Electron (`.exe` Windows sans installation requise, DMG macOS, AppImage Linux).
  - PWA Web responsive (ChromeOS, iPadOS, Safari, Chrome).
  - Serveur centralisé optionnel Node.js + PostgreSQL (`central-server/`).

---

## 2. Cartographie de l'Architecture

```text
BCD/
├── devis-portable/              # Frontend (Electron + PWA Web)
│   ├── app.js                   # Contrôleur principal UI / orchestration (Vanilla JS)
│   ├── quote-core.js            # Moteur pur de calcul financier (UMD, sans DOM)
│   ├── contact-core.js          # Moteur pur du carnet de contacts (UMD, sans DOM)
│   ├── contact-service.js       # Opérations du répertoire et persistance injectée (sans DOM)
│   ├── contacts-controller.js   # Écran Contacts : formulaire, recherche et événements
│   ├── tracking-core.js         # Moteur pur de suivi commercial & conversions (UMD)
│   ├── pdf-i18n.js              # Traductions du PDF en 8 langues (UMD, sans DOM)
│   ├── central-sync.js          # Client de synchronisation multi-postes (UMD)
│   ├── site-migration.js        # Assistant d'import/export inter-domaines (UMD)
│   ├── catalog.js               # Catalogue des catégories, soins par défaut et visuels
│   ├── body-anatomy.js          # Découpage anatomique SVG pour le sélecteur Mannequin
│   ├── main.cjs                 # Point d'entrée Electron (processus principal)
│   ├── preload.cjs              # Bridge Electron contextIsolation
│   ├── service-worker.js        # Cache et fonctionnement hors-ligne PWA
│   ├── index.html               # Structure de l'application desktop et mobile
│   ├── styles.css               # Design system et styles d'interface
│   ├── help.html / help.js      # Centre d'aide intégré
│   └── tests/                   # 27 suites de tests unitaires et d'intégration
├── central-server/              # Backend de synchronisation optionnel
│   ├── server.cjs               # API REST Express/HTTP centralisée
│   ├── database.cjs             # Couche d'accès PostgreSQL
│   ├── schema.sql               # Schéma SQL des tables
│   ├── migrations.cjs           # Gestionnaire de migrations versionnées
│   └── sync-merge.cjs           # Algorithmes de fusion sans conflit
├── scripts/                     # Scripts de build, génération PDF et captures
├── types/                       # Définitions TypeScript (types/bcdevis.d.ts)
└── .agents/                     # Règles et compétences spécialisées Antigravity
```

---

## 3. Règle d'or : Isolation des Modules Métier

Ne **JAMAIS** mélanger la logique de calcul ou de validation métier avec les manipulations du DOM.
Le projet suit une séparation stricte :

1. **`quote-core.js` (`window.QuoteCore`) :**
   - Fonctions pures : `calculate(quote)`, `installmentMonths(total)`, `referenceLineTotal(line)`, `customLineDiscount(line, studentRate)`, `percentToReachUnitPrice(line, prixCible)` (rabais en % d’un prix spécial, ex. SIF combiné à 62 CHF).
   - Tout changement dans les formules de calcul **doit** être testé via `devis-portable/tests/core.test.cjs`.

2. **`contact-core.js` (`window.BCDevisContacts`) :**
   - Fonctions pures : `sanitizeContact()`, `mergeContacts()`, `toCsv()`, `toVCard()`, `parseVCard()`, `parseContactFile()`.
   - Champs : `source` (provenance, premier canal conservé à la fusion) et, hors formulaire, `request` / `requestedAt` / `requestHandledAt` (demandes reçues du site). `pendingRequests(contacts, quotes)` alimente « À faire › Nouvelles demandes » : demande ouverte tant qu'elle n'est pas traitée et qu'aucun devis du contact n'a été créé depuis.
   - L'import CSV réunit des colonnes Prénom / Nom séparées (`firstName` / `lastName`) ; un « Nom » seul reste le nom complet.
   - Testé via `devis-portable/tests/contact-core.test.cjs`.
   - `contact-service.js` compose ces opérations et la sauvegarde injectée ; `contacts-controller.js` possède l'état de l'écran et ses événements. Les accès à la base et au devis sont des fonctions pour supporter les restaurations. Tests métier du service : `tests/contact-service.test.cjs`. Suite du découpage : [docs/PLAN-MODULARISATION.md](docs/PLAN-MODULARISATION.md).

3. **`tracking-core.js` (`window.BCDevisTracking`) :**
   - Gestion des états : `"draft"` -> `"ready"` -> `"sent"` -> `"accepted"` / `"refused"` / `"expired"` -> `"invoiced"`.
   - Fonctions pures : `consolidateOpportunities()`, `summarizeConversion()`, `monthlyConversion()`, `periodRange()`, `exportConversionCSV()`, `followUpCount()`, motifs de perte `LOSS_REASONS`.
   - Une relance n'est comptée que si un événement `type: "contact"` (bouton « Relance faite ») existe dans la chronologie.
   - `matchInvoiceFiles(noms, devis)` rattache des factures PDF à leur devis (référence `date + poste + séquence` dans le nom, sinon nom complet du client ayant un seul devis accepté). Statuts : `ok`, `unmatched`, `ambiguous`, `duplicate`, `already-invoiced`, `not-accepted` ; elle ne devine jamais.
   - Testé via `devis-portable/tests/tracking-core.test.cjs`.

4. **`pdf-i18n.js` (`window.BCDevisPdfI18n`) :**
   - Langues du PDF : `fr`, `en`, `de` (Suisse), `it`, `es`, `pt`, `uk`, `ru`. Tout texte du PDF vient de `strings(langue)` ; aucun `en ? "…" : "…"` dans `renderPrint()`.
   - Ajouter une langue : l'entrée de `LANGUAGES`, ses `STRINGS`, `CATEGORY_NAMES`, `SERVICE_NAMES` (tous les identifiants de `catalog.js`) et `DEFAULT_TEXTS`, puis l'option du réglage `pdfLanguage` dans `index.html`. Le test `pdf-i18n.test.cjs` signale les oublis.
   - Le cyrillique n'existe ni dans DM Sans (police par défaut) ni dans Red Hat Display : `uk` et `ru` utilisent Roboto (`assets/roboto-cyrillic.woff2`).
   - Tout nouveau script chargé par `index.html` doit être ajouté à `scripts/build-chromeos.cjs` (`APP_FILES`) et au précache de `service-worker.js` ; `platform-delivery.test.cjs` le vérifie.

---

## 4. Guide de Navigation dans `devis-portable/app.js`

`app.js` est le renderer principal (~6 940 lignes). Pour éviter d'inonder la fenêtre de contexte d'un agent, recherchez directement les fonctions et blocs suivants. Les lignes sont indicatives et changent lors des extractions :

| Section / Domaine | Fonctions clés | Lignes indicatives |
|---|---|---|
| **Constantes & Stockage** | `STORAGE_KEY = "bcdevis-v1"`, `defaultSettings` | L. 1 – 200 |
| **Calcul du devis** | `calculateQuote()`, `taxInformationEnabled()` | L. 200 – 250 |
| **Initialisation & Schéma** | `freshDatabase()`, `migrateDatabase()` | L. 210 – 350 |
| **Rendu Catalogue** | `renderCatalog()`, `addService()`, `renderBodySelector()` | L. 1980 – 2100 |
| **Panier & Lignes** | `renderCart()`, `quantityStepper()`, `openLineDiscountLayer()` | L. 2140 – 2510 |
| **Totaux & En-tête** | `renderTotals()`, `renderHeader()`, `renderQuoteSaveState()` | L. 2200 – 2300 |
| **Thème & Affichage** | `applyTheme()`, `applyFont()`, `applyIpadLayout()`, `applyDisplayMode()` | L. 2310 – 2390 |
| **Modales & Focus** | `openLayer()`, `closeLayer()`, `trapLayerFocus()` | L. 2530 – 2620 |
| **Répertoire Contacts** | `contact-service.js` : `save()`, `importContacts()` ; `contacts-controller.js` : `renderContactDirectory()`, `selectContact()`, `bind()` | Modules extraits de `app.js` |
| **Suivi Commercial** | `updateQuoteTracking()`, `recordTrackingContact()`, `renderTrackingQuickActions()`, `runTrackingQuickAction()`, `renderTrackingStats()`, `renderHistory()` | L. 2775 – 3610 |
| **Factures groupées** | `importInvoiceBatch()`, `invoiceCandidates()`, `invoiceMatchLine()` | L. 1288 – 1360 |
| **Nouvelles demandes** | `openContactRequests()`, `renderRequestSection()`, `createQuoteFromRequest()`, `markContactRequestHandled()` | L. 3336, 3812 – 3850, 3968 – 3995 |
| **Import / Export** | `exportQuote()`, `downloadJSON()`, `exportBackup()`, `restoreLocalDatabase()` | L. 3250 – 3360 |
| **Éditeur de Tuiles** | `openTileCatalogEditor()`, `saveTileCatalogEditor()` | L. 3400 – 3630 |
| **Paramètres / Réglages** | `fillSettingsForm()`, `refreshSettingsPreview()`, `setSettingsTab()` | L. 3740 – 3900 |
| **Impression & PDF** | `renderPrint()`, `printQuote()`, `togglePdfLanguage()` | L. 3900 – 4100 |
| **Partage & WhatsApp** | `transmissionMessage()`, `emailSubject()`, `outlookWebComposeUrl()` | L. 4100 – 4250 |

---

## 5. Contrats Techniques et Invariants Cruciaux

1. **Rétrocompatibilité du stockage (`localStorage`) :**
   - La clé primaire est `"bcdevis-v1"`.
   - Ne jamais altérer la structure racine sans écrire une migration ascendante dans `app.js` (les clés historiques `"bellecour-atelier-devis-v1/v2/v3"` sont toujours supportées).
2. **Accessibilité & Ergonomie Tactile :**
   - Toutes les cibles tactiles sur smartphone et iPad doivent mesurer **au moins 44×44 px**.
   - Pas de survol exclusif (hover) : toute action doit rester accessible au tap / clavier.
   - Les contrats de thème et de contraste sont vérifiés par `tests/theme-contracts.test.cjs`.
   - **Univers du site :** le thème par défaut `white` s'affiche « Bellecour » et reprend les couleurs de site-crm (`cliniquebellecour.ch`) ; la couche « Univers Bellecour » à la fin du `<style>` de `index.html` (pilules, pictogrammes bronze) ne vise que ce thème. Dans ce thème, `--accent` est un gris chaud (`#8f8b7f`) pour les cadres, anneaux et pastilles ; les sélections remplies utilisent `--select-bg` (gris léger) avec un texte en encre, et les icônes gardent leur couleur ; le mannequin et le visage redéfinissent `--accent` en bronze. Le noir (`--action`, `--contrast`) reste réservé aux actions. DM Sans (`assets/dm-sans-*.woff2`) est la police par défaut. `alignAppearanceWithSite()` fait passer une seule fois à DM Sans les postes restés sur Red Hat Display (`appearanceRevision`, sans changer le schéma 25). La marque à arches de l'en-tête (`#icon-bellecour-arches`, `.brand-mark`) suit `currentColor` et se masque entre 1181 et 1260 px, où le sélecteur de tarif a besoin de la place.
3. **Absence de Framework externe dans le frontend :**
   - Pas de React, pas de Vue, pas de Tailwind. Vanilla JavaScript + Vanilla CSS avec variables personnalisées (`:root { --font-main: ... }`).
4. **Langue de l'interface vs Documents :**
   - Interface : exclusivement en **français**.
   - Export PDF : bilingue (français ou anglais selon le paramètre `pdfLanguage`).

---

## 6. Commandes de Validation pour les Agents

Avant de valider ou proposer un changement, l'agent **doit impérativement exécuter** la vérification appropriée :

```powershell
# Vérification rapide de syntaxe (1s) :
npm run check:fast

# Vérification rapide de la logique métier pure (200ms) :
npm run test:core

# Vérification complète de conformité (syntaxe + 27 suites de tests) :
npm run check

# Lancer la suite de tests complète :
npm test
```
