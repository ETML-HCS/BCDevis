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
      return {
        side: document.querySelector(".body-selector").dataset.bodySide,
        services: document.querySelectorAll(".body-service-options .family-option").length,
        mapVisible: Boolean(map && map.getBoundingClientRect().height > 300),
        layoutContained: layout.getBoundingClientRect().right <= family.getBoundingClientRect().right + 1,
        resultsContained: results.scrollWidth <= results.clientWidth + 1,
        title: document.querySelector("#bodyResultsTitle").textContent
      };
    })()`);
    if (!front.mapVisible || !front.layoutContained || !front.resultsContained || front.services !== 13 || front.side !== "front" || front.title !== "Visage & cou") {
      throw new Error(`Vue avant invalide : ${JSON.stringify(front)}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector("#toastRegion").replaceChildren()`);
    await capture(window, "01-corps-avant-femme.png");

    const modelToggle = await window.webContents.executeJavaScript(`(() => {
      const dimensions = () => ({
        torso: document.querySelector('[data-body-region="front-torse"]').getBoundingClientRect().width,
        pelvis: document.querySelector('[data-body-region="front-maillot"]').getBoundingClientRect().width
      });
      const female = dimensions();
      document.querySelector('button[data-body-model="male"]').click();
      const male = dimensions();
      return {
        female,
        male,
        model: document.querySelector(".interactive-body-map").dataset.bodyModel,
        malePressed: document.querySelector('button[data-body-model="male"]').getAttribute("aria-pressed"),
        services: document.querySelectorAll(".body-service-options .family-option").length
      };
    })()`);
    if (modelToggle.model !== "male"
      || modelToggle.malePressed !== "true"
      || modelToggle.services !== 13
      || modelToggle.male.torso <= modelToggle.female.torso
      || modelToggle.male.pelvis >= modelToggle.female.pelvis) {
      throw new Error(`Toggle femme/homme invalide : ${JSON.stringify(modelToggle)}`);
    }
    await capture(window, "02-corps-avant-homme.png");
    await window.webContents.executeJavaScript(`document.querySelector('button[data-body-model="female"]').click()`);

    const faceDetail = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-body-region="front-visage"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const initialServices = document.querySelectorAll(".body-service-options .family-option").length;
      const femaleWidth = document.querySelector('[data-face-region="face-full"]').getBoundingClientRect().width;
      document.querySelector('[data-face-region="face-cheeks"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const cheeks = {
        title: document.querySelector("#bodyResultsTitle").textContent,
        ids: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId))
      };
      return {
        mapVisible: document.querySelector(".interactive-face-map").getBoundingClientRect().height >= 390,
        regions: document.querySelectorAll("[data-face-region]").length,
        initialServices,
        femaleWidth,
        cheeks,
        backButton: Boolean(document.querySelector("[data-body-detail='body']")),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (!faceDetail.mapVisible
      || faceDetail.regions !== 12
      || faceDetail.initialServices !== 13
      || faceDetail.cheeks.title !== "Joues"
      || faceDetail.cheeks.ids.join(",") !== "26"
      || !faceDetail.backButton
      || faceDetail.horizontalOverflow) {
      throw new Error(`Détail du visage féminin invalide : ${JSON.stringify(faceDetail)}`);
    }
    await capture(window, "03-visage-femme-joues.png");

    const maleFace = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-model="male"]').click();
      const maleWidth = document.querySelector('[data-face-region="face-full"]').getBoundingClientRect().width;
      document.querySelector('[data-face-region="face-nose"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        model: document.querySelector(".interactive-face-map").dataset.bodyModel,
        maleWidth,
        title: document.querySelector("#bodyResultsTitle").textContent,
        ids: [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => Number(item.dataset.familyServiceId)),
        activeNose: Boolean(document.querySelector('[data-face-region="face-nose"].active'))
      };
    })()`);
    if (maleFace.model !== "male"
      || maleFace.maleWidth <= faceDetail.femaleWidth
      || maleFace.title !== "Nez & narines"
      || maleFace.ids.join(",") !== "25"
      || !maleFace.activeNose) {
      throw new Error(`Détail du visage masculin invalide : ${JSON.stringify(maleFace)}`);
    }
    await capture(window, "04-visage-homme-nez.png");
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-model="female"]').click();
      document.querySelector("[data-body-detail='body']").click();
    })()`);

    const back = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="back"]').click();
      document.querySelector('svg [data-body-region="back-dos"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        side: document.querySelector(".body-selector").dataset.bodySide,
        title: document.querySelector("#bodyResultsTitle").textContent,
        services: document.querySelectorAll(".body-service-options .family-option").length,
        activeBack: Boolean(document.querySelector('svg [data-body-region="back-dos"].active')),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (back.side !== "back" || back.title !== "Dos & nuque" || back.services !== 5 || !back.activeBack || back.horizontalOverflow) {
      throw new Error(`Vue arrière invalide : ${JSON.stringify(back)}`);
    }
    await capture(window, "05-corps-arriere-dos.png");

    const exactRegions = await window.webContents.executeJavaScript(`(() => {
      const clickRegion = (regionId) => {
        document.querySelector('[data-body-region="' + regionId + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return {
          title: document.querySelector("#bodyResultsTitle").textContent,
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
      document.querySelector('button[data-body-model="female"]').click();
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
      const neutralArmpitStroke = getComputedStyle(document.querySelector(".body-region-armpit")).stroke;
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
        neutralArmpitStroke,
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
      || geometryAudit.neutralArmpitStroke !== geometryAudit.neutralSifStroke
      || geometryAudit.activeSifStroke === geometryAudit.neutralSifStroke) {
      throw new Error(`Géométrie anatomique invalide : ${JSON.stringify(geometryAudit)}`);
    }
    await capture(window, "08-zone-sif-femme.png");

    const keyboardAudit = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="front"]').click();
      const torso = document.querySelector('[data-body-region="front-torse"]');
      torso.focus();
      torso.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return {
        title: document.querySelector("#bodyResultsTitle").textContent,
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
        title: document.querySelector("#bodyResultsTitle").textContent,
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
    console.log(JSON.stringify({ front, modelToggle, faceDetail, maleFace, back, exactRegions, geometryAudit, keyboardAudit, narrow, mobile, settings, output: OUTPUT_PATH }, null, 2));
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
