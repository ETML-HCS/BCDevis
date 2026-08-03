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
const families = context.window.QUOTE_FAMILIES;
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
  126: "zones", 127: "zones", 128: "zones", 129: "zones", 131: "zones",
  132: "zones", 133: "zones", 134: "zones", 135: "zones",
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
const usedIconBodies = [...new Set(services.map((service) => service.icon))].map((icon) => {
  const match = html.match(new RegExp(`<symbol id="icon-map-${icon}"[^>]*>([\\s\\S]*?)<\\/symbol>`));
  return [icon, match?.[1].replace(/\s+/g, " ").trim()];
});

assert.equal(services.length, 96, "Le catalogue doit toujours contenir 96 prestations");
assert.equal(new Set(services.map((service) => service.icon)).size, 57, "Les 96 prestations doivent conserver leurs 57 dessins anatomiques distincts");
assert.equal(categories.length, 16, "Les 16 catégories historiques doivent rester disponibles");
assert.equal(categories.find((category) => category.id === 35)?.name, "Zones combinées", "La catégorie ne doit plus annoncer de réservations génériques par durée");
assert.match(families.find((family) => family.id === "combinees")?.description || "", /Séance et Pack 6 \+ 1/, "La famille doit annoncer ses deux tarifs réels");
assert.equal(symbolNames.length, symbols.size, "Chaque identifiant de symbole SVG doit être unique");
assert.deepEqual(
  symbolMatches.filter((match) => match[2] !== "0 0 24 24").map((match) => match[1]),
  [],
  "Tous les pictogrammes doivent partager le viewBox 24 × 24"
);
assert.equal(Object.keys(expectedIcons).length, services.length, "La matrice visuelle doit couvrir chaque prestation");
const combinedZones = services.filter((service) => Number(service.categoryId) === 35);
assert.deepEqual(
  Array.from(combinedZones, (service) => [service.name, service.price, service.packAveragePrice]),
  [
    ["Lèvre supérieure + menton", 179, 153],
    ["Maillot classique + aisselles + SIF", 276, 237],
    ["Maillot échancré + aisselles + SIF", 306, 262],
    ["Maillot complet + aisselles + SIF", 406, 348],
    ["Demi-jambes, maillot classique, SIF et aisselles", 605, 519],
    ["Demi-jambes, maillot échancré, SIF et aisselles", 635, 545],
    ["Demi-jambes, maillot complet, SIF et aisselles", 735, 630],
    ["Jambes complètes, maillot classique, SIF et aisselles", 758, 650],
    ["Jambes complètes, maillot échancré, SIF et aisselles", 793, 680],
    ["Jambes complètes, maillot complet, SIF et aisselles", 888, 762],
    ["Torse et abdomen", 439, 376],
    ["Torse, abdomen, cou et épaules", 678, 581],
    ["Dos complet, épaules et nuque", 661, 566],
    ["Torse, abdomen, cou, dos complet, épaules, nuque, aisselles et demi-bras", 999, 856]
  ],
  "Les zones combinées doivent reprendre exactement les tarifs Séance et Pack 6 + 1"
);
assert.ok(combinedZones.every((service) => service.price > 0 && service.duration === 0), "Les zones combinées ne doivent plus contenir de réservation à 0 CHF ou de durée inventée");
assert.match(appSource, /function catalogPriceDisplay\(item\)/, "Le catalogue doit distinguer le prix Séance du prix moyen Pack 6 + 1");
assert.match(appSource, /const durationText = item\.duration \? `\$\{item\.duration\} min` : "";/, "La durée doit disposer de son propre libellé secondaire");
assert.match(appSource, /family-option-copy"><strong>\$\{escapeHTML\(item\.name\)\}<\/strong>\$\{durationText \? `<small>\$\{escapeHTML\(durationText\)\}<\/small>` : ""\}<\/span>/, "Le nom doit rester seul dans strong et la durée doit passer dans small");
assert.doesNotMatch(appSource, /<small>\$\{escapeHTML\(visual\.zone\)\}<\/small>/, "Le texte de zone ne doit plus être répété sous le nom de la prestation");
assert.ok(usedIconBodies.every(([, body]) => body), "Chaque dessin utilisé doit contenir une géométrie SVG");
assert.equal(
  new Set(usedIconBodies.map(([, body]) => body)).size,
  usedIconBodies.length,
  "Deux zones anatomiques différentes ne doivent pas partager accidentellement le même dessin"
);
assert.ok(
  usedIconBodies.every(([, body]) => !/<image\b|href="https?:|style="/.test(body)),
  "Les pictogrammes doivent rester des vecteurs locaux sans image, dépendance distante ni style isolé"
);

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
  /<symbol id="icon-map-nose"[^>]*>[\s\S]*?<use href="#bodymap-face"[\s\S]*?M11 9\.1h2[\s\S]*?<circle class="anatomy-negative" cx="10\.9"[\s\S]*?<circle class="anatomy-negative" cx="13\.1"/,
  "Le nez et les deux narines doivent être explicitement lisibles de face"
);
assert.match(
  html,
  /<symbol id="icon-map-upper-lip"[^>]*>[\s\S]*?<use href="#bodymap-face"[\s\S]*?M9\.4 12\.8c1\.7\.7/,
  "La zone située au-dessus de la lèvre supérieure doit être lisible de face"
);
assert.match(
  html,
  /<symbol id="icon-map-beard"[^>]*>[\s\S]*?class="anatomy-zone-soft"[\s\S]*?class="anatomy-negative-line"/,
  "La barbe pleine doit associer une zone dense à des repères de texture"
);
assert.match(
  html,
  /<symbol id="icon-map-beard-line"[^>]*>[\s\S]*?<use href="#bodymap-face-profile"[\s\S]*?M10\.1 13\.5[\s\S]*?M9\.8 16\.2/,
  "La ligne de barbe doit montrer en profil le contour de joue et le contour sous-mandibulaire"
);
assert.match(
  html,
  /<symbol id="icon-map-face-skin"[^>]*>[\s\S]*?<path class="anatomy-zone-soft"[\s\S]*?<circle class="anatomy-dot" cx="12" cy="17"/,
  "La peau du visage doit couvrir le visage et rester distincte des deux joues"
);
assert.match(
  html,
  /<symbol id="icon-map-forehead"[^>]*>[\s\S]*?M6\.8 7\.4c3\.4-1\.5 7-1\.5 10\.4 0/,
  "Le front doit rester une bande faciale distincte de la calotte du cuir chevelu"
);
assert.match(
  html,
  /<g id="bodymap-hands-pair">[\s\S]*?<use href="#bodymap-hand" transform="translate\(0 2\.1\)"[\s\S]*?translate\(24 2\.1\) scale\(-1 1\)/,
  "Les prestations des mains et des doigts doivent représenter deux mains entières en miroir"
);
assert.match(
  html,
  /<symbol id="icon-map-hands"[^>]*>[\s\S]*?class="anatomy-zone-soft"[\s\S]*?class="anatomy-negative-line"/,
  "Les mains doivent mettre en évidence les deux dos de main et leurs articulations"
);
assert.equal(
  (html.match(/<symbol id="icon-map-fingers"[\s\S]*?<\/symbol>/)?.[0].match(/class="anatomy-zone"/g) || []).length,
  10,
  "Les dix doigts, pouces compris, doivent être explicitement mis en évidence"
);
assert.match(
  html,
  /<symbol id="icon-map-face-zone"[^>]*>[\s\S]*?class="anatomy-patch"/,
  "Les zones spéciales doivent utiliser le contour clinique pointillé"
);
for (const icon of ["face-zone", "arm-zone", "torso-zone", "back-zone", "bikini-zone", "thigh-zone", "leg-zone", "skin-target"]) {
  assert.match(
    html,
    new RegExp(`<symbol id="icon-map-${icon}"[^>]*>[\\s\\S]*?class="anatomy-patch"`),
    `La zone spéciale ${icon} doit utiliser le contour clinique pointillé`
  );
}
assert.match(
  html,
  /<symbol id="icon-map-neck"[^>]*>[\s\S]*?<use href="#bodymap-neck-front"[\s\S]*?M9\.3 8v3\.2/,
  "Le cou doit utiliser un buste dédié et limiter la zone pleine au cou"
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
  /<symbol id="icon-map-bikini-classic"[^>]*>[\s\S]*?m6\.7 10\.6 4 3\.1m6\.6-3\.1-4 3\.1" stroke-width="2\.2"/,
  "Le maillot classique doit montrer les lignes traitées plutôt qu’un vêtement rempli"
);
assert.match(
  html,
  /<symbol id="icon-map-bikini-high"[^>]*>[\s\S]*?m5\.5 8\.2 5\.2 5\.6m7\.8-5\.6-5\.2 5\.6" stroke-width="2\.5"/,
  "Le maillot échancré doit rester plus étendu que le maillot classique"
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
assert.match(
  html,
  /<g id="bodymap-foot">[\s\S]*?M7\.7 4\.7c1\.4-.2[\s\S]*?<circle class="anatomy-base" cx="9\.9" cy="2\.9" r="1\.05"/,
  "Chaque pied doit présenter une voûte, un talon et cinq orteils anatomiquement ordonnés"
);
assert.match(
  html,
  /<g id="bodymap-feet">[\s\S]*?<use href="#bodymap-foot"[\s\S]*?translate\(24 0\) scale\(-1 1\)/,
  "Les deux pieds doivent être représentés en miroir avec les gros orteils vers le centre"
);
assert.match(
  html,
  /<symbol id="icon-map-feet"[^>]*>[\s\S]*?class="anatomy-zone-soft"[\s\S]*?class="anatomy-negative-line"/,
  "Les pieds doivent mettre en évidence les deux plantes et leurs talons"
);
assert.equal(
  (html.match(/<symbol id="icon-map-toes"[\s\S]*?<\/symbol>/)?.[0].match(/class="anatomy-zone"/g) || []).length,
  10,
  "Les dix orteils doivent être explicitement visibles"
);
assert.match(
  html,
  /<symbol id="icon-map-skin-target"[^>]*>[\s\S]*?class="anatomy-patch"[\s\S]*?<circle class="anatomy-dot"[\s\S]*?<circle class="anatomy-dot"[\s\S]*?<circle class="anatomy-dot"/,
  "Une zone cutanée générique doit évoquer une surface de peau traitée"
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

for (const family of families.filter((family) => family.id !== "all")) {
  assert.ok(symbols.has(`map-${family.icon}`), `Pictogramme Body Map V3 absent pour la famille ${family.name}`);
}

assert.match(appSource, /function serviceVisual\(item\)/, "Le rendu doit gérer les prestations intégrées et sur mesure");
assert.match(appSource, /function prestationIconHref\(icon\)/, "Le rendu doit privilégier le système Body map V3");
assert.match(appSource, /document\.getElementById\(bodyMapId\)/, "Un pictogramme sur mesure doit conserver un repli sûr");
assert.match(
  appSource,
  /class="family-visibility-icon"[\s\S]*?prestationIconHref\(family\.icon\)/,
  "Le Catalogue des réglages doit réutiliser les pictogrammes actuels des familles"
);
assert.match(appSource, /class="service-zone-icon"/, "Le pictogramme anatomique doit être visible dans chaque prestation");
assert.match(appSource, /class="service-zone-icon" title="\$\{escapeHTML\(visual\.zone\)\}"/, "La zone doit rester disponible dans l’infobulle du pictogramme");
assert.match(appSource, /data-density-card data-density="normal"/, "Chaque prestation doit exposer sa structure de densité adaptative");
assert.match(appSource, /function analyzeTileDensity\(\)/, "Le catalogue doit analyser la densité de chaque groupe après son rendu");
assert.match(appSource, /tileDensityPercentile\(metrics\.map\(\(metric\) => metric\.score\), 0\.72\)/, "Le seuil doit s’adapter au groupe de prestations");
assert.match(appSource, /data-tile-detail-toggle/, "Les prestations compactes doivent disposer d’un contrôle de détail distinct de l’ajout");
assert.match(appSource, /function openTileDetail\(shell/, "Le libellé complet doit pouvoir être affiché sans modifier la prestation");
assert.match(appSource, /pointerover[\s\S]*?event\.target\.closest\("\[data-tile-detail-toggle\]"\)/, "Le survol doit être limité au bouton œil");
assert.doesNotMatch(appSource, /pointerover[\s\S]{0,300}?event\.target\.closest\("\[data-density-card/, "Le survol de la tuile complète ne doit pas ouvrir le détail");
assert.match(styles, /Prestations : cartes corporelles compactes, inspirées des body highlighters/);
assert.match(styles, /Prestations : densité adaptative et aperçu complet des libellés longs/);
assert.match(styles, /\.family-option-shell\[data-density="compact"\]\{grid-template-columns:minmax\(0,1fr\) 34px\}/, "Seules les prestations denses doivent réserver une commande de détail");
assert.match(styles, /\.tile-detail-layer\{[\s\S]*?z-index:260;[\s\S]*?pointer-events:none;/, "L’aperçu doit rester au-dessus des tuiles sans bloquer l’interface");
assert.match(styles, /\.tile-detail-layer\.is-open \.tile-detail-card\{opacity:1;pointer-events:auto;transform:translateY\(0\) scale\(1\)\}/, "L’ouverture du détail doit être animée et interactive");
assert.match(styles, /\.anatomy-base\{[\s\S]*?fill-opacity:\.1;[\s\S]*?stroke-opacity:\.82;/);
assert.match(styles, /\.anatomy-zone\{[\s\S]*?fill-opacity:\.96;[\s\S]*?stroke:none;/);
assert.match(styles, /\.anatomy-patch\{[\s\S]*?stroke-dasharray:1\.35 1\.15;/);
assert.match(
  styles,
  /\.service-zone-icon svg\{width:34px;height:34px;stroke-width:1\.5;shape-rendering:geometricPrecision\}/,
  "Les pictogrammes doivent conserver leur taille de lecture renforcée"
);
assert.match(
  styles,
  /\.family-option\{\s*min-height:76px;\s*padding:7px 5px 7px 9px;\s*grid-template-columns:44px minmax\(0,1fr\) 22px;\s*gap:8px;/,
  "Les prestations doivent réserver la largeur principale au texte"
);
assert.match(
  styles,
  /\.family-option-add\{width:20px;height:20px;justify-self:end;/,
  "Le signe plus doit rester ancré au bord droit"
);
assert.match(
  styles,
  /\.show-family-prices \.family-option\{grid-template-columns:44px minmax\(0,1fr\) auto 22px\}/,
  "La colonne de prix ne doit être réservée que lorsqu’elle est visible"
);

console.log("PRESTATION_ICONS_TESTS_OK");
