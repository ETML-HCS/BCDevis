"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8"));
const themes = ["light", "night", "forest", "bordeaux"];
const fonts = ["red-hat", "roboto", "roboto-slab", "system"];
const requiredTokens = [
  "--paper",
  "--soft",
  "--line",
  "--taupe",
  "--taupe-light",
  "--taupe-dark",
  "--ink",
  "--muted",
  "--topbar-bg",
  "--topbar-fg",
  "--panel-bg",
  "--accent",
  "--accent-ink",
  "--contrast",
  "--contrast-ink",
  "--surface",
  "--surface-raised",
  "--surface-soft"
];

function themeToken(block, token) {
  return block.match(new RegExp(`${token}:(#[0-9a-f]{6})`, "i"))?.[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (linear[0] * 0.2126) + (linear[1] * 0.7152) + (linear[2] * 0.0722);
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

assert.match(
  app,
  /const KNOWN_THEMES = \["light", "night", "forest", "bordeaux"\]/,
  "La liste applicative doit exposer les quatre thèmes"
);
assert.match(
  app,
  /const KNOWN_FONTS = \["red-hat", "roboto", "roboto-slab", "system"\]/,
  "La liste applicative doit rester limitée aux quatre polices prévues"
);
assert.match(app, /fontFamily: "red-hat"/, "Red Hat Display doit rester la police par défaut");

for (const theme of themes) {
  const themeBlock = html.match(new RegExp(`html\\[data-theme="${theme}"\\]\\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(themeBlock, `Variables CSS absentes pour le thème ${theme}`);
  for (const token of requiredTokens) {
    assert.match(themeBlock[1], new RegExp(`${token}:`), `${token} absent du thème ${theme}`);
  }
  for (const [foreground, background] of [
    ["--topbar-fg", "--topbar-bg"],
    ["--topbar-fg", "--panel-bg"],
    ["--accent-ink", "--accent"],
    ["--contrast-ink", "--contrast"],
    ["--ink", "--paper"],
    ["--ink", "--surface-raised"],
    ["--muted", "--surface-raised"],
    ["--muted", "--surface-soft"],
    ["--taupe-dark", "--taupe-light"]
  ]) {
    const foregroundColor = themeToken(themeBlock[1], foreground);
    const backgroundColor = themeToken(themeBlock[1], background);
    assert.ok(foregroundColor && backgroundColor, `Couleurs de contraste absentes pour ${theme}: ${foreground}/${background}`);
    assert.ok(
      contrast(foregroundColor, backgroundColor) >= 4.5,
      `Contraste insuffisant pour ${theme}: ${foreground}/${background}`
    );
  }
  assert.match(html, new RegExp(`data-theme="${theme}" role="radio"`), `Carte de sélection absente pour ${theme}`);
  assert.match(html, new RegExp(`theme-card-swatch ${theme}`), `Aperçu de palette absent pour ${theme}`);
  const browserColor = app.match(new RegExp(`${theme}: "(#[0-9a-f]{6})"`, "i"))?.[1];
  assert.equal(browserColor, themeToken(themeBlock[1], "--topbar-bg"), `Couleur de fenêtre incohérente pour ${theme}`);
  for (const [selector, property, token] of [
    [`\\.theme-card-swatch\\.${theme}`, "background", "--paper"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-top`, "background", "--topbar-bg"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-panel`, "background", "--panel-bg"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-accent`, "background", "--accent"]
  ]) {
    const previewColor = html.match(new RegExp(`${selector}\\{[^}]*${property}:(#[0-9a-f]{6})`, "i"))?.[1];
    assert.equal(previewColor, themeToken(themeBlock[1], token), `Aperçu ${token} incohérent pour ${theme}`);
  }
}

assert.match(
  html,
  /\.theme-picker\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
  "Le sélecteur desktop doit présenter les quatre palettes"
);
assert.match(
  html,
  /@media\(max-width:760px\)\{\.theme-picker\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/,
  "Le sélecteur doit rester compact sur tablette"
);
assert.match(html, /id="fontPicker" role="radiogroup" aria-label="Choix de la police"/);
assert.equal((html.match(/class="font-card"/g) || []).length, 4, "Les réglages doivent proposer exactement quatre polices");
for (const font of fonts) {
  assert.match(html, new RegExp(`data-font="${font}" role="radio"`), `Choix de police absent : ${font}`);
  assert.match(styles, new RegExp(`html\\[data-font="${font}"\\]`), `Variables typographiques absentes : ${font}`);
}
assert.match(styles, /@font-face\{font-family:"Roboto";[^}]*roboto-latin\.woff2/);
assert.match(styles, /@font-face\{font-family:"Roboto Slab";[^}]*roboto-slab-latin\.woff2/);
assert.match(styles, /\.print-quote\{[\s\S]*?font-family:var\(--document-font\)/, "Le PDF doit suivre la police choisie");
assert.doesNotMatch(
  styles,
  /@media print\{[\s\S]*?font-family:"Red Hat Display"/,
  "Aucune zone du PDF ne doit forcer Red Hat Display après un changement"
);
assert.equal(manifest.background_color, "#f4f1eb", "Le lancement PWA doit reprendre le papier du thème Lumière");
assert.equal(manifest.theme_color, "#171512", "Le lancement PWA doit reprendre l’en-tête du thème Lumière");
assert.doesNotMatch(html, /id="headerLogo"/, "Le logo ne doit plus occuper l’en-tête de l’application");
assert.doesNotMatch(html, /class="brand-logo"/, "Le header doit réserver sa largeur au tarif et aux actions");
assert.match(
  html,
  /html\[data-theme\] \.local-badge>span\{background:var\(--accent\)/,
  "L’indicateur local doit suivre l’accent de chaque thème"
);

console.log("THEME_CONTRACTS_TESTS_OK");
