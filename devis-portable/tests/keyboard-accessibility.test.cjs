"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

for (const shortcut of ["key === \"k\"", "key === \"s\"", "key === \"n\"", "key === \"p\"", "event.shiftKey && key === \"s\"", "event.key === \",\""]) {
  assert.match(app, new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Raccourci absent : ${shortcut}`);
}
assert.match(app, /trapLayerFocus/, "Les modales doivent conserver le focus au clavier");
assert.match(app, /moveRadioSelection/, "Les groupes de choix doivent accepter les flèches");
assert.match(app, /data-logo-picker/, "Le choix de logo doit être atteignable au clavier");
assert.match(html, /id="shortcutHelpLayer"/, "L’aide des raccourcis doit être accessible dans l’interface");
assert.match(html, /role="radiogroup" aria-label="Tarif appliqué aux soins"/, "Le tarif doit être annoncé comme un groupe de choix");
assert.doesNotMatch(html, /class="layer-backdrop"[^>]*?(?<!tabindex="-1")>/, "Les fonds de modale ne doivent pas interrompre l’ordre de tabulation");
console.log("KEYBOARD_ACCESSIBILITY_TESTS_OK");
