---
name: bcdevis-dev
description: >-
  Workflows de développement pour BCDevis : commandes de test, vérification syntaxique, ajout de soins dans le catalogue, migrations PostgreSQL et build des exécutables.
---

# BCDevis — Procédures de Développement et Workflows

Ce guide pas-à-pas décrit comment effectuer les opérations courantes sur le projet.

## 1. Exécution et Tests

### Vérification de syntaxe (rapide)
```powershell
npm run check:fast
```

### Tests unitaires du cœur de calcul (rapide, ~200ms)
```powershell
npm run test:core
```

### Vérification complète (syntaxe + 22 suites de tests)
```powershell
npm run check
```

---

## 2. Ajouter un Soin au Catalogue

1. Ouvrir `devis-portable/catalog.js`.
2. Repérer la catégorie correspondante dans `QUOTE_CATEGORIES` (ex: id 13 pour Épilation laser, 16 pour Injections).
3. Ajouter ou modifier le soin dans `DEFAULT_SERVICES` (ou le tableau concerné) avec un identifiant unique `id` non utilisé.
4. Si le soin a un visuel d'anatomie / zone, l'associer dans `PRESTATION_VISUALS`.
5. Lancer `npm test` pour s'assurer qu'aucun test d'invariance n'échoue.

---

## 3. Modifier la Génération PDF

1. Les fonctions d'impression et de rendu PDF se trouvent dans `devis-portable/app.js` (autour de la ligne 3900 : `renderPrint`, `printQuote`).
2. En mode bilingue (`pdfLanguage === "en"`), les traductions sont appliquées via `printServiceName` et `printOfferLabel`.
3. Valider avec :
```powershell
node devis-portable/tests/pdf-language.test.cjs
node devis-portable/tests/pdf-main.test.cjs
```

---

## 4. Évolution du Serveur Central et de la Base PostgreSQL

1. Le schéma SQL se trouve dans `central-server/schema.sql`.
2. Les migrations séquentielles sont gérées dans `central-server/migrations.cjs`.
3. Ne jamais altérer une migration déjà déployée : créer une nouvelle étape numérotée dans `migrations.cjs`.
4. Tester l'intégration PostgreSQL en mémoire :
```powershell
npm run test:central:postgres
```
