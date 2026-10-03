# Instructions pour Claude (CLAUDE.md)

Ce fichier est lu automatiquement par Claude Code et Claude Desktop pour ce projet.

## Contexte
BCDevis est une application médicale et esthétique de devis pour la Clinique Bellecour (Genève, Suisse).
- Monnaie : CHF (Franc suisse).
- Architecture : Electron (bureau portable) + PWA Web + Serveur PostgreSQL centralisé (`central-server/`).
- Code source : Vanilla JS / CSS, modules UMD sans DOM (`quote-core.js`, `contact-core.js`, `tracking-core.js`, `pdf-i18n.js`).

## Commandes Essentielles
- Vérifier la syntaxe : `npm run check:fast`
- Tester la logique pure : `npm run test:core`
- Validation complète : `npm run check`
- Lancer l'application Electron : `npm start`
- Lancer la PWA locale : `npm run pwa`

## Référence Principale
Consulter [AGENTS.md](AGENTS.md) pour la cartographie détaillée des fonctions de `app.js` et les règles d'intégrité de la base locale.
Les types TypeScript sont documentés dans [types/bcdevis.d.ts](types/bcdevis.d.ts).
