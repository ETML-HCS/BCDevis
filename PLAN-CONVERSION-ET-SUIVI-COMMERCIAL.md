# BCDevis – Plan conversion et suivi commercial

## Statut du document

- **Date de l’analyse :** 11 septembre 2026
- **Version de référence :** BCDevis 8.0.0
- **Portée :** brouillons, devis prêts, envois, relances, décisions, versions et factures envoyées
- **Objectif produit :** augmenter la part des devis envoyés qui aboutissent, tout en réduisant les oublis et le temps administratif
- **Documents associés :** [Nouvelles fonctionnalités](NOUVELLES-FONCTIONNALITES.md) et [Améliorations recommandées](AMELIORATIONS-RECOMMANDEES.md)

## Proposition directrice

### « Aucun devis ne se perd »

La plus forte valeur n’est pas un nouveau statut. BCDevis possède déjà le cycle :

`Brouillon` → `Prêt à envoyer` → `Envoyé` → `Accepté` / `Refusé` / `Expiré` → `Facture envoyée`

La prochaine étape consiste à transformer ce cycle en un **poste de travail commercial quotidien** qui répond immédiatement à quatre questions :

1. Quels brouillons faut-il terminer ?
2. Quels devis prêts faut-il envoyer ?
3. Quels clients faut-il relancer aujourd’hui ?
4. Quels devis acceptés attendent encore leur facture ?

Le cœur de la proposition est une vue **Aujourd’hui**, orientée vers l’action, complétée par des indicateurs qui expliquent ce qui convertit et ce qui se perd.

## Socle déjà disponible

BCDevis enregistre déjà les éléments nécessaires à un premier MVP sans migration lourde :

- statut commercial borné et transitions contrôlées ;
- dates d’envoi, d’acceptation, de refus et de facture ;
- prochaine date de relance ;
- canal, auteur, poste et chronologie des événements ;
- montant recalculable depuis le contenu figé de chaque devis ;
- coordonnées client figées dans le devis ;
- lien entre les versions V1, V2 et suivantes ;
- rappel au démarrage et compteur des relances dues ;
- facture PDF liée au numéro du devis accepté.

Le premier lot peut donc être **local, hors ligne et dérivé des données existantes**. La centralisation reste un moyen de partager les résultats, pas un prérequis.

## Indicateur principal

### Taux de conversion des devis envoyés

Pour une période donnée :

`devis acceptés ou facturés issus des envois de la période / devis envoyés durant la période`

Règles indispensables :

- utiliser `sentAt` pour constituer la cohorte, pas la date de création ;
- compter `Accepté` **et** `Facture envoyée` comme conversions, car la facturation ne doit pas faire disparaître une acceptation des statistiques ;
- compter chaque chaîne de versions comme une seule opportunité dans la vue commerciale consolidée ;
- afficher séparément les dossiers encore en attente afin de ne pas les confondre avec des pertes ;
- conserver les montants en CHF et ne pas présenter ces indicateurs comme des revenus encaissés.

Indicateurs secondaires :

- valeur envoyée, acceptée et encore en attente ;
- délai médian entre envoi et acceptation ;
- part des acceptations obtenues après au moins une relance ;
- nombre et ancienneté des brouillons, devis prêts, relances dues et devis à facturer ;
- motifs de refus ou d’expiration ;
- conversion par type de tarif, famille de soins, canal d’envoi et tranche de montant.

## Priorités proposées

| Priorité | Fonction | Valeur métier | Effort estimé | Dépendance |
| --- | --- | --- | --- | --- |
| P0 | File d’action **Aujourd’hui** | Très forte | Moyen | Données actuelles |
| P0 | Définitions et calculs de conversion fiables | Très forte | Faible | Données actuelles |
| P1 | Motifs structurés de perte et de report | Forte | Faible à moyen | Petite évolution de données |
| P1 | Tableau de bord conversion | Forte | Moyen | Calculs P0 |
| P1 | Export CSV de pilotage, nominatif ou anonymisé | Forte | Faible | Calculs P0 |
| P2 | Séquences de relance assistées | Forte | Moyen | Motifs P1 utiles mais non bloquants |
| P2 | Comparaison V1/V2 et consolidation des versions | Moyenne à forte | Moyen | Liens de versions actuels |
| P2 | Continuité devis accepté → facture envoyée | Forte | Faible à moyen | Bibliothèque Factures actuelle |
| P3 | Analyse des facteurs de conversion | Moyenne | Moyen | Volume de données suffisant |

## P0 – File d’action « Aujourd’hui »

### Objectif

Remplacer la consultation passive des statuts par une liste courte et priorisée des dossiers qui nécessitent une intervention.

### Sections

#### Brouillons à terminer

- devis enregistré au statut `Brouillon` sans modification depuis un délai configurable ;
- résumé des éléments manquants : client, prestation, coordonnées ou montant nul ;
- actions : **Ouvrir**, **Supprimer**, **Reporter** ;
- aucune remontée du brouillon automatique propre au poste tant qu’il n’a pas été explicitement enregistré.

#### Prêts à envoyer

- devis au statut `Prêt à envoyer` resté sans envoi ;
- ancienneté visible ;
- actions : **Ouvrir**, **E-mail**, **À joindre**, **Reporter** ;
- le statut `Envoyé` reste confirmé par la personne, comme aujourd’hui.

#### À relancer

- devis envoyés dont la relance arrive aujourd’hui ou est en retard ;
- tri par retard, puis montant, puis date d’envoi ;
- actions : **Relancer**, **Reprogrammer**, **Accepté**, **Refusé** ;
- message proposé selon le canal, toujours modifiable et validé avant ouverture de l’application externe.

#### Acceptés à facturer

- devis acceptés sans facture importée après un délai configurable ;
- délai depuis l’acceptation et montant visibles ;
- actions : **Importer la facture**, **Ouvrir le devis**, **Reporter** ;
- cette section ne suit ni paiement ni comptabilité : elle vérifie uniquement la continuité documentaire.

### Règle de priorité

Le classement doit rester explicable, sans score opaque :

1. relances en retard ;
2. devis acceptés en attente de facture ;
3. devis prêts non envoyés ;
4. brouillons anciens ;
5. à ancienneté égale, montant décroissant.

### Critères d’acceptation

- l’écran indique le nombre d’actions dues aujourd’hui ;
- chaque élément propose une action principale exécutable en un clic ;
- une action réalisée disparaît immédiatement de la section concernée ;
- **Reporter** exige une nouvelle date et crée un événement attribué dans la chronologie ;
- aucune relance, aucun changement de statut et aucun envoi ne sont automatiques ;
- la vue reste entièrement utilisable hors connexion.

## P0 – Mesures fiables avant le tableau de bord

Créer un module de calcul pur, testable séparément du rendu, qui produit pour une période :

- cohortes envoyées ;
- conversions, pertes et dossiers encore ouverts ;
- valeur proposée, acceptée et en attente ;
- délai médian de décision ;
- nombre de relances avant décision ;
- progression devis accepté → facture envoyée.

Cas à couvrir par les tests :

- un devis passé de `Accepté` à `Facture envoyée` reste une conversion ;
- une V2 ne double pas l’opportunité de la V1 ;
- une acceptation en septembre d’un devis envoyé en août appartient à la cohorte d’août ;
- un devis envoyé sans décision reste « en attente », pas « perdu » ;
- un devis expiré puis recréé comme nouvelle version reste rattaché à sa chaîne ;
- les calculs restent identiques en mode local et après synchronisation.

## P1 – Comprendre les pertes

### Motifs structurés

Lors du passage à `Refusé` ou `Expiré`, proposer un motif court :

- prix ;
- calendrier ou disponibilité ;
- souhaite réfléchir ;
- ne répond plus ;
- a choisi une autre solution ;
- projet abandonné ;
- doublon ou devis remplacé ;
- autre.

Une note libre facultative complète le motif. L’interface doit rappeler de ne pas saisir d’information clinique.

Pour un devis accepté, le nombre de relances et le canal ayant précédé la décision sont calculés depuis la chronologie. Ils ne doivent pas être demandés manuellement.

### Valeur obtenue

- distinguer un problème de prix d’un problème de délai ou de suivi ;
- repérer les expirations sans aucune relance ;
- mesurer les motifs dominants par période et tranche de montant ;
- éviter de décider à partir d’impressions isolées.

## P1 – Tableau de bord conversion

### Vue recommandée

Le tableau de bord reste compact et mène vers les devis concernés :

- **À faire maintenant :** compteurs cliquables de la file d’action ;
- **Entonnoir :** envoyés, acceptés ou facturés, refusés, expirés, encore en attente ;
- **Valeur :** montant envoyé, accepté et en attente ;
- **Délai :** médiane entre envoi et acceptation ;
- **Relances :** acceptations sans relance, après une relance, après plusieurs relances ;
- **Pertes :** trois premiers motifs de refus ou d’expiration.

Filtres : mois, trimestre, période personnalisée, poste ou utilisateur en mode central, canal et type de tarif.

Chaque indicateur doit ouvrir la liste filtrée qui le compose. Un chiffre non explicable et non vérifiable dans les devis ne doit pas être affiché.

### Export de pilotage

Exporter la période et les filtres actifs en CSV avec deux modes :

- **Opérationnel :** numéro, client, montant, statut, dates, canal, nombre de relances et motif ;
- **Anonymisé :** identifiant aléatoire stable dans l’export, montants, statuts, délais, canal et motif, sans nom, téléphone, e-mail, adresse ni note libre.

L’export doit signaler clairement lorsqu’il contient des données nominatives.

## P2 – Séquences de relance assistées

### Principe

Faire évoluer l’unique « prochaine relance » vers une petite séquence configurable, par exemple :

1. J+3 : message bref de vérification de réception ;
2. J+7 : proposition de répondre aux questions ;
3. J+14 : dernier suivi avant expiration.

Chaque étape contient une date, un canal préféré et un modèle de message. BCDevis prépare le contenu, mais la personne conserve la décision et déclenche elle-même l’envoi.

### Garde-fous

- deux ou trois étapes maximum par défaut ;
- possibilité d’arrêter, sauter ou reprogrammer la séquence ;
- arrêt immédiat à l’acceptation, au refus, à l’expiration ou à la facturation ;
- aucune fermeture automatique pour « absence de réponse » ;
- aucun envoi automatique en arrière-plan ;
- texte sans information médicale et coordonnées issues du devis figé.

### Mesure

La chronologie doit distinguer **relance prévue**, **relance préparée** et **relance confirmée comme envoyée**. Seule cette dernière compte dans les statistiques.

## P2 – Versions et continuité documentaire

### Comparaison V1/V2

Afficher avant ouverture :

- prestations ajoutées, retirées ou modifiées ;
- quantités et séances offertes ;
- remise, TVA et total ;
- conditions et validité ;
- variation absolue et en pourcentage du montant.

Le tableau de bord consolide la chaîne de versions sous une seule opportunité. La version acceptée reste identifiable et aucune version historique n’est modifiée.

### Devis accepté → facture envoyée

- rendre visible le délai depuis l’acceptation ;
- conserver un lien direct du devis vers le PDF de facture archivé ;
- signaler un devis accepté sans facture après le délai choisi ;
- distinguer « facture importée » de « facture envoyée » seulement si l’usage réel exige cette preuve supplémentaire ;
- ne pas ajouter de statut payé, d’encaissement ou d’écriture comptable dans ce périmètre.

## P3 – Analyse des facteurs de conversion

À activer seulement lorsque le volume est suffisant, avec les effectifs affichés pour éviter les conclusions trompeuses :

- conversion par type de tarif : séance, pack, étudiant ;
- conversion par famille de soins ;
- conversion par canal d’envoi ;
- conversion par tranche de montant ;
- conversion avec ou sans remise ;
- délai de décision selon le nombre de relances ;
- comparaison entre périodes équivalentes.

Cette vue décrit des corrélations. Elle ne doit pas prétendre expliquer seule la décision du client ni produire une recommandation automatisée individuelle.

## Séquencement recommandé

### Lot 0 – Corriger la lecture du parcours

- créer et tester les fonctions de cohorte et de consolidation des versions ;
- compter les statuts `Accepté` et `Facture envoyée` dans les conversions ;
- ajouter le compteur **Acceptés à facturer** ;
- établir une mesure de référence sur les données disponibles.

**Résultat attendu :** les chiffres sont justes avant de construire une nouvelle interface.

### Lot 1 – Livrer la valeur quotidienne

- créer la vue **Aujourd’hui** ;
- ajouter les quatre sections et leurs actions directes ;
- ajouter recherche, filtres et dates de report ;
- conserver le fonctionnement local et hors ligne.

**Résultat attendu :** l’utilisateur sait quoi traiter dès l’ouverture de BCDevis.

### Lot 2 – Apprendre des décisions

- enregistrer les motifs structurés de refus et d’expiration ;
- livrer le tableau de bord et l’export CSV ;
- rendre chaque indicateur vérifiable par sa liste de devis.

**Résultat attendu :** la clinique sait où elle perd des opportunités et peut mesurer une amélioration.

### Lot 3 – Accélérer sans automatiser la relation

- ajouter les séquences et modèles de relance ;
- confirmer manuellement chaque envoi ;
- mesurer l’effet des relances sur la décision.

**Résultat attendu :** le suivi est plus régulier sans communication incontrôlée.

### Lot 4 – Consolider les versions et la facture

- comparer V1/V2 ;
- consolider les chaînes dans les indicateurs ;
- relier directement devis, version acceptée et facture PDF.

**Résultat attendu :** le parcours complet reste lisible sans doublon statistique.

## Mesure du succès

Avant de fixer une cible, relever une base sur au moins quatre semaines complètes :

- part des devis prêts envoyés sous 24 heures ;
- part des relances réalisées au plus tard le jour prévu ;
- part des devis expirés sans relance confirmée ;
- taux de conversion par cohorte d’envoi ;
- délai médian d’envoi à décision ;
- délai médian d’acceptation à facture envoyée ;
- nombre de brouillons anciens et de devis acceptés non facturés.

Après le Lot 1, comparer quatre nouvelles semaines à cette base. Une amélioration doit être attribuée à un indicateur mesuré, pas seulement au nombre de fonctions livrées.

## Données et architecture

### Données dérivables immédiatement

- statut, dates clés, montant, ancienneté et prochaine relance ;
- nombre de relances confirmé par les événements ;
- canal d’envoi ;
- chaîne de versions ;
- délai entre acceptation et facture.

### Petite évolution de schéma à prévoir

- motif structuré de refus ou d’expiration ;
- date de report d’une action hors relance ;
- étapes d’une séquence de relance ;
- confirmation qu’une relance préparée a réellement été envoyée.

Ces champs doivent être assainis à l’import, fusionnés explicitement en mode central et couverts par une migration de la base locale. Les notes libres restent bornées et ne sont jamais incluses dans l’export anonymisé.

### Performance

Les agrégations peuvent d’abord être calculées localement à l’ouverture de la vue. Avant toute optimisation, mesurer avec 100, 500 et 1 000 devis. Introduire un cache ou une pagination seulement si les temps observés le justifient.

## Hors périmètre

- envoi automatique de messages ou de relances ;
- notation prédictive opaque ou décision produite par une IA ;
- dossier médical, diagnostic ou notes cliniques ;
- agenda de rendez-vous ;
- encaissement, paiement, rappel de facture ou comptabilité ;
- changement automatique d’un statut commercial sans confirmation, hors expiration déjà définie ;
- classement des collaborateurs présenté comme un objectif de performance individuelle.

## Décision recommandée

Commencer par **Lot 0 + Lot 1**. C’est la combinaison offrant la meilleure plus-value immédiate : elle exploite les données actuelles, ne dépend pas du serveur central, réduit les oublis sur tout le parcours et prépare des mesures fiables avant d’ajouter des automatismes.

Le premier prototype doit tenir dans une seule vue **Aujourd’hui** avec quatre compteurs cliquables : **Brouillons à terminer**, **Prêts à envoyer**, **À relancer** et **Acceptés à facturer**.