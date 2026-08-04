"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(PROJECT_ROOT, "devis-portable", "index.html");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "tmp", "prestation-svg-audit");
const passName = String(process.argv[2] || "final").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

async function main() {
  await fs.mkdir(OUTPUT_PATH, { recursive: true });
  const window = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1760,
    backgroundColor: "#171512",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false,
      partition: `bcdevis-prestation-icons-${process.pid}-${Date.now()}`
    }
  });

  try {
    await window.loadFile(APP_PATH);
    await window.webContents.executeJavaScript("document.fonts.ready");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const themeAudit = await window.webContents.executeJavaScript(`(() => {
      const initialTheme = document.documentElement.dataset.theme;
      const samples = ["light", "night", "forest", "bordeaux"].map((theme) => {
        document.documentElement.dataset.theme = theme;
        const icon = document.querySelector(".family-option .service-zone-icon");
        const styles = getComputedStyle(icon);
        return {
          theme,
          color: styles.color,
          background: styles.backgroundColor,
          border: styles.borderColor
        };
      });
      document.documentElement.dataset.theme = initialTheme;
      return samples;
    })()`);
    if (themeAudit.some((sample) =>
      !sample.color || !sample.background || sample.color === sample.background
      || sample.color === "rgba(0, 0, 0, 0)"
    )) {
      throw new Error(`Contraste thématique SVG invalide : ${JSON.stringify(themeAudit)}`);
    }
    const audit = await window.webContents.executeJavaScript(`(() => {
      const services = window.QUOTE_SERVICES;
      const sprite = document.querySelector(".svg-sprite");
      const categoryNames = new Map(window.QUOTE_CATEGORIES.map((category) => [category.id, category.short]));
      const main = document.createElement("main");
      main.className = "prestation-icon-audit";
      main.innerHTML = \`
        <header>
          <p>Clinique Bellecour · contrôle anatomique</p>
          <h1>Les pictogrammes des soins</h1>
          <span>Rendu réel 34 px · \${new Set(services.map((service) => service.icon)).size} dessins anatomiques</span>
        </header>
        <section>
          \${services.map((service) => \`
            <article data-service-id="\${service.id}" data-icon="\${service.icon}">
              <span class="service-zone-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-map-\${service.icon}"></use></svg></span>
              <span><b>\${service.id} · \${service.name}</b><small>\${service.zone}</small><em>\${categoryNames.get(service.categoryId) || ""} · \${service.icon}</em></span>
            </article>
          \`).join("")}
        </section>
      \`;
      const style = document.createElement("style");
      style.textContent = \`
        html,body{width:1600px;min-height:1760px;margin:0;overflow:hidden;background:#171512;color:#f6f1e9}
        body{padding:34px;font-family:Arial,sans-serif}
        .prestation-icon-audit header{display:flex;margin-bottom:24px;align-items:end;gap:22px}
        .prestation-icon-audit header p{margin:0;color:#b4a996;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
        .prestation-icon-audit h1{margin:0;font-family:Georgia,serif;font-size:32px;font-weight:500}
        .prestation-icon-audit header span{margin-left:auto;color:#a49d94;font-size:13px}
        .prestation-icon-audit section{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
        .prestation-icon-audit article{display:grid;min-width:0;min-height:74px;padding:8px;border:1px solid #48443e;border-radius:13px;color:#f6f1e9;background:#201f1d;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:9px}
        .prestation-icon-audit article>span:last-child{min-width:0}
        .prestation-icon-audit b,.prestation-icon-audit small,.prestation-icon-audit em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .prestation-icon-audit b{color:#f6f1e9;font-size:11px}
        .prestation-icon-audit small{margin-top:3px;color:#b4a996;font-size:10px}
        .prestation-icon-audit em{margin-top:3px;color:#76716a;font-size:8px;font-style:normal}
      \`;
      document.head.append(style);
      document.body.replaceChildren(sprite, main);
      const cards = [...document.querySelectorAll("[data-service-id]")];
      const geometry = cards.map((card) => {
        const use = card.querySelector("use");
        const bounds = use.getBBox();
        return {
          id: Number(card.dataset.serviceId),
          icon: card.dataset.icon,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        };
      });
      return {
        cards: cards.length,
        uniqueIcons: new Set(cards.map((card) => card.dataset.icon)).size,
        invalidGeometry: geometry.filter((item) =>
          item.width < 8 || item.height < 8 || item.x < -0.25 || item.y < -0.25
          || item.x + item.width > 24.25 || item.y + item.height > 24.25
        ),
        dimensions: {
          icon: getComputedStyle(cards[0].querySelector(".service-zone-icon svg")).width,
          container: getComputedStyle(cards[0].querySelector(".service-zone-icon")).width
        }
      };
    })()`);

    if (audit.cards !== 96 || audit.uniqueIcons !== 57 || audit.invalidGeometry.length) {
      throw new Error(`Audit SVG invalide : ${JSON.stringify(audit)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    const image = await window.webContents.capturePage();
    const output = path.join(OUTPUT_PATH, `${passName}.png`);
    await fs.writeFile(output, image.toPNG());
    window.setContentSize(390, 844);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mobileDimensions = await window.webContents.executeJavaScript(`(() => {
      const icon = document.querySelector(".service-zone-icon");
      return {
        icon: getComputedStyle(icon.querySelector("svg")).width,
        container: getComputedStyle(icon).width,
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    })()`);
    if (mobileDimensions.icon !== "32px" || mobileDimensions.container !== "42px") {
      throw new Error(`Dimensions mobiles SVG invalides : ${JSON.stringify(mobileDimensions)}`);
    }
    console.log("PRESTATION_ICONS_VISUAL_OK");
    console.log(JSON.stringify({ ...audit, themes: themeAudit, mobile: mobileDimensions, output }, null, 2));
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
