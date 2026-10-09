# BCDevis — Modularisation progressive

État du code local au 9 octobre 2026, version 8.7.1. Périmètre : BCDevis, utilisé en local, avec la même interface et les mêmes formats de données.

## Diagnostic

Avant ce lot, `devis-portable/app.js` comptait **7 098 lignes**, 370 fonctions déclarées au niveau du contrôleur et 174 appels à `addEventListener`. Les fonctions individuelles sont généralement courtes : la plus longue mesure environ 95 lignes. La difficulté vient du nombre de responsabilités qui partagent `db`, le devis courant et le DOM.

Des modules existent déjà et doivent être réutilisés : `quote-core.js` pour les calculs, `contact-core.js` pour les formats et les fusions de contacts, `tracking-core.js` pour les statistiques et le rapprochement des factures, `pdf-i18n.js`, `currency-core.js`, `central-sync.js` et `site-migration.js`.

Un service porte une opération métier, par exemple enregistrer un contact ou réviser un devis. Un contrôleur porte un écran : affichage, clics, saisie et focus. Extraire seulement les fonctions dans un fichier recevant toutes les variables de `app.js` conserverait les mêmes dépendances.

## Premier lot réalisé : le répertoire

| Fichier | Responsabilité |
| --- | --- |
| `contact-core.js` | Normalisation, fusion d'une fiche, formats CSV/vCard/JSON et calcul des demandes ouvertes. |
| `contact-service.js` | Liste, enregistrement et association au devis, import, export, suppression et retour à l'état précédent si la persistance échoue. Aucun accès au DOM, à Electron ou à `localStorage`. |
| `contacts-controller.js` | Formulaire, recherche, sélection, boutons, lecture du fichier choisi, messages et focus. État local limité à la recherche et au contact sélectionné. |
| `app.js` | Construction des deux modules et raccordement au devis courant, à la sauvegarde et aux fonctions d'interface existantes. |

Après extraction, `app.js` compte **6 938 lignes**. Le service mesure 128 lignes et le contrôleur 141. La réduction du fichier principal est de 160 lignes ; le nombre total de lignes augmente légèrement avec les interfaces explicites. Le bénéfice recherché est l'isolation des responsabilités, pas un objectif artificiel de taille.

Le service lit la base et le devis via `getDatabase()` et `getQuote()` à chaque opération. Une restauration, l'ouverture d'un autre devis ou la synchronisation ne le laissent donc pas attaché à un ancien objet. `persist(touchCurrent)` garde le chemin de sauvegarde existant.

Les imports préparent une nouvelle collection et comptent les contacts une seule fois, au lieu de refaire `Object.keys(...)` pour chaque ajout. Un export sérialise seulement le format demandé. Les échecs de persistance restaurent aussi l'instantané du brouillon et sa date de modification. Retirer le client du devis bénéficie désormais du même retour à l'état précédent que les autres opérations du répertoire.

Les migrations, l'initialisation du répertoire à partir des anciens devis et l'affichage des demandes dans l'historique restent dans leur emplacement actuel. Les règles de demandes ouvertes et de rapprochement des factures n'ont pas été modifiées.

## Suite recommandée, par lots indépendants

| Ordre | Extraction | Fonctions actuelles à examiner | Contrat à préserver |
| --- | --- | --- | --- |
| 1 | `quote-service.js`, avec les règles pures de suivi dans le moteur existant | `saveQuote`, `createNewQuote`, `duplicateQuote`, `createQuoteRevision`, `updateQuoteTracking`, `recordTrackingContact`, `expireTrackedQuotes` | Numérotation unique, transitions autorisées, devis verrouillés, chronologie, révisions et retour à l'état précédent si l'enregistrement échoue. |
| 2 | `history-controller.js` | `renderHistory`, `renderTrackingQuickActions`, `runTrackingQuickAction`, filtres, recherche et événements du suivi | Actions métier déléguées au service ; statistiques déléguées à `tracking-core.js`. Les vues et commandes existantes restent identiques. |
| 3 | `document-service.js`, puis un contrôleur de partage si nécessaire | `renderPrint`, `printQuote`, `downloadPdf`, `transmissionMessage`, partages e-mail et WhatsApp | Devis figé passé en entrée, langue et devise explicites ; accès Electron/navigateur dans l'adaptateur. PDF, polices, pièces jointes et ordre des opérations conservés. |
| 4 | `settings-controller.js` et `catalog-controller.js` | `fillSettingsForm`, aperçus, validation des réglages, catalogue, panier et événements associés | Chaque écran garde son état de présentation ; les calculs financiers restent dans `quote-core.js`. Extraire un écran à la fois. |
| 5 | `database-store.js` et migrations, après stabilisation des opérations | `loadDatabase`, `saveLocal`, `migrateDatabase`, `restoreLocalDatabase` | Un seul propriétaire de l'état, clé `bcdevis-v1`, anciennes sauvegardes lisibles, erreurs de stockage explicites et synchronisation optionnelle après écriture réussie. |

La persistance est volontairement traitée après les premières extractions : `saveLocal` touche aujourd'hui le devis, prépare son instantané, écrit le stockage, planifie la synchronisation et met à jour l'interface. Ce contrat doit être testé avant de déplacer la responsabilité entière.

Pour le rendu PDF, séparer la construction du document à partir d'un instantané des opérations qui attendent les polices, manipulent le DOM ou appellent Electron. Pour le catalogue et le panier, conserver les règles de prix dans le moteur plutôt que les recopier dans un service.

## Méthode et limites

- Garder les modules JavaScript actuels, compatibles avec le lancement local Electron et la PWA, et les fonctions de construction avec des dépendances explicites.
- Garder un seul état applicatif ; les services le consultent par des fonctions d'accès. Les contrôleurs possèdent seulement l'état de leur écran.
- Déplacer ensemble une responsabilité et ses événements. Éviter un fichier `utils.js` regroupant des fonctions sans lien ou un service par petite fonction.
- Ajouter un module au chargement HTML, au livrable ChromeOS et au précache PWA ; invalider le cache lors d'un changement de ressources.
- Tester les comportements extraits. Les tests qui cherchent du texte dans `app.js` doivent suivre le module concerné et être complétés par des tests d'opérations, sans supprimer leurs exigences.
- Valider chaque lot avant le suivant. Le nombre de lignes déplacées ne prouve pas une accélération : mesurer séparément l'import, le rendu d'un historique volumineux et la sauvegarde avant d'annoncer des gains de temps.

Le premier lot utilise les tests métier du répertoire, une nouvelle suite `contact-service.test.cjs`, les parcours Electron existants complétés pour le contrôleur et les vérifications de livraison. **`npm run check` passe** : syntaxe et **27 suites**, avec les parcours Electron dans un profil temporaire isolé. Aucune dépendance ni fonctionnalité visible n'a été ajoutée.
