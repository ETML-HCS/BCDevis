"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readJSON = (relativePath) => JSON.parse(read(relativePath));

const packageJson = readJSON("package.json");
const workflow = read(".github/workflows/livrables.yml").replace(/\r\n?/g, "\n");
const readme = read("devis-portable/README.md");
const manual = read("devis-portable/MODE-D-EMPLOI.md");
const quick = read("devis-portable/UTILISATION-RAPIDE.md");
const shortcuts = read("devis-portable/RACCOURCIS-CLAVIER-V7.md");
const templateGuide = read("devis-portable/MODELE-DEVIS-V7.md");
const clientReadme = read("devis-portable/LIRE-MOI-ALEKSANDRA.txt");
const template = readJSON("devis-portable/MODELE-DEVIS-V7.json");
const serviceWorker = read("devis-portable/service-worker.js");
const centralReadme = read("central-server/README.md");
const centralSchema = read("central-server/schema.sql");
const centralCompose = read("central-server/compose.yml");

assert.equal(packageJson.version, "7.1.1", "La livraison doit annoncer la version 7.1.1");
assert.match(packageJson.description, /Linux/);
assert.equal(packageJson.scripts["docs:pdf"], "node scripts/run-electron-script.cjs scripts/generate-doc-pdfs.cjs");
for (const scriptName of ["build:portable", "mac", "linux"]) {
  assert.match(packageJson.scripts[scriptName], /--publish never$/, `${scriptName} ne doit pas publier implicitement depuis un tag`);
}
assert.ok(packageJson.devDependencies.marked, "Le générateur PDF doit disposer du moteur Markdown");
assert.ok(packageJson.dependencies.pg, "PostgreSQL doit être une dépendance de production du serveur central");
assert.match(serviceWorker, /bcdevis-pwa-v7\.1\.1-touch-ipad-smartphone-documents-help/, "Le cache PWA doit suivre la version tactile, les réglages documentaires et le centre d’aide");

assert.match(workflow, /\n  linux:\n/);
assert.match(workflow, /name: Linux AppImage[\s\S]*?runs-on: ubuntu-latest/);
assert.match(workflow, /\n  linux:\n[\s\S]*?Configurer la sandbox Electron sous Linux[\s\S]*?xvfb-run -a npm run linux/);
assert.match(workflow, /xvfb-run -a npm run linux/);
assert.match(workflow, /name: BCDevis-Linux/);
assert.match(workflow, /BCDevis-\*-linux-x86_64\.AppImage/);
assert.match(workflow, /\n  chromeos:\n[\s\S]*?Configurer la sandbox Electron sous Linux[\s\S]*?xvfb-run -a npm run chromeos/);

for (const document of [readme, manual, quick, shortcuts, templateGuide, clientReadme]) {
  assert.match(document, /7\.1\.1/, "Chaque document client doit annoncer la version 7.1.1");
}
assert.match(readme, /Windows[\s\S]*Linux[\s\S]*macOS[\s\S]*ChromeOS/);
assert.match(manual, /\*\*Linux\*\*/);
assert.match(manual, /Lancer au démarrage/);
assert.match(manual, /\*\*iPadOS\*\*[\s\S]*?Réglages > Interface > iPad/);
assert.match(quick, /### iPadOS[\s\S]*?détection iPad est automatique par défaut[\s\S]*?\*\*Automatique\*\* par défaut[\s\S]*?\*\*Toujours\*\*[\s\S]*?\*\*Désactivée\*\*/i);
assert.match(manual, /Mode Mannequin/);
assert.match(manual, /\*\*Tuiles\*\* reste le mode activé par défaut/);
assert.match(manual, /Corps complet/);
assert.match(manual, /douze zones/);
assert.match(manual, /captures\/04-corps-interactif\.png/);
assert.match(manual, /\*\*Entreprise\*\*[\s\S]*préfixes des devis et factures[\s\S]*code poste commun[\s\S]*dossier local des devis PDF/);
assert.match(manual, /\*\*Devis\*\* : conditions de paiement/);
assert.match(quick, /BCDevis-7\.1\.1\.exe/);
assert.match(quick, /BCDevis-7\.1\.1-linux-x86_64\.AppImage/);
assert.match(quick, /BCDevis-7\.1\.1-chromeos\.zip/);
assert.match(quick, /adresse HTTPS/);
assert.match(quick, /Réglages > Interface > Navigation/);
assert.match(shortcuts, /ChromeOS/);
assert.match(clientReadme, /3-ChromeOS[\s\S]*BCDevis-7\.1\.1-chromeos\.zip/);
assert.match(clientReadme, /Elle ne s'installe pas directement depuis le[\s\S]*fichier ZIP/);
assert.match(manual, /\*\*Outlook Web\*\*[\s\S]*dossier configuré/);
assert.match(clientReadme, /DEV-20260806A001[\s\S]*FAC-20260806A001[\s\S]*dossier\s+configuré/);
for (const document of [readme, manual, quick, clientReadme]) {
  assert.match(document, /centre d'aide|centre d’aide/i, "Les documents de livraison doivent orienter vers le centre d’aide HTML");
  assert.match(document, /hors ligne/i, "L’aide HTML doit être annoncée comme disponible hors ligne");
}
for (const document of [readme, manual, quick, clientReadme]) {
  assert.match(document, /Réglages > Données/);
  assert.match(document, /PostgreSQL/);
}
for (const document of [readme, manual, quick, clientReadme]) {
  assert.match(document, /bcd\.athys\.ch/);
  assert.match(document, /mot de passe|mot-de-passe/i, "La migration doit rappeler que les secrets ne sont pas transférés");
}
assert.match(manual, /PostgreSQL n’est jamais ouvert directement aux postes/);
assert.match(manual, /Conflit à résoudre/);
assert.match(quick, /mode local reste disponible sans serveur/);
assert.match(centralReadme, /BCDEVIS_DATABASE_URL/);
assert.match(centralReadme, /HTTPS/);
assert.match(centralReadme, /pg_dump/);
assert.match(centralCompose, /postgres:17-alpine/);
for (const tableName of ["organizations", "users", "devices", "sessions", "workspace_state", "shared_settings", "quote_counters", "custom_services", "catalog_overrides", "quotes", "quote_number_sequences", "quote_number_reservations", "documents", "audit_log"]) {
  assert.match(centralSchema, new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\b`));
}
for (const document of [readme, manual, quick, clientReadme]) {
  assert.match(document, /numéros uniques/i, "Les documents client doivent expliquer la numérotation unique centrale");
  assert.match(document, /Documents partagés/, "Les documents client doivent présenter la bibliothèque centrale avec son libellé actuel");
  assert.match(document, /Suivi (?:commercial|des devis)/i, "Les documents client doivent présenter clairement le suivi commercial");
  assert.match(document, /Auto[\s\S]*Mobile[\s\S]*Bureau/i, "Les documents client doivent présenter les trois modes d’affichage");
}
assert.match(manual, /Brouillon[\s\S]*Prêt à envoyer[\s\S]*Envoyé[\s\S]*Accepté[\s\S]*Refusé[\s\S]*Expiré/, "Le manuel doit expliquer le parcours complet du suivi");
assert.match(quick, /rappels au démarrage/, "La fiche rapide doit signaler les rappels de suivi");
assert.match(centralReadme, /BYTEA/);
assert.match(centralReadme, /8 Mo/);
assert.match(readme, /87 soins tarifables/, "Le README doit reprendre le nombre réel de soins actifs");
assert.match(quick, /Bouton \*\*−\*\*[\s\S]*Bouton \*\*\+\*\*/, "La fiche rapide doit expliquer les contrôles de quantité tactiles");
assert.match(manual, /bord droit[\s\S]*?balayez la ligne vers la gauche[\s\S]*?touchez la corbeille/, "Le manuel doit expliquer les deux modes de suppression sans surcharger la caisse");
assert.match(quick, /bord droit[\s\S]*?balayez vers la gauche[\s\S]*?corbeille/, "La fiche rapide doit expliquer la suppression souris et tactile");
assert.match(manual, /première utilisation[\s\S]*?\*\*Annuler\*\*/, "Le manuel doit expliquer l’indication tactile et l’annulation de suppression");
assert.match(quick, /première utilisation[\s\S]*?\*\*Annuler\*\*/, "La fiche rapide doit expliquer l’indication tactile et l’annulation de suppression");
for (const document of [readme, manual, quick, shortcuts, clientReadme]) {
  assert.doesNotMatch(document, /Objet sur mesure|objet sur mesure|Clic droit sur (?:la quantité|le nombre)|Clic sur le prix|prix unitaire modifiable/i, "Les documents ne doivent plus décrire les anciennes interactions");
}
assert.doesNotMatch(shortcuts, /Sur une quantité sélectionnée, les flèches/i, "La fiche clavier ne doit plus décrire l’ancien contrôle de quantité");
assert.doesNotMatch(templateGuide, /adaptez[^\n]*les prix/i, "Le guide du modèle ne doit pas suggérer une édition directe des prix de ligne");

const expectedShortcutLabels = [
  "Ouvrir le menu Catalogue",
  "Rechercher",
  "Afficher ou masquer les prix",
  "Sur mesure",
  "Nouveau devis",
  "Enregistrer le devis",
  "Ouvrir l'historique",
  "Dupliquer",
  "Importer",
  "Exporter",
  "Imprimer le devis",
  "Télécharger le PDF",
  "Préparer le devis via WhatsApp",
  "Ouvrir les réglages",
  "Afficher l'aide des raccourcis",
  "Fermer un menu, une fenêtre ou la recherche"
];
for (const label of expectedShortcutLabels) assert.match(shortcuts, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal(expectedShortcutLabels.length, 16);

assert.equal(template.type, "atelier-devis-quote");
assert.equal(template.version, 24);
assert.ok(Array.isArray(template.quote.lines));
assert.equal(template.quote.lines.length, 0);
for (const generatedField of ["id", "number", "date", "validUntil"]) {
  assert.equal(Object.hasOwn(template.quote, generatedField), false, `${generatedField} doit être généré à l'import`);
}

for (const pdfName of [
  "MODE-D-EMPLOI.pdf",
  "UTILISATION-RAPIDE.pdf",
  "RACCOURCIS-CLAVIER-V7.pdf",
  "MODELE-DEVIS-V7.pdf"
]) {
  const pdfPath = path.join(projectRoot, "devis-portable", pdfName);
  assert.ok(fs.existsSync(pdfPath), `${pdfName} doit être livré`);
  const contents = fs.readFileSync(pdfPath);
  assert.equal(contents.subarray(0, 4).toString("ascii"), "%PDF", `${pdfName} doit être un PDF valide`);
  assert.ok(contents.length > 10000, `${pdfName} semble incomplet`);
}

for (const captureName of ["02-reglages.png", "04-corps-interactif.png"]) {
  const capturePath = path.join(projectRoot, "devis-portable", "captures", captureName);
  assert.ok(fs.existsSync(capturePath), `${captureName} doit illustrer le manuel V7`);
  assert.ok(fs.statSync(capturePath).size > 100000, `${captureName} semble incomplet`);
}

console.log("DELIVERY_DOCS_TESTS_OK");
