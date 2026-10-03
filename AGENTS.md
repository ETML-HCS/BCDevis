# BCDevis — Guide pour Agents IA (AGENTS.md)

Ce document fournit aux agents d'intelligence artificielle (Antigravity, Claude Code, Cursor, Copilot, ChatGPT, Codex, etc.) le contexte architectural, les contrats techniques et les consignes d'exécution nécessaires pour intervenir sur le projet BCDevis sans régression.

---

## 1. Contexte & Identité du Projet

- **Produit :** BCDevis (version 8.6.2+)
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
│   └── tests/                   # 23 suites de tests unitaires et d'intégration
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
   - Fonctions pures : `calculate(quote)`, `installmentMonths(total)`, `referenceLineTotal(line)`, `customLineDiscount(line, studentRate)`.
   - Tout changement dans les formules de calcul **doit** être testé via `devis-portable/tests/core.test.cjs`.

2. **`contact-core.js` (`window.BCDevisContacts`) :**
   - Fonctions pures : `sanitizeContact()`, `mergeContacts()`, `exportCSV()`, `exportVCard()`, `parseVCard()`.
   - Testé via `devis-portable/tests/contact-core.test.cjs`.

3. **`tracking-core.js` (`window.BCDevisTracking`) :**
   - Gestion des états : `"draft"` -> `"ready"` -> `"sent"` -> `"accepted"` / `"refused"` / `"expired"` -> `"invoiced"`.
   - Fonctions pures : `consolidateOpportunities()`, `summarizeConversion()`, `monthlyConversion()`, `periodRange()`, `exportConversionCSV()`, `followUpCount()`, motifs de perte `LOSS_REASONS`.
   - Une relance n'est comptée que si un événement `type: "contact"` (bouton « Relance faite ») existe dans la chronologie.
   - Testé via `devis-portable/tests/tracking-core.test.cjs`.

4. **`pdf-i18n.js` (`window.BCDevisPdfI18n`) :**
   - Langues du PDF : `fr`, `en`, `de` (Suisse), `it`, `es`, `pt`, `uk`, `ru`. Tout texte du PDF vient de `strings(langue)` ; aucun `en ? "…" : "…"` dans `renderPrint()`.
   - Ajouter une langue : l'entrée de `LANGUAGES`, ses `STRINGS`, `CATEGORY_NAMES`, `SERVICE_NAMES` (tous les identifiants de `catalog.js`) et `DEFAULT_TEXTS`, puis l'option du réglage `pdfLanguage` dans `index.html`. Le test `pdf-i18n.test.cjs` signale les oublis.
   - Le cyrillique n'existe pas dans Red Hat Display : `uk` et `ru` utilisent Roboto (`assets/roboto-cyrillic.woff2`).
   - Tout nouveau script chargé par `index.html` doit être ajouté à `scripts/build-chromeos.cjs` (`APP_FILES`) et au précache de `service-worker.js` ; `platform-delivery.test.cjs` le vérifie.

---

## 4. Guide de Navigation dans `devis-portable/app.js`

`app.js` est le renderer principal (~5 900 lignes). Pour éviter d'inonder la fenêtre de contexte d'un agent, recherchez directement les fonctions et blocs suivants :

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
| **Répertoire Contacts** | `renderContactDirectory()`, `selectContact()`, `upsertContactFromForm()` | L. 2630 – 2750 |
| **Suivi Commercial** | `updateQuoteTracking()`, `recordTrackingContact()`, `renderTrackingQuickActions()`, `runTrackingQuickAction()`, `renderTrackingStats()`, `renderHistory()` | L. 2775 – 3610 |
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

# Vérification complète de conformité (syntaxe + 22 suites de tests) :
npm run check

# Lancer la suite de tests complète :
npm test
```
