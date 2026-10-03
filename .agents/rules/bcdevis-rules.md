# Règles de Développement BCDevis

Ces règles s'appliquent à tous les agents intervenant sur ce dépôt.

## 1. Sécurité et Rétrocompatibilité
- Ne jamais réinitialiser ou casser le format `localStorage` `"bcdevis-v1"`.
- Toute modification de structure de base de données doit inclure une fonction de migration ascendante.
- Les fichiers générés dans `devis-portable/data/` sur machine locale doivent continuer à s'ouvrir sans perte d'historique.

## 2. Architecture et Pureté du Code
- Maintenir la séparation stricte : le code métier pur (`quote-core.js`, `contact-core.js`, `tracking-core.js`) ne doit avoir aucune dépendance au DOM (`window.document`), ni à Electron.
- Les nouveaux modules de calcul ou traitement de données doivent être emballés en format UMD (Universal Module Definition) pour tourner aussi bien sous Node.js (tests CJS) que dans le navigateur.
- Ne pas introduire de framework CSS ou JS lourd (garder Vanilla JS et CSS avec variables `:root`).

## 3. Ergonomie et Accessibilité
- Toute cible tactile sur écran tactile (iPad, smartphone) doit respecter une taille minimale de 44×44 px.
- Veiller aux contrastes des quatre thèmes officiels (`white`, `dark`, `sand`, `slate`).
- Valider systématiquement que le test `node devis-portable/tests/theme-contracts.test.cjs` passe.

## 4. Protocole de Validation Obligatoire
Avant de considérer une tâche comme achevée, exécuter :
1. `npm run check:fast` pour vérifier la validité syntaxique de tous les scripts.
2. `npm run test:core` ou `npm test` pour s'assurer qu'aucune régression fonctionnelle n'est introduite.
