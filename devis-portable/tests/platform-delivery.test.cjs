"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const packageJson = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const main = read("devis-portable/main.cjs");
const preload = read("devis-portable/preload.cjs");
const styles = read("devis-portable/styles.css");
const index = read("devis-portable/index.html");
const readme = read("devis-portable/README.md");
const guide = read("devis-portable/MODE-D-EMPLOI.md");
const workflow = read(".github/workflows/livrables.yml");
const chromeosBuilder = read("scripts/build-chromeos.cjs");

assert.equal(packageJson.version, lock.version, "La version du lockfile doit suivre package.json");
assert.equal(packageJson.version, lock.packages[""].version, "La version racine du lockfile doit être synchronisée");
assert.equal(packageJson.build.win.target[0].target, "portable");
assert.deepEqual(packageJson.build.win.target[0].arch, ["x64"]);
assert.equal(packageJson.build.mac.target[0].target, "dmg");
assert.deepEqual(packageJson.build.mac.target[0].arch, ["universal"]);
assert.equal(packageJson.build.icon, "devis-portable/assets/bcdevis-app-icon.png");
assert.equal(packageJson.build.mac.icon, packageJson.build.icon);
assert.equal(packageJson.build.linux.icon, packageJson.build.icon);
assert.ok(fs.existsSync(path.join(projectRoot, packageJson.build.icon)), "L'icône multiplateforme doit être livrée");
const appIcon = fs.readFileSync(path.join(projectRoot, packageJson.build.icon));
assert.equal(appIcon.readUInt32BE(16), 512, "L'icône doit mesurer 512 px de large");
assert.equal(appIcon.readUInt32BE(20), 512, "L'icône doit mesurer 512 px de haut");
assert.match(packageJson.scripts.chromeos, /build-chromeos\.cjs/);
for (const helpFile of ["help.html", "help.css", "help.js"]) {
  assert.match(chromeosBuilder, new RegExp(`"${helpFile.replace(".", "\\.")}"`), `${helpFile} doit être copié dans le livrable ChromeOS`);
}
assert.match(chromeosBuilder, /"contact-core\.js"/, "Le moteur de contacts doit être copié dans le livrable ChromeOS");
assert.match(chromeosBuilder, /fetch\(new URL\("help\.html", url\)\)[\s\S]*?helpPage\.ok[\s\S]*?text\/html/, "L’assembleur ChromeOS doit vérifier le centre d’aide livré");
assert.match(packageJson.scripts.mac, /require-build-platform\.cjs darwin/);
assert.match(packageJson.scripts.linux, /require-build-platform\.cjs linux/);

assert.match(main, /process\.platform === "win32"/);
assert.match(main, /PORTABLE_EXECUTABLE_DIR/);
assert.match(main, /else if \(!app\.isPackaged\)/);
assert.doesNotMatch(main, /path\.dirname\(process\.execPath\)/, "macOS ne doit pas écrire dans le bundle applicatif");
assert.match(main, /customWindowPlatforms = \["win32", "linux"\]/, "Windows et Linux doivent utiliser la fenêtre BCDevis personnalisée");
assert.match(main, /titleBarStyle:\s*"hidden"/, "Windows et Linux doivent masquer la barre de titre standard");
assert.match(main, /titleBarStyle:\s*"hiddenInset"/, "macOS doit conserver ses contrôles natifs dans l'en-tête BCDevis");
assert.match(main, /bcdevis-app-icon\.png/, "La fenêtre doit utiliser l'icône BCDevis lisible");
assert.match(main, /TABLET_WINDOW_SIZE = Object\.freeze\(\{ width: 1180, height: 820 \}\)/, "Le bouton Agrandir doit disposer d’un format tablette calé sur le breakpoint responsive");
assert.match(main, /function switchToTabletWindow[\s\S]*?window\.setBounds\(tabletWindowBounds\(window\), true\)/, "La restauration doit revenir à une fenêtre tablette centrée");
assert.match(main, /const windowShell = process\.platform === "darwin"[\s\S]*?\? "mac"[\s\S]*?\? "custom" : "standard"/, "Le chrome doit être adapté à chaque plateforme");
assert.match(main, /appUrl\.searchParams\.set\("windowShell", windowShell\)/, "Le rendu doit connaître le chrome de la plateforme");
for (const channel of ["bcdevis:window-minimize", "bcdevis:window-toggle-maximize", "bcdevis:window-close"]) {
  assert.match(main, new RegExp(channel), `Le contrôle ${channel} doit être relié à la fenêtre`);
}
assert.match(read("devis-portable/app.js"), /classList\.add\("bcdevis-window-overlay"\)/, "Le rendu Windows doit activer la zone de déplacement");
assert.match(preload, /minimizeWindow:/);
assert.match(preload, /toggleMaximizeWindow:/);
assert.match(preload, /closeWindow:/);
assert.match(styles, /html\.bcdevis-window-overlay \.topbar\{[\s\S]*?-webkit-app-region:drag/, "L'en-tête BCDevis doit déplacer la fenêtre");
assert.match(styles, /html\.bcdevis-window-overlay \.topbar\{[\s\S]*?z-index:auto/, "Les contrôles doivent pouvoir apparaître au-dessus de la caisse");
assert.match(styles, /-webkit-app-region:no-drag/, "Les actions de l'en-tête doivent rester cliquables");
assert.match(styles, /\.window-controls:hover,[\s\S]*?\.window-controls:focus-within\{[\s\S]*?width:126px/, "Les contrôles doivent se révéler discrètement au survol ou au clavier");
assert.match(styles, /\.checkout-panel\.is-full-height \.receipt-head\{[\s\S]*?padding-right:34px/, "Le rail replié ne doit réserver que 34 px dans la caisse");
assert.match(styles, /\.window-controls:hover,[\s\S]*?\.window-controls:focus-within\{[\s\S]*?background:#fff[\s\S]*?backdrop-filter:none/, "Le rail déployé doit être opaque et bloquer les clics au travers");
assert.match(styles, /@media \(hover:none\),\(pointer:coarse\)\{[\s\S]*?\.window-controls\{[\s\S]*?width:126px[\s\S]*?background:#fff[\s\S]*?receipt-head\{padding-right:118px\}/, "Le rail complet doit rester réservé uniquement sans hover");
for (const id of ["windowMinimizeButton", "windowMaximizeButton", "windowCloseButton"]) {
  assert.match(index, new RegExp(`id="${id}"[^>]+aria-label="[^"]+"`), `${id} doit rester accessible`);
}
assert.match(read("devis-portable/app.js"), /isMaximized \? "Passer en mode tablette" : "Agrandir la fenêtre"/, "Le bouton central doit annoncer son prochain mode");
assert.doesNotMatch(index, /class="window-app-mark"/, "Les contrôles de fenêtre ne doivent pas répéter le logo de l’application");

for (const platform of ["Windows", "Linux", "macOS", "ChromeOS"]) {
  assert.match(workflow, new RegExp(platform, "i"), `Le workflow doit produire le livrable ${platform}`);
}
for (const document of [readme, guide]) {
  assert.match(document, new RegExp(packageJson.version.replaceAll(".", "\\.")), "La documentation doit annoncer la version livrée");
}

console.log("PLATFORM_DELIVERY_TESTS_OK");
