"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const notices = fs.readFileSync(path.join(root, "THIRD-PARTY-NOTICES.md"), "utf8");

assert.match(app, /const APP_VERSION = 19;/, "La migration locale doit intégrer le choix du catalogue");
assert.match(app, /catalogMode: "tiles"/, "Le mode historique doit rester le choix par défaut");
assert.match(app, /function currentCatalogMode\(\)/, "Le choix sauvegardé doit être normalisé");
assert.match(app, /function renderBodySelector\(\)/, "Le sélecteur corporel doit avoir son propre rendu");
assert.match(app, /function bodyMapMarkup\(side, visibleIds\)/, "Les vues avant et arrière doivent partager un rendu dédié");
assert.match(app, /Corps humain vu de face/, "La vue avant doit être décrite");
assert.match(app, /Corps humain vu de dos/, "La vue arrière doit être décrite");
assert.match(app, /interactive-body-map"[^>]+role="group"/, "La carte doit exposer ses zones interactives aux technologies d’assistance");

for (const family of ["visage", "bras", "torse", "dos", "maillot", "jambes"]) {
  assert.match(app, new RegExp(`region\\("${family}"`), `La silhouette doit exposer la famille ${family}`);
}
for (const family of ["electrolyse", "medecine", "combinees", "consultations"]) {
  assert.match(app, new RegExp(`"${family}"`), `La navigation complémentaire doit conserver ${family}`);
}

assert.match(
  app,
  /data-body-side="front"[\s\S]*data-body-side="back"/,
  "Le sélecteur doit permettre de basculer entre l’avant et l’arrière"
);
assert.match(
  app,
  /BODY_SIDE_FAMILY_IDS\[nextSide\][\s\S]*preferredFamily = nextSide === "back" \? "dos" : "visage"/,
  "Un changement de face doit conserver une zone cohérente avec la silhouette affichée"
);
assert.match(
  app,
  /event\.target\.closest\("svg \[data-body-family\]"\)[\s\S]*\["Enter", " "\]/,
  "Chaque région SVG doit être activable avec Entrée ou Espace"
);
assert.match(
  app,
  /catalogMode: data\.get\("catalogMode"\) === "body" \? "body" : "tiles"/,
  "Le choix du mode doit être sauvegardé avec les autres réglages"
);

assert.match(html, /aria-label="Navigation des prestations"/, "Le réglage doit annoncer son groupe");
assert.match(html, /name="catalogMode" type="radio" value="tiles"/, "Le mode Tuiles doit rester disponible");
assert.match(html, /name="catalogMode" type="radio" value="body"/, "Le mode Corps interactif doit être disponible");
assert.match(html, />Corps interactif</, "Le nouveau mode doit être nommé explicitement");

assert.match(styles, /\.body-selector-layout\{[^}]*grid-template-columns:/, "Le corps et ses résultats doivent former un ensemble lisible");
assert.match(styles, /\.body-region\.active \.body-region-shape\{fill:var\(--taupe\);stroke:#fff\}/, "La zone active doit être nettement mise en évidence");
assert.match(styles, /\.body-region:focus-visible \.body-region-shape/, "Le focus clavier doit être visible sur la silhouette");
assert.match(styles, /@media screen and \(max-width:760px\)\{[\s\S]*?\.body-selector-layout\{grid-template-columns:1fr\}/, "Le sélecteur doit s’empiler sur mobile");

assert.match(notices, /react-native-body-highlighter/, "La source du principe interactif doit être attribuée");
assert.match(notices, /MIT License/, "La licence MIT d’origine doit être conservée");
assert.match(notices, /Copyright \(c\) 2022 ELABBASSI Hicham/, "La notice de copyright d’origine doit être conservée");

console.log("BODY_SELECTOR_TESTS_OK");
