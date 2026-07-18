# Bellecour Devis — version portable 4.17

Application autonome de création de devis pour Clinique Bellecour. Elle fonctionne sans serveur, sans compte et sans installation.

## Lancer l’application

- Double-cliquer sur `Lancer Bellecour Devis.cmd` : c’est l’unique fichier à exécuter.
- Le lanceur ouvre l’application avec son propre profil local, stocké dans `data/browser-profile`. Les préférences, le brouillon et l’historique restent donc disponibles après redémarrage, sans dépendre du navigateur personnel.

## Interface tactile

- Deux zones seulement : prestations à gauche et caisse à droite.
- Sur ordinateur, la caisse est élargie afin que ses informations restent visibles dans une seule vue.
- Trois modes de prestation en tête : Séance, Pack et Étudiant −50 %.
- L’accordéon reste volontairement sobre : nom, mode actif et durée, sans répéter les montants.
- Le prix apparaît uniquement après ajout dans la caisse.
- Les familles déplient leurs soins directement dessous ; toucher un soin l’ajoute à la caisse.
- Le mode Étudiant réduit directement le prix de chaque soin selon le pourcentage configuré, fixé à 50 % par défaut.
- Toutes les actions principales mesurent au moins 48 px et ne dépendent pas du survol.
- Sur tablette ou téléphone, un grand onglet permet de passer de Prestations à Caisse.
- Sur les écrans peu hauts, prestations et caisse défilent sans masquer les actions finales.

## Parcours

1. Choisir le mode de prestation : Séance, Pack ou Étudiant −50 %.
2. Ouvrir une famille : Visage, Bras & aisselles, Torse & ventre, Dos & nuque, Maillot, Jambes & pieds, Électrolyse, Médecine esthétique, Zones combinées ou Consultations.
3. Toucher le soin désiré : il est ajouté directement à la caisse avec le prix et les conditions du mode actif.
4. Ajuster dans la caisse les quantités payées et, pour un pack, les séances offertes. Les séances offertes apparaissent sur le devis mais ne sont jamais facturées.

## Fonctions incluses

- 82 prestations tarifables issues du catalogue fourni, regroupées en 10 familles pratiques.
- Un sélecteur Séance/Pack/Étudiant : le passage vers ou depuis le tarif étudiant applique le nouveau tarif à toutes les prestations du devis, après confirmation. Cette confirmation peut être désactivée depuis sa case « Ne plus afficher ce message ». Le rabais étudiant, configurable et fixé à 50 % par défaut, est affiché séparément dans les totaux pour rendre l’économie visible.
- Réglages globaux du pack et du pourcentage du tarif étudiant.
- Recherche simultanée dans toutes les familles et prestations personnalisées réutilisables.
- Caisse avec prix unitaire modifiable et coupon manuel : pourcentage ou montant CHF. Avec un tarif étudiant, seul le coupon CHF reste cumulable.
- TVA incluse par défaut, désactivable ou ajoutée en plus. Le paiement échelonné propose 3/4/6 mois sous 1’000 CHF, ajoute 10 mois dès 1’000 CHF, puis 12 mois dès 2’000 CHF.
- Date du devis fixée au jour même par défaut, ajustable jusqu’à J+14 ; validité calculée automatiquement à 30 jours calendaires.
- Numéro de devis traçable : `DEV-YYYYMMDDMACHINE001`, avec un compteur quotidien propre à chaque machine. Les anciens numéros locaux sont automatiquement convertis à ce format ; le prochain index est déterminé à partir du compteur enregistré et des devis déjà présents dans la sauvegarde locale.
- Sauvegarde automatique, historique, duplication, import et export JSON.
- Impression ou création d’un PDF A4 avec le détail séance/pack/étudiant et le code coupon appliqué.

## Données et portabilité

Toutes les données restent dans le profil local créé à côté de l’application. Les données créées avec les versions précédentes sont reprises automatiquement lors du lancement avec le même navigateur.

Pour déplacer les données vers un autre ordinateur, utiliser `Devis` > `Sauvegarde complète`, puis `Restaurer` sur l’autre poste. L’archive peut être copiée sur une clé USB et ne dépend pas d’Internet.

## Créer un PDF

Dans la caisse, cliquer sur `Imprimer / PDF`, puis choisir `Enregistrer au format PDF` dans la fenêtre d’impression.

## Transférer un devis

Le bouton WhatsApp prépare un message avec les références, les prestations, le total et la date de validité du devis. Pour joindre le document complet, créer d’abord le PDF puis l’ajouter au message WhatsApp.
