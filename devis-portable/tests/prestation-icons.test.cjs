"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const catalogSource = fs.readFileSync(path.join(root, "catalog.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const context = { window: {} };
vm.runInNewContext(catalogSource, context, { filename: "catalog.js" });

const services = context.window.QUOTE_SERVICES;
const categories = context.window.QUOTE_CATEGORIES;
const symbolMatches = [...html.matchAll(/<symbol\s+id="icon-([^"]+)"\s+viewBox="([^"]+)"/g)];
const symbolNames = symbolMatches.map((match) => match[1]);
const symbols = new Set(symbolNames);
const expectedIcons = {
  102: "consultation", 110: "skin-target",
  99: "consultation", 96: "scalp", 95: "face-skin", 94: "face-skin",
  15: "consultation", 14: "consultation", 130: "consultation",
  97: "consultation", 63: "injection", 100: "injection", 87: "forehead",
  89: "face-neck", 88: "injection", 93: "face-skin", 90: "nose",
  91: "armpits", 92: "male-intimate",
  98: "consultation", 80: "cheeks", 81: "body-vessels",
  111: "zones", 122: "zones", 123: "zones", 124: "zones", 125: "zones",
  126: "zones", 127: "zones", 128: "zones", 129: "zones",
  101: "consultation", 62: "electrolysis", 61: "electrolysis",
  60: "electrolysis", 59: "electrolysis", 58: "electrolysis",
  27: "beard", 30: "neck", 22: "glabella", 26: "cheeks",
  19: "upper-lip", 28: "beard-line", 20: "chin", 25: "nose",
  24: "ears", 21: "eyebrows", 23: "temples", 29: "face", 109: "face-zone",
  33: "abdomen", 32: "areola", 34: "linea-alba", 31: "torso", 108: "torso-zone",
  37: "lower-back", 38: "back", 36: "upper-back", 35: "nape", 105: "back-zone",
  41: "armpits", 43: "forearms", 44: "arms", 39: "fingers",
  42: "shoulders", 40: "hands", 104: "arm-zone",
  45: "bikini-classic", 46: "bikini-high", 47: "maillot",
  48: "male-intimate", 49: "sif", 107: "bikini-zone",
  54: "thighs", 56: "lower-legs", 55: "buttocks", 52: "knees",
  57: "legs", 50: "toes", 51: "feet", 106: "leg-zone", 53: "thigh-zone",
  112: "student", 113: "student", 114: "student", 115: "student", 116: "student",
  118: "student", 119: "student", 120: "student", 121: "student"
};

assert.equal(services.length, 91, "Le catalogue doit toujours contenir 91 prestations");
assert.equal(categories.length, 16, "Les 16 catégories historiques doivent rester disponibles");
assert.equal(symbolNames.length, symbols.size, "Chaque identifiant de symbole SVG doit être unique");
assert.deepEqual(
  symbolMatches.filter((match) => match[2] !== "0 0 24 24").map((match) => match[1]),
  [],
  "Tous les pictogrammes doivent partager le viewBox 24 × 24"
);
assert.equal(Object.keys(expectedIcons).length, services.length, "La matrice visuelle doit couvrir chaque prestation");

for (const service of services) {
  assert.equal(service.icon, expectedIcons[service.id], `Pictogramme incohérent pour ${service.id} · ${service.name}`);
  assert.ok(symbols.has(service.icon), `Symbole #icon-${service.icon} absent pour ${service.id} · ${service.name}`);
  assert.ok(
    typeof service.zone === "string" && service.zone.trim().length >= 3,
    `Zone corporelle absente pour ${service.id} · ${service.name}`
  );
}

for (const category of categories.filter((category) => services.some((service) => service.categoryId === category.id))) {
  const categoryServices = services.filter((service) => service.categoryId === category.id);
  assert.ok(categoryServices.every((service) => symbols.has(service.icon)), `Catégorie incomplète : ${category.name}`);
}

assert.match(appSource, /function serviceVisual\(item\)/, "Le rendu doit gérer les prestations intégrées et sur mesure");
assert.match(appSource, /class="service-zone-icon"/, "Le pictogramme anatomique doit être visible dans chaque prestation");
assert.match(appSource, /<small>\$\{escapeHTML\(visual\.zone\)\}<\/small>/, "La zone doit aussi être explicitée en texte");
assert.match(styles, /Prestations : pictogrammes anatomiques explicites et homogènes/);
assert.match(styles, /\.family-option\{\s*min-height:76px;\s*grid-template-columns:44px minmax\(0,1fr\) auto 30px;/);

console.log("PRESTATION_ICONS_TESTS_OK");
