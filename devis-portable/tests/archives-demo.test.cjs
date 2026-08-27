"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const appRoot = path.join(projectRoot, "devis-portable");
const text = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

const html = text("index.html");
const app = text("app.js");

// Le centre (Historique) affiche chaque devis enregistré avec sa date et le
// nombre de soins : « 16.08.2026 · 5 soins ».
assert.match(
  app,
  /history-item-meta[\s\S]*?\$\{formatDate\(item\.date\)\} · \$\{plural\(item\.lines\?\.length \|\| 0, "soin"\)\}/,
  "La carte d’historique doit afficher la date et le nombre de soins"
);
assert.match(
  app,
  /const plural = \(count, singular, pluralForm = `\$\{singular\}s`\) => `\$\{count\} \$\{count === 1 \? singular : pluralForm\}`/,
  "Le pluriel doit transformer 5 soins en « 5 soins »"
);

// Un devis enregistré apparaît dans le centre avec le statut « Enregistré ».
assert.match(app, /key: "saved",\s*label: "Enregistré"/, "Le statut du devis archivé doit s’appeler « Enregistré »");
assert.match(app, /function renderHistoryItem\(item[\s\S]*?data-quote-id/, "Chaque devis du centre doit exposer son identifiant");
assert.match(app, /Aucun devis enregistré/, "Le centre doit nommer clairement les devis enregistrés");

// La date du devis est modifiable et accepte des dates passées comme le 16.08.2026.
assert.match(html, /id="quoteDate" type="date"/, "Le devis doit disposer d’un champ de date");
assert.match(app, /quoteDateEditable: false/, "La date du devis doit être verrouillée par défaut");
assert.match(app, /const validISODate = \(value, fallback = todayISO\(\)\)/, "Une date ISO valide doit être acceptée, y compris une date passée");
