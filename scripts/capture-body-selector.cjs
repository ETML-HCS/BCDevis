"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(PROJECT_ROOT, "devis-portable", "index.html");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "tmp", "body-selector");

app.commandLine.appendSwitch("disable-gpu");

async function capture(window, name) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(OUTPUT_PATH, name), image.toPNG());
}

function validateBodyGeometry(label, geometry) {
  const view = geometry.viewBox;
  const tolerance = 2;
  const invalidRegion = geometry.regions.find((region) => region.paths < 1
    || region.width <= 0
    || region.height <= 0
    || region.x < view.x - tolerance
    || region.y < view.y - tolerance
    || region.x + region.width > view.x + view.width + tolerance
    || region.y + region.height > view.y + view.height + tolerance);
  if (invalidRegion) {
    throw new Error(`Géométrie ${label} rognée ou vide : ${JSON.stringify(invalidRegion)}`);
  }
  const figureCenter = geometry.figure.x + (geometry.figure.width / 2);
  const viewCenter = view.x + (view.width / 2);
  if (Math.abs(figureCenter - viewCenter) > view.width * .04) {
    throw new Error(`Géométrie ${label} décentrée : ${JSON.stringify({ figureCenter, viewCenter })}`);
  }
}

async function main() {
  await fs.mkdir(OUTPUT_PATH, { recursive: true });
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 980,
    backgroundColor: "#171512",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
      partition: `bcdevis-body-selector-${process.pid}-${Date.now()}`
    }
  });
  window.webContents.on("console-message", (event) => {
    if (event.level >= 2) console.error(`RENDERER_CONSOLE_${event.level}: ${event.message}`);
  });
  try {
    await window.loadFile(APP_PATH);
    await window.webContents.executeJavaScript(`document.fonts.ready`);
    const front = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#settingsButton").click();
      const form = document.querySelector("#settingsForm");
      form.elements.catalogMode.value = "body";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const map = document.querySelector(".interactive-body-map");
      const layout = document.querySelector(".body-selector-layout");
      const results = document.querySelector(".body-results");
      const family = document.querySelector("#familyPanel");
      const stage = document.querySelector(".body-map-stage").getBoundingClientRect();
      const figure = document.querySelector(".body-figure").getBoundingClientRect();
      const figureBox = document.querySelector(".body-figure").getBBox();
      const viewBox = map.viewBox.baseVal;
      return {
        side: document.querySelector(".body-selector").dataset.bodySide,
        services: document.querySelectorAll(".body-service-options .family-option").length,
        mapVisible: Boolean(map && map.getBoundingClientRect().height > 300),
        figure: {
          width: figure.width,
          height: figure.height,
          stageWidth: stage.width,
          stageHeight: stage.height,
          mapWidth: map.getBoundingClientRect().width,
          mapHeight: map.getBoundingClientRect().height,
          stageHeightRatio: figure.height / stage.height,
          mapHeightRatio: figure.height / map.getBoundingClientRect().height
        },
        geometry: {
          viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
          figure: { x: figureBox.x, y: figureBox.y, width: figureBox.width, height: figureBox.height },
          regions: [...document.querySelectorAll("[data-body-region]")].map((region) => {
            const bounds = region.getBBox();
            return {
              id: region.dataset.bodyRegion,
              paths: region.querySelectorAll("path,ellipse").length,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height
            };
          })
        },
        layoutContained: layout.getBoundingClientRect().right <= family.getBoundingClientRect().right + 1,
        resultsContained: results.scrollWidth <= results.clientWidth + 1,
        title: document.querySelector(".body-results").dataset.bodyResultsTitle
      };
    })()`);
    if (!front.mapVisible
      || front.figure.height < 500
      || front.figure.width < 220
      || front.figure.stageHeightRatio < 0.88
      || front.figure.mapHeightRatio < 0.88
      || !front.layoutContained
      || !front.resultsContained
      || front.services !== 13
      || front.side !== "front"
      || front.title !== "Visage & cou") {
      throw new Error(`Vue avant invalide : ${JSON.stringify(front)}`);
    }
    validateBodyGeometry("homme/Face", front.geometry);
    await window.webContents.executeJavaScript(`document.querySelector("#toastRegion").replaceChildren()`);
    const initialModel = await window.webContents.executeJavaScript(`(() => ({
      model: document.querySelector(".interactive-body-map").dataset.bodyModel,
      modelToggleArea: Boolean(document.querySelector("[data-body-model-toggle]")),
      sideButtons: document.querySelectorAll(".body-side-toggle button").length,
      modelButtons: [...document.querySelectorAll("[data-body-model-choice]")].map((button) => ({
        label: button.textContent.trim(),
        pressed: button.getAttribute("aria-pressed")
      }))
    }))()`);
    if (initialModel.model !== "male"
      || !initialModel.modelToggleArea
      || initialModel.sideButtons !== 2
      || initialModel.modelButtons.map((button) => button.label).join(",") !== "Femme,Homme"
      || initialModel.modelButtons.map((button) => button.pressed).join(",") !== "false,true") {
      throw new Error(`Mannequin masculin initial invalide : ${JSON.stringify(initialModel)}`);
    }
    await capture(window, "01-corps-avant-homme.png");
    const femaleToggle = await window.webContents.executeJavaScript(`(() => {
      const beforeRegion = document.querySelector("[data-body-region].active")?.dataset.bodyRegion;
      document.querySelector('[data-body-model-choice="female"]').click();
      const figure = document.querySelector(".body-figure").getBoundingClientRect();
      const figureBox = document.querySelector(".body-figure").getBBox();
      const map = document.querySelector(".interactive-body-map");
      const viewBox = map.viewBox.baseVal;
      return {
        beforeRegion,
        femaleModel: document.querySelector(".interactive-body-map").dataset.bodyModel,
        afterClickRegion: document.querySelector("[data-body-region].active")?.dataset.bodyRegion,
        femalePressed: document.querySelector('[data-body-model-choice="female"]').getAttribute("aria-pressed"),
        figure: { width: figure.width, height: figure.height },
        geometry: {
          viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
          figure: { x: figureBox.x, y: figureBox.y, width: figureBox.width, height: figureBox.height },
          regions: [...document.querySelectorAll("[data-body-region]")].map((region) => {
            const bounds = region.getBBox();
            return { id: region.dataset.bodyRegion, paths: region.querySelectorAll("path,ellipse").length, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          })
        }
      };
    })()`);
    if (femaleToggle.femaleModel !== "female"
      || femaleToggle.beforeRegion !== femaleToggle.afterClickRegion
      || femaleToggle.femalePressed !== "true"
      || femaleToggle.figure.width < 210
      || femaleToggle.figure.height < 500) {
      throw new Error(`Basculement vers le corps féminin invalide : ${JSON.stringify(femaleToggle)}`);
    }
    validateBodyGeometry("femme/Face", femaleToggle.geometry);
    await capture(window, "02-corps-avant-femme.png");
    const femaleFrontRegionsAudit = await window.webContents.executeJavaScript(`(() => {
      const expected = [
        ["front-torse", "Torse & ventre", 5],
        ["front-bras", "Bras & aisselles", 7],
        ["front-maillot", "Maillot & zone intime", 5],
        ["front-jambes", "Jambes & pieds", 8],
        ["front-visage", "Visage & cou", 13]
      ];
      const results = expected.map(([id, expectedTitle, expectedServices]) => {
        document.querySelector('[data-body-region="' + id + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          id,
          expectedTitle,
          expectedServices,
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          services: document.querySelectorAll(".body-service-options .family-option").length,
          model: document.querySelector("[data-body-model]").dataset.bodyModel
        };
      });
      document.querySelector("[data-body-detail='body']")?.click();
      return results;
    })()`);
    const invalidFemaleFrontRegion = femaleFrontRegionsAudit.find((region) => region.title !== region.expectedTitle
      || region.services !== region.expectedServices
      || region.model !== "female");
    if (invalidFemaleFrontRegion) {
      throw new Error(`Zone féminine Face invalide : ${JSON.stringify(invalidFemaleFrontRegion)}`);
    }
    const maleToggle = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-body-model-choice="male"]').click();
      return {
        finalModel: document.querySelector(".interactive-body-map").dataset.bodyModel,
        finalRegion: document.querySelector("[data-body-region].active")?.dataset.bodyRegion,
        malePressed: document.querySelector('[data-body-model-choice="male"]').getAttribute("aria-pressed")
      };
    })()`);
    const modelToggle = { ...femaleToggle, ...maleToggle };
    if (modelToggle.finalModel !== "male"
      || modelToggle.beforeRegion !== modelToggle.finalRegion
      || modelToggle.malePressed !== "true") {
      throw new Error(`Basculement inverse vers le corps masculin invalide : ${JSON.stringify(modelToggle)}`);
    }
    const maleFrontRegionsAudit = await window.webContents.executeJavaScript(`(() => {
      const expected = [
        ["front-torse", "Torse & ventre", 5],
        ["front-bras", "Bras & aisselles", 7],
        ["front-maillot", "Maillot & zone intime", 5],
        ["front-jambes", "Jambes & pieds", 8],
        ["front-visage", "Visage & cou", 13]
      ];
      const results = expected.map(([id, expectedTitle, expectedServices]) => {
        document.querySelector('[data-body-region="' + id + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          id,
          expectedTitle,
          expectedServices,
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          services: document.querySelectorAll(".body-service-options .family-option").length,
          model: document.querySelector("[data-body-model]").dataset.bodyModel
        };
      });
      document.querySelector("[data-body-detail='body']")?.click();
      return results;
    })()`);
    const invalidMaleFrontRegion = maleFrontRegionsAudit.find((region) => region.title !== region.expectedTitle
      || region.services !== region.expectedServices
      || region.model !== "male");
    if (invalidMaleFrontRegion) {
      throw new Error(`Zone masculine Face invalide : ${JSON.stringify(invalidMaleFrontRegion)}`);
    }

    const faceDetail = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-body-region="front-visage"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const initialServices = document.querySelectorAll(".body-service-options .family-option").length;
      const map = document.querySelector(".interactive-face-map");
      const mapBounds = map.getBoundingClientRect();
      const figure = document.querySelector(".face-figure").getBoundingClientRect();
      const fullFace = document.querySelector('[data-face-region="face-full"]').getBoundingClientRect();
      const pairedBounds = (regionId) => [...document.querySelectorAll('[data-face-region="' + regionId + '"] .face-region-shape')]
        .map((shape) => {
          const bounds = shape.getBoundingClientRect();
          return { left: bounds.left, width: bounds.width, height: bounds.height };
        });
      const brows = pairedBounds("face-brows");
      const cheeksBounds = pairedBounds("face-cheeks");
      document.querySelector('[data-face-region="face-cheeks"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const cheeks = {
        title: document.querySelector(".body-results").dataset.bodyResultsTitle,
        ids: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId))
      };
      return {
        mapVisible: mapBounds.height >= 410,
        mapBox: {
          width: mapBounds.width,
          height: mapBounds.height,
          computedWidth: getComputedStyle(map).width,
          computedHeight: getComputedStyle(map).height,
          display: getComputedStyle(map).display
        },
        regions: document.querySelectorAll("[data-face-region]").length,
        initialServices,
        model: map.dataset.bodyModel,
        anatomySource: map.dataset.anatomySource,
        viewBox: map.getAttribute("viewBox"),
        figureTransformAbsent: !document.querySelector(".face-figure").hasAttribute("transform"),
        figure: {
          width: figure.width,
          height: figure.height,
          ratio: figure.width / figure.height,
          occupancy: figure.height / mapBounds.height
        },
        fullFace: { width: fullFace.width, height: fullFace.height },
        pairedRegions: { brows, cheeks: cheeksBounds },
        accessibleTitle: document.querySelector("#faceMapTitle").textContent,
        cheeks,
        backButton: Boolean(document.querySelector("[data-body-detail='body']")),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (!faceDetail.mapVisible
      || faceDetail.regions !== 12
      || faceDetail.initialServices !== 13
      || faceDetail.model !== "male"
      || faceDetail.anatomySource !== "user-reference"
      || faceDetail.viewBox !== "260 45 505 740"
      || !faceDetail.figureTransformAbsent
      || faceDetail.figure.ratio < .55
      || faceDetail.figure.ratio > .78
      || faceDetail.figure.occupancy < .9
      || faceDetail.fullFace.height < 300
      || faceDetail.pairedRegions.brows.length !== 2
      || faceDetail.pairedRegions.cheeks.length !== 2
      || Math.abs(faceDetail.pairedRegions.brows[0].width - faceDetail.pairedRegions.brows[1].width) > 3
      || Math.abs(faceDetail.pairedRegions.cheeks[0].width - faceDetail.pairedRegions.cheeks[1].width) > 3
      || faceDetail.accessibleTitle !== "Détail du visage neutre"
      || faceDetail.cheeks.title !== "Joues"
      || faceDetail.cheeks.ids.join(",") !== "26"
      || !faceDetail.backButton
      || faceDetail.horizontalOverflow) {
      throw new Error(`Détail du visage neutre invalide : ${JSON.stringify(faceDetail)}`);
    }
    await capture(window, "02-visage-neutre-joues.png");

    const faceNose = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-face-region="face-nose"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        model: document.querySelector(".interactive-face-map").dataset.bodyModel,
        title: document.querySelector(".body-results").dataset.bodyResultsTitle,
        ids: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId)),
        activeNose: Boolean(document.querySelector('[data-face-region="face-nose"].active'))
      };
    })()`);
    if (faceNose.model !== "male"
      || faceNose.title !== "Nez & narines"
      || faceNose.ids.join(",") !== "25"
      || !faceNose.activeNose) {
      throw new Error(`Zone du nez invalide : ${JSON.stringify(faceNose)}`);
    }
    await capture(window, "03-visage-neutre-nez.png");
    const faceRegionsAudit = await window.webContents.executeJavaScript(`(() => {
      const expected = [
        ["face-full", "Visage complet", 29],
        ["face-temples", "Tempes", 23],
        ["face-brows", "Sourcils", 21],
        ["face-glabella", "Entre-sourcils", 22],
        ["face-nose", "Nez & narines", 25],
        ["face-cheeks", "Joues", 26],
        ["face-upper-lip", "Lèvre supérieure", 19],
        ["face-beard", "Barbe", 27],
        ["face-beard-line", "Ligne de barbe", 28],
        ["face-chin", "Menton", 20],
        ["face-ears", "Oreilles", 24],
        ["face-neck", "Cou", 30]
      ];
      return expected.map(([id, expectedTitle, expectedServiceId]) => {
        document.querySelector('[data-face-region="' + id + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const region = document.querySelector('[data-face-region="' + id + '"]');
        const bounds = region.getBoundingClientRect();
        return {
          id,
          expectedTitle,
          expectedServiceId,
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          serviceIds: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId)),
          active: region.classList.contains("active"),
          activeRegions: document.querySelectorAll(".face-region.active").length,
          width: bounds.width,
          height: bounds.height
        };
      });
    })()`);
    const invalidFaceRegion = faceRegionsAudit.find((region) => region.title !== region.expectedTitle
      || region.serviceIds.join(",") !== String(region.expectedServiceId)
      || !region.active
      || region.activeRegions !== 1
      || region.width <= 0
      || region.height <= 0);
    if (invalidFaceRegion) {
      throw new Error(`Zone faciale invalide : ${JSON.stringify(invalidFaceRegion)}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector("[data-body-detail='body']").click()`);

    const back = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="back"]').click();
      document.querySelector('svg [data-body-region="back-dos"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        side: document.querySelector(".body-selector").dataset.bodySide,
        title: document.querySelector(".body-results").dataset.bodyResultsTitle,
        services: document.querySelectorAll(".body-service-options .family-option").length,
        activeBack: Boolean(document.querySelector('svg [data-body-region="back-dos"].active')),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (back.side !== "back" || back.title !== "Dos & nuque" || back.services !== 5 || !back.activeBack || back.horizontalOverflow) {
      throw new Error(`Vue arrière invalide : ${JSON.stringify(back)}`);
    }
    const maleBack = await window.webContents.executeJavaScript(`(() => {
      const figure = document.querySelector(".body-figure").getBoundingClientRect();
      const figureBox = document.querySelector(".body-figure").getBBox();
      const map = document.querySelector(".interactive-body-map");
      const viewBox = map.viewBox.baseVal;
      return {
        model: document.querySelector(".interactive-body-map").dataset.bodyModel,
        figure: { width: figure.width, height: figure.height },
        regions: document.querySelectorAll("[data-body-region]").length,
        geometry: {
          viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
          figure: { x: figureBox.x, y: figureBox.y, width: figureBox.width, height: figureBox.height },
          regions: [...document.querySelectorAll("[data-body-region]")].map((region) => {
            const bounds = region.getBBox();
            return { id: region.dataset.bodyRegion, paths: region.querySelectorAll("path,ellipse").length, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          })
        }
      };
    })()`);
    if (maleBack.model !== "male"
      || maleBack.regions !== 5
      || maleBack.figure.width < 220
      || maleBack.figure.height < 500) {
      throw new Error(`Vue arrière masculine invalide : ${JSON.stringify(maleBack)}`);
    }
    validateBodyGeometry("homme/Dos", maleBack.geometry);
    await capture(window, "04-corps-arriere-homme.png");
    const maleBackRegionsAudit = await window.webContents.executeJavaScript(`(() => {
      const expected = [
        ["back-scalp", "Cuir chevelu", 1],
        ["back-dos", "Dos & nuque", 5],
        ["back-bras", "Bras & épaules", 7],
        ["back-jambes", "Fesses, jambes & pieds", 9],
        ["back-sif", "Sillon interfessier (SIF)", 1]
      ];
      const results = expected.map(([id, expectedTitle, expectedServices]) => {
        document.querySelector('[data-body-region="' + id + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          id,
          expectedTitle,
          expectedServices,
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          services: document.querySelectorAll(".body-service-options .family-option").length,
          model: document.querySelector(".interactive-body-map").dataset.bodyModel,
          active: Boolean(document.querySelector('[data-body-region="' + id + '"].active'))
        };
      });
      document.querySelector('[data-body-region="back-dos"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return results;
    })()`);
    const invalidMaleBackRegion = maleBackRegionsAudit.find((region) => region.title !== region.expectedTitle
      || region.services !== region.expectedServices
      || region.model !== "male"
      || !region.active);
    if (invalidMaleBackRegion) {
      throw new Error(`Zone masculine Dos invalide : ${JSON.stringify(invalidMaleBackRegion)}`);
    }
    const femaleBack = await window.webContents.executeJavaScript(`(() => {
      const beforeRegion = document.querySelector("[data-body-region].active")?.dataset.bodyRegion;
      document.querySelector(".interactive-body-map").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const figure = document.querySelector(".body-figure").getBoundingClientRect();
      const figureBox = document.querySelector(".body-figure").getBBox();
      const map = document.querySelector(".interactive-body-map");
      const viewBox = map.viewBox.baseVal;
      return {
        model: document.querySelector(".interactive-body-map").dataset.bodyModel,
        beforeRegion,
        afterRegion: document.querySelector("[data-body-region].active")?.dataset.bodyRegion,
        figure: { width: figure.width, height: figure.height },
        regions: document.querySelectorAll("[data-body-region]").length,
        geometry: {
          viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
          figure: { x: figureBox.x, y: figureBox.y, width: figureBox.width, height: figureBox.height },
          regions: [...document.querySelectorAll("[data-body-region]")].map((region) => {
            const bounds = region.getBBox();
            return { id: region.dataset.bodyRegion, paths: region.querySelectorAll("path,ellipse").length, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          })
        }
      };
    })()`);
    if (femaleBack.model !== "female"
      || femaleBack.regions !== 5
      || femaleBack.beforeRegion !== femaleBack.afterRegion
      || femaleBack.figure.width < 210
      || femaleBack.figure.height < 480) {
      throw new Error(`Vue arrière féminine invalide : ${JSON.stringify(femaleBack)}`);
    }
    validateBodyGeometry("femme/Dos", femaleBack.geometry);
    await capture(window, "05-corps-arriere-femme.png");
    const femaleBackRegionsAudit = await window.webContents.executeJavaScript(`(() => {
      const expected = [
        ["back-scalp", "Cuir chevelu", 1],
        ["back-dos", "Dos & nuque", 5],
        ["back-bras", "Bras & épaules", 7],
        ["back-jambes", "Fesses, jambes & pieds", 9],
        ["back-sif", "Sillon interfessier (SIF)", 1]
      ];
      return expected.map(([id, expectedTitle, expectedServices]) => {
        document.querySelector('[data-body-region="' + id + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          id,
          expectedTitle,
          expectedServices,
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          services: document.querySelectorAll(".body-service-options .family-option").length,
          model: document.querySelector(".interactive-body-map").dataset.bodyModel,
          active: Boolean(document.querySelector('[data-body-region="' + id + '"].active'))
        };
      });
    })()`);
    const invalidFemaleBackRegion = femaleBackRegionsAudit.find((region) => region.title !== region.expectedTitle
      || region.services !== region.expectedServices
      || region.model !== "female"
      || !region.active);
    if (invalidFemaleBackRegion) {
      throw new Error(`Zone féminine Dos invalide : ${JSON.stringify(invalidFemaleBackRegion)}`);
    }
    const restoredMaleBack = await window.webContents.executeJavaScript(`(() => {
      const stage = document.querySelector("[data-body-model-toggle]");
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      return {
        model: document.querySelector(".interactive-body-map").dataset.bodyModel,
        region: document.querySelector("[data-body-region].active")?.dataset.bodyRegion
      };
    })()`);
    if (restoredMaleBack.model !== "male" || restoredMaleBack.region !== "back-sif") {
      throw new Error(`Retour clavier vers le dos masculin invalide : ${JSON.stringify(restoredMaleBack)}`);
    }

    const exactRegions = await window.webContents.executeJavaScript(`(() => {
      const clickRegion = (regionId) => {
        document.querySelector('[data-body-region="' + regionId + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          title: document.querySelector(".body-results").dataset.bodyResultsTitle,
          ids: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId))
        };
      };
      const result = {
        sif: clickRegion("back-sif"),
        scalp: clickRegion("back-scalp"),
        backLegs: clickRegion("back-jambes")
      };
      document.querySelector('button[data-body-side="front"]').click();
      result.frontMaillot = clickRegion("front-maillot");
      result.frontLegs = clickRegion("front-jambes");
      result.frontFace = clickRegion("front-visage");
      return result;
    })()`);
    const exactRegionsValid = exactRegions.sif.title === "Sillon interfessier (SIF)"
      && exactRegions.sif.ids.join(",") === "49"
      && exactRegions.scalp.title === "Cuir chevelu"
      && exactRegions.scalp.ids.join(",") === "96"
      && exactRegions.backLegs.ids.length === 9
      && exactRegions.frontMaillot.ids.length === 5
      && !exactRegions.frontMaillot.ids.includes(49)
      && exactRegions.frontLegs.ids.length === 8
      && !exactRegions.frontLegs.ids.includes(55)
      && exactRegions.frontFace.ids.length === 13;
    if (!exactRegionsValid) throw new Error(`Filtrage anatomique invalide : ${JSON.stringify(exactRegions)}`);

    const geometryAudit = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("[data-body-detail='body']")?.click();
      document.querySelector('button[data-body-side="front"]').click();
      const activate = (regionId) => {
        const region = document.querySelector('[data-body-region="' + regionId + '"]');
        region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        const bounds = document.querySelector('[data-body-region="' + regionId + '"]').getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          activeRegions: document.querySelectorAll(".body-region.active").length
        };
      };
      const frontArms = activate("front-bras");
      const frontMaillot = activate("front-maillot");
      document.querySelector('button[data-body-side="back"]').click();
      const backLegs = activate("back-jambes");
      const sifHitarea = document.querySelector('[data-body-region="back-sif"] .body-region-hitarea').getBoundingClientRect();
      const neutralSifStroke = getComputedStyle(document.querySelector('[data-body-region="back-sif"] .body-region-target')).stroke;
      const sif = activate("back-sif");
      const activeSifStroke = getComputedStyle(document.querySelector('[data-body-region="back-sif"] .body-region-target')).stroke;
      return {
        frontArms,
        frontMaillot,
        backLegs,
        sif,
        sifHitarea: { width: sifHitarea.width, height: sifHitarea.height },
        neutralSifStroke,
        activeSifStroke
      };
    })()`);
    if (Object.values({
      frontArms: geometryAudit.frontArms,
      frontMaillot: geometryAudit.frontMaillot,
      backLegs: geometryAudit.backLegs,
      sif: geometryAudit.sif
    }).some((region) => region.width <= 0 || region.height <= 0 || region.activeRegions !== 1)
      || geometryAudit.sifHitarea.width < 25
      || geometryAudit.sifHitarea.height < 35
      || geometryAudit.activeSifStroke === geometryAudit.neutralSifStroke) {
      throw new Error(`Géométrie anatomique invalide : ${JSON.stringify(geometryAudit)}`);
    }
    await capture(window, "05-zone-sif-neutre.png");

    const keyboardAudit = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="front"]').click();
      const torso = document.querySelector('[data-body-region="front-torse"]');
      torso.focus();
      torso.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return {
        title: document.querySelector(".body-results").dataset.bodyResultsTitle,
        activeTorso: Boolean(document.querySelector('[data-body-region="front-torse"].active')),
        activeRegions: document.querySelectorAll(".body-region.active").length
      };
    })()`);
    if (keyboardAudit.title !== "Torse & ventre" || !keyboardAudit.activeTorso || keyboardAudit.activeRegions !== 1) {
      throw new Error(`Navigation clavier anatomique invalide : ${JSON.stringify(keyboardAudit)}`);
    }

    window.setContentSize(740, 900);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const narrow = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="front"]').click();
      if (!document.querySelector('svg [data-body-region="front-visage"].active')) {
        document.querySelector('svg [data-body-region="front-visage"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        document.querySelector("[data-body-detail='body']").click();
      }
      const layout = document.querySelector(".body-selector-layout");
      const map = document.querySelector(".interactive-body-map");
      const results = document.querySelector(".body-results");
      return {
        width: innerWidth,
        columns: getComputedStyle(layout).gridTemplateColumns.split(" ").length,
        mapVisible: map.getBoundingClientRect().height >= 380,
        title: document.querySelector(".body-results").dataset.bodyResultsTitle,
        activeFrontRegion: Boolean(document.querySelector('svg [data-body-region="front-visage"].active')),
        resultsBelowMap: results.getBoundingClientRect().top >= map.getBoundingClientRect().bottom,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (narrow.columns !== 1 || !narrow.mapVisible || narrow.title !== "Visage & cou" || !narrow.activeFrontRegion || !narrow.resultsBelowMap || narrow.horizontalOverflow) {
      throw new Error(`Vue étroite invalide : ${JSON.stringify(narrow)}`);
    }
    await capture(window, "06-corps-responsive-760.png");

    window.setContentSize(390, 844);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const mobile = await window.webContents.executeJavaScript(`(() => ({
      width: innerWidth,
      mapVisible: document.querySelector(".interactive-body-map").getBoundingClientRect().height >= 345,
      sideButtonsVisible: [...document.querySelectorAll(".body-side-toggle button")].every((button) => button.getBoundingClientRect().width > 80),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
    }))()`);
    if (!mobile.mapVisible || !mobile.sideButtonsVisible || mobile.horizontalOverflow) {
      throw new Error(`Vue mobile invalide : ${JSON.stringify(mobile)}`);
    }
    await capture(window, "09-corps-responsive-390.png");
    await window.webContents.executeJavaScript(`document.querySelector(".body-results").scrollIntoView({ block: "start" })`);
    await capture(window, "10-prestations-responsive-390.png");
    const mobileFace = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-body-region="front-visage"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const map = document.querySelector(".interactive-face-map");
      const card = document.querySelector(".body-map-card");
      const results = document.querySelector(".body-results");
      const bounds = map.getBoundingClientRect();
      return {
        regions: document.querySelectorAll("[data-face-region]").length,
        mapHeight: bounds.height,
        mapContained: bounds.left >= card.getBoundingClientRect().left && bounds.right <= card.getBoundingClientRect().right,
        resultsBelowMap: results.getBoundingClientRect().top >= bounds.bottom,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (mobileFace.regions !== 12
      || mobileFace.mapHeight < 340
      || !mobileFace.mapContained
      || !mobileFace.resultsBelowMap
      || mobileFace.horizontalOverflow) {
      throw new Error(`Visage mobile invalide : ${JSON.stringify(mobileFace)}`);
    }
    await capture(window, "11-visage-neutre-responsive-390.png");

    window.setContentSize(1440, 980);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const settings = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#settingsButton").click();
      const picker = document.querySelector(".catalog-mode-picker");
      picker.scrollIntoView({ block: "center" });
      const cards = [...picker.querySelectorAll(".catalog-mode-card")];
      const modal = document.querySelector("#settingsLayer .settings-modal");
      return {
        cards: cards.length,
        bodyChecked: document.querySelector('input[name="catalogMode"][value="body"]').checked,
        cardsBalanced: Math.max(...cards.map((card) => card.getBoundingClientRect().height)) - Math.min(...cards.map((card) => card.getBoundingClientRect().height)) <= 1,
        contained: picker.getBoundingClientRect().left >= modal.getBoundingClientRect().left && picker.getBoundingClientRect().right <= modal.getBoundingClientRect().right,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (settings.cards !== 2 || !settings.bodyChecked || !settings.cardsBalanced || !settings.contained || settings.horizontalOverflow) {
      throw new Error(`Réglage du sélecteur invalide : ${JSON.stringify(settings)}`);
    }
    await capture(window, "07-reglage-navigation.png");
    console.log("BODY_SELECTOR_VISUAL_OK");
    console.log(JSON.stringify({ front, initialModel, modelToggle, femaleFrontRegionsAudit, maleFrontRegionsAudit, faceDetail, faceNose, faceRegionsAudit, back, maleBack, maleBackRegionsAudit, femaleBack, femaleBackRegionsAudit, restoredMaleBack, exactRegions, geometryAudit, keyboardAudit, narrow, mobile, mobileFace, settings, output: OUTPUT_PATH }, null, 2));
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
