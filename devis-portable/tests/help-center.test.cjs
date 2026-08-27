"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { startPwaServer } = require("../../scripts/pwa-server.cjs");

const projectRoot = path.resolve(__dirname, "..", "..");
const appRoot = path.join(projectRoot, "devis-portable");
const read = (name) => fs.readFileSync(path.join(appRoot, name), "utf8");
const html = read("help.html");
const css = read("help.css");
const script = read("help.js");
const index = read("index.html");
const app = read("app.js");
const serviceWorker = read("service-worker.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

for (const file of ["help.html", "help.css", "help.js"]) {
  const filePath = path.join(appRoot, file);
  assert.ok(fs.existsSync(filePath), `${file} doit être embarqué`);
  assert.ok(fs.statSync(filePath).size > 500, `${file} ne doit pas être vide`);
}

const topics = [...html.matchAll(/<article class="[^"]*help-topic[^"]*" id="([^"]+)" data-help-topic/g)].map((match) => match[1]);
assert.deepEqual(topics, ["overview", "quotes", "contacts", "tracking", "invoices", "central", "migration", "pdf", "shortcuts"], "Le centre d’aide doit couvrir les neuf thèmes annoncés");
for (const label of ["Devis", "Contacts", "Suivi commercial", "Factures", "Base centrale", "Nouvelle adresse", "PDF", "Raccourcis"]) assert.match(html, new RegExp(`>${label}<`));
assert.match(html, /ne transforme pas automatiquement un devis en facture/i, "L’aide doit lever l’ambiguïté entre statut et facture");
assert.match(html, /Brouillon[\s\S]*Prêt à envoyer[\s\S]*Envoyé[\s\S]*Accepté[\s\S]*Refusé[\s\S]*Expiré/, "Le workflow commercial doit être complet");
assert.match(html, /Non archivé, À enregistrer ou Enregistré/, "L’aide doit reprendre les états d’enregistrement réels");
assert.match(html, /Réglages → Devis &amp; suivi/, "L’aide doit reprendre le nom réel du réglage de suivi");
assert.match(html, /Historique[\s\S]*?liste compacte[\s\S]*?dernier statut commercial[\s\S]*?Dans <b>Suivi<\/b>/, "L’aide doit distinguer clairement Historique et Suivi");
assert.match(html, /survolez une fiche[\s\S]*?sur écran tactile, touchez directement la fiche/i, "L’aide doit expliquer l’ouverture adaptée à la souris et au tactile");
assert.match(html, /sans Internet ni PostgreSQL/i, "L’aide doit expliquer l’autonomie du mode local");
assert.match(html, /Le navigateur applique son propre réglage de téléchargement/i, "La limite de destination PDF de la PWA doit être exacte");
assert.equal((html.match(/<dt><kbd>/g) || []).length, 17, "Les dix-sept raccourcis actifs doivent être centralisés dans l’aide HTML");
assert.doesNotMatch(html, /(?:href|src)="https?:\/\//i, "Le centre d’aide ne doit dépendre d’aucune ressource Internet");

assert.match(script, /addEventListener\("input", filterTopics\)/, "La recherche doit filtrer à chaque saisie");
assert.match(script, /normalize\("NFD"\)/, "La recherche doit ignorer les accents");
assert.match(script, /terms\.every\(\(term\) => haystack\.includes\(term\)\)/, "La recherche doit accepter plusieurs mots non contigus");
assert.match(script, /new IntersectionObserver/, "La navigation doit suivre le thème visible");
assert.match(script, /window\.print\(\)/, "L’aide doit rester imprimable depuis sa source HTML");
assert.match(script, /bcdevis-help-close/, "Échap dans l’iframe doit pouvoir fermer la fenêtre d’aide");
assert.match(css, /@media print\{/, "Une mise en page imprimable doit être fournie");
assert.match(css, /@media\(max-width:820px\)/, "L’aide doit adapter sa navigation à la tablette");
assert.match(css, /@media\(max-width:620px\)/, "L’aide doit adapter son contenu au mobile");

assert.match(index, /id="helpButton"[^>]*aria-label="Ouvrir le centre d’aide"[^>]*data-tooltip="Aide"[^>]*>[\s\S]*?<use href="#icon-help">/, "Le header doit exposer un bouton Aide en icône");
assert.doesNotMatch(index, /id="helpButton"[^>]*>[\s\S]*?<span>Aide<\/span>/, "Le bouton Aide ne doit plus afficher de texte");
assert.match(index, /id="helpLayer"[\s\S]*?class="modal-card help-center-modal"[\s\S]*?<iframe id="helpFrame" src="help\.html#overview"/, "L’aide doit s’ouvrir dans une grande surface intégrée");
assert.doesNotMatch(index, /id="shortcutHelpLayer"|class="shortcut-groups"/, "La petite aide dupliquée ne doit plus rester dans l’application");
for (const topic of ["quotes", "contacts", "tracking", "central", "migration", "pdf"]) assert.match(index, new RegExp(`data-help-topic="${topic}"`), `Un accès contextuel ${topic} doit être présent`);
assert.match(app, /function openHelp\(topic = "overview"\)/, "L’application doit disposer d’une ouverture thématique unique");
assert.match(app, /event\.key === "\?"[\s\S]*?openHelp\("shortcuts"\)/, "Le raccourci ? doit ouvrir directement le thème Raccourcis");
assert.match(app, /activeCentralDocumentView === "invoices" \? "invoices" : "central"/, "La bibliothèque doit proposer l’aide adaptée à sa vue");

for (const asset of ["./help.html", "./help.css", "./help.js"]) assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${asset} doit faire partie du cache hors ligne`);
assert.match(serviceWorker, new RegExp(`CACHE_NAME = "bcdevis-pwa-v${packageJson.version.replaceAll(".", "\\.")}-touch-ipad-smartphone-documents-help-contacts"`), "Le cache PWA doit être invalidé pour le centre d’aide et les contacts");
assert.match(serviceWorker, /caches\.match\(request\)[\s\S]*?cached \|\| caches\.match\("\.\/index\.html"\)/, "Une navigation directe vers l’aide doit retrouver sa propre page hors ligne");
assert.ok(packageJson.build.files.includes("devis-portable/**"), "Le packaging Electron doit inclure le centre d’aide");

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

(async () => {
  const { server, url } = await startPwaServer({ port: 0 });
  try {
    const resources = await Promise.all(["help.html", "help.css", "help.js"].map((file) => get(new URL(file, url))));
    const expectedTypes = [/^text\/html/, /^text\/css/, /^(?:text|application)\/javascript/];
    resources.forEach((resource, index) => {
      assert.equal(resource.status, 200);
      assert.match(resource.headers["content-type"], expectedTypes[index]);
      assert.ok(resource.body.length > 500);
    });
    assert.equal(resources[0].body.length, (await fsp.stat(path.join(appRoot, "help.html"))).size);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("HELP_CENTER_TESTS_OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
