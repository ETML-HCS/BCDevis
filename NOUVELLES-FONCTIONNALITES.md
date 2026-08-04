# BCDevis — Nouvelles fonctionnalités envisagées

## Statut du document

- **Date de la proposition :** 3 août 2026
- **Version de référence :** BCDevis 5.3.5
- **État :** idées à évaluer, aucune fonction décrite ici n’est considérée comme engagée ou implémentée
- **Document associé :** [Améliorations recommandées](AMELIORATIONS-RECOMMANDEES.md)

## Orientation produit proposée

BCDevis remplit déjà correctement son rôle de création, sauvegarde, impression et partage de devis. Les nouvelles fonctions devraient prioritairement l’aider à devenir un outil léger de suivi commercial, sans le transformer immédiatement en CRM, logiciel médical ou système comptable complet.

Les principes à préserver sont :

- fonctionnement local et hors connexion ;
- interface rapide et peu encombrée ;
- génération PDF professionnelle ;
- portabilité entre Windows, macOS, Linux, ChromeOS et iPadOS ;
- absence de serveur obligatoire pour les usages actuels ;
- ajout progressif des fonctions nécessitant une infrastructure distante.

## F1 — Cycle de vie du devis

### Objectif

Suivre ce qu’il advient d’un devis après sa création.

### Statuts proposés

- Brouillon
- Enregistré
- Envoyé
- Accepté
- Refusé
- Expiré
- Archivé

### Comportement envisagé

- Le statut `Envoyé` peut être proposé après un partage, sans être imposé automatiquement.
- Le statut `Expiré` est calculé depuis la date de validité.
- Une acceptation ou un refus conserve la date et une note facultative.
- Les statuts apparaissent dans l’historique, les filtres et les exports.
- Un devis accepté reste modifiable uniquement par création d’une nouvelle version.

### Valeur attendue

Donner une vision simple des devis en attente et éviter les oublis, sans ajouter un tableau de bord envahissant.

## F2 — Carnet clients local

### Objectif

Éviter de ressaisir les coordonnées d’un client et retrouver rapidement ses devis.

### Fonctionnement envisagé

- Recherche par nom, téléphone ou e-mail.
- Création d’un client depuis le devis.
- Sélection d’un client existant en quelques actions.
- Affichage de ses devis précédents.
- Détection prudente des doublons.
- Fusion manuelle de deux fiches.
- Conservation d’une copie des coordonnées dans chaque devis afin de préserver l’historique du document.

### Points de vigilance

- Protection des données locales.
- Suppression ou anonymisation d’une fiche.
- Absence de modification rétroactive des anciens devis.

## F3 — Relances de devis

### Objectif

Identifier les devis envoyés qui attendent encore une réponse.

### Fonctionnement envisagé

- Définir une date de prochaine relance.
- Afficher une liste sobre des relances du jour ou en retard.
- Proposer un message WhatsApp ou e-mail prérempli.
- Enregistrer la date de la dernière relance.
- Désactiver les relances pour un devis accepté, refusé ou archivé.

### Limite recommandée

Ne pas envoyer automatiquement de message sans validation humaine.

## F4 — Modèles de devis et favoris

### Objectif

Accélérer les propositions récurrentes.

### Fonctions envisagées

- Enregistrer un devis comme modèle sans coordonnées client.
- Créer des ensembles fréquents de soins.
- Ajouter un ensemble complet au devis en une action.
- Épingler des soins favoris en tête du catalogue.
- Dupliquer puis adapter un modèle.
- Importer et exporter les modèles.

### Exemples

- Pack de soins fréquemment associé.
- Proposition type pour une zone du corps.
- Devis étudiant standard.
- Modèle promotionnel temporaire.

## F5 — Versions et historique des modifications

### Objectif

Conserver la trace des propositions successives adressées au même client.

### Fonctionnement envisagé

- Créer une version V2 à partir d’un devis envoyé ou accepté.
- Conserver les versions précédentes en lecture seule.
- Comparer les soins, quantités, rabais et totaux modifiés.
- Indiquer la version dans le PDF.
- Éviter de remplacer silencieusement le document déjà envoyé.

### Valeur attendue

Rendre les échanges plus fiables et limiter les désaccords sur la version acceptée.

## F6 — Signature sur iPad et acceptation locale

### Objectif

Permettre au client d’accepter un devis directement sur l’appareil de la clinique.

### Fonctionnement envisagé

- Mode de lecture dédié avant signature.
- Case d’acceptation des conditions.
- Signature tactile.
- Nom du signataire, date, heure et éventuellement lieu.
- Génération d’un PDF final contenant l’acceptation.
- Verrouillage du devis accepté et création d’une nouvelle version pour toute modification ultérieure.

### Points de vigilance

- Consentement explicite avant signature.
- Protection de la signature enregistrée.
- Validation juridique séparée avant de présenter la fonction comme une signature électronique qualifiée.

## F7 — Plan de traitement issu d’un devis accepté

### Objectif

Transformer un devis accepté en liste opérationnelle de séances à planifier.

### Fonctionnement envisagé

- Convertir les quantités payées et offertes en séances prévues.
- Afficher les séances réalisées et restantes.
- Ajouter une date prévue ou réalisée.
- Conserver le lien avec le devis d’origine.
- Exporter ou imprimer un résumé.

### Limite recommandée

Rester sur un suivi simple. La gestion médicale détaillée et l’agenda complet doivent être considérés comme des produits distincts sauf décision contraire.

## F8 — Export de gestion

### Objectif

Permettre une analyse externe sans surcharger l’interface principale.

### Exports envisagés

- CSV ou tableur des devis par période.
- Répartition par statut.
- Montants proposés, acceptés et refusés.
- Soins les plus souvent proposés.
- Délais moyens entre création et acceptation.
- Liste des devis expirés ou à relancer.

### Principes

- Aucun tableau de bord permanent n’est nécessaire dans le devis.
- Les indicateurs doivent être utiles à une décision concrète.
- Les exports contenant des clients doivent être clairement identifiés comme sensibles.

## F9 — Catalogue versionné et modification en masse

### Objectif

Faciliter les changements de tarifs et la maintenance du catalogue.

### Fonctionnement envisagé

- Exporter le catalogue en CSV ou JSON.
- Réimporter les prix, durées et libellés après validation.
- Prévisualiser les changements avant application.
- Définir une date d’entrée en vigueur.
- Conserver les anciens prix dans les devis existants.
- Annuler la dernière modification globale.
- Comparer le catalogue personnalisé au catalogue de référence.

### Points de vigilance

- Ne jamais recalculer rétroactivement un ancien devis avec les nouveaux tarifs.
- Refuser les doublons d’identifiants et les montants invalides.

## F10 — Sauvegarde chiffrée et synchronisation facultative

### Objectif

Permettre de retrouver les données après perte d’un appareil et, si nécessaire, de travailler sur plusieurs postes.

### Première étape hors ligne

- Sauvegardes automatiques chiffrées dans un emplacement choisi.
- Rotation des dernières sauvegardes.
- Vérification régulière de leur lisibilité.
- Restauration guidée.

### Étape multi-postes facultative

- Synchronisation chiffrée entre appareils autorisés.
- Gestion explicite des conflits.
- Journal des dernières synchronisations.
- Conservation d’un mode hors connexion complet.
- Possibilité de désactiver totalement la synchronisation.

### Décision structurante

Cette fonction nécessite de choisir entre stockage local partagé, stockage cloud privé ou véritable service avec comptes. Elle ne doit pas être ajoutée implicitement au programme actuel.

## F11 — Partage natif amélioré

### Objectif

Réduire les manipulations nécessaires pour envoyer le PDF sur tablette et mobile.

### Pistes envisagées

- Utiliser le partage natif de fichiers lorsque la plateforme le permet.
- Proposer `Partager le PDF` sur iPadOS et ChromeOS.
- Conserver les solutions existantes WhatsApp, Outlook Web et application e-mail.
- Afficher clairement quand une pièce jointe doit encore être ajoutée manuellement.
- Mémoriser le canal préféré sans envoyer automatiquement.

## F12 — Interface multilingue et PDF bilingue

### Objectif

Préparer les devis pour une clientèle francophone et internationale.

### Fonctionnement envisagé

- Interface française conservée par défaut.
- PDF disponible au minimum en français et en anglais.
- Conditions et mentions personnalisables par langue.
- Choix de langue mémorisé par devis.
- Catalogue traduit sans modifier les identifiants internes.

### Point de vigilance

Les traductions des conditions commerciales doivent être validées avant livraison.

## Priorisation proposée

### Priorité haute — prochaine évolution métier

1. F1 — cycle de vie du devis ;
2. F2 — carnet clients local ;
3. F4 — modèles et favoris ;
4. F3 — relances.

Ces quatre fonctions forment ensemble un suivi commercial léger et cohérent.

### Priorité moyenne

5. F5 — versions du devis ;
6. F9 — catalogue versionné ;
7. F8 — exports de gestion ;
8. F11 — partage natif amélioré.

### Priorité ultérieure ou soumise à décision

9. F6 — signature sur iPad ;
10. F7 — plan de traitement ;
11. F10 — synchronisation multi-postes ;
12. F12 — multilingue.

## Proposition de versions

### BCDevis 5.3 — Suivi commercial local

- statuts de devis ;
- recherche et filtres dans l’historique ;
- carnet clients ;
- modèles et favoris ;
- premières relances manuelles.

### BCDevis 5.4 — Traçabilité et protection

- versions de devis ;
- sauvegardes automatiques et chiffrées ;
- catalogue versionné ;
- export de gestion.

### BCDevis 6 — Collaboration facultative

- signature sur iPad ;
- plan de traitement ;
- partage natif avancé ;
- synchronisation multi-postes ou accès distant, uniquement si le besoin est confirmé.

## Questions à valider avant développement

- Combien de personnes utilisent BCDevis aujourd’hui ?
- Chaque personne travaille-t-elle sur un poste distinct ?
- Le même client doit-il être retrouvé sur plusieurs appareils ?
- Quels statuts correspondent au processus réel de la clinique ?
- Une relance doit-elle rester manuelle ou être planifiée ?
- La signature se ferait-elle uniquement sur place ou également à distance ?
- Faut-il suivre les séances après acceptation ou seulement transmettre le devis ?
- Une exportation vers un outil comptable ou un agenda existant est-elle attendue ?
- Quelle durée de conservation doit être appliquée aux devis et coordonnées ?
- Le fonctionnement entièrement hors ligne doit-il rester obligatoire ?

## Règle de décision

Avant d’ajouter une nouvelle fonction :

1. confirmer qu’elle répond à un usage réel et fréquent ;
2. vérifier qu’elle ne surcharge pas le devis principal ;
3. définir son comportement hors connexion ;
4. identifier les nouvelles données conservées ;
5. prévoir export, sauvegarde, suppression et migration ;
6. couvrir les plateformes concernées par des tests ;
7. mettre à jour les documents et livrables dans la même version.
