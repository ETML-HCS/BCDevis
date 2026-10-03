"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const styles = read("styles.css");
const sync = read("central-sync.js");
const serviceWorker = read("service-worker.js");
const chromeos = fs.readFileSync(path.join(root, "..", "scripts", "build-chromeos.cjs"), "utf8");
const pdfI18n = read("pdf-i18n.js");

// Le module de calcul est chargé avant l'application, livré dans le build web et précaché hors ligne.
assert.match(html, /<script src="pdf-i18n\.js"><\/script>\s*<script src="currency-core\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/, "Le moteur de conversion doit être chargé avant l’application");
assert.ok(serviceWorker.includes('"./currency-core.js"'), "Le moteur de conversion doit rester disponible hors ligne");
assert.match(chromeos, /"currency-core\.js"/, "Le moteur de conversion doit être copié dans le livrable ChromeOS");

// Réglages : option, taux, commission, actualisation, mise à jour automatique.
assert.match(html, /name="eurEnabled" type="checkbox"[\s\S]*?Proposer le devis en euros/, "Les réglages doivent proposer d’activer le devis en euros");
assert.match(html, /name="eurRate" type="text" inputmode="decimal"[\s\S]*?name="eurCommission" type="text" inputmode="decimal"[\s\S]*?2 à 3 % conseillés/, "Le taux et la commission doivent être saisissables, avec le conseil de commission");
assert.match(html, /id="eurRefreshButton"[\s\S]*?Actualiser le taux \(BCE\)/, "Le taux doit pouvoir être actualisé depuis les réglages");
assert.match(html, /name="eurAutoUpdate" type="checkbox"/, "La mise à jour automatique doit pouvoir être désactivée");
assert.match(html, /name="eurRateDate"[\s\S]*?name="eurRateSource"/, "La date et l’origine du taux doivent être conservées");
assert.match(app, /eurRate === null \|\| eurCommission === null[\s\S]*?return;/, "Un taux ou une commission invalide doit bloquer l’enregistrement");
assert.match(app, /if \(name === "eurRate"\) markEurRateManual\(\)/, "Un taux saisi à la main doit être reconnu comme tel");
assert.match(app, /function markEurRateManual\(\)[\s\S]*?eurAutoUpdate\.checked = false/, "Un taux saisi à la main ne doit pas être écrasé par la mise à jour automatique");
assert.match(app, /async function autoRefreshEurRate\(\)[\s\S]*?db\.settings\.eurRateDate === todayISO\(\)[\s\S]*?refreshEurRate\(\{ silent: true \}\)/, "La mise à jour automatique doit avoir lieu au plus une fois par jour et échouer sans bruit");
assert.match(app, /window\.setTimeout\(\(\) => void autoRefreshEurRate\(\), 6000\)/, "La mise à jour automatique doit se lancer à l’ouverture");
assert.match(app, /eurEnabled: eurRequested && eurRate !== null/, "L’option ne doit jamais être active sans taux valide");

// Les réglages sont partagés entre les postes, pour que toute la clinique utilise le même taux.
for (const key of ["eurEnabled", "eurRate", "eurCommission", "eurAutoUpdate", "eurRateDate", "eurRateSource"]) {
  assert.ok(sync.includes(`"${key}"`), `${key} doit être synchronisé entre les postes`);
}

// Caisse : sélecteur CHF / EUR, taux visible, référence en francs, devis verrouillé non modifiable.
assert.match(html, /id="currencySwitch" hidden>[\s\S]*?data-quote-currency="CHF"[\s\S]*?data-quote-currency="EUR"[\s\S]*?id="currencyNote" role="status"/, "La caisse doit proposer le choix de devise");
assert.match(html, /id="referenceTotalRow" hidden>[\s\S]*?Référence en francs suisses/, "Le total en CHF doit rester visible sous le total en euros");
assert.match(app, /function setQuoteCurrency\(code\) \{\s*if \(!ensureQuoteEditable\(\)\) return;/, "Un devis verrouillé ne doit pas changer de devise");
assert.match(app, /button\.disabled = locked;/, "Les boutons de devise doivent être inactifs sur un devis verrouillé");
assert.match(app, /Réglez d’abord le taux de l’euro/, "Sans taux valide, le passage en euros doit expliquer quoi faire");
assert.match(app, /function renderCurrencySwitch\(\)[\s\S]*?CurrencyCore\.isStale\(fx\.date, today\)[\s\S]*?ancien/, "Un taux ancien doit être signalé dans la caisse");

// Le taux est figé dans le devis : un changement ultérieur ne modifie pas un devis déjà préparé.
assert.match(app, /const importedFx = CurrencyCore\.sanitizeFx\(source\.fx\)[\s\S]*?else delete sanitized\.fx/, "Un devis importé ne doit conserver qu’une photographie de taux valide");
assert.match(app, /function refreshCopyFx\(copy\)[\s\S]*?CurrencyCore\.makeFx\(db\.settings, todayISO\(\)\)/, "Une copie ou une nouvelle version doit repartir du taux courant");
assert.match(app, /function refreshQuoteFx\(\) \{\s*if \(!ensureQuoteEditable\(\)\) return;/, "Mettre à jour le taux d’un devis doit respecter son verrouillage");

// Montants : tout ce que lit le client passe par la conversion, jamais par un calcul séparé en CHF.
assert.match(app, /\$\("#grandTotalValue"\)\.textContent = displayMoney\(totals\.total\)/, "Le total de la caisse doit être converti");
assert.match(app, /\$\("#installmentGrid"\)\.innerHTML = months\.length === 0 \? "" : `[\s\S]*?moneyValue\(payable \/ month\)/, "Les mensualités doivent partir du total converti");
assert.match(app, /function pdfMoney\(value\)[\s\S]*?PdfI18n\.formatMoney\(CurrencyCore\.convertFromChf\(value, fx\), language, "EUR"\)/, "Le PDF doit afficher les montants en euros");
assert.match(app, /function pdfInstallment\(totalChf, month\)[\s\S]*?convertFromChf\(totalChf, fx\) \/ month/, "Les mensualités du PDF doivent partir du total converti");
assert.match(app, /print-fx-note[\s\S]*?text\.fxNote\(/, "Le PDF en euros doit expliquer le taux appliqué et rappeler le total en CHF");
assert.match(app, /Montants en euros au taux de 1 € = [\s\S]*?Total de référence/, "Le message d’envoi doit préciser le taux et le total de référence");
assert.match(styles, /\.print-fx-note\{/, "La note de conversion doit avoir sa mise en forme d’impression");

// La note du PDF existe dans les huit langues.
assert.equal((pdfI18n.match(/fxNote: \(rate, date, reference\) =>/g) || []).length, 8, "La note de conversion doit être traduite dans les huit langues");

console.log("CURRENCY_UI_TESTS_OK");
