# Guide d’Optimisation des Prompts pour Agents IA

Ce guide pratique vous permet d'obtenir des résultats rapides, précis et sans régression lorsque vous demandez à un agent IA (Antigravity, Claude Code, Cursor, Copilot, ChatGPT, etc.) de modifier l'application BCDevis.

---

## 1. Comment l'Agent IA Comprend ce Projet

Grâce aux fichiers d'optimisation installés à la racine du projet :
- `AGENTS.md` : Donne à l'IA la cartographie exacte des 5 900 lignes de `app.js` et les règles d'intégrité.
- `types/bcdevis.d.ts` : Donne à l'IA la forme exacte de chaque objet (`Quote`, `QuoteLine`, `Contact`, `Tracking`, `Settings`) pour éviter toute hallucination.
- `.agents/rules/` et `.agents/skills/` : Fournissent les compétences métier et les procédures de test automatique.
- `CLAUDE.md` et `.cursorrules` : Assurent une compatibilité native si vous utilisez Claude Code ou Cursor.

---

## 2. Les 3 Règles d'Or pour Rédiger vos Prompts

1. **Ciblez le fichier concerné :** Évitez de dire simplement « modifie le devis », dites plutôt « modifie `devis-portable/quote-core.js` » ou « ajuste `devis-portable/catalog.js` ».
2. **Rappelez la contrainte Vanilla JS :** L'agent sait déjà qu'il ne doit pas importer de framework (React, Tailwind, etc.), mais préciser « garde le code en Vanilla JS/CSS » renforce la consigne.
3. **Exigez la validation finale :** Terminez toujours votre prompt par :
   *« Valide tes modifications en exécutant `npm run check:fast` puis `npm run test:core` (ou `npm run check`).»*

---

## 3. Modèles de Prompts Prêts à l'Emploi (Copier-Coller)

### Modèle 1 : Ajouter ou modifier un soin dans le catalogue
```text
Dans devis-portable/catalog.js, ajoute un nouveau soin dans la catégorie "Épilation laser" (id: 13) :
- Nom : "Épilation laser — Interfessier complet"
- Prix unitaire : 140 CHF
- Durée : 20 min
- Visuel associé dans PRESTATION_VISUALS si nécessaire : "sif"
Assure-toi que les identifiants uniques sont respectés et valide avec "npm run check:fast".
```

### Modèle 2 : Modifier ou ajuster une règle de calcul financier
```text
Dans devis-portable/quote-core.js :
Je souhaite ajuster la logique de calcul de [décrire la règle, ex: le rabais fixe].
Veille à :
1. Conserver la fonction pure sans dépendance au DOM.
2. Mettre à jour les tests associés dans devis-portable/tests/core.test.cjs.
3. Lancer "npm run test:core" pour prouver que tous les calculs restent corrects.
```

### Modèle 3 : Retouche d'interface graphique (CSS / Responsive)
```text
Dans devis-portable/styles.css et devis-portable/index.html :
Je souhaite ajuster [décrire l'élément, ex: l'espacement du sélecteur de tarif sur smartphone].
Règles à respecter :
- Utilise les variables CSS existantes (:root).
- Assure-toi que les cibles tactiles font au moins 44x44 px sur mobile/iPad.
- Valide que le test des contrats de thèmes passe avec "node devis-portable/tests/theme-contracts.test.cjs".
```

### Modèle 4 : Modifier ou enrichir le PDF
```text
Dans devis-portable/app.js (section impression PDF autour de renderPrint) :
Je souhaite [décrire la modification, ex: ajouter une mention sur les conditions de paiement en anglais].
Veille à :
- Mettre à jour la version FR et la version EN.
- Valider avec "node devis-portable/tests/pdf-language.test.cjs" et "node devis-portable/tests/pdf-main.test.cjs".
```

### Modèle 5 : Évolution du Serveur Central et PostgreSQL
```text
Dans central-server/ :
Je souhaite ajouter [décrire la fonctionnalité, ex: une nouvelle colonne dans la table quotes].
Veille à :
1. Créer une nouvelle migration numérotée dans central-server/migrations.cjs sans altérer les migrations passées.
2. Mettre à jour central-server/schema.sql pour les nouvelles installations.
3. Valider avec "npm run test:central:postgres".
```

### Modèle 6 : Résoudre un bug avec test de non-régression
```text
Voici le problème constaté : [décrire le bug].
1. Localise la cause racine dans le code.
2. Corrige le problème en respectant les conventions existantes.
3. Ajoute un test de non-régression dans le fichier de test approprié sous devis-portable/tests/.
4. Lance "npm run check" et affiche la confirmation que tous les tests passent.
```

---

## 4. Commandes Utiles pour l'Agent

| Commande | Vitesse | Ce qu'elle vérifie |
|---|---|---|
| `npm run check:fast` | **~1 sec** | Vérification syntaxique de tous les 33 fichiers JS/CJS |
| `npm run test:core` | **~200 ms** | Tests du cœur pur (calculs, contacts, suivi, whatsapp) |
| `npm run test:central` | **~1 sec** | Tests de synchronisation et administration centrale |
| `npm run check` | **~10 sec** | Vérification syntaxique complète + les 22 suites de tests |
| `npm test` | **~8 sec** | Exécution des 22 suites de tests |
