"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const anatomySource = fs.readFileSync(path.join(root, "body-anatomy.js"), "utf8");
const anatomyGenerator = fs.readFileSync(path.join(root, "..", "scripts", "generate-body-anatomy.cjs"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const notices = fs.readFileSync(path.join(root, "THIRD-PARTY-NOTICES.md"), "utf8");
const catalogContext = { window: {} };
vm.createContext(catalogContext);
vm.runInContext(fs.readFileSync(path.join(root, "catalog.js"), "utf8"), catalogContext);
const services = catalogContext.window.QUOTE_SERVICES.filter((service) => Number(service.categoryId) !== 36);
const families = catalogContext.window.QUOTE_FAMILIES.filter((family) => family.id !== "all");
const regions = catalogContext.window.QUOTE_BODY_REGIONS;

assert.match(app, /const APP_VERSION = 20;/, "La migration locale doit intégrer les personnalisations du catalogue");
assert.match(app, /catalogMode: "tiles"/, "Le mode historique doit rester le choix par défaut");
assert.match(app, /function currentCatalogMode\(\)/, "Le choix sauvegardé doit être normalisé");
assert.match(app, /function renderBodySelector\(\)/, "Le sélecteur corporel doit avoir son propre rendu");
assert.match(app, /function bodyMapMarkup\(side, visibleIds\)/, "Les vues avant et arrière doivent partager un rendu dédié");
assert.match(app, /function bodyModelGeometry\(side\)/, "Le mannequin doit disposer d’une géométrie anatomique dédiée");
assert.match(app, /window\.BCDEVIS_BODY_ANATOMY/, "Le rendu doit utiliser les tracés anatomiques normalisés");
assert.match(app, /Mannequin \$\{modelLabel\} vu de face/, "La vue avant doit annoncer le modèle affiché");
assert.match(app, /Mannequin \$\{modelLabel\} vu de dos/, "La vue arrière doit annoncer le modèle affiché");
assert.match(app, /interactive-body-map[^"]*"[^>]+role="group"/, "La carte doit exposer ses zones interactives aux technologies d’assistance");
assert.match(app, /let activeBodyModel = "male"/, "Le corps masculin doit être le modèle initial");
assert.match(app, /class="body-model-toggle"[\s\S]*?data-body-model-choice="female"[^>]*>Femme<\/button>[\s\S]*?data-body-model-choice="male"[^>]*>Homme<\/button>/, "Le titre doit être remplacé par un sélecteur Femme/Homme explicite");
assert.match(app, /function setBodyModel\(model, focusSelector\)/, "Le sélecteur explicite doit choisir directement la morphologie demandée");
assert.doesNotMatch(app, /toggleBodyModel|data-body-model-toggle|bodyModelToggleArea/, "L’espace autour du corps ne doit plus changer implicitement de morphologie");
assert.match(app, /function faceMapMarkup\(\)/, "Le visage doit disposer d’une carte anatomique dédiée");
assert.match(app, /Détail du visage neutre/, "Le schéma facial doit être décrit comme neutre");
assert.match(app, /sans cheveux ni identité reconnaissable/, "Le schéma facial doit annoncer son anonymat");
assert.match(app, /activeBodyModel === "female" \? "féminin" : "masculin"/, "L’intitulé accessible doit suivre le modèle réellement affiché");
assert.match(app, /data-body-detail="body"/, "Le détail du visage doit permettre de revenir au corps complet");
assert.match(
  app,
  /class="body-map-head-actions"[\s\S]*?aria-label="Orientation du corps"[\s\S]*?data-body-side="front"[^>]*>Face<\/button>[\s\S]*?data-body-side="back"[^>]*>Dos<\/button>/,
  "Le sélecteur Face/Dos doit se trouver dans la ligne de titre de la carte"
);
assert.match(
  styles,
  /\.body-map-card-head\{display:flex;align-items:center;justify-content:space-between;gap:12px\}/,
  "Les sélecteurs Femme/Homme et Face/Dos doivent partager la même ligne"
);
assert.doesNotMatch(app, /Choisir une zone|Navigation corporelle|Autres prestations|zones? sur cette vue/, "Les libellés évidents ne doivent pas alourdir la navigation corporelle");
assert.doesNotMatch(app, /body-results-head|bodyResultsTitle/, "L’en-tête redondant des prestations doit être entièrement supprimé");
assert.match(app, /data-body-results-title="\$\{escapeHTML\(resultTitle\)\}"/, "Le titre courant doit rester disponible sans contenu visuel redondant");
assert.doesNotMatch(styles, /\.body-results-head/, "Aucun style orphelin de l’en-tête supprimé ne doit subsister");
assert.equal(families.find((family) => family.id === "consultations")?.description, "", "La famille Consultations ne doit pas répéter sa définition sous son titre");

const expectedFaceRegions = {
  "face-full": 29,
  "face-temples": 23,
  "face-brows": 21,
  "face-glabella": 22,
  "face-nose": 25,
  "face-cheeks": 26,
  "face-upper-lip": 19,
  "face-beard": 27,
  "face-beard-line": 28,
  "face-chin": 20,
  "face-ears": 24,
  "face-neck": 30
};
const faceRegionIds = [...app.matchAll(/\{ id: "(face-[^"]+)", title: "[^"]+", description: "[^"]+", serviceIds: \[(\d+)\] \}/g)];
assert.equal(faceRegionIds.length, 12, "Le détail du visage doit conserver douze sous-zones exactes");
for (const [, regionId, serviceId] of faceRegionIds) {
  assert.equal(Number(serviceId), expectedFaceRegions[regionId], `La prestation faciale de ${regionId} doit être exacte`);
  assert.match(app, new RegExp(`region\\("${regionId}"`), `Le visage doit exposer ${regionId}`);
}

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
assert.equal(expectedServiceIds.length, 87, "Le catalogue doit exposer les 87 prestations actives documentées");
assert.deepEqual(bodyModeServiceIds, expectedServiceIds, "Les 87 prestations actives doivent rester accessibles dans le mode corporel");

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
  /event\.target\.closest\("svg \[data-body-region\], svg \[data-face-region\]"\)[\s\S]*\["Enter", " "\]/,
  "Chaque région corporelle ou faciale doit être activable avec Entrée ou Espace"
);
assert.match(
  app,
  /catalogMode: data\.get\("catalogMode"\) === "body" \? "body" : "tiles"/,
  "Le choix du mode doit être sauvegardé avec les autres réglages"
);

assert.match(html, /aria-label="Navigation des soins"/, "Le réglage doit annoncer son groupe");
assert.match(html, /<script src="body-anatomy\.js"><\/script>\s*<script src="app\.js"><\/script>/, "Les tracés anatomiques doivent être chargés avant l’application");
assert.match(html, /name="catalogMode" type="radio" value="tiles"/, "Le mode Tuiles doit rester disponible");
assert.match(html, /name="catalogMode" type="radio" value="body"/, "Le mode Corps interactif doit être disponible");
assert.match(html, />Corps interactif</, "Le nouveau mode doit être nommé explicitement");

assert.match(styles, /\.body-selector-layout\{[^}]*grid-template-columns:/, "Le corps et ses résultats doivent former un ensemble lisible");
assert.match(styles, /\.body-region\.active \.body-region-shape\{fill:var\(--taupe\);stroke:#fff\}/, "La zone active doit être nettement mise en évidence");
assert.match(styles, /\.body-region:focus-visible \.body-region-shape/, "Le focus clavier doit être visible sur la silhouette");
assert.match(styles, /\.body-region:focus-visible \.body-region-target\{stroke-width:4\}/, "Le focus du SIF doit rester visible");
assert.doesNotMatch(styles, /\.interactive-body-map\.body-model-female \[data-body-region=/, "Les morphologies ne doivent plus être déformées zone par zone en CSS");
assert.match(app, /data-anatomy-source="react-native-body-highlighter"/, "La provenance anatomique doit rester explicite dans le SVG");
assert.match(app, /<g class="body-figure">/, "Chaque silhouette doit disposer d’un groupe mesurable unique");
assert.match(app, /class="body-anatomy-outline"/, "La silhouette doit conserver un fond corporel continu derrière les zones");
assert.match(app, /class="body-region-shape body-anatomy-segment"/, "Les zones doivent reprendre des segments anatomiques précis");
assert.match(app, /function anonymousBodyHeadMarkup\(side, headGeometry\)/, "La tête anonyme doit suivre le centre propre à chaque morphologie");
assert.match(app, /class="body-region-shape body-anonymous-head"/, "La tête anonyme doit rester une zone interactive");
assert.match(app, /class="body-region-detail body-face-landmarks"/, "Le visage du mannequin doit conserver des repères anatomiques neutres");
assert.match(app, /const headMaskId = `body-head-mask-\$\{side\}`/, "La tête d’origine doit être masquée sans rectangle visible");
assert.match(app, /data-anatomy-source="user-reference" viewBox="260 45 505 740"/, "Le visage doit reprendre le tracé anatomique de référence dans un repère naturel");
assert.match(app, /<g class="face-figure">/, "Le visage doit disposer d’un groupe anatomique mesurable");
assert.doesNotMatch(app, /class="face-figure" transform=/, "Le visage ne doit subir aucune déformation corrective");
assert.match(app, /sans cheveux ni identité reconnaissable/, "Le visage doit rester neutre et anonyme");
assert.match(app, /class="face-anatomy-base"/, "Le visage doit reposer sur une surface anatomique continue");
assert.match(app, /class="face-anatomy-landmark /, "Les repères des yeux doivent rester discrets et non interactifs");
assert.match(app, /class="body-region-hitarea"[^>]+rx="48" ry="70"/, "Le SIF doit disposer d’une cible tactile confortable");
assert.match(app, /class="face-region-hitarea"/, "La ligne de barbe doit disposer d’une cible tactile élargie");
assert.match(styles, /\.interactive-body-map\{[^}]*height:clamp\(540px,65vh,620px\)/, "Le corps complet doit occuper une hauteur confortable");
assert.match(styles, /\.body-anatomy-outline\{[^}]*fill:#353431;stroke:none/, "Le fond continu doit réunifier les segments sans dessiner de contour extérieur");
assert.match(styles, /\.body-anonymous-head,\.body-anonymous-neck\{[^}]*stroke:none/, "La tête et le cou ne doivent pas recréer un contour extérieur séparé");
assert.match(styles, /html\[data-theme\] \.body-anatomy-outline\{[^}]*stroke:none/, "Aucun thème ne doit réintroduire le contour extérieur");
assert.match(styles, /\.body-anatomy-segment\{[^}]*stroke:#706c65;stroke-width:\.65;opacity:\.64/, "Les mains, les pieds et les détails musculaires doivent rester lisibles sans concurrencer la zone active");
assert.match(styles, /\.body-region\.active \.body-anatomy-segment\{[^}]*opacity:1/, "La zone active doit retrouver toute sa lisibilité");
assert.match(styles, /\.interactive-face-map\{[^}]*height:clamp\(410px,52vh,510px\)/, "Le visage détaillé doit rester lisible");
assert.match(styles, /\.face-anatomy-base\{[^}]*pointer-events:none/, "Le fond anatomique continu ne doit pas intercepter les zones du visage");
assert.doesNotMatch(styles, /\.face-region\{[^}]*scaleX/, "Le visage ne doit plus être étiré artificiellement");
assert.match(styles, /\.face-anatomy-landmark\{[^}]*pointer-events:none/, "Les repères anatomiques ne doivent pas intercepter les clics");
assert.doesNotMatch(styles, /\.body-map-stage\[data-body-model-toggle\]/, "La zone vide autour du mannequin ne doit plus sembler cliquable");
assert.match(styles, /\.face-region\.active \.face-region-shape\{fill:var\(--taupe\);stroke:#fff\}/, "La sous-zone faciale active doit être clairement visible");
assert.match(styles, /\.face-region:focus-visible \.face-region-shape/, "Le focus clavier doit être visible sur le visage");
assert.match(styles, /@media screen and \(max-width:760px\)\{[\s\S]*?\.body-selector-layout\{grid-template-columns:1fr\}/, "Le sélecteur doit s’empiler sur mobile");

assert.match(notices, /react-native-body-highlighter/, "La source du principe interactif doit être attribuée");
assert.match(notices, /MIT License/, "La licence MIT d’origine doit être conservée");
assert.match(notices, /Copyright \(c\) 2022 ELABBASSI Hicham/, "La notice de copyright d’origine doit être conservée");

const anatomyContext = { window: {} };
vm.createContext(anatomyContext);
vm.runInContext(anatomySource, anatomyContext);
const anatomy = anatomyContext.window.BCDEVIS_BODY_ANATOMY;
assert.deepEqual(Array.from(Object.keys(anatomy)), ["male", "female"], "Les deux anatomies homme et femme doivent être livrées");
for (const model of ["male", "female"]) {
  assert.ok(anatomy?.[model]?.front && anatomy?.[model]?.back, `Les vues Face et Dos du modèle ${model} doivent être livrées`);
  for (const side of ["front", "back"]) {
    const figure = anatomy[model][side];
    assert.ok(figure.outline.length > 8000, `Le contour ${model}/${side} ne doit pas être une approximation simplifiée`);
    assert.ok(Object.values(figure.regions).flat().length >= 60, `Les zones ${model}/${side} doivent rester anatomiquement détaillées`);
    assert.ok(Number.isFinite(figure.head.cx), `Le centre de tête ${model}/${side} doit rester défini`);
  }
}
assert.equal(anatomy.male.front.viewBox, "0 130 724 1230", "La vue masculine Face doit conserver son cadrage");
assert.equal(anatomy.male.back.viewBox, "724 130 724 1230", "La vue masculine Dos doit conserver son cadrage");
assert.equal(anatomy.female.front.viewBox, "-50 130 734 1368", "La vue féminine Face doit inclure la silhouette native jusqu'aux pieds");
assert.equal(anatomy.female.back.viewBox, "756 130 774 1318", "La vue féminine Dos doit inclure la silhouette native jusqu'aux pieds");
assert.notEqual(anatomy.male.front.outline, anatomy.female.front.outline, "Le modèle féminin doit utiliser une vraie géométrie distincte");
assert.match(anatomyGenerator, /bodyFemaleFront\.ts[\s\S]*?bodyFemaleBack\.ts/, "Le générateur doit extraire les deux géométries féminines officielles");

console.log("BODY_SELECTOR_TESTS_OK");
