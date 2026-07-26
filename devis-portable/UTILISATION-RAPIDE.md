<div class="document-cover">
  <p class="kicker">CLINIQUE BELLECOUR</p>
  <h1>Utilisation rapide</h1>
  <p>Les gestes essentiels pour créer, enregistrer et transmettre un devis avec BCDevis.</p>
  <p class="version">Version 5.0.0 - Windows et Linux</p>
</div>

<style>
@media print {
  body { font-size: 9.7pt; line-height: 1.42; }
  h2 { margin: 20px 0 9px; padding: 7px 11px; font-size: 15.5pt; }
  h3 { margin: 14px 0 5px; font-size: 11.5pt; }
  ul, ol { margin: 7px 0; }
  li { margin: 2px 0; }
  .callout { margin: 10px 0; padding: 9px 11px; }
}
</style>

## 1. Ouvrir BCDevis

### Windows

Double-cliquez sur `BCDevis-5.0.0.exe`. Aucun programme d'installation n'est nécessaire.

Le dossier `data` est créé à côté de l'application au premier lancement. Gardez toujours l'EXE et ce dossier ensemble : ils contiennent les réglages, le brouillon et l'historique.

### Linux

Rendez le fichier exécutable une seule fois, puis ouvrez-le :

```bash
chmod +x BCDevis-5.0.0-linux-x86_64.AppImage
./BCDevis-5.0.0-linux-x86_64.AppImage
```

Les données sont conservées dans le profil local de l'utilisateur.

<div class="callout"><strong>Option pratique :</strong> dans Réglages > Interface, activez Lancer au démarrage si BCDevis doit s'ouvrir automatiquement avec la session Windows ou Linux.</div>

## 2. Créer un devis en 8 gestes

1. Choisissez le tarif en haut : **Séance**, **Pack** ou **Étudiant -50 %**.
2. Recherchez un soin avec `Ctrl + K`, ou ouvrez une famille de prestations.
3. Si vous utilisez le **Corps interactif**, choisissez Femme/Homme et Face/Dos, puis cliquez sur une zone.
4. Cliquez sur une prestation pour l'ajouter à la caisse.
5. Cliquez sur **Ajouter un client** et complétez au minimum son nom.
6. Vérifiez la date, les quantités, le prix, la TVA et le total.
7. Cliquez sur **Enregistrer** pour placer le devis dans l'historique.
8. Choisissez **PDF**, **Imprimer** ou **Envoyer**.

## 3. Ajuster une ligne

- Clic sur la quantité : diminuer.
- Clic droit sur la quantité : augmenter.
- Flèches du clavier : modifier la quantité lorsque le contrôle est sélectionné.
- Clic sur le prix : saisir un prix unitaire personnalisé.
- Corbeille : retirer la prestation.
- **Ajouter 1 offerte** : transformer une quantité admissible en pack.

Pour une prestation qui n'existe pas dans le catalogue, utilisez **Menu Catalogue > Objet sur mesure**.

## 4. Enregistrer et retrouver

- **Enregistrer** archive le devis.
- **Historique** affiche tous les devis enregistrés.
- Un clic sur une carte de l'historique rouvre le devis.
- Le menu `...` permet de dupliquer, exporter ou importer un devis.

Le fichier `MODELE-DEVIS-V5.json` fourni avec le livrable peut être importé depuis `...` > **Importer un devis**. Il crée un nouveau devis vierge avec la date, la numérotation et les réglages actuels.

## 5. Créer ou envoyer le PDF

- **PDF** crée le devis A4 dans le dossier Téléchargements.
- **Imprimer** ouvre l'impression du système.
- **Envoyer > E-mail** prépare un message avec le PDF joint.
- **Envoyer > WhatsApp** prépare le PDF et ouvre le message ; ajoutez ensuite manuellement le fichier dans WhatsApp.

Un PDF existant n'est jamais écrasé : BCDevis ajoute un numéro au nouveau fichier.

## 6. Sauvegarder avant un changement d'ordinateur

Ouvrez **Historique**, puis cliquez sur **Sauvegarde complète**. Copiez le fichier JSON obtenu sur une clé USB ou un espace sécurisé.

Sur le nouvel ordinateur, ouvrez **Historique > Restaurer**. La restauration remplace les données locales présentes : faites une sauvegarde avant de confirmer.

## En cas de doute

- PDF introuvable : ouvrez le dossier **Téléchargements**.
- Devis absent de l'historique : cliquez sur **Enregistrer**.
- Données Windows absentes : vérifiez que le dossier `data` se trouve toujours à côté de l'EXE.
- Application déjà ouverte : fermez l'ancienne fenêtre avant de lancer la nouvelle version.
- Tous les raccourcis : ouvrez **Raccourcis** dans l'application ou consultez `RACCOURCIS-CLAVIER-V5.pdf`.
