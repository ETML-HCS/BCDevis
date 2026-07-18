# Bellecour Devis — version portable 4.20

Application autonome de création de devis pour Clinique Bellecour. Elle fonctionne sans serveur, sans compte et sans installation.

## Lancer l’application

- Distribuer uniquement `Bellecour Devis-4.20.0-portable.exe`, généré dans `dist`. C’est l’unique fichier à lancer : aucun navigateur ni installation ne sont nécessaires.
- Au premier lancement, l’application crée un dossier `data` à côté de l’EXE. Il contient uniquement le profil local de Bellecour Devis : préférences, brouillon et historique restent disponibles après redémarrage.
- Pour déplacer l’application, copier l’EXE **et** son dossier `data`. Le dossier est nécessaire afin de conserver les données déjà créées.

`Lancer Bellecour Devis.cmd` reste disponible comme solution de secours pour ouvrir les sources HTML avec Edge/Chrome ; il n’est pas destiné à la distribution.

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
4. Ajuster dans la caisse les quantités payées et, pour un pack, les séances offertes. En mode Séance, dès que la quantité atteint le seuil configuré du pack, la caisse propose d’ajouter la séance offerte. Les séances offertes apparaissent sur le devis mais ne sont jamais facturées.

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

Toutes les données restent dans le profil local créé à côté de l’application. Les données créées avec les versions précédentes restent accessibles via l’ancien lanceur et peuvent être transférées avec la sauvegarde complète.

Pour déplacer les données vers un autre ordinateur, utiliser `Devis` > `Sauvegarde complète`, puis `Restaurer` sur l’autre poste. L’archive peut être copiée sur une clé USB et ne dépend pas d’Internet.

## Créer un PDF

Dans l’EXE, le bouton `Télécharger le PDF` crée directement le document dans le dossier Windows `Téléchargements`. Un second clic sur le même devis crée un fichier numéroté, sans écraser le précédent. Le bouton `Imprimer` ouvre la fenêtre d’impression Windows. Avec le lanceur de secours, choisir `Enregistrer au format PDF` dans la fenêtre d’impression.

Le document est composé automatiquement pour le format A4 : les lignes d’un soin ne sont jamais coupées, les en-têtes du tableau sont répétés sur les pages suivantes et les blocs de total, conditions et signature restent groupés.

Dans `Réglages` > `Votre entreprise`, deux logos peuvent être configurés :

- `Logo de l’application` personnalise l’en-tête à l’écran.
- `Logo du PDF` personnalise uniquement le document imprimé. S’il est laissé vide, le logo de l’application est réutilisé.

Les formats PNG, JPG et WebP sont acceptés jusqu’à 4 Mo. Un PNG transparent donne généralement le résultat le plus élégant. Les logos sont optimisés avant d’être conservés dans la sauvegarde locale.

## Transférer un devis

Le bouton WhatsApp prépare un message avec les références, les prestations, le total et la date de validité du devis. Pour joindre le document complet, créer d’abord le PDF puis l’ajouter au message WhatsApp.

## Générer l’EXE portable

Sur un poste de préparation avec Node.js installé :

```powershell
npm install
npm run exe
```

Le fichier à remettre est `devis-portable/dist/Bellecour Devis-4.20.0-portable.exe`. Ne pas distribuer le dossier `win-unpacked`, qui ne sert qu’à la fabrication.
