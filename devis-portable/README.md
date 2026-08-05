# BCDevis - version 7.0.2

Application de création de devis pour Clinique Bellecour. Elle reste entièrement utilisable en mode local sur Windows, Linux, macOS, ChromeOS et iPadOS, et peut facultativement synchroniser plusieurs postes avec le serveur PostgreSQL sécurisé de la V7.

## Nouveautés 7.0.2

- L’état du devis affiche désormais **Brouillon**, **Enregistré** ou **Modifié** selon sa version réellement archivée dans **Mes devis**.
- Le suivi commercial facultatif rassemble les statuts, les filtres, la chronologie, les notes, les prochaines relances, les compteurs et les rappels au démarrage.
- Le menu **Catalogue > Vue** permet de choisir **Auto**, **Mobile** ou **Bureau** ; cette préférence reste propre à chaque poste.
- Sur iPad et smartphone, les actions essentielles atteignent désormais au moins 44 px, sans modifier l’interface ordinateur.
- Dans la caisse tactile, un indice explique le balayage vers la gauche et le bouton **Annuler** restaure immédiatement le dernier soin retiré.
- L’éditeur des tuiles propose un aperçu direct, une recherche, des filtres et de meilleurs contrôles tactiles.
- L’icône d’enregistrement a été redessinée en SVG net à toutes les tailles.
- Le nouvel onglet `Réglages > Données` active facultativement la centralisation multi-postes.
- L’application se connecte à une API sécurisée ; elle ne reçoit jamais les identifiants PostgreSQL.
- Les devis enregistrés, le suivi, les tarifs et les réglages métier sont fusionnés entre les appareils autorisés.
- Le brouillon et les préférences d’affichage restent locaux ; le travail continue hors connexion.
- Une modification concurrente n’est jamais écrasée silencieusement : BCDevis demande la version à conserver et crée auparavant une sauvegarde JSON.
- Une option réserve dans PostgreSQL des numéros uniques communs à tous les postes, avec une petite réserve utilisable hors connexion.
- La nouvelle fenêtre **Documents PDF** importe, recherche, affiche et télécharge les PDF partagés.

Documents maintenus avec la version 7 :

- [Mode d’emploi](MODE-D-EMPLOI.md)
- [Utilisation rapide](UTILISATION-RAPIDE.md)
- [Raccourcis clavier V7](RACCOURCIS-CLAVIER-V7.md)
- [Modèle de devis](MODELE-DEVIS-V7.md) et fichier importable [MODELE-DEVIS-V7.json](MODELE-DEVIS-V7.json)

## Lancer l’application sous Windows

- Distribuer uniquement `BCDevis-7.0.2.exe`, généré dans `dist`. C’est l’unique fichier à lancer : aucun navigateur ni installation ne sont nécessaires.
- Au premier lancement, l’application crée un dossier `data` à côté de l’EXE. Il contient uniquement le profil local de BCDevis : préférences, brouillon et historique restent disponibles après redémarrage.
- Pour déplacer l’application, copier l’EXE **et** son dossier `data`. Le dossier est nécessaire afin de conserver les données déjà créées.

`Lancer BCDevis.cmd` ouvre les sources dans leur moteur Electron local afin de conserver toutes les fonctions de bureau, dont le téléchargement direct du PDF. Il nécessite d’avoir lancé `npm install` à la racine du projet et n’est pas destiné à la distribution.

## Interface tactile

- Deux zones seulement : **Soins** à gauche et **Devis** à droite.
- Sur ordinateur, le devis occupe en permanence toute la hauteur de la fenêtre.
- Trois tarifs en tête : Séance, Pack et Étudiant −50 %.
- L’accordéon reste volontairement sobre : nom, mode actif et durée, sans répéter les montants.
- Le prix apparaît uniquement après ajout au devis.
- Les familles déplient leurs soins directement dessous ; toucher un soin l’ajoute au devis.
- Dans `Réglages` > `Interface` > `Navigation`, le mode **Corps interactif** remplace l’accordéon par une silhouette Femme/Homme et Face/Dos : toucher une zone affiche uniquement les soins anatomiquement correspondants, notamment le SIF et les fesses au dos. Le mode **Tuiles** reste disponible à tout moment.
- Le mode Étudiant réduit directement le prix de chaque soin selon le pourcentage configuré, fixé à 50 % par défaut.
- L’en-tête du devis donne un accès direct au nouveau devis, à l’enregistrement et à l’historique. La barre supérieure conserve les documents PDF, les réglages, les raccourcis et un menu compact pour le catalogue.
- Les icônes Imprimer, PDF et Envoyer restent visibles au bas du devis dès qu’un soin est ajouté. Leur nom complet apparaît au survol ou au focus. Envoyer sépare immédiatement l’e-mail avec joint automatique des canaux où le PDF reste à joindre.
- Sur tablette ou téléphone, un grand onglet permet de passer de **Soins** à **Devis**.
- Sur les écrans peu hauts, les deux zones défilent sans bandeau d’actions fixe en bas.

## Parcours

1. Choisir le tarif : Séance, Pack ou Étudiant −50 %.
2. En mode **Tuiles**, ouvrir une famille. En mode **Corps interactif**, choisir Femme/Homme et Face/Dos puis toucher directement la zone du corps ; les soins correspondants apparaissent à côté.
3. Toucher le soin désiré : il est ajouté directement au devis avec le prix et les conditions du tarif actif.
4. Ajuster dans le devis les quantités payées et, pour un pack, les séances offertes. En mode Séance, dès que la quantité atteint le seuil configuré du pack, le bouton **+1 offerte** apparaît. Les séances offertes ne sont jamais facturées.

## Fonctions incluses

- 87 soins tarifables issus du catalogue fourni, regroupés en 10 familles pratiques.
- Un sélecteur Séance/Pack/Étudiant : le passage vers ou depuis le tarif étudiant applique le nouveau tarif à tous les soins du devis, après confirmation. Cette confirmation peut être désactivée depuis sa case « Ne plus afficher ce message ». Le rabais étudiant, configurable et fixé à 50 % par défaut, est affiché séparément dans les totaux pour rendre l’économie visible.
- Réglages globaux du pack et du pourcentage du tarif étudiant.
- Recherche simultanée dans toutes les familles et soins personnalisés réutilisables.
- Navigation corporelle facultative, accessible au clavier, avec morphologies femme/homme, vues face/dos et accès conservé aux consultations, à l’électrolyse, à la médecine esthétique et aux zones combinées.
- Démarrage automatique facultatif avec la session Windows, Linux ou macOS, configurable dans `Réglages` > `Interface`.
- Devis avec quantités explicites et coupon manuel : pourcentage ou montant CHF. Pour un tarif libre, **Catalogue > Sur mesure** crée un soin personnalisé. Avec un tarif étudiant, seul le coupon CHF reste cumulable.
- TVA incluse par défaut, désactivable ou ajoutée en plus. Le paiement échelonné propose 3/4/6 mois sous 1’000 CHF, ajoute 10 mois dès 1’000 CHF, puis 12 mois dès 2’000 CHF.
- Date du devis fixée au jour même et verrouillée par défaut. `Réglages > Devis > Date du devis` peut autoriser sa modification jusqu’à J+14 ; la validité est calculée automatiquement à 30 jours calendaires.
- Numéro de devis traçable : `DEV-YYYYMMDDMACHINE001`, avec un compteur quotidien propre à chaque machine. Les anciens numéros locaux sont automatiquement convertis à ce format ; le prochain index est déterminé à partir du compteur enregistré et des devis déjà présents dans la sauvegarde locale.
- Sauvegarde automatique, historique, duplication, import et export JSON.
- Suivi commercial facultatif avec statuts, couleurs accessibles, filtres, chronologie, notes, dates de relance et rappels au démarrage. La désactivation masque le suivi sans effacer les données.
- Centralisation PostgreSQL facultative avec compte, appareil identifié, numéros uniques en option, synchronisation différée hors ligne, révisions et résolution explicite des conflits.
- Bibliothèque **Documents PDF** centrale avec import, recherche, aperçu et téléchargement des documents de 8 Mo maximum.
- Impression ou création d’un PDF A4 avec le détail séance/pack/étudiant et le code coupon appliqué.

## Données et portabilité

Par défaut, toutes les données restent locales :

- sous Windows portable, dans le dossier `data` placé à côté de l’EXE ;
- sous Linux, dans le profil applicatif BCDevis de l’utilisateur ;
- sous macOS, dans le profil applicatif BCDevis de l’utilisateur ;
- sous ChromeOS, dans le stockage du profil Chrome qui a installé la PWA.

Pour déplacer les données vers un autre ordinateur ou une autre plateforme, ouvrir **Historique** depuis l’en-tête du devis, choisir `Sauvegarde complète`, puis `Restaurer` sur l’autre poste. L’archive JSON peut être copiée sur une clé USB et ne dépend pas d’Internet.

### Centralisation PostgreSQL facultative

Dans **Réglages > Données**, activez **Connecter ce poste**, indiquez l’adresse HTTPS du serveur BCDevis, puis le compte et le nom de l’appareil. **Tester le serveur** vérifie à la fois l’API V7 et la disponibilité de PostgreSQL avant la connexion.

Les données partagées sont les devis enregistrés, l’historique et le suivi, les tarifs personnalisés, les compteurs, l’identité de l’entreprise et les mentions. Le brouillon en cours, le thème, la police, la disposition d’écran et le lancement automatique restent propres à l’appareil.

Chaque poste connecté reçoit un code permanent comme `P01`. Sans autre réglage, il entre dans les prochains numéros de devis et évite les collisions hors connexion. Après connexion, activez **Numéros uniques centralisés** pour utiliser une séquence commune gérée atomiquement par PostgreSQL. BCDevis réserve alors une petite série de numéros utilisables sans réseau ; des numéros peuvent rester inutilisés, mais deux postes ne reçoivent jamais le même.

Le bouton **Documents PDF** apparaît dans la barre supérieure. Il ouvre une fenêtre permettant d’importer un PDF, de le rechercher par titre, numéro de devis ou client, de l’afficher directement et de le télécharger. L’import associe automatiquement le document au devis et au client ouverts. Les PDF, limités à 8 Mo chacun, sont stockés dans PostgreSQL et nécessitent une connexion au serveur pour être consultés.

L’état, la révision centrale et la date de la dernière synchronisation restent visibles dans le panneau. En cas de conflit, choisissez **Conserver la version centrale** ou **Conserver ce poste** ; une sauvegarde locale est téléchargée avant la résolution.

Le serveur et PostgreSQL se déploient séparément. Consultez [BCDevis Central](../central-server/README.md) pour Docker Compose, HTTPS, les variables de connexion SQL, les sauvegardes et la restauration. Les hôte, port, utilisateur et mot de passe PostgreSQL restent exclusivement sur ce serveur.

## Créer un PDF

Dans les applications Windows, Linux et macOS, la commande `Télécharger le PDF` crée directement le document dans le dossier `Téléchargements`. Un second clic sur le même devis crée un fichier numéroté, sans écraser le précédent. Sous ChromeOS, la même commande ouvre l’impression : choisir `Enregistrer au format PDF`.

Le document est composé automatiquement pour le format A4 : les lignes d’un soin ne sont jamais coupées, les en-têtes du tableau sont répétés sur les pages suivantes et les blocs de total, conditions et signature restent groupés.

Dans `Réglages` > `Votre entreprise`, deux logos peuvent être configurés :

- `Logo principal` sert d’identité personnalisée et de remplacement pour le document PDF.
- `Logo du PDF` personnalise uniquement le document imprimé. S’il est laissé vide, le logo principal est réutilisé.

Les formats PNG, JPG et WebP sont acceptés jusqu’à 4 Mo. Un PNG transparent donne généralement le résultat le plus élégant. Les logos sont optimisés avant d’être conservés dans la sauvegarde locale.

Dans `Réglages` > `Mentions légales`, l’option `Afficher les zones de signature` ajoute ou retire les lignes `Date et lieu` et `Bon pour accord` du PDF et de l’impression. Elle est activée par défaut.

## Chrome OS, iPadOS / PWA

Le dossier `devis-portable` constitue aussi une PWA installable. Le logo officiel et la famille Red Hat Display sont embarqués : aucun chargement de ressource externe n’est nécessaire pour l’affichage ou l’impression.

Pour la contrôler localement depuis la racine du projet :

```powershell
npm run pwa
```

Ouvrir ensuite `http://127.0.0.1:4173/` dans Chrome. Sur Chromebook, une mise à disposition réelle doit utiliser HTTPS ; Chrome propose alors l’installation depuis sa barre d’adresse ou son menu. Sur iPad, ouvrez la même adresse HTTPS dans Safari puis utilisez **Partager > Sur l’écran d’accueil**. Les données restent dans le profil local lorsque la centralisation est désactivée ; lorsqu’elle est activée, les données métier sont également synchronisées avec le serveur autorisé. Le bouton PDF ouvre l’impression du système, où l’enregistrement produit le même gabarit A4.

Pour assembler l’archive ChromeOS à remettre :

```powershell
npm run chromeos
```

Le livrable est `devis-portable/dist/chromeos/BCDevis-7.0.2-chromeos.zip`. Il contient le dossier statique `site` à publier sur un hébergement HTTPS et une notice d’installation.

Le contrôle automatisé Chrome OS (agent utilisateur CrOS, fenêtre 1365 × 768, PWA, polices, logo et impression A4) se lance avec :

```powershell
npm run test:chromeos
```

Le contrôle visuel iPad vérifie le paysage, le portrait et Split View, ainsi que les cibles tactiles et l’absence de débordement :

```powershell
npm run test:ipad:visual
```

Les deux PDF de référence avec signatures activées et désactivées sont écrits dans `output/pdf`.

## Raccourcis clavier V7

- Catalogue : `Alt + M`, `Ctrl + K` ou `/`, `Alt + P`, `Ctrl + Maj + N`.
- Devis : `Ctrl + N`, `Ctrl + S`, `Ctrl + H`, `Ctrl + D`, `Ctrl + O`, `Ctrl + E`.
- Sortie : `Ctrl + P`, `Ctrl + Maj + S`, `Ctrl + Alt + W`.
- Application : `Ctrl + ,`, `?`, `Échap`.
- Dans les choix de tarif et de thème, les flèches gauche/droite ou haut/bas sélectionnent directement l’option suivante.

La fiche [RACCOURCIS-CLAVIER-V7.md](RACCOURCIS-CLAVIER-V7.md) documente les 16 commandes.

## Envoyer un devis

Quatre icônes restent visibles au bas du devis : **Imprimer**, **PDF**, **E-mail** et **À joindre**.

- **E-mail** ouvre directement un nouveau message avec l’objet, le texte et le PDF déjà joint. Si le client possède une adresse e-mail, elle est utilisée automatiquement ;
- **À joindre > WhatsApp** prépare le PDF dans **Téléchargements**, puis ouvre WhatsApp avec le message du devis prérempli ;
- **À joindre > Outlook** crée le PDF dans **Téléchargements**, puis ouvre Outlook Web avec le destinataire, l’objet et le texte préremplis. Il reste uniquement à joindre le PDF téléchargé.

Sous Windows, le choix **Application e-mail** utilise Outlook classique lorsqu’il est disponible. Sinon, comme sur macOS et Linux, il crée dans **Téléchargements** un brouillon `.eml` contenant déjà le message et le PDF, puis l’ouvre avec la messagerie par défaut. **Outlook Web** ouvre directement la composition Microsoft 365, mais le navigateur impose de sélectionner manuellement le PDF dans **Téléchargements**. Il n’ouvre plus de message `mailto:` sans pièce jointe. WhatsApp exige également l’ajout manuel du PDF. Sous ChromeOS, créez d’abord le PDF avec la commande **PDF**, puis joignez le fichier enregistré.

## Générer les applications de distribution

Sur un poste de préparation avec Node.js installé :

```powershell
npm install
```

Sous Windows, pour l’EXE portable :

```powershell
npm run exe
```

Le fichier à remettre est `devis-portable/dist/BCDevis-7.0.2.exe`. Ne pas distribuer le dossier `win-unpacked`, qui ne sert qu’à la fabrication.

L’EXE est actuellement non signé afin que sa génération reste possible sans certificat de distribution. Windows peut donc demander une confirmation au premier lancement ; pour une diffusion large, configurer un certificat de signature avant de réactiver cette étape.

Sous macOS, pour un DMG universel compatible Mac Intel et Apple Silicon :

```zsh
npm run mac
```

Le fichier à distribuer est `devis-portable/dist/BCDevis-7.0.2-mac.dmg`. Cette commande doit être exécutée depuis un Mac ou un runner CI macOS ; elle est volontairement bloquée sous Windows et Linux. Une signature et une notarisation Apple sont nécessaires avant une diffusion large pour éviter les alertes Gatekeeper.

Sous Linux x64, pour une application portable AppImage :

```bash
npm run linux
```

Le fichier à distribuer est `devis-portable/dist/BCDevis-7.0.2-linux-x86_64.AppImage`. Cette commande doit être exécutée depuis Linux ou un runner CI Linux ; elle est volontairement bloquée sous Windows et macOS. Une fois généré, le fichier doit être rendu exécutable avec `chmod +x` avant son premier lancement.

Le workflow `.github/workflows/livrables.yml` exécute les builds sur les systèmes natifs et publie quatre artefacts séparés : `BCDevis-Windows`, `BCDevis-Linux`, `BCDevis-macOS` et `BCDevis-ChromeOS`.

## Générer les documents PDF

Après une modification du manuel ou des fiches client :

```powershell
npm run docs:pdf
```

La commande régénère et contrôle les quatre PDF suivis dans `devis-portable`, puis écrit une copie de livraison dans `output/pdf`.
