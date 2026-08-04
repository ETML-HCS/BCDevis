# BCDevis — Améliorations recommandées

## Statut du document

- **Date de l’audit :** 3 août 2026
- **Version examinée :** BCDevis 5.2.0, correction BCDevis 5.2.5 et amélioration de caisse BCDevis 5.3.0
- **Portée :** application Electron, PWA, stockage local, génération PDF, documentation, tests et livrables
- **État :** suivi des recommandations ; A1 et A2 traitées dans BCDevis 5.2.5, lisibilité et suppression de ligne renforcées dans BCDevis 5.3.0
- **Document associé :** [Nouvelles fonctionnalités](NOUVELLES-FONCTIONNALITES.md)

## Synthèse

BCDevis repose sur une base fonctionnelle stable et déjà très complète. La validation automatisée de la version 5.2.0 couvre notamment les calculs métier, les prestations, le corps interactif, les PDF, l’accessibilité clavier, la persistance Electron, la PWA, les plateformes de livraison, le démarrage système et la documentation.

Les améliorations les plus importantes concernent désormais :

1. la correction de l’interaction de quantité devenue difficile sur certains appareils ;
2. la transformation de l’historique en outil de travail réellement exploitable ;
3. la protection et la récupération des données locales ;
4. la synchronisation entre le comportement livré, la documentation et les tests ;
5. la réduction de la dette technique avant d’ajouter de nouveaux parcours importants.

## P0 — Corrections immédiates

### A1. Remplacer le clic gauche/droit sur les quantités par des contrôles explicites

**État : traité dans BCDevis 5.2.5, puis complété dans BCDevis 5.3.0 par une poubelle hors du flux et un balayage tactile gauche.**

#### Constat

Dans la version 5.2.0 auditée, un clic gauche diminuait une quantité et un clic droit l’augmentait. Ce fonctionnement était peu visible et mal adapté aux écrans tactiles. Dans le cas d’un pack déjà ajouté, augmenter à nouveau les quantités pouvait devenir particulièrement difficile.

#### Amélioration proposée

- Afficher un contrôle compact `−  quantité  +`.
- Prévoir les mêmes contrôles pour les séances payées et offertes.
- Rendre chaque bouton utilisable au clavier avec les interactions natives.
- Garantir des cibles tactiles adaptées à l’iPad.
- Désactiver proprement `−` lorsque la valeur minimale est atteinte.
- Supprimer la dépendance fonctionnelle au menu contextuel du clic droit.

#### Critères de validation

- Toute quantité peut être augmentée ou diminuée sur Windows, macOS, Linux, ChromeOS et iPadOS.
- Les contrôles restent lisibles dans une caisse étroite.
- Les bornes de quantité sont respectées.
- Les totaux sont recalculés après chaque action.
- Les tests couvrent les quantités payées et offertes sur une interface tactile simulée.

### A2. Réaligner la documentation sur le programme livré

**État : traité dans BCDevis 5.2.5.**

#### Incohérences constatées

- Le README annonce 82 prestations tarifables alors que le catalogue actif et le manuel en comptent 87.
- Le README décrivait encore un ancien comportement du logo principal alors que l’en-tête visuel a volontairement été simplifié.
- La documentation présentait encore une modification directe du prix alors que le tarif libre passe désormais par **Prestation sur mesure**.

#### Amélioration proposée

- Corriger immédiatement les valeurs et descriptions devenues obsolètes.
- Générer automatiquement les nombres de prestations et de familles depuis le catalogue.
- Centraliser le numéro de version utilisé par l’application, le cache PWA, les documents et les tests.
- Ajouter des assertions reliant les fonctions documentées aux contrôles réellement rendus.

#### Critères de validation

- Le README, le mode d’emploi, l’utilisation rapide et les PDF décrivent le même comportement.
- Le nombre de prestations ne peut plus diverger du catalogue actif.
- Une validation échoue si une action documentée n’existe plus dans l’interface.

## P1 — Améliorations fonctionnelles de l’existant

### A3. Rendre l’historique réellement opérationnel

#### Constat

L’historique affiche le numéro, le client, la date, le nombre de prestations, le total et un statut unique `Enregistré`. Il permet uniquement de rouvrir le devis.

#### Amélioration proposée

- Ajouter une recherche par numéro, nom, téléphone ou e-mail.
- Ajouter des filtres par date, montant et statut.
- Ajouter un tri par modification récente, date du devis, client ou total.
- Proposer sur chaque carte : ouvrir, dupliquer, exporter, archiver et supprimer.
- Exiger une confirmation avant suppression.
- Prévoir une corbeille locale temporaire ou une possibilité d’annulation.
- Afficher automatiquement les devis arrivés à expiration.
- Conserver une présentation sobre sans transformer l’écran en tableau de bord chargé.

#### Critères de validation

- L’historique reste utilisable avec plusieurs centaines de devis.
- Les actions ne provoquent pas l’ouverture involontaire d’un devis.
- Une suppression accidentelle reste récupérable pendant une durée définie.
- Recherche, filtres et tri sont accessibles au clavier et au toucher.

### A4. Fiabiliser les sauvegardes et les restaurations

#### Constat

La sauvegarde complète JSON est manuelle. Une restauration remplace la base locale après confirmation, sans créer au préalable une copie de sécurité récupérable par l’utilisateur.

#### Amélioration proposée

- Créer automatiquement un instantané avant toute restauration.
- Vérifier entièrement une sauvegarde avant de remplacer les données locales.
- Afficher un résumé avant restauration : version, date, nombre de devis, nombre de prestations personnalisées et réglages concernés.
- Proposer une restauration complète ou sélective.
- Conserver plusieurs sauvegardes tournantes dans l’application de bureau.
- Ajouter un rappel discret lorsqu’aucune sauvegarde externe récente n’existe.
- Permettre de tester une sauvegarde sans l’importer.

#### Critères de validation

- Une sauvegarde partiellement valide ne remplace jamais silencieusement la base courante.
- Une restauration peut être annulée grâce à l’instantané précédent.
- Les migrations de versions anciennes restent couvertes par des tests.
- Les sauvegardes ne sont jamais intégrées aux livrables distribués.

### A5. Améliorer la protection des données locales

#### Constat

BCDevis conserve localement des coordonnées client, des prestations et l’historique commercial. Le fonctionnement hors ligne est un avantage, mais l’application ne fournit pas encore de verrouillage ou de chiffrement applicatif.

#### Amélioration proposée

- Ajouter un verrouillage facultatif par code ou authentification du système.
- Prévoir un verrouillage automatique après une période d’inactivité.
- Chiffrer les sauvegardes exportées lorsque l’utilisateur le demande.
- Étudier un stockage structuré comme IndexedDB pour la PWA et une couche de persistance dédiée pour Electron.
- Définir une durée de conservation configurable.
- Ajouter des fonctions d’archivage et de suppression définitive.
- Éviter d’afficher des informations client dans les notifications ou journaux techniques.

#### Critères de validation

- Le verrouillage ne supprime jamais les données.
- Une perte du code dispose d’une procédure documentée compatible avec la politique choisie.
- Les données d’un utilisateur ne sont pas incluses dans un EXE, une archive ChromeOS ou un artefact CI.
- Les migrations depuis le stockage actuel préservent tous les devis existants.

### A6. Clarifier l’état de sauvegarde du devis courant

#### Amélioration proposée

- Distinguer visuellement un brouillon modifié d’un devis enregistré.
- Afficher une indication discrète `Modifications enregistrées localement` ou `Devis à enregistrer`.
- Éviter que l’impression ou le téléchargement PDF modifient silencieusement le sens métier du devis sans l’expliquer.
- Conserver la sauvegarde automatique technique tout en distinguant le brouillon du document explicitement archivé.

#### Critères de validation

- L’utilisateur sait toujours si le devis figure dans l’historique.
- Fermer l’application ne provoque aucune perte du brouillon.
- Imprimer ou télécharger n’ajoute pas de doublon dans l’historique.

## P2 — Maintenabilité et qualité

### A7. Découper progressivement `app.js`

#### Constat

Le fichier principal regroupe le stockage, les migrations, le catalogue, le corps interactif, la caisse, les réglages, l’historique, le PDF, les partages et les raccourcis.

#### Amélioration proposée

Conserver JavaScript natif et extraire progressivement des modules :

- `storage` et migrations ;
- modèle et calculs de devis ;
- catalogue et personnalisation ;
- caisse et interactions ;
- clients et historique ;
- PDF et impression ;
- partage et e-mail ;
- réglages ;
- modales, menus et accessibilité.

Le découpage doit rester progressif et ne justifie pas, à lui seul, une réécriture dans un framework.

#### Critères de validation

- Les modules métier peuvent être testés sans démarrer Electron.
- Les dépendances entre modules sont explicites.
- Les migrations et calculs n’accèdent pas directement au DOM.
- Chaque extraction conserve les tests existants au vert.

### A8. Consolider le CSS

#### Constat

Le projet charge un fichier CSS volumineux et contient également une quantité importante de styles intégrés dans `index.html`. Plusieurs corrections tardives redéfinissent les mêmes surfaces.

#### Amélioration proposée

- Déplacer les styles intégrés vers des fichiers dédiés.
- Organiser les styles par fondations, composants, thèmes, impression et adaptations responsives.
- Supprimer les règles obsolètes uniquement après comparaison du rendu.
- Documenter les niveaux de `z-index` utilisés par le header, la caisse, les menus, les modales et les notifications.
- Ajouter un contrôle automatique des débordements aux largeurs de référence.

#### Critères de validation

- Aucun style applicatif important ne reste intégré dans le HTML.
- Les quatre thèmes et l’impression restent identiques ou volontairement améliorés.
- Les modes 390 px, 760 px et 1180 px restent sans chevauchement.

### A9. Renforcer les tests comportementaux

#### Amélioration proposée

Compléter les tests de contrat existants par des scénarios utilisateur :

- création et modification d’un devis ;
- création d’une prestation sur mesure ;
- quantités tactiles ;
- ajout et conversion d’un pack ;
- recherche et suppression dans l’historique ;
- sauvegarde puis restauration ;
- devis expiré ;
- partage avec et sans adresse e-mail ;
- migration depuis plusieurs anciennes versions ;
- navigation complète au clavier ;
- rendu visuel des thèmes, de l’iPad et du PDF.

#### Critères de validation

- Les fonctions essentielles sont prouvées par leur comportement, pas uniquement par la présence de chaînes dans le code.
- Un échec produit un diagnostic compréhensible.
- Les parcours tactiles et clavier sont validés séparément.

### A10. Durcir Electron et la PWA

#### Points déjà satisfaisants

- isolation du contexte activée ;
- intégration Node désactivée dans le renderer ;
- sandbox Electron activée ;
- liens externes limités à HTTPS ;
- validation des chemins de pièces jointes PDF.

#### Amélioration proposée

- Ajouter une politique CSP stricte après consolidation des styles intégrés.
- Vérifier l’origine de chaque appel IPC sensible.
- Restreindre les navigations internes au document exact de l’application.
- Épingler les actions GitHub à des révisions immuables si la politique de maintenance le permet.
- Ajouter un contrôle des dépendances et des artefacts avant chaque livraison.
- Documenter les limites de la publication PWA publique et du fonctionnement hors connexion.

### A11. Signer les applications distribuées

#### Amélioration proposée

- Signer l’EXE Windows avec un certificat adapté.
- Signer et notariser l’application macOS.
- Vérifier les signatures dans le workflow de livraison.
- Documenter le renouvellement des certificats et la procédure d’urgence.

Cette amélioration devient prioritaire avant une diffusion large, mais peut rester différée pendant les tests internes.

## Ordre de réalisation conseillé

### Version 5.2.5 — Fiabilisation urgente

- A1 — contrôles de quantité explicites ;
- A2 — terminologie et documentation synchronisées ;
- tests de régression associés.

### Versions 5.3.x suivantes — Exploitation quotidienne

- A3 — historique opérationnel ;
- A4 — sauvegardes et restaurations renforcées ;
- A6 — état clair du brouillon et de l’enregistrement ;
- premières nouvelles fonctions décrites dans le document associé.

### Versions 5.3.x ultérieures — Protection et industrialisation

- A5 — verrouillage et protection des données ;
- A7 et A8 — modularisation et consolidation CSS ;
- A9 et A10 — tests et sécurité renforcés ;
- A11 — signature des livrables selon le périmètre de diffusion.

## Règle de suivi

Lorsqu’une amélioration est retenue :

1. créer une tâche dédiée avec son périmètre exact ;
2. définir les plateformes concernées ;
3. ajouter ou adapter les tests avant livraison ;
4. mettre à jour les documents utilisateur dans la même version ;
5. reconstruire et vérifier les artefacts réellement distribués ;
6. ne marquer l’amélioration comme terminée qu’après validation sur le livrable final.
