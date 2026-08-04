<div class="document-cover">
  <p class="kicker">CLINIQUE BELLECOUR</p>
  <h1>Utilisation rapide</h1>
  <p>Les gestes essentiels pour créer, enregistrer et transmettre un devis avec BCDevis.</p>
  <p class="version">Version 6.0.0 - Windows, Linux, macOS, ChromeOS et iPadOS</p>
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

Double-cliquez sur `BCDevis-6.0.0.exe`. Aucun programme d'installation n'est nécessaire.

Le dossier `data` est créé à côté de l'application au premier lancement. Gardez toujours l'EXE et ce dossier ensemble : ils contiennent les réglages, le brouillon et l'historique.

### Linux

Rendez le fichier exécutable une seule fois, puis ouvrez-le :

```bash
chmod +x BCDevis-6.0.0-linux-x86_64.AppImage
./BCDevis-6.0.0-linux-x86_64.AppImage
```

Les données sont conservées dans le profil local de l'utilisateur.

### ChromeOS

La version ChromeOS est une PWA. L'archive `BCDevis-6.0.0-chromeos.zip` doit d'abord être décompressée et son dossier `site` publié sur une adresse HTTPS.

Sur le Chromebook, ouvrez cette adresse dans Chrome, puis choisissez **Caster, enregistrer et partager > Installer la page en tant qu'application**. Les données restent dans le profil Chrome utilisé.

### iPadOS

Ouvrez la même adresse HTTPS dans Safari, puis choisissez **Partager > Sur l’écran d’accueil**. Le responsive standard reste actif par défaut en portrait, en paysage et en Split View.

<div class="callout"><strong>Option pratique :</strong> dans Réglages > Interface, activez Lancer au démarrage si BCDevis doit s'ouvrir automatiquement avec la session Windows ou Linux.</div>

## 2. Créer un devis en 8 gestes

Dans **Réglages > Interface > Navigation**, choisissez **Tuiles** pour parcourir les familles en accordéon ou **Corps interactif** pour utiliser le mannequin Femme/Homme et Face/Dos. Le choix est mémorisé.

L’optimisation iPad est **Désactivée** par défaut. Choisissez **Automatique** pour l’activer uniquement lorsque iPadOS est reconnu, ou **Toujours** pour la forcer. Ce choix ne change pas le PDF.

Pour corriger le nom, le temps, le prix ou le pictogramme d’un soin, utilisez **Réglages > Interface > Catalogue > Éditeur des tuiles**. Les changements restent locaux et réversibles.

1. Choisissez le tarif en haut : **Séance**, **Pack** ou **Étudiant -50 %**.
2. Recherchez un soin avec `Ctrl + K`, ou ouvrez une famille.
3. Si vous utilisez le **Corps interactif**, choisissez Femme/Homme et Face/Dos, puis cliquez sur une zone.
4. Cliquez sur un soin pour l'ajouter au **Devis**.
5. Cliquez sur **Client** et complétez au minimum son nom.
6. Vérifiez la date, les quantités, le prix, la TVA et le total.
7. Cliquez sur **Enregistrer** pour placer le devis dans l'historique.
8. Choisissez **Imprimer**, **PDF**, **E-mail** ou **À joindre**.

## 3. Ajuster une ligne

- Bouton **−** : diminuer la quantité.
- Bouton **+** : augmenter la quantité.
- Les mêmes boutons règlent séparément les séances payées et offertes d’un pack.
- Avec une souris : allez au bord droit de la ligne pour révéler la corbeille.
- Sur écran tactile : balayez vers la gauche, puis touchez la corbeille pour supprimer.
- **+1 offerte** : transformer une quantité admissible en pack.

Pour un soin absent du catalogue ou avec tarif libre, utilisez **Catalogue > Sur mesure**. Le libellé complet apparaît au survol.

## 4. Enregistrer et retrouver

- **Enregistrer** archive le devis.
- **Historique** affiche tous les devis enregistrés.
- Un clic sur une carte de l'historique rouvre le devis.
- Le menu `...` permet de dupliquer, exporter ou importer un devis.

Pour suivre les réponses des clients, activez **Réglages > Devis > Suivi des devis**. L’Historique affiche alors une couleur et un badge selon le dernier statut. L’onglet **Suivi** permet de filtrer les devis ; le triangle ouvre les changements de statut, les notes et la prochaine relance. Désactiver l’option masque ces informations sans les supprimer.

Le fichier `MODELE-DEVIS-V6.json` fourni avec le livrable peut être importé depuis `...` > **Importer**. Il crée un nouveau devis vierge avec la date, la numérotation et les réglages actuels.

## 5. Créer ou envoyer le PDF

- **PDF** crée le devis A4 dans le dossier Téléchargements. Sous ChromeOS, choisissez **Enregistrer au format PDF** dans la fenêtre d'impression.
- **Imprimer** ouvre l'impression du système.
- **E-mail** prépare directement un message avec le PDF joint.
- **À joindre > WhatsApp** prépare le PDF et ouvre le message ; ajoutez ensuite manuellement le fichier.
- **À joindre > Outlook** ouvre un message prérempli ; joignez le PDF créé dans **Téléchargements**.

Un PDF existant n'est jamais écrasé : BCDevis ajoute un numéro au nouveau fichier.

## 6. Sauvegarder avant un changement d'ordinateur

Ouvrez **Historique**, puis cliquez sur **Sauvegarde complète**. Copiez le fichier JSON obtenu sur une clé USB ou un espace sécurisé.

Sur le nouvel ordinateur, ouvrez **Historique > Restaurer**. La restauration remplace les données locales présentes : faites une sauvegarde avant de confirmer.

## En cas de doute

- PDF introuvable : ouvrez le dossier **Téléchargements**.
- Devis absent de l'historique : cliquez sur **Enregistrer**.
- Données Windows absentes : vérifiez que le dossier `data` se trouve toujours à côté de l'EXE.
- Données ChromeOS absentes : vérifiez que vous utilisez le même profil Chrome.
- Application déjà ouverte : fermez l'ancienne fenêtre avant de lancer la nouvelle version.
- Tous les raccourcis : ouvrez **Raccourcis** dans l'application ou consultez `RACCOURCIS-CLAVIER-V6.pdf`.
