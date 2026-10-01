"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { whatsAppNumber } = require("../contact-core.js");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "preload.cjs"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Numéros : format international sans « + », indicatif suisse par défaut.
assert.equal(whatsAppNumber("+41 79 123 45 67"), "41791234567");
assert.equal(whatsAppNumber("079 123 45 67"), "41791234567");
assert.equal(whatsAppNumber("0041 79 123 45 67"), "41791234567");
assert.equal(whatsAppNumber("+41 (0) 79 123 45 67"), "41791234567", "Le (0) national après l’indicatif doit être ignoré");
assert.equal(whatsAppNumber("+33 6 12 34 56 78"), "33612345678", "Un indicatif étranger explicite est conservé");
assert.equal(whatsAppNumber("12345"), "", "Un numéro trop court ne doit pas produire de lien");
assert.equal(whatsAppNumber(""), "");

// Application de bureau : le PDF est copié comme fichier puis la conversation est ouverte.
assert.match(main, /ipcMain\.handle\("bcdevis:whatsapp-prepare"/, "Le processus principal doit préparer l’envoi WhatsApp");
assert.match(main, /Set-Clipboard -LiteralPath \$env:BCDEVIS_CLIPBOARD_FILE/, "Le chemin du PDF doit passer par l’environnement, jamais par la ligne de commande");
assert.match(main, /whatsapp:\/\/send\?/, "WhatsApp Desktop doit être ouvert directement quand il est installé");
assert.match(main, /https:\/\/wa\.me\//, "WhatsApp Web reste le repli");
assert.ok(main.includes(String.raw`/^\d{8,15}$/.test(String(payload?.phone`), "Le numéro reçu doit être validé avant d’entrer dans une URL");
assert.match(main, /path\.extname\(filePath\)\.toLowerCase\(\) === "\.pdf"/, "Seul un PDF peut être copié dans le presse-papiers");
assert.match(preload, /prepareWhatsAppShare:/, "Le pont de préchargement doit exposer l’envoi WhatsApp");
assert.match(app, /prepareWhatsAppShare\(\{ phone, text: message, filePath: result\.filePath \}\)/, "Le bouton WhatsApp doit utiliser la préparation native");
assert.match(app, /BCDevisContacts\.whatsAppNumber\(quote\.client\?\.phone\)/, "Le numéro du client doit préremplir la conversation");

console.log("WHATSAPP_SHARE_TESTS_OK");
