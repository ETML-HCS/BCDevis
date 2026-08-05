# BCDevis — Nouvelles fonctionnalités envisagées

## Statut du document

- **Dernière mise à jour :** 5 août 2026
- **Version de référence :** BCDevis 7.0.2
- **État :** portefeuille fonctionnel réévalué après le suivi commercial V6 et la centralisation PostgreSQL V7
- **Documents associés :** [Améliorations recommandées](AMELIORATIONS-RECOMMANDEES.md) et [Dette technique et optimisations](DETTE-TECHNIQUE-ET-OPTIMISATIONS.md)

## Orientation produit

BCDevis est désormais un outil de devis local avec suivi commercial et mode multi-postes facultatif. Les prochaines fonctions doivent consolider ce positionnement sans transformer l’application en dossier médical, agenda ou logiciel comptable complet.

Principes à préserver :

- fonctionnement local et hors connexion par défaut ;
- centralisation activée uniquement lorsqu’elle est nécessaire ;
- interface rapide et peu encombrée ;
- données récupérables et conflits explicites ;
- PDF professionnel ;
- continuité Windows, Linux, macOS, ChromeOS et iPadOS ;
- validation humaine avant tout envoi à un client.

## État des propositions précédentes

| Référence | Fonction | État en 7.0.2 | Manque principal |
| --- | --- | --- | --- |
| F1 | Cycle de vie du devis | **Largement livré en V6** | Archivage, verrouillage d’un devis accepté et création explicite d’une nouvelle version. |
| F2 | Carnet clients | **Non commencé** | Modèle de données, doublons, fusion, anonymisation et synchronisation. |
| F3 | Relances | **Livré en V6** | Recherche globale et, si utile, vue planifiée plus détaillée. |
| F4 | Modèles et favoris | **Partiel** | Un modèle JSON et la duplication existent ; pas de bibliothèque de modèles ni de favoris. |
| F5 | Versions d’un devis | **Non commencé** | Version immuable, comparaison et lien entre versions. |
| F6 | Signature sur iPad | **Non commencé** | Validation juridique et protection de la signature. |
| F7 | Plan de traitement | **Non commencé** | Décision produit à confirmer. |
| F8 | Export de gestion | **Non commencé** | Schéma d’export, anonymisation et indicateurs retenus. |
| F9 | Catalogue versionné | **Partiel** | L’éditeur de tuiles existe ; import de masse, date d’effet et historique tarifaire manquent. |
| F10 | Sauvegarde et synchronisation | **Partiel en V7** | Synchronisation centrale livrée ; sauvegarde locale automatique chiffrée, administration et restauration serveur prouvée manquent. |
| F11 | Partage natif | **Partiel** | E-mail avec pièce jointe sur Electron et canaux web existants ; partage natif de fichier à étudier sur PWA. |
| F12 | Multilingue | **Non commencé** | Architecture de traduction et validation des textes commerciaux. |

## Priorité haute — terminer les parcours déjà engagés

### F13. Administration centrale

#### Objectif

Permettre à une personne responsable d’exploiter le mode multi-postes sans intervention SQL directe.

#### Fonctions proposées

- créer, désactiver et réactiver un utilisateur ;
- attribuer les rôles administrateur, éditeur ou lecture seule ;
- changer ou réinitialiser un mot de passe ;
- lister et révoquer les appareils et sessions ;
- consulter le journal d’activité ;
- afficher l’état des sauvegardes et la capacité utilisée ;
- exporter un diagnostic sans données client en clair.

#### Limite

Cette fonction ne doit pas exposer PostgreSQL au navigateur. Elle passe par l’API et nécessite une authentification administrateur renforcée.

### F14. Historique consultable et actions par devis

#### Objectif

Rendre l’historique efficace lorsqu’il contient plusieurs centaines de devis.

#### Fonctions proposées

- rechercher par numéro, client, téléphone ou e-mail ;
- trier par date, modification, client ou montant ;
- ouvrir, dupliquer et exporter depuis la carte ;
- archiver sans supprimer ;
- supprimer vers une corbeille avec annulation ;
- paginer ou virtualiser uniquement lorsque les mesures le justifient.

### F5. Versions et verrouillage après acceptation

#### Objectif

Éviter qu’un devis déjà envoyé ou accepté soit remplacé silencieusement.

#### Fonctions proposées

- figer une version envoyée ou acceptée ;
- créer une V2 liée à la version précédente ;
- comparer lignes, quantités, réductions, mentions et totaux ;
- indiquer la version dans le PDF ;
- conserver les anciennes versions en lecture seule ;
- journaliser l’auteur et la date en mode central.

### F15. Sauvegardes guidées et vérifiables

#### Objectif

Transformer la sauvegarde en fonction contrôlable, pas seulement en bouton d’export.

#### Fonctions proposées

- instantané automatique avant restauration ou résolution de conflit ;
- résumé du contenu avant import ;
- test de lisibilité sans restauration ;
- rotation de sauvegardes locales pour Electron ;
- état de la dernière sauvegarde PostgreSQL vérifiée ;
- procédure guidée de restauration sur un environnement séparé.

## Priorité moyenne — gagner du temps au quotidien

### F2. Carnet clients local ou central

- Rechercher par nom, téléphone ou e-mail.
- Créer ou sélectionner un client depuis le devis.
- Conserver une copie des coordonnées dans chaque devis historique.
- Détecter les doublons et proposer une fusion manuelle.
- Permettre suppression ou anonymisation selon la politique de conservation.
- Définir le comportement hors ligne et les conflits avant synchronisation.

Le carnet ne doit pas devenir un dossier médical. Aucune donnée clinique ne doit y être ajoutée implicitement.

### F4. Bibliothèque de modèles et favoris

- Enregistrer un devis comme modèle sans coordonnées client.
- Créer des ensembles fréquents de soins.
- Épingler des prestations favorites.
- Dupliquer et adapter un modèle.
- Importer, exporter et, en mode central, partager les modèles choisis.

### F8. Exports de gestion

- Exporter en CSV les devis d’une période.
- Séparer montants proposés, acceptés, refusés et expirés.
- Mesurer délais de réponse et relances en attente.
- Exporter des statistiques sans données nominatives lorsque cela suffit.
- Signaler explicitement les exports contenant des données sensibles.

### F9. Catalogue versionné et modifications en masse

- Prévisualiser un import CSV ou JSON avant application.
- Refuser identifiants dupliqués et montants invalides.
- Définir une date d’entrée en vigueur.
- Conserver les tarifs historiques dans les devis existants.
- Comparer le catalogue actif au catalogue de référence.
- Annuler la dernière modification globale.

## Priorité ultérieure ou soumise à décision

### F6. Signature sur iPad

À envisager uniquement après validation juridique du niveau de preuve attendu. Le parcours devrait inclure lecture du devis, consentement, identité du signataire, date, PDF final et impossibilité de modifier la version signée.

### F7. Plan de traitement

À retenir seulement si le besoin réel est de suivre des séances restantes. La gestion médicale détaillée et l’agenda doivent rester hors périmètre sans décision explicite.

### F11. Partage natif de fichier

Étudier l’API de partage disponible sur les plateformes PWA, avec repli clair vers les fonctions existantes. Aucun message ne doit être envoyé sans confirmation humaine.

### F12. Interface multilingue et PDF bilingue

Préparer une architecture de traduction stable, conserver les identifiants internes du catalogue et faire valider les mentions commerciales dans chaque langue avant livraison.

## Fonctions volontairement hors périmètre actuel

- dossier médical et notes cliniques détaillées ;
- agenda complet ;
- facturation et comptabilité ;
- paiement automatique ;
- envoi automatique de relances sans validation ;
- exposition directe de PostgreSQL aux postes ;
- promesse de signature électronique qualifiée sans validation spécialisée.

## Proposition de séquencement

### Étape 1 — V7 exploitable

- administration des comptes, appareils et sessions ;
- sauvegarde/restauration prouvée ;
- synchronisation mesurée et protégée contre les gros volumes ;
- recherche et actions essentielles dans l’historique.

### Étape 2 — Traçabilité commerciale

- versions de devis ;
- verrouillage après acceptation ;
- carnet clients ;
- export de gestion.

### Étape 3 — Productivité

- modèles et favoris ;
- catalogue versionné ;
- partage natif si les plateformes le permettent.

### Étape 4 — Extensions validées par l’usage

- signature ;
- plan de traitement ;
- multilingue.

## Questions à trancher avant développement

- Qui administre le serveur et restaure les sauvegardes ?
- Combien d’utilisateurs et d’appareils sont prévus à 12 et 24 mois ?
- Quels rôles peuvent consulter les coordonnées, les PDF et le journal ?
- Quelle durée de conservation appliquer aux devis, PDF, suivis et journaux ?
- Un devis accepté doit-il être totalement figé ou seulement dupliqué avant modification ?
- Le carnet clients contient-il uniquement des coordonnées commerciales ?
- Quels exports sont réellement utilisés et par qui ?
- La signature est-elle sur place, à distance, ou les deux ?
- Quelles fonctions doivent continuer à fonctionner pendant une coupure prolongée ?

## Règle de décision

Avant d’engager une fonction :

1. confirmer l’usage réel et sa fréquence ;
2. définir le comportement local, central et hors ligne ;
3. identifier les données créées, leur sensibilité et leur rétention ;
4. prévoir export, sauvegarde, restauration, suppression et migration ;
5. définir les conflits multi-postes ;
6. ajouter les tests sur les plateformes concernées ;
7. mettre à jour les guides et vérifier le livrable réel.
