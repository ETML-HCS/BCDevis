<div class="document-cover">
  <p class="kicker">CLINIQUE BELLECOUR</p>
  <h1>Modèle de devis V7</h1>
  <p>Importer le modèle vierge fourni avec le livrable client.</p>
  <p class="version">BCDevis 7.1.1</p>
</div>

<style>
@media print {
  body { font-size: 9.5pt; line-height: 1.38; }
  h2 { margin: 17px 0 8px; padding: 7px 11px; font-size: 15pt; }
  ul, ol { margin: 6px 0; }
  li { margin: 2px 0; }
  .callout { margin: 9px 0; padding: 8px 10px; }
}
</style>

## Fichier fourni

Le fichier `MODELE-DEVIS-V7.json` est un devis vierge compatible avec BCDevis 7.1.1.

Il ne contient volontairement ni numéro, ni date, ni tarif imposé. Lors de l'import :

- BCDevis attribue la date du jour ;
- le prochain numéro disponible est créé automatiquement ;
- les conditions, la TVA et la configuration actuelles de l'application sont utilisées ;
- aucun devis existant n'est remplacé.

## Importer le modèle

1. Ouvrez BCDevis.
2. Dans l'en-tête du devis, ouvrez le menu `...`.
3. Cliquez sur **Importer**.
4. Sélectionnez `MODELE-DEVIS-V7.json`.
5. Ajoutez le client et les soins.
6. Cliquez sur **Enregistrer**.

## Créer votre propre modèle

Préparez un devis avec les soins et notes souhaités, puis utilisez `...` > **Exporter**.

Pour réutiliser ce fichier :

1. importez-le ;
2. BCDevis lui attribue une nouvelle identité si le numéro existe déjà ;
3. adaptez le client, la date, les quantités et les soins ;
4. enregistrez le nouveau devis.

<div class="callout"><strong>Important :</strong> utilisez <strong>Importer</strong> pour un modèle unique. Utilisez <strong>Historique &gt; Restaurer</strong> uniquement pour une sauvegarde complète, car cette action remplace toutes les données locales.</div>
