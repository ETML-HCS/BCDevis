<div class="document-cover">
  <p class="kicker">CLINIQUE BELLECOUR</p>
  <h1>Utilisation rapide</h1>
  <p>Les gestes essentiels pour créer, enregistrer et transmettre un devis avec BCDevis.</p>
  <p class="version">Version 7.1.1 - Windows, Linux, macOS, ChromeOS et iPadOS</p>
</div>

<style>
@media print {
  body { font-size: 9.4pt; line-height: 1.36; }
  h2 { margin: 17px 0 8px; padding: 6px 10px; font-size: 15pt; break-after: avoid; page-break-after: avoid; }
  h3 { margin: 11px 0 4px; font-size: 11.2pt; }
  ul, ol { margin: 5px 0; }
  li {
    display: list-item;
    width: 100%;
    margin: 1px 0;
    break-inside: avoid;
  }
  .callout { margin: 8px 0; padding: 8px 10px; }
  .page-break-before { break-before: page; page-break-before: always; }
}
</style>

<div class="callout"><strong>Aide intégrée :</strong> le bouton <strong>Aide</strong> ouvre un centre d’aide HTML avec recherche par thèmes. Il reste disponible hors ligne dans Electron et la PWA, sans Internet ni PostgreSQL, et peut être imprimé directement.</div>

## 1. Ouvrir BCDevis

### Windows

Double-cliquez sur `BCDevis-7.1.1.exe`. Aucun programme d'installation n'est nécessaire.

Le dossier `data` est créé à côté de l'application au premier lancement. Gardez toujours l'EXE et ce dossier ensemble : ils contiennent les réglages, le brouillon et l'historique.

### Linux

Rendez le fichier exécutable une seule fois, puis ouvrez-le :

```bash
chmod +x BCDevis-7.1.1-linux-x86_64.AppImage
./BCDevis-7.1.1-linux-x86_64.AppImage
```

Les données sont conservées dans le profil local de l'utilisateur.

### ChromeOS

La version ChromeOS est une PWA. L'archive `BCDevis-7.1.1-chromeos.zip` doit d'abord être décompressée et son dossier `site` publié sur une adresse HTTPS.

Sur le Chromebook, ouvrez cette adresse dans Chrome, puis choisissez **Caster, enregistrer et partager > Installer la page en tant qu'application**. Les données restent dans le profil Chrome utilisé.

### iPadOS

Ouvrez la même adresse HTTPS dans Safari, puis choisissez **Partager > Sur l’écran d’accueil**. La détection iPad est automatique par défaut et adapte les zones tactiles en portrait, en paysage et en Split View.

<div class="callout"><strong>Option pratique :</strong> dans Réglages > Interface, activez Lancer au démarrage si BCDevis doit s'ouvrir automatiquement avec la session Windows ou Linux.</div>

<div class="callout"><strong>Fonctions récentes :</strong><br><strong>Suivi commercial</strong> : activez Réglages > Devis > Suivi des devis pour retrouver les statuts, les notes, les prochaines relances, les compteurs et les rappels au démarrage. Les états terminaux sont verrouillés et l’action Créer une V2 protège l’ancienne version.<br><strong>Factures</strong> : depuis un devis accepté, importez la facture envoyée pour la sortir du suivi actif et la retrouver dans la bibliothèque Factures.<br><strong>Affichage</strong> : dans Catalogue > Vue, choisissez Auto, Mobile ou Bureau ; le choix reste propre à ce poste.<br><strong>Mode centralisé V7</strong> : si plusieurs postes doivent partager les mêmes devis, renseignez dans Réglages > Données l’adresse HTTPS et le compte fournis par l’administrateur. Le mode local reste disponible sans serveur.</div>

## 2. Créer un devis en 8 gestes

Dans **Réglages > Interface > Navigation**, choisissez **Tuiles** pour parcourir les familles en accordéon ou **Corps interactif** pour utiliser le mannequin Femme/Homme et Face/Dos. Le choix est mémorisé.

L’optimisation iPad utilise **Automatique** par défaut sur les nouveaux profils : elle s’active uniquement lorsque iPadOS est reconnu. Choisissez **Toujours** pour la forcer ou **Désactivée** pour conserver le responsive standard. Ce choix ne change pas le PDF et ne remplace pas un choix déjà enregistré.

Pour corriger le nom, le temps, le prix ou le pictogramme d’un soin, utilisez **Réglages > Interface > Catalogue > Éditeur des tuiles**. L’aperçu se met à jour pendant la saisie et le filtre **Modifiées** permet de retrouver rapidement les personnalisations. Cliquez sur **Enregistrer** pour les appliquer ; les changements restent locaux et réversibles.

1. Choisissez le tarif en haut : **Séance**, **Pack** ou **Étudiant -50 %**.
2. Recherchez un soin avec `Ctrl + K`, ou ouvrez une famille.
3. Si vous utilisez le **Corps interactif**, choisissez Femme/Homme et Face/Dos, puis cliquez sur une zone.
4. Cliquez sur un soin pour l'ajouter au **Devis**.
5. Cliquez sur le pictogramme client, choisissez un contact du répertoire ou créez-en un, puis complétez au minimum son nom.
6. Vérifiez la date, les quantités, le prix, la TVA et le total.
7. Cliquez sur **Enregistrer** pour placer le devis dans l'historique ; l’indicateur d’archivage passe de **Non archivé** à **Enregistré**.
8. Choisissez **Imprimer**, **PDF**, **E-mail** ou **À joindre**.

## 3. Ajuster une ligne

- Bouton **−** : diminuer la quantité.
- Bouton **+** : augmenter la quantité.
- Les mêmes boutons règlent séparément les séances payées et offertes d’un pack.
- Avec une souris : allez au bord droit de la ligne pour révéler la corbeille.
- En mode iPad ou Smartphone : la première utilisation rappelle le geste ; balayez vers la gauche, touchez la corbeille, puis utilisez **Annuler** si nécessaire.
- **+1 offerte** : transformer une quantité admissible en pack.

Pour un soin absent du catalogue ou avec tarif libre, utilisez **Catalogue > Sur mesure**. Le libellé complet apparaît au survol.

## 4. Enregistrer et retrouver

- **Enregistrer** archive le devis.
- **Historique** affiche tous les devis enregistrés.
- Un clic sur une carte de l'historique rouvre le devis.
- Le menu `...` permet de dupliquer, exporter ou importer un devis.

Le répertoire client se recherche par nom, téléphone, e-mail, société, ville ou référence. **Plus d’informations** affiche l’adresse détaillée, la date de naissance, la langue, la référence et les notes. **Importer** accepte CSV, vCard et JSON ; les boutons CSV, vCard et JSON exportent le répertoire complet. Les doublons sont fusionnés. Les coordonnées choisies sont copiées dans le devis et restent inchangées dans les devis déjà enregistrés.

L’indicateur discret de la caisse affiche seulement **Non archivé**, **À enregistrer** ou **Enregistré**. Les statuts commerciaux restent dans **Mes devis > Suivi** afin de ne pas surcharger la création du devis.

Pour suivre les réponses des clients, activez **Réglages > Devis & suivi > Suivi des devis**. L’onglet **Historique** reste une liste compacte de tous les devis enregistrés avec leur tag de statut. L’onglet **Suivi** permet de filtrer les devis ; le triangle ouvre le parcours contrôlé **Brouillon > Prêt à envoyer > Envoyé > Accepté / Refusé / Expiré**, les notes et la prochaine relance. Un état terminal verrouille le devis ; **Créer une V2** permet de poursuivre sans l’écraser. Depuis **Accepté**, **Importer la facture envoyée** archive le PDF, retire le devis du suivi actif et place le fichier dans **Factures**.

Le fichier `MODELE-DEVIS-V7.json` fourni avec le livrable peut être importé depuis `...` > **Importer**. Il crée un nouveau devis vierge avec la date, la numérotation et les réglages actuels.

## 5. Connecter ce poste à la base centrale

Dans **Réglages > Données** :

1. activez **Connecter ce poste** ;
2. renseignez l’adresse HTTPS de l’API, l’e-mail, le mot de passe et le nom de l’appareil ;
3. cliquez sur **Tester le serveur** et vérifiez la mention **PostgreSQL prêt** ;
4. cliquez sur **Se connecter**.

Le panneau affiche ensuite le code du poste, la révision et la dernière synchronisation. Les devis, compteurs et réglages métier sont partagés. Le brouillon ouvert, le thème et les préférences d’affichage restent locaux. Le mot de passe PostgreSQL n’est jamais saisi dans l’application : il reste sur le serveur.

Après la connexion, vous pouvez activer **Numéros uniques centralisés** puis enregistrer les réglages. PostgreSQL réserve des numéros sans doublon pour tous les postes et en garde quelques-uns sur l’appareil pour une coupure réseau. Des trous sont possibles si un numéro réservé n’est pas utilisé.

Après connexion, les boutons **Documents partagés** et **Factures partagées**, avec deux pictogrammes distincts, ouvrent la bibliothèque centrale. Importez un PDF de 8 Mo maximum, recherchez-le, puis affichez-le, téléchargez-le ou imprimez-le. Sans serveur, les boutons sont masqués et les fichiers ne sont pas disponibles localement.

En cas de coupure, continuez à travailler normalement. Les changements restent localement en attente. Si deux postes ont modifié le même devis, choisissez explicitement la version locale ou la version serveur dans ce même panneau ; BCDevis crée d’abord une sauvegarde JSON.

## 6. Créer ou envoyer le PDF

- **PDF** crée le devis A4 dans le dossier choisi sous **Réglages > Entreprise > Fichiers PDF** ; **Téléchargements** est utilisé par défaut. Sous ChromeOS ou dans la PWA, le navigateur choisit l’emplacement via **Enregistrer au format PDF**.
- **Imprimer** ouvre l'impression du système.
- **E-mail** prépare directement un message avec le PDF joint.
- **À joindre > WhatsApp** prépare le PDF et ouvre le message ; ajoutez ensuite manuellement le fichier.
- **À joindre > Outlook** ouvre un message prérempli ; joignez le PDF créé dans le dossier configuré.

Un PDF existant n'est jamais écrasé : BCDevis ajoute un numéro au nouveau fichier. Les préfixes sont configurables séparément ; `DEV-20260806A001` et `FAC-20260806A001` conservent le même poste `A`. Une facture n’est classée et le devis n’est clôturé qu’après import réussi du PDF, jamais par un simple changement de statut.

## 7. Sauvegarder avant un changement d'ordinateur

Ouvrez **Historique**, puis cliquez sur **Sauvegarde complète**. Copiez le fichier JSON obtenu sur une clé USB ou un espace sécurisé.

Sur le nouvel ordinateur, ouvrez **Historique > Restaurer**. La restauration remplace les données locales présentes : faites une sauvegarde avant de confirmer.

<div class="page-break-before"></div>

## 8. Changer l'adresse du site

Sur l'ancienne adresse, ouvrez **Réglages > Données > Changer l’adresse du site** :

1. vérifiez `https://bcd.athys.ch/` ;
2. cliquez sur **1. Préparer le transfert** et conservez le fichier JSON téléchargé dans un emplacement sécurisé ;
3. cliquez sur **2. Ouvrir la nouvelle adresse** ;
4. sur la nouvelle page, cliquez sur **3. Importer ici**, choisissez le fichier et confirmez ;
5. vérifiez les devis et réglages. Si la base centrale était activée, saisissez à nouveau le mot de passe pour reconnecter le poste.

Le fichier contient les données locales, mais aucun mot de passe ni jeton de session. Supprimez-le seulement après avoir vérifié la nouvelle adresse.

## En cas de doute

- PDF introuvable : vérifiez **Réglages > Entreprise > Fichiers PDF**, ou le dossier choisi par le navigateur dans la PWA.
- Devis absent de l'historique : cliquez sur **Enregistrer**.
- Données Windows absentes : vérifiez que le dossier `data` se trouve toujours à côté de l'EXE.
- Synchronisation absente : ouvrez **Réglages > Données**, testez le serveur et vérifiez **PostgreSQL prêt**.
