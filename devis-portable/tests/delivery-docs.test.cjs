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
const shortcuts = read("devis-portable/RACCOURCIS-CLAVIER-V5.md");
const templateGuide = read("devis-portable/MODELE-DEVIS-V5.md");
const clientReadme = read("devis-portable/LIRE-MOI-ALEKSANDRA.txt");
const template = readJSON("devis-portable/MODELE-DEVIS-V5.json");
const serviceWorker = read("devis-portable/service-worker.js");

assert.equal(packageJson.version, "5.1.0", "La livraison doit annoncer la version 5.1.0");
assert.match(packageJson.description, /Linux/);
assert.equal(packageJson.scripts["docs:pdf"], "node scripts/run-electron-script.cjs scripts/generate-doc-pdfs.cjs");
assert.ok(packageJson.devDependencies.marked, "Le générateur PDF doit disposer du moteur Markdown");
assert.match(serviceWorker, /bcdevis-pwa-v5\.1\.0/, "Le cache PWA doit suivre la version livrée");

assert.match(workflow, /\n  linux:\n/);
assert.match(workflow, /name: Linux AppImage[\s\S]*?runs-on: ubuntu-latest/);
assert.match(workflow, /xvfb-run -a npm run linux/);
assert.match(workflow, /name: BCDevis-Linux/);
assert.match(workflow, /BCDevis-\*-linux-x86_64\.AppImage/);

for (const document of [readme, manual, quick, shortcuts, templateGuide, clientReadme]) {
  assert.match(document, /5\.1\.0/, "Chaque document client doit annoncer la version 5.1.0");
}
assert.match(readme, /Windows[\s\S]*Linux[\s\S]*macOS[\s\S]*ChromeOS/);
assert.match(manual, /\*\*Linux\*\*/);
assert.match(manual, /Lancer au démarrage/);
assert.match(manual, /Mode Mannequin/);
assert.match(manual, /\*\*Tuiles\*\* reste le mode activé par défaut/);
assert.match(manual, /Corps complet/);
assert.match(manual, /douze zones/);
assert.match(manual, /captures\/04-corps-interactif\.png/);
assert.match(manual, /\*\*Entreprise\*\*[\s\S]*préfixe et nom du poste/);
assert.match(manual, /\*\*Devis\*\* : conditions de paiement/);
assert.match(quick, /BCDevis-5\.1\.0\.exe/);
assert.match(quick, /BCDevis-5\.1\.0-linux-x86_64\.AppImage/);
assert.match(quick, /BCDevis-5\.1\.0-chromeos\.zip/);
assert.match(quick, /adresse HTTPS/);
assert.match(quick, /Réglages > Interface > Navigation/);
assert.match(shortcuts, /ChromeOS/);
assert.match(clientReadme, /3-ChromeOS[\s\S]*BCDevis-5\.1\.0-chromeos\.zip/);
assert.match(clientReadme, /Elle ne s'installe pas directement depuis le[\s\S]*fichier ZIP/);
assert.match(manual, /\*\*Outlook Web\*\*[\s\S]*Téléchargements/);
assert.match(clientReadme, /Outlook Web[\s\S]*Téléchargements/);

const expectedShortcutLabels = [
  "Ouvrir le menu Catalogue",
  "Rechercher une prestation",
  "Afficher ou masquer les prix",
  "Créer un objet sur mesure",
  "Nouveau devis",
  "Enregistrer le devis",
  "Ouvrir l'historique",
  "Dupliquer le devis",
  "Importer un devis",
  "Exporter le devis",
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
assert.equal(template.version, 19);
assert.ok(Array.isArray(template.quote.lines));
assert.equal(template.quote.lines.length, 0);
for (const generatedField of ["id", "number", "date", "validUntil"]) {
  assert.equal(Object.hasOwn(template.quote, generatedField), false, `${generatedField} doit être généré à l'import`);
}

for (const pdfName of [
  "MODE-D-EMPLOI.pdf",
  "UTILISATION-RAPIDE.pdf",
  "RACCOURCIS-CLAVIER-V5.pdf",
  "MODELE-DEVIS-V5.pdf"
]) {
  const pdfPath = path.join(projectRoot, "devis-portable", pdfName);
  assert.ok(fs.existsSync(pdfPath), `${pdfName} doit être livré`);
  const contents = fs.readFileSync(pdfPath);
  assert.equal(contents.subarray(0, 4).toString("ascii"), "%PDF", `${pdfName} doit être un PDF valide`);
  assert.ok(contents.length > 10000, `${pdfName} semble incomplet`);
}

for (const captureName of ["02-reglages.png", "04-corps-interactif.png"]) {
  const capturePath = path.join(projectRoot, "devis-portable", "captures", captureName);
  assert.ok(fs.existsSync(capturePath), `${captureName} doit illustrer le manuel V5`);
  assert.ok(fs.statSync(capturePath).size > 100000, `${captureName} semble incomplet`);
}

console.log("DELIVERY_DOCS_TESTS_OK");
