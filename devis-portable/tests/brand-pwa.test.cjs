"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { startPwaServer } = require("../../scripts/pwa-server.cjs");

const projectRoot = path.resolve(__dirname, "..", "..");
const appRoot = path.join(projectRoot, "devis-portable");
const text = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

for (const relativePath of [
  "assets/clinique-bellecour-logo-officiel.jpeg",
  "assets/clinique-bellecour-logo-officiel.png",
  "assets/icon-save.svg",
  "assets/red-hat-display-regular.ttf",
  "assets/red-hat-display-medium.ttf",
  "assets/red-hat-display-semibold.ttf",
  "assets/red-hat-display-bold.ttf",
  "assets/red-hat-display-extrabold.ttf",
  "assets/red-hat-display-black.ttf",
  "assets/red-hat-display-italic-variable.ttf",
  "assets/roboto-latin.woff2",
  "assets/roboto-slab-latin.woff2"
]) {
  const bundledPath = path.join(appRoot, relativePath);
  assert.ok(fs.existsSync(bundledPath), `${relativePath} doit être livré avec BCDevis`);
  assert.ok(fs.statSync(bundledPath).size > 0, `${relativePath} ne doit pas être vide`);
}

const styles = text("styles.css");
const appSource = text("app.js");
const bodyAnatomy = text("body-anatomy.js");
const siteMigration = text("site-migration.js");
const index = text("index.html");
const saveIcon = text("assets/icon-save.svg");
const manifest = JSON.parse(text("manifest.webmanifest"));
const serviceWorker = text("service-worker.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

assert.match(styles, /font-family:"Red Hat Display"/);
assert.match(styles, /font-family:"Roboto"/);
assert.match(styles, /font-family:"Roboto Slab"/);
assert.match(styles, /font-family:"BCDevis Fallback"/);
assert.match(styles, /--sans:"Red Hat Display","Roboto",Arial,sans-serif/);
assert.match(styles, /\.print-hero h1\{[^}]*font-weight:800/);
assert.match(styles, /\.print-client-card \.print-label\{font-weight:600\}/);
assert.match(styles, /\.print-contact-label\{[^}]*font-weight:600/);
assert.match(appSource, /<h1>\$\{en \? "QUOTE" : "DEVIS"\}<\/h1>/);
assert.match(appSource, /settings\.showSignatures !== false/);
const printItemMetaTemplate = appSource.match(/<span class="print-item-meta">([\s\S]*?)<\/span>/)?.[1] || "";
assert.ok(printItemMetaTemplate, "Le détail secondaire des prestations doit être présent dans le PDF");
assert.doesNotMatch(printItemMetaTemplate, /duration|\bmin\b/, "La durée ne doit pas apparaître dans le PDF");
assert.match(index, /name="showSignatures" type="checkbox"/);
assert.match(index, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/, "La PWA doit exploiter les marges sûres de l’iPad");
assert.match(index, /name="apple-mobile-web-app-capable" content="yes"/, "BCDevis doit pouvoir s’ouvrir comme application iPad");
assert.match(index, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/, "La barre d’état iPad doit s’intégrer au header");
assert.match(index, /--safe-area-bottom:env\(safe-area-inset-bottom,0px\)/, "La navigation iPad doit respecter la zone de geste système");
assert.match(appSource, /window\.visualViewport\?\.addEventListener\("resize", syncViewportMetrics\)/, "Le clavier virtuel iPad doit redimensionner la surface utile");
assert.doesNotMatch(index, /id="headerLogo"/);
assert.match(index, /id="headerLogoPreview"/);
assert.match(index, /<script src="body-anatomy\.js"><\/script>/);
assert.match(index, /<script src="central-sync\.js"><\/script>/);
assert.match(index, /<script src="contact-core\.js"><\/script>/);
assert.match(index, /<script src="site-migration\.js"><\/script>/);
assert.ok(bodyAnatomy.length > 1000, "La géométrie du sélecteur anatomique doit être livrée");
assert.match(siteMigration, /atelier-devis-site-transfer/, "L’assistant de migration doit être livré avec la PWA");
assert.equal(manifest.display, "standalone");
assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
assert.match(serviceWorker, /clinique-bellecour-logo-officiel\.png/);
assert.match(serviceWorker, /\.\/body-anatomy\.js/);
assert.match(serviceWorker, /\.\/contact-core\.js/);
assert.match(serviceWorker, /\.\/site-migration\.js/);
assert.match(serviceWorker, /red-hat-display-extrabold\.ttf/);
assert.match(serviceWorker, /roboto-latin\.woff2/);
assert.match(serviceWorker, /roboto-slab-latin\.woff2/);
assert.match(serviceWorker, new RegExp(`CACHE_NAME = "bcdevis-pwa-v${packageJson.version.replaceAll(".", "\\.")}-touch-ipad-smartphone-documents-help-contacts"`), "Le cache PWA doit changer avec la passe tactile, les réglages documentaires, le centre d’aide et les contacts");
assert.match(saveIcon, /stroke="currentColor"[^>]*stroke-width="2\.15"/, "L’icône Enregistrer livrée doit rester nette et adaptable au thème");
assert.equal((saveIcon.match(/<path\b/g) || []).length, 3, "L’icône Enregistrer doit conserver ses trois tracés lisibles");

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

(async () => {
  const { server, url } = await startPwaServer({ port: 0 });
  try {
    const [page, webmanifest, font, roboto, robotoSlab, logo] = await Promise.all([
      get(url),
      get(new URL("manifest.webmanifest", url)),
      get(new URL("assets/red-hat-display-extrabold.ttf", url)),
      get(new URL("assets/roboto-latin.woff2", url)),
      get(new URL("assets/roboto-slab-latin.woff2", url)),
      get(new URL("assets/clinique-bellecour-logo-officiel.png", url))
    ]);
    assert.equal(page.status, 200);
    assert.match(page.headers["content-type"], /^text\/html/);
    assert.equal(webmanifest.status, 200);
    assert.match(webmanifest.headers["content-type"], /^application\/manifest\+json/);
    assert.equal(font.status, 200);
    assert.equal(font.headers["content-type"], "font/ttf");
    assert.equal(roboto.status, 200);
    assert.equal(roboto.headers["content-type"], "font/woff2");
    assert.equal(robotoSlab.status, 200);
    assert.equal(robotoSlab.headers["content-type"], "font/woff2");
    assert.equal(logo.status, 200);
    assert.equal(logo.headers["content-type"], "image/png");
    assert.equal(font.body.length, (await fsp.stat(path.join(appRoot, "assets", "red-hat-display-extrabold.ttf"))).size);
    assert.equal(roboto.body.length, (await fsp.stat(path.join(appRoot, "assets", "roboto-latin.woff2"))).size);
    assert.equal(robotoSlab.body.length, (await fsp.stat(path.join(appRoot, "assets", "roboto-slab-latin.woff2"))).size);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("BRAND_PWA_TESTS_OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
