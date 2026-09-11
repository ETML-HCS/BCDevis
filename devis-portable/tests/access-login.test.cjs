"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const html = read("devis-portable/index.html");
const app = read("devis-portable/app.js");
const central = read("devis-portable/central-sync.js");
const server = read("central-server/server.cjs");

assert.match(html, /<html[^>]*class="auth-pending"/, "Le document doit masquer l’application avant la décision d’accès");
assert.match(html, /id="accessGate"[\s\S]*?id="accessLoginForm"/, "Un écran de connexion doit précéder l’application");
assert.match(html, /id="appShell" inert aria-hidden="true"/, "L’application doit être inerte avant authentification");
assert.match(html, /id="accessEmail"[^>]*autocomplete="username"[^>]*required/, "Le login doit demander une adresse e-mail");
assert.match(html, /id="accessPassword"[^>]*type="password"[^>]*autocomplete="current-password"[^>]*required/, "Le mot de passe doit utiliser le champ et l’autocomplétion adaptés");
assert.doesNotMatch(html, /id="accessPassword"[^>]*value=/, "Aucun mot de passe ne doit être inscrit dans le document");
assert.match(html, /id="sessionLogoutButton"[^>]*aria-label="Se déconnecter"/, "Un poste partagé doit pouvoir être reverrouillé");

assert.match(app, /ACCESS_GATE_REQUIRED = ACCESS_GATE_FORCED \|\| \(\/\^https\?:\$\//, "La version web publiée doit exiger une authentification");
assert.match(app, /centralController\.initialize\(\{ requireAuthentication: true \}\)/, "Une session mémorisée doit être validée avant le démarrage");
assert.match(app, /if \(!applicationStarted\) return;/, "Les raccourcis doivent rester inactifs derrière le verrou");
assert.match(app, /await centralController\.logout\(\);[\s\S]*?showAccessGate\("Vous êtes déconnecté\."\)/, "La déconnexion doit reverrouiller l’application");
assert.match(app, /enabled\.disabled = ACCESS_GATE_REQUIRED/, "Le mode local ne doit pas pouvoir être réactivé dans la PWA protégée");

assert.match(central, /async function validateSession\(\)[\s\S]*?request\("session"\)/, "Le jeton local doit être vérifié auprès du serveur");
assert.match(central, /function invalidateSession[\s\S]*?config\.token = ""/, "Une session refusée doit supprimer le jeton local");
assert.match(central, /async function logout\(\)[\s\S]*?enabled: true, token: ""/, "La déconnexion V8 doit conserver l’exigence d’identification");
const persistedConfigShape = central.match(/function freshConfig\(\) \{[\s\S]*?^  \}/m)?.[0] || "";
assert.doesNotMatch(persistedConfigShape, /password/i, "La configuration persistée ne doit jamais contenir de champ mot de passe");
assert.match(central, /storage\.setItem\(CONFIG_KEY, JSON\.stringify\(config\)\)/, "Seule la configuration contrôlée doit être persistée");
assert.match(server, /url\.pathname === `\$\{API_PREFIX\}\/auth\/login`/, "Le login doit être validé par l’API centrale");
assert.match(server, /const session = token \? await database\.authenticate\(token\) : null/, "Les routes centrales doivent rester protégées par session");

console.log("ACCESS_LOGIN_TESTS_OK");