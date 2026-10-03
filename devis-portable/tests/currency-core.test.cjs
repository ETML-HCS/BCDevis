"use strict";

const assert = require("node:assert/strict");
const currency = require("../currency-core.js");

// Taux : la virgule décimale est acceptée, une valeur absurde ou vide est refusée.
assert.equal(currency.parseRate("0.9279"), 0.9279);
assert.equal(currency.parseRate("0,9279"), 0.9279, "La virgule décimale doit être acceptée");
assert.equal(currency.parseRate(" 0.92794 "), 0.9279, "Le taux est arrondi à quatre décimales");
for (const bad of ["", "abc", "0", "-1", "0.2", "5", null, undefined, NaN]) assert.equal(currency.parseRate(bad), null, `Taux refusé : ${bad}`);

// Commission : bornée de 0 à 10 %.
assert.equal(currency.parseCommission("2,5"), 2.5);
assert.equal(currency.parseCommission("0"), 0);
for (const bad of ["", "-1", "11", "x"]) assert.equal(currency.parseCommission(bad), null, `Commission refusée : ${bad}`);
assert.deepEqual(["1", "2", "2.5", "3", "4", "x"].map(currency.commissionAdvice), ["low", "ok", "ok", "ok", "high", "invalid"], "Les commissions de 2 à 3 % sont conseillées");

// Photographie du taux : uniquement si l'option est active et le taux valide.
const settings = { eurEnabled: true, eurRate: 0.9279, eurCommission: 2.5, eurRateDate: "2026-10-02" };
assert.deepEqual(currency.makeFx(settings, "2026-10-03"), { code: "EUR", rate: 0.9279, commission: 2.5, date: "2026-10-02" });
assert.equal(currency.makeFx({ ...settings, eurEnabled: false }, "2026-10-03"), null, "Option désactivée : pas de devis en euros");
assert.equal(currency.makeFx({ ...settings, eurRate: 0 }, "2026-10-03"), null, "Sans taux valide, aucune conversion n'est possible");
assert.equal(currency.makeFx({ ...settings, eurCommission: "x" }, "2026-10-03").commission, 2.5, "Une commission illisible revient à la valeur par défaut, jamais à zéro");
assert.equal(currency.makeFx({ ...settings, eurRateDate: "" }, "2026-10-03").date, "2026-10-03", "Sans date de taux, celle du jour est retenue");

// Conversion : CHF ÷ taux × (1 + commission).
const fx = currency.makeFx(settings, "2026-10-03");
assert.equal(currency.convertFromChf(100, fx), 110.46, "100 CHF ÷ 0.9279 × 1.025 = 110.4645, arrondi au centime");
assert.equal(currency.convertFromChf(0, fx), 0);
assert.equal(currency.convertFromChf(100, null), 100, "Sans taux, le montant reste en CHF");
assert.equal(currency.convertFromChf(100, { ...fx, commission: 0 }), 107.77, "Sans commission : le taux du marché seul");
assert.equal(currency.effectiveRate(fx), 0.9053, "Le taux affiché au client est celui qui permet de retrouver le montant");
assert.ok(Math.abs(currency.convertFromChf(765, fx) - 765 / currency.effectiveRate(fx)) < 0.1, "Avec le taux imprimé (quatre décimales), le client retrouve le montant à quelques centimes près");

// La commission protège la clinique : après une semaine, si l'euro perd 2 %, le rechange en francs couvre le prix.
const euros = currency.convertFromChf(1000, fx);
const backAfterDrop = euros * settings.eurRate * 0.98;
assert.ok(backAfterDrop >= 1000, `Le rechange après une baisse de 2 % doit couvrir 1000 CHF (obtenu ${backAfterDrop.toFixed(2)})`);
const noCommission = currency.convertFromChf(1000, { ...fx, commission: 0 });
assert.ok(noCommission * settings.eurRate * 0.98 < 1000, "Sans commission, la même baisse ferait perdre de l'argent");

// Devis importé : la photographie est vérifiée, sinon ignorée.
assert.deepEqual(currency.sanitizeFx({ ...fx, rate: "0,9279" }), fx);
for (const bad of [null, "EUR", { ...fx, code: "USD" }, { ...fx, rate: 9 }, { ...fx, commission: 50 }, { ...fx, date: "hier" }]) assert.equal(currency.sanitizeFx(bad), null, "Une photographie invalide est ignorée");

// Ancienneté du taux.
assert.equal(currency.rateAgeDays("2026-09-25", "2026-10-03"), 8);
assert.equal(currency.rateAgeDays("2026-10-05", "2026-10-03"), 0, "Une date future n'est pas négative");
assert.equal(currency.rateAgeDays("", "2026-10-03"), null);
assert.deepEqual([currency.isStale("2026-09-26", "2026-10-03"), currency.isStale("2026-09-25", "2026-10-03")], [false, true], "Un taux de plus de sept jours est signalé comme ancien");

async function main() {
  // Service de taux : réponses valides, erreurs claires.
  const reply = (payload, { ok = true, status = 200 } = {}) => async () => ({ ok, status, json: async () => payload });
  assert.deepEqual(await currency.fetchEurChfRate(reply({ amount: 1, base: "EUR", date: "2026-10-02", rates: { CHF: 0.9279 } })), { rate: 0.9279, date: "2026-10-02", source: "ecb" });
  await assert.rejects(currency.fetchEurChfRate(reply({}, { ok: false, status: 503 })), /a répondu 503/);
  await assert.rejects(currency.fetchEurChfRate(reply({ rates: { CHF: 42 } })), /inexploitable/, "Un taux absurde renvoyé par le service est refusé");
  await assert.rejects(currency.fetchEurChfRate(reply({ rates: {} })), /inexploitable/);
  await assert.rejects(currency.fetchEurChfRate(async () => { throw new TypeError("fetch failed"); }), /saisissez le taux à la main/);
  await assert.rejects(currency.fetchEurChfRate(async () => ({ ok: true, status: 200, json: async () => { throw new Error("x"); } })), /illisible/);
  await assert.rejects(currency.fetchEurChfRate(null), /indisponible/);
  assert.match(currency.RATE_SOURCE_URL, /^https:\/\/api\.frankfurter\.dev\/v1\/latest\?base=EUR&symbols=CHF$/, "La source doit être le taux de référence EUR→CHF en HTTPS");
  console.log("CURRENCY_CORE_TESTS_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
