# BCDevis — version 4.21.1

Application locale de création de devis pour Clinique Bellecour. Elle fonctionne sans serveur ni compte sur Windows, macOS et ChromeOS.

Le guide d’utilisation est disponible dans [MODE-D-EMPLOI.md](MODE-D-EMPLOI.md).

## Lancer l’application sous Windows

- Distribuer uniquement `BCDevis-4.21.1.exe`, généré dans `dist`. C’est l’unique fichier à lancer : aucun navigateur ni installation ne sont nécessaires.
- Au premier lancement, l’application crée un dossier `data` à côté de l’EXE. Il contient uniquement le profil local de BCDevis : préférences, brouillon et historique restent disponibles après redémarrage.
- Pour déplacer l’application, copier l’EXE **et** son dossier `data`. Le dossier est nécessaire afin de conserver les données déjà créées.

`Lancer BCDevis.cmd` reste disponible comme solution de secours pour ouvrir les sources HTML avec Edge/Chrome ; il n’est pas destiné à la distribution.

## Interface tactile

- Deux zones seulement : prestations à gauche et caisse à droite.
- Sur ordinateur, la caisse occupe en permanence toute la hauteur de la fenêtre.
- Trois modes de prestation en tête : Séance, Pack et Étudiant −50 %.
- L’accordéon reste volontairement sobre : nom, mode actif et durée, sans répéter les montants.
- Le prix apparaît uniquement après ajout dans la caisse.
- Les familles déplient leurs soins directement dessous ; toucher un soin l’ajoute à la caisse.
- Le mode Étudiant réduit directement le prix de chaque soin selon le pourcentage configuré, fixé à 50 % par défaut.
- L’en-tête de la caisse donne un accès direct au nouveau devis, à l’enregistrement et à l’historique. La barre supérieure conserve les réglages, les raccourcis et un menu compact pour le catalogue.
- Les commandes Imprimer, PDF et Envoyer restent visibles au bas de la caisse dès qu’une prestation est ajoutée.
- Sur tablette ou téléphone, un grand onglet permet de passer de Prestations à Caisse.
- Sur les écrans peu hauts, prestations et caisse défilent sans bandeau d’actions fixe en bas.

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

Toutes les données restent locales :

- sous Windows portable, dans le dossier `data` placé à côté de l’EXE ;
- sous macOS, dans le profil applicatif BCDevis de l’utilisateur ;
- sous ChromeOS, dans le stockage du profil Chrome qui a installé la PWA.

Pour déplacer les données vers un autre ordinateur ou une autre plateforme, ouvrir **Historique** depuis l’en-tête de la caisse, choisir `Sauvegarde complète`, puis `Restaurer` sur l’autre poste. L’archive JSON peut être copiée sur une clé USB et ne dépend pas d’Internet.

## Créer un PDF

Dans les applications Windows et macOS, la commande `Télécharger le PDF` crée directement le document dans le dossier `Téléchargements`. Un second clic sur le même devis crée un fichier numéroté, sans écraser le précédent. Sous ChromeOS, la même commande ouvre l’impression : choisir `Enregistrer au format PDF`.

Le document est composé automatiquement pour le format A4 : les lignes d’un soin ne sont jamais coupées, les en-têtes du tableau sont répétés sur les pages suivantes et les blocs de total, conditions et signature restent groupés.

Dans `Réglages` > `Votre entreprise`, deux logos peuvent être configurés :

- `Logo de l’application` personnalise l’en-tête à l’écran.
- `Logo du PDF` personnalise uniquement le document imprimé. S’il est laissé vide, le logo de l’application est réutilisé.

Les formats PNG, JPG et WebP sont acceptés jusqu’à 4 Mo. Un PNG transparent donne généralement le résultat le plus élégant. Les logos sont optimisés avant d’être conservés dans la sauvegarde locale.

Dans `Réglages` > `Mentions légales`, l’option `Afficher les zones de signature` ajoute ou retire les lignes `Date et lieu` et `Bon pour accord` du PDF et de l’impression. Elle est activée par défaut.

## Chrome OS / PWA

Le dossier `devis-portable` constitue aussi une PWA installable. Le logo officiel et la famille Red Hat Display sont embarqués : aucun chargement de ressource externe n’est nécessaire pour l’affichage ou l’impression.

Pour la contrôler localement depuis la racine du projet :

```powershell
npm run pwa
```

Ouvrir ensuite `http://127.0.0.1:4173/` dans Chrome. Sur Chromebook, une mise à disposition réelle doit utiliser HTTPS ; Chrome propose alors l’installation depuis sa barre d’adresse ou son menu. Les devis et réglages restent dans le stockage local du profil Chrome utilisé. Le bouton PDF ouvre l’impression Chrome OS, où `Enregistrer au format PDF` produit le même gabarit A4.

Pour assembler l’archive ChromeOS à remettre :

```powershell
npm run chromeos
```

Le livrable est `devis-portable/dist/chromeos/BCDevis-4.21.1-chromeos.zip`. Il contient le dossier statique `site` à publier sur un hébergement HTTPS et une notice d’installation.

Le contrôle automatisé Chrome OS (agent utilisateur CrOS, fenêtre 1365 × 768, PWA, polices, logo et impression A4) se lance avec :

```powershell
npm run test:chromeos
```

Les deux PDF de référence avec signatures activées et désactivées sont écrits dans `output/pdf`.

## Raccourcis clavier

- `Ctrl` / `⌘` + `N` : nouveau devis ; `S` : enregistrer ; `K` ou `/` : rechercher une prestation.
- `Ctrl` / `⌘` + `P` : imprimer ; `Maj` + `S` : créer le PDF ; `,` : ouvrir les réglages.
- `?` ouvre cette aide dans l’application ; `Échap` ferme une fenêtre ou la recherche.
- Dans les choix de tarif et de thème, les flèches gauche/droite ou haut/bas sélectionnent directement l’option suivante.

## Envoyer un devis

La commande **Envoyer** au bas de la caisse propose deux choix :

- **WhatsApp** : prépare le PDF dans **Téléchargements**, puis ouvre WhatsApp avec le message du devis prérempli ;
- **E-mail** : dans l’application de bureau Windows, macOS ou Linux, ouvre un nouveau message avec l’objet, le texte et le PDF déjà joint. Si le client possède une adresse e-mail, elle est utilisée automatiquement. Sinon, le champ destinataire reste vide afin de la saisir dans la messagerie.

Sous Windows, BCDevis utilise Outlook classique lorsqu’il est disponible. Sinon, comme sur macOS et Linux, il crée dans **Téléchargements** un brouillon `.eml` contenant déjà le message et le PDF, puis l’ouvre avec la messagerie par défaut. Il n’ouvre plus de message `mailto:` sans pièce jointe. WhatsApp exige toujours l’ajout manuel du PDF. Sous ChromeOS, où le navigateur ne peut pas joindre automatiquement le document, créez d’abord le PDF avec la commande **PDF**, puis joignez le fichier enregistré.

## Générer les applications de distribution

Sur un poste de préparation avec Node.js installé :

```powershell
npm install
```

Sous Windows, pour l’EXE portable :

```powershell
npm run exe
```

Le fichier à remettre est `devis-portable/dist/BCDevis-4.21.1.exe`. Ne pas distribuer le dossier `win-unpacked`, qui ne sert qu’à la fabrication.

L’EXE est actuellement non signé afin que sa génération reste possible sans certificat de distribution. Windows peut donc demander une confirmation au premier lancement ; pour une diffusion large, configurer un certificat de signature avant de réactiver cette étape.

Sous macOS, pour un DMG universel compatible Mac Intel et Apple Silicon :

```zsh
npm run mac
```

Le fichier à distribuer est `devis-portable/dist/BCDevis-4.21.1-mac.dmg`. Cette commande doit être exécutée depuis un Mac ou un runner CI macOS ; elle est volontairement bloquée sous Windows et Linux. Une signature et une notarisation Apple sont nécessaires avant une diffusion large pour éviter les alertes Gatekeeper.

Sous Linux x64, pour une application portable AppImage :

```bash
npm run linux
```

Le fichier à distribuer est `devis-portable/dist/BCDevis-4.21.1-linux-x86_64.AppImage`. Cette commande doit être exécutée depuis Linux ou un runner CI Linux ; elle est volontairement bloquée sous Windows et macOS. Une fois généré, le fichier doit être rendu exécutable avec `chmod +x` avant son premier lancement.

Le workflow `.github/workflows/livrables.yml` exécute les builds sur les trois systèmes natifs et publie trois artefacts séparés : `BCDevis-Windows`, `BCDevis-macOS` et `BCDevis-ChromeOS`.
