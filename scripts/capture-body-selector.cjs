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
    await capture(window, "01-corps-avant.png");

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
    await capture(window, "02-corps-arriere-dos.png");

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

    window.setContentSize(740, 900);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const narrow = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('button[data-body-side="front"]').click();
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
    await capture(window, "03-corps-responsive-760.png");

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
    await capture(window, "04-reglage-navigation.png");
    console.log("BODY_SELECTOR_VISUAL_OK");
    console.log(JSON.stringify({ front, back, exactRegions, narrow, mobile, settings, output: OUTPUT_PATH }, null, 2));
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
