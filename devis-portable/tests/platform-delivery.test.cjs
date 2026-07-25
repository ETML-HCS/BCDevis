"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const packageJson = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const main = read("devis-portable/main.cjs");
const readme = read("devis-portable/README.md");
const guide = read("devis-portable/MODE-D-EMPLOI.md");
const workflow = read(".github/workflows/livrables.yml");

assert.equal(packageJson.version, lock.version, "La version du lockfile doit suivre package.json");
assert.equal(packageJson.version, lock.packages[""].version, "La version racine du lockfile doit être synchronisée");
assert.equal(packageJson.build.win.target[0].target, "portable");
assert.deepEqual(packageJson.build.win.target[0].arch, ["x64"]);
assert.equal(packageJson.build.mac.target[0].target, "dmg");
assert.deepEqual(packageJson.build.mac.target[0].arch, ["universal"]);
assert.match(packageJson.build.mac.icon, /\.icns$/);
assert.ok(fs.existsSync(path.join(projectRoot, packageJson.build.mac.icon)), "L'icône macOS doit être livrée");
assert.match(packageJson.scripts.chromeos, /build-chromeos\.cjs/);
assert.match(packageJson.scripts.mac, /require-build-platform\.cjs darwin/);

assert.match(main, /process\.platform === "win32"/);
assert.match(main, /PORTABLE_EXECUTABLE_DIR/);
assert.match(main, /else if \(!app\.isPackaged\)/);
assert.doesNotMatch(main, /path\.dirname\(process\.execPath\)/, "macOS ne doit pas écrire dans le bundle applicatif");

for (const platform of ["Windows", "macOS", "ChromeOS"]) {
  assert.match(workflow, new RegExp(platform, "i"), `Le workflow doit produire le livrable ${platform}`);
}
for (const document of [readme, guide]) {
  assert.match(document, new RegExp(packageJson.version.replaceAll(".", "\\.")), "La documentation doit annoncer la version livrée");
}

console.log("PLATFORM_DELIVERY_TESTS_OK");
