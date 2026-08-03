"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(PROJECT_ROOT, "devis-portable", "index.html");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "tmp", "ipad");

app.commandLine.appendSwitch("disable-gpu");

async function settle(window) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  await window.webContents.executeJavaScript("document.fonts.ready");
}

async function capture(window, name) {
  await settle(window);
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(OUTPUT_PATH, name), image.toPNG());
}

async function setViewport(window, width, height) {
  window.setContentSize(width, height);
  await settle(window);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await window.webContents.executeJavaScript(`({ width: innerWidth, height: innerHeight })`);
    if (Math.abs(current.width - width) <= 1 && Math.abs(current.height - height) <= 1) return;
    window.setContentSize(width + (width - current.width), height + (height - current.height));
    await settle(window);
  }
  const current = await window.webContents.executeJavaScript(`({ width: innerWidth, height: innerHeight })`);
  if (Math.abs(current.width - width) > 1 || Math.abs(current.height - height) > 1) throw new Error(`Viewport ${width} × ${height} impossible : ${JSON.stringify(current)}`);
}

async function audit(window, label, { minColumns = 2 } = {}) {
  const result = await window.webContents.executeJavaScript(`(() => {
    const appShell = document.querySelector(".app-shell").getBoundingClientRect();
    const mobileTabs = document.querySelector("#mobileTabs").getBoundingClientRect();
    const search = document.querySelector("#catalogSearchToggle").getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      layout: document.documentElement.dataset.ipadLayout,
      preference: document.documentElement.dataset.ipadPreference,
      tabsVisible: getComputedStyle(document.querySelector("#mobileTabs")).display !== "none",
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      shellContained: appShell.bottom <= innerHeight + 1,
      tabsContained: mobileTabs.left >= 0 && mobileTabs.right <= innerWidth + 1 && mobileTabs.bottom <= innerHeight + 1,
      searchTouchTarget: search.width >= 44 && search.height >= 44,
      inputFontSize: Number.parseFloat(getComputedStyle(document.querySelector("#catalogSearch")).fontSize),
      familyOptionColumns: getComputedStyle(document.querySelector(".family-options")).gridTemplateColumns.split(" ").filter(Boolean).length
    };
  })()`);
  if (result.layout !== "optimized" || result.preference !== "always") throw new Error(`${label} : optimisation iPad inactive`);
  if (!result.tabsVisible || result.horizontalOverflow || !result.shellContained || !result.tabsContained) throw new Error(`${label} : débordement ${JSON.stringify(result)}`);
  if (!result.searchTouchTarget || result.inputFontSize < 16) throw new Error(`${label} : confort tactile insuffisant ${JSON.stringify(result)}`);
  if (result.familyOptionColumns < minColumns) throw new Error(`${label} : l’espace disponible des prestations est sous-utilisé ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  await fs.mkdir(OUTPUT_PATH, { recursive: true });
  const window = new BrowserWindow({
    show: false,
    width: 1180,
    height: 820,
    backgroundColor: "#171512",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
      partition: `bcdevis-ipad-${process.pid}-${Date.now()}`
    }
  });

  try {
    await window.loadFile(APP_PATH);
    await settle(window);
    await capture(window, "00-nouveautes-5.2.0.png");
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('#releaseNotesLayer:not([hidden]) [data-close="releaseNotesLayer"]')?.click();
      document.querySelector("#settingsButton").click();
      const form = document.querySelector("#settingsForm");
      if (form.elements.ipadLayoutMode.value !== "off") throw new Error("Le confort iPad n’est pas désactivé par défaut");
      form.elements.ipadLayoutMode.value = "always";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    })()`);

    await setViewport(window, 1180, 820);
    await window.webContents.executeJavaScript(`document.querySelector(".toast-close")?.click()`);
    const landscape = await audit(window, "iPad paysage");
    await capture(window, "01-ipad-paysage-prestations.png");
    await window.webContents.executeJavaScript(`document.querySelector('[data-panel="checkoutPanel"]').click()`);
    await capture(window, "02-ipad-paysage-caisse.png");

    await setViewport(window, 820, 1180);
    await window.webContents.executeJavaScript(`document.querySelector('[data-panel="familyPanel"]').click()`);
    const portrait = await audit(window, "iPad portrait");
    await capture(window, "03-ipad-portrait-prestations.png");
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector(".toast-close")?.click();
      document.querySelector("#settingsButton").click();
      document.querySelector(".settings-section--ipad").scrollIntoView({ block: "center" });
    })()`);
    await capture(window, "04-ipad-portrait-reglages.png");

    await window.webContents.executeJavaScript(`document.querySelector('#settingsLayer [data-close="settingsLayer"]').click()`);
    await setViewport(window, 600, 820);
    await window.webContents.executeJavaScript(`document.querySelector('[data-panel="familyPanel"]').click()`);
    const splitView = await audit(window, "iPad Split View", { minColumns: 1 });
    await capture(window, "05-ipad-split-view.png");

    console.log("IPAD_VISUAL_OK");
    console.log(JSON.stringify({ landscape, portrait, splitView, output: OUTPUT_PATH }, null, 2));
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
