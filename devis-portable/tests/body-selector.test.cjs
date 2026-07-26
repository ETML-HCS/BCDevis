"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const notices = fs.readFileSync(path.join(root, "THIRD-PARTY-NOTICES.md"), "utf8");
const catalogContext = { window: {} };
vm.createContext(catalogContext);
vm.runInContext(fs.readFileSync(path.join(root, "catalog.js"), "utf8"), catalogContext);
const services = catalogContext.window.QUOTE_SERVICES.filter((service) => Number(service.categoryId) !== 36);
const families = catalogContext.window.QUOTE_FAMILIES.filter((family) => family.id !== "all");
const regions = catalogContext.window.QUOTE_BODY_REGIONS;

assert.match(app, /const APP_VERSION = 19;/, "La migration locale doit intégrer le choix du catalogue");
assert.match(app, /catalogMode: "tiles"/, "Le mode historique doit rester le choix par défaut");
assert.match(app, /function currentCatalogMode\(\)/, "Le choix sauvegardé doit être normalisé");
assert.match(app, /function renderBodySelector\(\)/, "Le sélecteur corporel doit avoir son propre rendu");
assert.match(app, /function bodyMapMarkup\(side, visibleIds\)/, "Les vues avant et arrière doivent partager un rendu dédié");
assert.match(app, /Corps humain vu de face/, "La vue avant doit être décrite");
assert.match(app, /Corps humain vu de dos/, "La vue arrière doit être décrite");
assert.match(app, /interactive-body-map[^"]*"[^>]+role="group"/, "La carte doit exposer ses zones interactives aux technologies d’assistance");
assert.match(app, /let activeBodyModel = "female"/, "La silhouette féminine doit être proposée par défaut");
assert.match(app, /data-body-model="female"[^>]+>Femme</, "Le sélecteur doit proposer une morphologie féminine");
assert.match(app, /data-body-model="male"[^>]+>Homme</, "Le sélecteur doit proposer une morphologie masculine");
assert.match(app, /button\[data-body-model\]/, "Le changement de morphologie doit être interactif");

const expectedRegionCounts = {
  "front-visage": 13,
  "front-torse": 5,
  "front-bras": 7,
  "front-maillot": 5,
  "front-jambes": 8,
  "back-scalp": 1,
  "back-dos": 5,
  "back-bras": 7,
  "back-jambes": 9,
  "back-sif": 1
};
assert.equal(regions.length, 10, "La silhouette doit conserver cinq régions exactes par face");
assert.equal(new Set(regions.map((region) => region.id)).size, regions.length, "Chaque région corporelle doit avoir un identifiant unique");

function servicesForRegion(region) {
  const family = families.find((candidate) => candidate.id === region.familyId);
  assert.ok(family, `Famille inconnue pour ${region.id}`);
  const included = Array.isArray(region.includeServiceIds) ? new Set(region.includeServiceIds.map(Number)) : null;
  const excluded = new Set(Array.isArray(region.excludeServiceIds) ? region.excludeServiceIds.map(Number) : []);
  return services.filter((service) => {
    if (!family.categoryIds.includes(Number(service.categoryId))) return false;
    if (included && !included.has(Number(service.id))) return false;
    return !excluded.has(Number(service.id));
  });
}

for (const region of regions) {
  assert.equal(region.id.startsWith(`${region.side}-`), true, `La face de ${region.id} doit être explicite`);
  assert.equal(servicesForRegion(region).length, expectedRegionCounts[region.id], `Nombre de soins incohérent pour ${region.id}`);
  assert.match(app, new RegExp(`region\\("${region.id}"`), `La silhouette doit exposer ${region.id}`);
}

const primaryFamilyIds = new Set(["visage", "bras", "torse", "dos", "maillot", "jambes"]);
const expectedBodyServiceIds = Array.from(services
  .filter((service) => families.some((family) => primaryFamilyIds.has(family.id) && family.categoryIds.includes(Number(service.categoryId))))
  .map((service) => Number(service.id)))
  .sort((left, right) => left - right);
const coveredBodyServiceIds = [...new Set(regions
  .filter((region) => primaryFamilyIds.has(region.familyId))
  .flatMap((region) => servicesForRegion(region).map((service) => Number(service.id))))]
  .sort((left, right) => left - right);
assert.deepEqual(coveredBodyServiceIds, expectedBodyServiceIds, "Chaque prestation corporelle doit être accessible depuis au moins une face");
assert.deepEqual(Array.from(servicesForRegion(regions.find((region) => region.id === "back-scalp")), (service) => service.id), [96], "Le cuir chevelu ne doit afficher que la mésothérapie capillaire");
assert.deepEqual(Array.from(servicesForRegion(regions.find((region) => region.id === "back-sif")), (service) => service.id), [49], "Le SIF ne doit afficher que le sillon interfessier");

const auxiliaryFamilyIds = new Set(["electrolyse", "medecine", "combinees", "consultations"]);
const auxiliaryServiceIds = services
  .filter((service) => families.some((family) => auxiliaryFamilyIds.has(family.id) && family.categoryIds.includes(Number(service.categoryId))))
  .map((service) => Number(service.id));
const bodyModeServiceIds = [...new Set([...coveredBodyServiceIds, ...auxiliaryServiceIds])].sort((left, right) => left - right);
const expectedServiceIds = Array.from(services, (service) => Number(service.id)).sort((left, right) => left - right);
assert.deepEqual(bodyModeServiceIds, expectedServiceIds, "Les 82 prestations actives doivent rester accessibles dans le mode corporel");

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
  /firstVisibleBodyRegion\(nextSide, visibleIds, activeFamily\)/,
  "Un changement de face doit conserver une zone cohérente avec la silhouette affichée"
);
assert.match(
  app,
  /event\.target\.closest\("svg \[data-body-region\]"\)[\s\S]*\["Enter", " "\]/,
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
assert.match(styles, /\.body-region:focus-visible \.body-region-target\{stroke-width:4\}/, "Le focus du SIF doit rester visible");
assert.match(styles, /\.interactive-body-map\.body-model-female \[data-body-region="front-torse"\]/, "La morphologie féminine doit adapter le torse");
assert.match(styles, /\.interactive-body-map\.body-model-female \[data-body-region="front-maillot"\]\{transform:scaleX\(1\.08\)\}/, "La morphologie féminine doit adapter le bassin");
assert.match(styles, /@media screen and \(max-width:760px\)\{[\s\S]*?\.body-selector-layout\{grid-template-columns:1fr\}/, "Le sélecteur doit s’empiler sur mobile");

assert.match(notices, /react-native-body-highlighter/, "La source du principe interactif doit être attribuée");
assert.match(notices, /MIT License/, "La licence MIT d’origine doit être conservée");
assert.match(notices, /Copyright \(c\) 2022 ELABBASSI Hicham/, "La notice de copyright d’origine doit être conservée");

console.log("BODY_SELECTOR_TESTS_OK");
