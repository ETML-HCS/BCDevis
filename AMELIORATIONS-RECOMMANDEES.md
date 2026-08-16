# BCDevis — Améliorations recommandées

## Statut du document

- **Dernière analyse :** 7 août 2026
- **Version examinée :** BCDevis 7.1.0 et évolutions locales non taguées du 7 août 2026
- **Portée :** application Electron, PWA, mode local, serveur central PostgreSQL, synchronisation, PDF, documentation, tests et livrables
- **État :** feuille de route consolidée après la fermeture du workflow par facture envoyée, le verrouillage des devis terminaux, les V2, les réglages documentaires par poste et le centre d’aide HTML hors ligne
- **Documents associés :** [Dette technique et optimisations](DETTE-TECHNIQUE-ET-OPTIMISATIONS.md), [Nouvelles fonctionnalités](NOUVELLES-FONCTIONNALITES.md) et [plan de protection de la PWA](PLAN-PROTECTION-ACCES-GITHUB-PAGES.md)

## Résultat de l’analyse

BCDevis 7.1.0 est fonctionnel et dispose d’un socle de validation sérieux pour une application JavaScript native :

- `npm run check` passe les contrôles syntaxiques et les 16 suites de tests ;
- les calculs, le catalogue, le corps interactif, les thèmes, le clavier, les PDF, le suivi commercial, la centralisation, la persistance, la PWA, les plateformes et les documents sont couverts ;
- `npm audit` et `npm audit --omit=dev` ne signalent aucune vulnérabilité connue ;
- `docker compose config` valide la configuration fournie pour PostgreSQL et l’API ;
- Electron conserve l’isolation du contexte, désactive Node dans le renderer et limite les ouvertures externes ;
- la V7 permet un usage local complet ou une synchronisation PostgreSQL facultative avec conflits explicites et numéros centralisés.
- le suivi distingue désormais l’archivage local du statut commercial, borne les transitions et sort une facture envoyée du workflow actif vers la bibliothèque **Factures**.
- l’aide principale est désormais une page HTML unique, recherchable, responsive, imprimable et mise en cache pour Electron comme pour la PWA.

Le risque principal a changé depuis l’audit V5 : il ne s’agit plus d’ajouter rapidement des fonctions commerciales, mais de rendre la nouvelle architecture multi-postes exploitable, récupérable et mesurable avant sa mise en production. La priorité doit donc rester la stabilisation de la V7.

## Suivi des recommandations précédentes

| Référence | Sujet | État en 7.1.0 | Suite recommandée |
| --- | --- | --- | --- |
| A1 | Quantités tactiles explicites | **Traité** | Conserver les tests tactiles et clavier. |
| A2 | Documentation alignée sur le produit | **Partiellement traité** | Le centre d’aide HTML devient la référence intégrée unique ; les guides de livraison restent versionnés séparément et la version reste dupliquée dans plusieurs sources. |
| A3 | Historique opérationnel | **Partiellement traité** | Statuts contrôlés, filtres, chronologie, relances, factures sorties du workflow et tri métier sont livrés ; recherche libre, archivage et suppression récupérable restent à faire. |
| A4 | Sauvegarde et restauration fiables | **Partiellement traité** | L’import est borné, migré et restauré avec retour en mémoire si l’écriture locale échoue ; aucun instantané utilisateur n’est créé automatiquement avant une restauration. |
| A5 | Protection des données | **Partiellement traité** | HTTPS distant obligatoire, sessions, rôles et séparation API/PostgreSQL sont présents ; données locales, sauvegardes et jeton client ne sont pas chiffrés. |
| A6 | État clair du devis | **Traité localement** | La caisse affiche seulement l’état d’enregistrement ; le statut commercial et ses détails sont réservés à l’espace **Suivi**. |
| A7 | Découpage de `app.js` | **À faire** | Le moteur de formats contacts est isolé, mais le contrôleur du répertoire porte `app.js` à 5 199 lignes et environ 267 Kio. |
| A8 | Consolidation CSS | **À faire** | `styles.css` compte 3 106 lignes et `index.html` embarque encore environ 1 729 lignes, soit près de 98 Ko de CSS intégré. |
| A9 | Tests comportementaux | **Partiellement traité** | Une CI indépendante et un test PostgreSQL 17 réel sont maintenant présents ; la première exécution sur le service réel, la matrice navigateur et les essais de volume restent à prouver. |
| A10 | Durcissement Electron/PWA/API | **En cours** | Les protections de base sont présentes ; CSP, limitation globale, administration des accès et épinglage immuable des actions restent ouverts. |
| A11 | Signature des livrables | **À faire** | Windows n’est pas signé et macOS n’est ni signé ni notarisé. |
| A15 | Clôture par facture envoyée | **Traité localement** | Import central de la facture, sortie du suivi actif, consultation, téléchargement et impression sont reliés au devis accepté. |
| A16 | Espace de travail du suivi | **Traité localement** | Le volet étroit est remplacé par une surface large et responsive avec grille, fiche étendue, chronologie et actions lisibles. |
| A17 | Sortie PDF et nommage facture | **Traité localement** | Dossier des devis configurable par poste, préfixe facture distinct et référence machine identique au devis. |
| A18 | Centre d’aide HTML hors ligne | **Traité localement** | Bouton Aide, recherche instantanée, neuf thèmes, liens contextuels, rendu responsive, impression et cache PWA sans dépendance PostgreSQL. |
| A19 | Répertoire de contacts | **Traité localement** | Recherche, formulaire progressif, suppression, import/export CSV-vCard-JSON, fusion des doublons, instantané par devis et synchronisation centrale sont reliés ; l’anonymisation reste à cadrer. |

## P0 — Stabiliser la centralisation avant un usage réel

### A12. Prouver le serveur sur un vrai PostgreSQL

#### Constat

La suite `centralization.test.cjs` exerce bien l’API, les sessions, les numéros uniques, les conflits et les PDF, mais elle s’appuie sur `pg-mem`. Le fichier `schema.sql` est appliqué directement avec des `CREATE ... IF NOT EXISTS` et ne constitue pas encore un historique de migrations versionnées.

**Avancement du 5 août 2026 :** `central-postgres.integration.test.cjs` et la CI dédiée ont été ajoutés. Le scénario utilise une base PostgreSQL dont le nom contient `test`, crée un schéma isolé puis le supprime. Il couvre notamment deux réservations concurrentes, JSONB, conflits, PDF et audit. Le moteur Docker local étant indisponible pendant cette passe, la première exécution sur PostgreSQL 17 reste une preuve attendue de la CI.

#### Actions

- Maintenir le test d’intégration contre PostgreSQL 17 réel et rendre sa réussite obligatoire dans la CI.
- Tester un démarrage neuf, un redémarrage avec données, une migration de schéma, une concurrence de synchronisation et une reprise après interruption.
- Créer des migrations numérotées, atomiques et traçables au lieu de dépendre d’un unique schéma cumulatif.
- Écrire et tester un runbook complet de sauvegarde **et** restauration `pg_dump`/`pg_restore`.
- Vérifier le déploiement derrière le proxy HTTPS réellement retenu, sans exposer PostgreSQL.

#### Critères de validation

- Le test échoue si une requête utilisée n’est pas compatible avec PostgreSQL 17.
- Une base de la version précédente est migrée sans perte de devis, documents, comptes, appareils ou journal.
- Une restauration dans une base distincte est prouvée par des contrôles de volume, d’empreinte et de contenu.
- Le service redémarre après restauration et un poste peut se reconnecter puis synchroniser.

### A13. Administrer les comptes, appareils et sessions

#### Constat

Le schéma prévoit les rôles `admin`, `editor` et `reader`, mais seul l’administrateur initial peut être créé par la procédure actuelle. Aucune interface ou commande maintenue ne permet encore de créer un utilisateur, changer son rôle, désactiver un compte, révoquer un appareil ou invalider toutes ses sessions.

#### Actions

- Fournir une commande d’administration hors ligne ou une interface réservée aux administrateurs.
- Gérer création, désactivation, changement de rôle et réinitialisation du mot de passe.
- Lister les appareils et sessions avec dernière activité, expiration et action de révocation.
- Documenter la perte d’un appareil, le départ d’un collaborateur et la rotation d’urgence des accès.
- Nettoyer périodiquement les sessions expirées et borner la mémoire du limiteur de connexion.

#### Critères de validation

- Un appareil révoqué ne peut plus lire ni écrire de données.
- Un compte `reader` ne peut ni synchroniser une modification, ni réserver un numéro, ni importer un PDF.
- Chaque action administrative sensible est journalisée.
- La procédure ne nécessite pas de modifier directement une ligne SQL sans garde-fou.

### A14. Rendre la synchronisation proportionnelle aux changements

#### Constat

Chaque synchronisation envoie un instantané complet. Lorsqu’il change, le serveur supprime puis réinsère tous les réglages, compteurs, prestations, adaptations et devis de l’organisation. Le dernier instantané complet est aussi recopié dans chaque appareil. Ce fonctionnement est simple et sûr à petite échelle, mais son coût augmente avec l’historique et finira par rencontrer la limite de requête de 12 Mo.

#### Actions

- Mesurer la taille et la durée des synchronisations avec 100, 500 et 1 000 devis.
- Introduire un journal de changements ou des mutations par entité avec révision.
- Ne réécrire que les lignes créées, modifiées ou supprimées.
- Conserver des marqueurs de suppression afin qu’un poste hors ligne ne recrée pas une donnée effacée.
- Paginer les listes volumineuses et éviter de charger tous les devis ou 500 documents sans besoin.
- Tester une modification locale qui survient pendant une synchronisation déjà en vol.

#### Critères de validation

- Modifier un devis ne réécrit aucun devis non concerné.
- La taille d’une synchronisation courante dépend de la modification, pas de la taille totale de l’historique.
- Deux postes modifiant des entités différentes se fusionnent sans conflit ni perte.
- Une limite atteinte produit une alerte exploitable et n’efface aucune donnée locale.

## P1 — Protéger les données et fluidifier l’exploitation

### A3. Terminer l’historique opérationnel

- Ajouter une recherche par numéro, client, téléphone et e-mail.
- Ajouter les tris par date, dernière modification, client et montant.
- Proposer ouvrir, dupliquer, exporter, archiver et supprimer depuis chaque devis.
- Introduire une corbeille ou une annulation avant suppression définitive.
- Tester l’affichage et la recherche sur plusieurs centaines de devis.

### A4. Sécuriser les restaurations locales et centrales

- Télécharger automatiquement un instantané local avant chaque restauration.
- Présenter avant confirmation la version, la date et le nombre d’éléments importés.
- Valider l’ensemble de la sauvegarde avant toute mutation.
- Ajouter une restauration sélective lorsque le besoin sera confirmé.
- Pour PostgreSQL, définir rotation, chiffrement, stockage hors serveur, rétention et test périodique de restauration.

### A5. Renforcer la protection locale

- Décrire honnêtement le jeton central : il est stocké côté client sous forme de jeton porteur et doit être traité comme un secret.
- Étudier le stockage protégé par le système dans Electron.
- Préparer la migration de la PWA de `localStorage` vers IndexedDB avec transaction et contrôle de quota.
- Ajouter un verrouillage facultatif et un export chiffré si le risque métier le justifie.
- Définir les durées de conservation des devis, suivis, PDF et journaux.

### A6. Séparer l’archivage et le statut commercial sans surcharger la caisse

**Traitement intégré à la version locale 7.0.2 le 5 août 2026 :**

- un indicateur discret, sans fond ni bordure, et annoncé aux technologies d’assistance affiche `Non archivé`, `Enregistré` ou `À enregistrer` dans le contexte du devis ;
- les statuts commerciaux, les relances, la chronologie et les auteurs sont volontairement regroupés dans l’espace large **Mes devis > Suivi** ;
- la caisse n’affiche ni statut commercial, ni verrouillage, ni numéro de version ; ces informations et l’action **Créer une Vn** restent dans l’espace **Suivi** ;
- l’état est recalculé après chaque sauvegarde locale en comparant le contenu métier courant à la version de **Mes devis** ;
- les métadonnées techniques `status` et `updatedAt` sont exclues de la comparaison afin d’éviter les faux changements ;
- le libellé accessible et l’infobulle du bouton d’enregistrement suivent le même état ;
- un test Electron vérifie la transition complète `Non archivé` → `Enregistré` → `À enregistrer` → `Enregistré` et l’absence des détails de suivi dans la caisse.

L’auto-sauvegarde du brouillon reste distincte de l’archivage : seul l’état `Enregistré` confirme que la version affichée est à jour dans **Mes devis**.

### A15. Clore le workflow avec la facture envoyée

**Traitement intégré localement le 5 août 2026 :**

- les transitions commerciales sont explicites : `Brouillon` → `Prêt à envoyer` → `Envoyé` → `Accepté` / `Refusé` / `Expiré` ;
- un devis accepté, refusé, expiré ou facturé est verrouillé ; une modification passe par une V2 liée à la version précédente ;
- chaque événement de suivi conserve l’auteur et le poste disponibles ;
- un devis accepté propose **Importer la facture envoyée** ; la transition `Accepté` → `Facture envoyée` n’est créée qu’après l’archivage réussi du PDF central ;
- la facture quitte l’onglet **Suivi**, reste traçable dans l’historique et rejoint **Factures**, avec aperçu, import, téléchargement et impression ;
- les factures restent des documents commerciaux archivés : BCDevis ne devient pas un logiciel comptable et ne calcule aucun paiement.
- aucun changement de statut ne fabrique une facture ; seul l’import réussi d’un PDF clôt le suivi, et son nom d’archive reprend la référence du devis avec le préfixe facture configuré.

La prochaine validation de livraison devra encore tester ce parcours contre le PostgreSQL 17 réel de la CI, puis sur l’artefact de la plateforme distribuée.

### A16. Donner au suivi un véritable espace de travail

**Traitement intégré localement le 5 août 2026 :**

- sur ordinateur, **Mes devis** s’ouvre désormais dans une surface centrée pouvant atteindre 1 180 px de large et 900 px de haut ;
- les devis sont présentés sur deux colonnes pour exploiter la largeur disponible ;
- **Historique** reste une liste compacte de tous les devis enregistrés avec leur tag de statut, tandis que **Suivi** porte seul les filtres, relances, chronologies et actions commerciales ;
- dans **Suivi**, le bouton du détail apparaît au survol ou au focus avec une souris ; une interaction tactile sur la fiche ouvre ou referme directement le détail, qui conserve une action explicite **Ouvrir le devis** ;
- l’ouverture d’un devis étend sa fiche sur toute la largeur et sépare le résumé, la chronologie et les actions de suivi ;
- entre 581 et 900 px, le contenu repasse sur une colonne dans une grande fenêtre adaptée ;
- sur mobile, l’espace devient plein écran afin de préserver la lisibilité et les cibles tactiles ;
- le dialogue reste modal, pilotable au clavier et identique dans Electron et la PWA.

### A17. Configurer la sortie PDF sans casser la traçabilité

**Traitement intégré localement le 6 août 2026 :**

- l’application Electron conserve dans une préférence propre au poste le dossier des devis PDF ; **Téléchargements** reste le repli par défaut ;
- ce chemin absolu n’entre pas dans les réglages synchronisés, afin qu’un ordinateur ne remplace pas le dossier d’un autre ;
- la PWA explique que le navigateur garde la maîtrise du dossier, conformément aux restrictions de la plateforme ;
- les préfixes devis et facture sont distincts (`DEV` et `FAC` par défaut), tandis que date, code machine et séquence sont recopiés à l’identique ;
- la validation couvre le choix, la persistance, la réinitialisation, l’enregistrement dans le dossier retenu et l’autorisation de la pièce jointe e-mail.

### A18. Remplacer l’aide PDF principale par un centre HTML

**Traitement intégré localement le 6 août 2026 :**

- le bouton **Aide** ouvre une grande surface de travail qui charge `help.html`, également utilisable comme page autonome dans la PWA ;
- la recherche instantanée ignore les accents, accepte plusieurs mots et filtre les thèmes devis, suivi, factures, base centrale, PDF et raccourcis ;
- les parcours et libellés de l’aide reprennent exactement ceux de l’interface, notamment **À enregistrer**, **Devis & suivi** et la confirmation du statut **Envoyé** ;
- les écrans devis, suivi, bibliothèque PDF, réglages de sortie et centralisation ouvrent directement le thème pertinent ;
- `help.html`, `help.css` et `help.js` sont embarqués dans Electron et préchargés par le service worker ; la navigation hors ligne conserve la page demandée au lieu de revenir systématiquement à l’accueil ;
- une feuille d’impression produit la version papier depuis la même source, sans imposer un second document d’aide à maintenir ;
- l’ancienne modale de raccourcis, son contenu dupliqué, son SVG et ses styles morts ont été retirés ;
- une quatorzième suite contrôle le contenu, les ressources locales, les liens contextuels, l’impression, le cache hors ligne et la livraison HTTP par la PWA.

**Passe du 7 août 2026 :** textes raccourcis, parcours alignés sur les libellés réels, recherche multi-mots et thème actif synchronisé avec la lecture.

Les PDF de documentation livrés restent des secours figés de la version 7.1.0. Ils ne sont plus présentés comme la référence principale dans l’application.

## P2 — Réduire la dette et le coût de maintenance

### A7. Découper progressivement le renderer

Extraire d’abord les zones qui disposent déjà de contrats clairs :

1. suivi commercial ;
2. historique et sauvegardes ;
3. PDF et partage ;
4. catalogue et éditeur de tuiles ;
5. réglages et modales ;
6. persistance et migrations locales.

Le découpage doit conserver JavaScript natif et rester couvert à chaque étape ; une réécriture dans un framework n’est pas un objectif en soi.

### A8. Consolider les styles et préparer une CSP

- Déplacer le bloc `<style>` de `index.html` vers des feuilles dédiées.
- Organiser fondations, composants, thèmes, responsive, modales et impression.
- Documenter l’échelle de `z-index`.
- Ajouter des contrôles visuels aux largeurs 390, 600, 760, 1 024, 1 180 et 1 366 px.
- Introduire ensuite une CSP sans `unsafe-inline` pour les scripts et, si possible, pour les styles.

### A9. Séparer validation continue et publication

- Faire réussir la nouvelle CI de contrôle sur les pull requests et `main`, sans déployer Pages.
- Conserver les workflows de livrables sur les tags et la publication Pages sur `main`.
- Compléter le test PostgreSQL réel par des budgets de taille et de performance.
- Produire des diagnostics par scénario plutôt qu’une longue chaîne de scripts uniquement séquentielle.

### A10 et A11. Fiabiliser les versions, dépendances et livrables

- Générer la version applicative, serveur, cache PWA, notes et documents depuis `package.json`.
- Examiner les mises à jour mineures détectées (`electron` 43.1.1 vers 43.3.0, `marked` 18.0.7 vers 18.0.9) dans une tâche séparée.
- Surveiller les dépendances transitives dépréciées apportées par l’outillage de packaging malgré un audit de sécurité actuellement vert.
- Épingler les actions GitHub à des révisions immuables si la politique du dépôt le permet.
- Vérifier l’artefact final de chaque plateforme, puis signer Windows et signer/notariser macOS avant diffusion large.

## Ordre de réalisation conseillé

### Stabilisation 7.0.x

1. A12 — PostgreSQL réel, migrations et restauration prouvée ;
2. A13 — administration et révocation ;
3. A14 — mesures de volume et protection contre la limite de synchronisation ;
4. A4 — instantané automatique avant restauration locale.

### Durcissement 7.1

1. A5 — stockage des secrets, rétention et protection locale ;
2. A9 — CI indépendante du déploiement ;
3. A10 — version unique, dépendances et chaîne de livraison ;
4. A3 — recherche, archivage et actions dans l’historique.

### Optimisation 7.2

1. synchronisation incrémentale ;
2. modularisation de `app.js` ;
3. consolidation CSS et CSP ;
4. tests de volume et budgets de performance.

Ces numéros de versions sont indicatifs : la priorité fonctionnelle doit être validée avant engagement.

## Règle de clôture

Une amélioration n’est considérée comme terminée que lorsque :

1. son risque et son périmètre sont explicités ;
2. les modes local et central sont distingués ;
3. les tests pertinents passent sur l’environnement réel concerné ;
4. une procédure de retour arrière existe pour les données ou le déploiement ;
5. les documents utilisateur et d’exploitation sont mis à jour ;
6. l’artefact ou le service réellement distribué est vérifié.
