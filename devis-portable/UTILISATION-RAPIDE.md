<div class="document-cover">
  <p class="kicker">CLINIQUE BELLECOUR</p>
  <h1>Utilisation rapide</h1>
  <p>Les gestes essentiels pour créer, enregistrer et transmettre un devis avec BCDevis.</p>
  <p class="version">Version 7.0.2 - Windows, Linux, macOS, ChromeOS et iPadOS</p>
</div>

<style>
@media print {
  body { font-size: 9.4pt; line-height: 1.36; }
  h2 { margin: 17px 0 8px; padding: 6px 10px; font-size: 15pt; }
  h3 { margin: 11px 0 4px; font-size: 11.2pt; }
  ul, ol { margin: 5px 0; }
  li {
    display: list-item;
    width: 100%;
    margin: 1px 0;
    break-inside: avoid;
  }
  .callout { margin: 8px 0; padding: 8px 10px; }
}
</style>

## 1. Ouvrir BCDevis

### Windows

Double-cliquez sur `BCDevis-7.0.2.exe`. Aucun programme d'installation n'est nécessaire.

Le dossier `data` est créé à côté de l'application au premier lancement. Gardez toujours l'EXE et ce dossier ensemble : ils contiennent les réglages, le brouillon et l'historique.

### Linux

Rendez le fichier exécutable une seule fois, puis ouvrez-le :

```bash
chmod +x BCDevis-7.0.2-linux-x86_64.AppImage
./BCDevis-7.0.2-linux-x86_64.AppImage
```

Les données sont conservées dans le profil local de l'utilisateur.

### ChromeOS

La version ChromeOS est une PWA. L'archive `BCDevis-7.0.2-chromeos.zip` doit d'abord être décompressée et son dossier `site` publié sur une adresse HTTPS.

Sur le Chromebook, ouvrez cette adresse dans Chrome, puis choisissez **Caster, enregistrer et partager > Installer la page en tant qu'application**. Les données restent dans le profil Chrome utilisé.

### iPadOS

Ouvrez la même adresse HTTPS dans Safari, puis choisissez **Partager > Sur l’écran d’accueil**. La détection iPad est automatique par défaut et adapte les zones tactiles en portrait, en paysage et en Split View.

<div class="callout"><strong>Option pratique :</strong> dans Réglages > Interface, activez Lancer au démarrage si BCDevis doit s'ouvrir automatiquement avec la session Windows ou Linux.</div>

<div class="callout"><strong>Fonctions récentes :</strong><br><strong>Suivi commercial</strong> : activez Réglages > Devis > Suivi des devis pour retrouver les statuts, les notes, les prochaines relances, les compteurs et les rappels au démarrage.<br><strong>Affichage</strong> : dans Catalogue > Vue, choisissez Auto, Mobile ou Bureau ; le choix reste propre à ce poste.<br><strong>Mode centralisé V7</strong> : si plusieurs postes doivent partager les mêmes devis, renseignez dans Réglages > Données l’adresse HTTPS et le compte fournis par l’administrateur. Le mode local reste disponible sans serveur.</div>

## 2. Créer un devis en 8 gestes

Dans **Réglages > Interface > Navigation**, choisissez **Tuiles** pour parcourir les familles en accordéon ou **Corps interactif** pour utiliser le mannequin Femme/Homme et Face/Dos. Le choix est mémorisé.

L’optimisation iPad utilise **Automatique** par défaut sur les nouveaux profils : elle s’active uniquement lorsque iPadOS est reconnu. Choisissez **Toujours** pour la forcer ou **Désactivée** pour conserver le responsive standard. Ce choix ne change pas le PDF et ne remplace pas un choix déjà enregistré.

Pour corriger le nom, le temps, le prix ou le pictogramme d’un soin, utilisez **Réglages > Interface > Catalogue > Éditeur des tuiles**. L’aperçu se met à jour pendant la saisie et le filtre **Modifiées** permet de retrouver rapidement les personnalisations. Cliquez sur **Enregistrer** pour les appliquer ; les changements restent locaux et réversibles.

1. Choisissez le tarif en haut : **Séance**, **Pack** ou **Étudiant -50 %**.
2. Recherchez un soin avec `Ctrl + K`, ou ouvrez une famille.
3. Si vous utilisez le **Corps interactif**, choisissez Femme/Homme et Face/Dos, puis cliquez sur une zone.
4. Cliquez sur un soin pour l'ajouter au **Devis**.
5. Cliquez sur **Client** et complétez au minimum son nom.
6. Vérifiez la date, les quantités, le prix, la TVA et le total.
7. Cliquez sur **Enregistrer** pour placer le devis dans l'historique ; l’indicateur passe de **Brouillon** à **Enregistré**.
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

L’indicateur du devis distingue la sauvegarde locale et l’archivage : **Brouillon** n’est pas encore dans l’historique, **Modifié** contient des changements postérieurs au dernier enregistrement et **Enregistré** est à jour dans **Mes devis**.

Pour suivre les réponses des clients, activez **Réglages > Devis > Suivi des devis**. L’Historique affiche alors une couleur et un badge selon le dernier statut. L’onglet **Suivi** permet de filtrer les devis ; le triangle ouvre le parcours **Brouillon > Prêt à envoyer > Envoyé > Accepté / Refusé / Expiré**, les notes et la prochaine relance. Les compteurs résument l’activité et les rappels au démarrage signalent les devis à relancer. Désactiver l’option masque ces informations sans les supprimer.

Le fichier `MODELE-DEVIS-V7.json` fourni avec le livrable peut être importé depuis `...` > **Importer**. Il crée un nouveau devis vierge avec la date, la numérotation et les réglages actuels.

<div class="page-break"></div>

## 5. Connecter ce poste à la base centrale

Dans **Réglages > Données** :

1. activez **Connecter ce poste** ;
2. renseignez l’adresse HTTPS de l’API, l’e-mail, le mot de passe et le nom de l’appareil ;
3. cliquez sur **Tester le serveur** et vérifiez la mention **PostgreSQL prêt** ;
4. cliquez sur **Se connecter**.

Le panneau affiche ensuite le code du poste, la révision et la dernière synchronisation. Les devis, compteurs et réglages métier sont partagés. Le brouillon ouvert, le thème et les préférences d’affichage restent locaux. Le mot de passe PostgreSQL n’est jamais saisi dans l’application : il reste sur le serveur.

Après la connexion, vous pouvez activer **Numéros uniques centralisés** puis enregistrer les réglages. PostgreSQL réserve des numéros sans doublon pour tous les postes et en garde quelques-uns sur l’appareil pour une coupure réseau. Des trous sont possibles si un numéro réservé n’est pas utilisé.

Le bouton **Documents PDF** en haut ouvre la bibliothèque centrale : **Importer un PDF**, rechercher par devis ou client, cliquer sur le document pour l’afficher, puis **Télécharger** si nécessaire. Chaque fichier est limité à 8 Mo et la consultation nécessite la connexion au serveur.

En cas de coupure, continuez à travailler normalement. Les changements restent localement en attente. Si deux postes ont modifié le même devis, choisissez explicitement la version locale ou la version serveur dans ce même panneau ; BCDevis crée d’abord une sauvegarde JSON.

## 6. Créer ou envoyer le PDF

- **PDF** crée le devis A4 dans le dossier Téléchargements. Sous ChromeOS, choisissez **Enregistrer au format PDF** dans la fenêtre d'impression.
- **Imprimer** ouvre l'impression du système.
- **E-mail** prépare directement un message avec le PDF joint.
- **À joindre > WhatsApp** prépare le PDF et ouvre le message ; ajoutez ensuite manuellement le fichier.
- **À joindre > Outlook** ouvre un message prérempli ; joignez le PDF créé dans **Téléchargements**.

Un PDF existant n'est jamais écrasé : BCDevis ajoute un numéro au nouveau fichier.

## 7. Sauvegarder avant un changement d'ordinateur

Ouvrez **Historique**, puis cliquez sur **Sauvegarde complète**. Copiez le fichier JSON obtenu sur une clé USB ou un espace sécurisé.

Sur le nouvel ordinateur, ouvrez **Historique > Restaurer**. La restauration remplace les données locales présentes : faites une sauvegarde avant de confirmer.

## En cas de doute

- PDF introuvable : ouvrez le dossier **Téléchargements**.
- Devis absent de l'historique : cliquez sur **Enregistrer**.
- Données Windows absentes : vérifiez que le dossier `data` se trouve toujours à côté de l'EXE.
- Données ChromeOS absentes : vérifiez que vous utilisez le même profil Chrome.
- Synchronisation absente : ouvrez **Réglages > Données**, testez le serveur et vérifiez **PostgreSQL prêt**.
- Application déjà ouverte : fermez l'ancienne fenêtre avant de lancer la nouvelle version.
- Tous les raccourcis : ouvrez **Raccourcis** dans l'application ou consultez `RACCOURCIS-CLAVIER-V7.pdf`.
