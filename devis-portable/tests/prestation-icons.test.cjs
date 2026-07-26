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
const normalizedReferenceIcons = [
  "face", "scalp", "face-skin", "face-neck", "forehead", "glabella", "cheeks",
  "upper-lip", "chin", "nose", "ears", "eyebrows", "temples", "beard", "beard-line", "face-zone", "neck",
  "arms", "armpits", "forearms", "shoulders", "hands", "fingers", "arm-zone",
  "torso", "abdomen", "areola", "linea-alba", "torso-zone",
  "back", "upper-back", "lower-back", "back-zone", "nape",
  "maillot", "bikini-classic", "bikini-high", "bikini-zone", "male-intimate", "sif",
  "buttocks", "legs", "thighs", "thigh-zone", "lower-legs", "knees", "leg-zone", "feet", "toes",
  "injection", "injection-zone", "skin-target", "body-vessels", "zones", "student",
  "electrolysis", "consultation", "aesthetic", "all"
];
const expectedIcons = {
  102: "consultation", 110: "skin-target",
  99: "consultation", 96: "scalp", 95: "skin-target", 94: "face-skin",
  15: "consultation", 14: "consultation", 130: "consultation",
  97: "consultation", 63: "injection-zone", 100: "injection-zone", 87: "forehead",
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

for (const icon of normalizedReferenceIcons) {
  assert.match(
    html,
    new RegExp(`<symbol id="icon-map-${icon}" viewBox="0 0 24 24" data-design="body-map-v3">`),
    `La carte corporelle normalisée #icon-map-${icon} doit rester identifiable`
  );
}
assert.match(
  html,
  /<symbol id="icon-map-armpits"[^>]*>[\s\S]*?<circle class="anatomy-zone" cx="7\.7" cy="8\.4"[\s\S]*?<circle class="anatomy-zone" cx="16\.3" cy="8\.4"/,
  "Les deux aisselles doivent être explicitement mises en évidence"
);
assert.match(
  html,
  /<symbol id="icon-map-face"[^>]*>[\s\S]*?<use href="#bodymap-face"/,
  "Le visage complet doit utiliser la carte frontale commune"
);
assert.match(
  html,
  /<symbol id="icon-map-nose"[^>]*>[\s\S]*?<path class="anatomy-zone" d="m12 8\.3 2 5\.5-2 1\.3-2-1\.3 2-5\.5Z"/,
  "Le nez doit être explicitement mis en évidence sur le visage frontal"
);
assert.match(
  html,
  /<symbol id="icon-map-torso"[^>]*>[\s\S]*?<use href="#bodymap-upper-front"[\s\S]*?class="anatomy-zone"/,
  "Le torse doit associer la carte du haut du corps à une poitrine pleine"
);
assert.match(
  html,
  /<symbol id="icon-map-areola"[^>]*>[\s\S]*?<circle class="anatomy-zone" cx="8\.7" cy="10\.4"[\s\S]*?<circle class="anatomy-zone" cx="15\.3" cy="10\.4"/,
  "Les deux aréoles doivent être explicitement mises en évidence"
);
assert.match(
  html,
  /<g id="bodymap-upper-back">[\s\S]*?M12 5\.3v14\.4/,
  "Le dos doit conserver une colonne vertébrale simplifiée dans sa carte commune"
);
assert.match(
  html,
  /<symbol id="icon-map-maillot"[^>]*>[\s\S]*?M5\.6 9\.5 12 15\.3l6\.4-5\.8/,
  "Le maillot doit conserver un contour frontal immédiatement reconnaissable"
);
assert.match(
  html,
  /<symbol id="icon-map-buttocks"[^>]*>[\s\S]*?<use href="#bodymap-pelvis-back"/,
  "Les fesses doivent conserver un sillon central lisible"
);
assert.match(
  html,
  /<symbol id="icon-map-sif"[^>]*>[\s\S]*?M12 12\.7v7" stroke-width="2\.5"/,
  "Le SIF doit être plus fortement marqué que la silhouette générale des fesses"
);
assert.match(
  html,
  /<symbol id="icon-map-zones"[^>]*>[\s\S]*?<circle class="anatomy-zone" cx="9" cy="9\.2"[\s\S]*?<circle class="anatomy-zone" cx="15" cy="13\.1"[\s\S]*?<circle class="anatomy-zone" cx="10\.4" cy="18"/,
  "Les zones combinées doivent montrer trois zones distinctes sur une silhouette"
);
assert.match(
  html,
  /<symbol id="icon-map-injection-zone"[^>]*>[\s\S]*?<use href="#bodymap-full"[\s\S]*?m20\.5 3\.4-7 7/,
  "Les injections génériques doivent associer une silhouette corporelle et une seringue"
);
assert.match(
  html,
  /<symbol id="icon-map-student"[^>]*>[\s\S]*?<use href="#bodymap-full"[\s\S]*?m9 17\.5 6-6/,
  "La prestation étudiante doit conserver une zone corporelle générique avec son indicateur tarifaire"
);
assert.match(
  html,
  /<symbol id="icon-map-knees"[^>]*>[\s\S]*?<circle class="anatomy-zone" cx="9\.2" cy="10\.2"[\s\S]*?<circle class="anatomy-zone" cx="14\.8" cy="10\.2"/,
  "Les deux genoux doivent rester visibles et distincts des cuisses et des demi-jambes"
);
assert.match(
  html,
  /<symbol id="icon-map-lower-legs"[^>]*>[\s\S]*?<circle class="anatomy-zone" cx="9\.2" cy="10\.2"[\s\S]*?M7\.4 20\.2h3\.8v1\.7/,
  "Les demi-jambes doivent aussi montrer les genoux et les pieds inclus"
);
assert.match(
  html,
  /<symbol id="icon-map-legs"[^>]*>[\s\S]*?M7\.4 20\.2h3\.8v1\.7/,
  "Les jambes complètes doivent aussi montrer les pieds inclus"
);
assert.equal(
  services.find((service) => service.id === 95)?.zone,
  "Visage ou zone cutanée du corps",
  "Le microneedling doit expliciter que la zone cutanée peut aussi être corporelle"
);
assert.equal(
  services.find((service) => service.id === 31)?.zone,
  "Torse (poitrine)",
  "Le libellé du torse doit rester cohérent avec la prestation et son pictogramme"
);
assert.ok(
  services.filter((service) => service.categoryId === 36).every((service) => service.zone === "Zone du corps définie lors de la séance"),
  "Les prestations étudiantes doivent expliciter que la zone corporelle est choisie pendant la séance"
);

for (const service of services) {
  assert.equal(service.icon, expectedIcons[service.id], `Pictogramme incohérent pour ${service.id} · ${service.name}`);
  assert.ok(symbols.has(`map-${service.icon}`), `Symbole #icon-map-${service.icon} absent pour ${service.id} · ${service.name}`);
  assert.ok(
    typeof service.zone === "string" && service.zone.trim().length >= 3,
    `Zone corporelle absente pour ${service.id} · ${service.name}`
  );
}

for (const category of categories.filter((category) => services.some((service) => service.categoryId === category.id))) {
  const categoryServices = services.filter((service) => service.categoryId === category.id);
  assert.ok(categoryServices.every((service) => symbols.has(`map-${service.icon}`)), `Catégorie incomplète : ${category.name}`);
}

assert.match(appSource, /function serviceVisual\(item\)/, "Le rendu doit gérer les prestations intégrées et sur mesure");
assert.match(appSource, /function prestationIconHref\(icon\)/, "Le rendu doit privilégier le système Body map V3");
assert.match(appSource, /document\.getElementById\(bodyMapId\)/, "Un pictogramme sur mesure doit conserver un repli sûr");
assert.match(appSource, /class="service-zone-icon"/, "Le pictogramme anatomique doit être visible dans chaque prestation");
assert.match(appSource, /<small>\$\{escapeHTML\(visual\.zone\)\}<\/small>/, "La zone doit aussi être explicitée en texte");
assert.match(styles, /Prestations : cartes corporelles compactes, inspirées des body highlighters/);
assert.match(styles, /\.anatomy-base\{[\s\S]*?fill-opacity:\.13;[\s\S]*?stroke-opacity:\.52;/);
assert.match(styles, /\.anatomy-zone\{[\s\S]*?fill-opacity:\.9;[\s\S]*?stroke:none;/);
assert.match(
  styles,
  /\.family-option\{\s*min-height:76px;\s*padding:7px 5px 7px 9px;\s*grid-template-columns:40px minmax\(0,1fr\) 22px;\s*gap:8px;/,
  "Les prestations doivent réserver la largeur principale au texte"
);
assert.match(
  styles,
  /\.family-option-add\{width:20px;height:20px;justify-self:end;/,
  "Le signe plus doit rester ancré au bord droit"
);
assert.match(
  styles,
  /\.show-family-prices \.family-option\{grid-template-columns:40px minmax\(0,1fr\) auto 22px\}/,
  "La colonne de prix ne doit être réservée que lorsqu’elle est visible"
);

console.log("PRESTATION_ICONS_TESTS_OK");
