# Plan de protection temporaire de BCDevis sur GitHub Pages

## Statut du document

- **Créé le :** 3 août 2026
- **Échéance maximale proposée :** 17 août 2026
- **État :** préparation uniquement
- **Autorisation actuelle :** aucune mise en œuvre, aucune modification de GitHub Pages et aucun changement de visibilité du dépôt

Ce document prépare une protection temporaire de la version web de BCDevis pendant sa phase de test. Toute mise en œuvre devra faire l’objet d’une validation explicite avant de modifier le code, les secrets GitHub, la visibilité du dépôt ou le déploiement GitHub Pages.

## Situation actuelle

- Le dépôt `ETML-HCS/BCDevis` est public.
- La PWA est assemblée par `npm run chromeos`, puis publiée par `.github/workflows/pages.yml`.
- Le site GitHub Pages est public à l’adresse `https://etml-hcs.github.io/BCDevis/`.
- Les devis et réglages restent dans le stockage local du navigateur utilisé. Ils ne sont pas transférés dans le dépôt GitHub par le fonctionnement actuel de l’application.

## Objectif du test

Ajouter une barrière d’accès temporaire qui :

- demande un mot de passe partagé lors du premier accès ;
- mémorise l’appareil autorisé pendant 30 jours ;
- ne publie jamais le mot de passe dans le dépôt, les journaux ou les fichiers du site ;
- empêche un visiteur non autorisé de charger directement l’application publiée ;
- conserve l’installation PWA et le stockage local de BCDevis ;
- permet de verrouiller volontairement un appareil sans supprimer ses devis ;
- reste réversible à la fin du test.

## Solution temporaire proposée

### 1. Précondition obligatoire

Passer le dépôt en privé avant de considérer la protection comme effective. Si les sources restent publiques, un visiteur pourra récupérer directement l’application depuis GitHub, indépendamment de l’écran de déverrouillage.

Avant cette opération, vérifier que la formule GitHub du compte permet de publier GitHub Pages depuis un dépôt privé. Si ce n’est pas le cas, arrêter la mise en œuvre et choisir un hébergement avec contrôle d’accès ; ne pas remplacer cette exigence par un simple mot de passe écrit dans JavaScript.

### 2. Secret de déploiement

Créer un secret GitHub Actions nommé `BCDEVIS_TEST_PASSWORD` :

- mot de passe aléatoire et long, sans lien avec la clinique ou le nom du produit ;
- connu uniquement des personnes autorisées au test ;
- jamais ajouté dans un fichier suivi par Git ;
- jamais affiché dans les sorties du workflow ;
- renouvelable en cas de diffusion accidentelle.

### 3. Publication chiffrée

Ajouter ultérieurement une étape de fabrication dédiée qui :

1. assemble d’abord la PWA existante ;
2. regroupe les fichiers nécessaires à son fonctionnement ;
3. chiffre ce contenu avec AES-256-GCM et des valeurs aléatoires propres à chaque publication ;
4. publie uniquement l’écran de déverrouillage, le code de déchiffrement et la charge utile chiffrée ;
5. échoue si un fichier applicatif non chiffré ou une carte de sources se retrouve dans l’artefact Pages.

La clé devra être dérivée du mot de passe dans le navigateur avec un mécanisme reconnu et calibré lors de l’implémentation. Les paramètres cryptographiques devront être documentés et couverts par des tests ; ils ne devront pas être improvisés dans le workflow YAML.

### 4. Mémorisation dans le navigateur

Après un déverrouillage réussi :

- enregistrer une clé non extractible dans IndexedDB, et non le mot de passe en clair ;
- associer cette autorisation à une date d’expiration de 30 jours ;
- redemander le mot de passe sur un nouvel appareil, en navigation privée, après effacement des données du site ou à l’expiration ;
- prévoir une commande **Verrouiller cet appareil** qui supprime uniquement la clé et les fichiers applicatifs déchiffrés ;
- ne jamais supprimer automatiquement les devis, réglages et sauvegardes locales de BCDevis lors du verrouillage.

### 5. Fonctionnement hors connexion

Le mode PWA implique qu’un appareil déjà autorisé peut conserver une copie utilisable hors connexion. Pour ce test, ce comportement devra être accepté explicitement ou désactivé.

Conséquence importante : changer le mot de passe empêchera les nouveaux chargements connectés, mais ne garantit pas l’arrêt immédiat d’une PWA déjà déchiffrée et conservée hors connexion. Une révocation immédiate par personne nécessitera plus tard une vraie authentification en ligne.

## Limites acceptées pour le test

- Le mot de passe est partagé : il n’existe pas de compte individuel ni de journal nominatif.
- Une personne autorisée peut techniquement copier les fichiers après leur déchiffrement.
- Un mot de passe faible pourrait être recherché hors connexion ; un code PIN court est donc exclu.
- Le dépôt ayant déjà été public, cette opération ne peut pas rendre rétroactivement secrets les fichiers déjà publiés.
- Cette solution protège l’accès de test, mais ne remplace pas un contrôle d’accès professionnel tel que GitHub Pages privé avec GitHub Enterprise Cloud ou un proxy d’identité.

## Critères de validation

La protection ne pourra être déclarée prête que si tous les contrôles suivants passent :

- [ ] Le dépôt est privé et les accès GitHub ont été vérifiés.
- [ ] Le mot de passe n’apparaît ni dans Git, ni dans l’artefact Pages, ni dans les journaux Actions.
- [ ] Aucun fichier applicatif exploitable n’est publié en clair, hors écran de déverrouillage.
- [ ] Un mauvais mot de passe ne crée aucun cache applicatif déchiffré.
- [ ] Le bon mot de passe ouvre BCDevis sur Chrome, Edge et Safari iPadOS.
- [ ] Un rechargement sur le même appareil ne redemande pas le mot de passe pendant 30 jours.
- [ ] Un nouveau profil de navigateur demande le mot de passe.
- [ ] **Verrouiller cet appareil** redemande ensuite le mot de passe sans effacer les devis locaux.
- [ ] L’installation PWA et le fonctionnement hors connexion suivent la décision validée.
- [ ] L’impression et l’enregistrement PDF fonctionnent toujours sur la version web.
- [ ] La rotation du secret et un nouveau déploiement invalident l’ancien mot de passe pour les futurs chargements connectés.
- [ ] Le workflow refuse de publier si son secret est absent.
- [ ] Le retour à la publication actuelle a été testé sur une branche de préparation.

## Calendrier maximal

| Date limite | Étape | Résultat attendu |
| --- | --- | --- |
| 4 août 2026 | Validation du principe, de la durée de 30 jours et du fonctionnement hors connexion | Décisions consignées avant toute modification |
| 5 août 2026 | Vérification de la formule GitHub et préparation du passage du dépôt en privé | Faisabilité GitHub confirmée |
| 7 août 2026 | Prototype du chiffrement et de l’écran de déverrouillage sur une branche séparée | Aucun changement sur le site public |
| 10 août 2026 | Mémorisation, verrouillage local et intégration PWA | Parcours complet disponible en prévalidation |
| 12 août 2026 | Tests automatiques et contrôle de l’artefact publié | Absence de secret et de sources en clair prouvée |
| 14 août 2026 | Essai sur un ordinateur et un iPad de test | Validation fonctionnelle réelle |
| 16 août 2026 | Corrections finales et vérification du retour arrière | Candidat prêt à publier |
| **17 août 2026** | Publication uniquement après autorisation explicite | Protection temporaire active ou décision documentée de ne pas publier |

## Procédure de retour arrière

Si la protection empêche l’utilisation normale de BCDevis :

1. suspendre le déploiement protégé ;
2. restaurer le workflow Pages validé précédemment ;
3. republier l’artefact PWA standard ;
4. vérifier l’ouverture, l’installation et l’impression ;
5. ne pas changer la visibilité du dépôt sans une nouvelle décision explicite ;
6. consigner la cause de l’échec avant une nouvelle tentative.

Le retour arrière ne doit jamais effacer les données locales présentes sur les appareils des utilisateurs.

## Décisions requises avant exécution

- [ ] Autoriser explicitement le démarrage de l’implémentation.
- [ ] Autoriser ou refuser le passage du dépôt en privé.
- [ ] Confirmer que la mémorisation doit durer 30 jours.
- [ ] Accepter ou refuser l’utilisation hors connexion après le premier déverrouillage.
- [ ] Désigner la personne qui conservera et distribuera le mot de passe de test.
- [ ] Désigner l’ordinateur et l’iPad utilisés pour la validation.
- [ ] Autoriser explicitement la publication finale sur GitHub Pages.

Tant que ces décisions ne sont pas validées, ce document reste une préparation et aucune protection ne doit être déployée.
