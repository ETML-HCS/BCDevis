const assert = require("node:assert/strict");
const { calculate, customLineDiscount, assessLineDiscount, DISCOUNT_GUARD, lineDiscountBase, installmentMonths, referenceLineTotal, cleanDocumentPrefix, relatedDocumentNumber } = require("../quote-core.js");

const base = {
  lines: [{ price: 122, quantity: 7 }, { price: 322, quantity: 7 }, { price: 222, quantity: 7 }],
  discount: { type: "percent", value: 50 },
  tax: { enabled: false, rate: 8.1, mode: "included" }
};
assert.deepEqual(calculate(base), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, lineDiscount: 0, discount: 2331, totalDiscount: 2331, discounted: 2331, net: 2331, tax: 0, total: 2331, rate: 8.1 });
assert.equal(calculate({ ...base, discount: { type: "fixed", value: 9000 } }).total, 0, "La remise fixe ne peut pas rendre le total négatif");
assert.deepEqual(calculate({ ...base, discount: { type: "percent", value: 0 }, tax: { enabled: true, rate: 8.1, mode: "excluded" } }), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, lineDiscount: 0, discount: 0, totalDiscount: 0, discounted: 4662, net: 4662, tax: 377.62, total: 5039.62, rate: 8.1 });
assert.deepEqual(calculate({ ...base, discount: { type: "percent", value: 0 }, tax: { enabled: true, rate: 8.1, mode: "included" } }), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, lineDiscount: 0, discount: 0, totalDiscount: 0, discounted: 4662, net: 4312.67, tax: 349.33, total: 4662, rate: 8.1 });
assert.equal(calculate({ lines: [], discount: {}, tax: {} }).total, 0);
const pack = calculate({ lines: [{ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }], discount: {}, tax: {} });
assert.deepEqual(pack, { subtotal: 900, packDiscount: 300, studentDiscount: 0, studentRate: 0, lineDiscount: 0, discount: 0, totalDiscount: 300, discounted: 600, net: 600, tax: 0, total: 600, rate: 0 }, "Les séances offertes sont visibles dans la valeur catalogue puis entièrement déduites");
assert.equal(referenceLineTotal({ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }), 900, "La ligne Pack affiche sa valeur avant offre");
assert.deepEqual(calculate({ lines: [{ price: 61, quantity: 1, offerType: "student", basePrice: 122, studentDiscount: 50 }], discount: {}, tax: {} }), { subtotal: 122, packDiscount: 0, studentDiscount: 61, studentRate: 50, lineDiscount: 0, discount: 0, totalDiscount: 61, discounted: 61, net: 61, tax: 0, total: 61, rate: 0 }, "Le prix catalogue et l’économie étudiante sont séparés");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, offerType: "student", basePrice: 100, studentDiscount: 50 }], discount: { type: "percent", value: 20 }, tax: {} }).total, 50, "Un coupon en pourcentage ne se cumule pas avec le tarif étudiant");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, offerType: "student", basePrice: 100, studentDiscount: 50 }], discount: { type: "fixed", value: 10 }, tax: {} }).total, 40, "Un coupon en CHF s’applique après le rabais étudiant");
assert.deepEqual(
  calculate({ lines: [{ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }], discount: { type: "percent", value: 10 }, tax: {} }),
  { subtotal: 900, packDiscount: 300, studentDiscount: 0, studentRate: 0, lineDiscount: 0, discount: 60, totalDiscount: 360, discounted: 540, net: 540, tax: 0, total: 540, rate: 0 },
  "Un coupon en pourcentage s’applique au montant payant, pas aux séances offertes"
);
// Rabais personnalisé par ligne (double-clic côté caisse)
const noExtras = { discount: {}, tax: {} };
assert.equal(calculate({ lines: [{ price: 200, quantity: 1, customDiscount: { type: "percent", value: 10 } }], ...noExtras }).total, 180, "Un rabais de ligne en % réduit le montant de la ligne");
assert.equal(calculate({ lines: [{ price: 200, quantity: 2, customDiscount: { type: "fixed", value: 50 } }], ...noExtras }).total, 350, "Un rabais de ligne en CHF s’applique à l’ensemble des séances de la ligne");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, customDiscount: { type: "fixed", value: 500 } }], ...noExtras }).total, 0, "Le rabais de ligne ne peut pas rendre la ligne négative");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, customDiscount: { type: "percent", value: 250 } }], ...noExtras }).total, 0, "Un rabais en % est borné à 100 %");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, customDiscount: { type: "percent", value: -20 } }], ...noExtras }).total, 100, "Un rabais négatif est ignoré");
const stacked = calculate({ lines: [{ price: 100, quantity: 1, customDiscount: { type: "percent", value: 10 } }, { price: 100, quantity: 1 }], discount: { type: "percent", value: 10 }, tax: {} });
assert.deepEqual([stacked.lineDiscount, stacked.discount, stacked.totalDiscount, stacked.total], [10, 19, 29, 171], "Le coupon global s’applique après les rabais de ligne");
const packLine = { price: 100, quantity: 6, freeQuantity: 3, offerType: "pack", customDiscount: { type: "percent", value: 10 } };
assert.equal(customLineDiscount(packLine), 60, "Le rabais de ligne ne porte que sur les séances payées d’un pack");
assert.equal(calculate({ lines: [packLine], ...noExtras }).total, 540, "Pack : 900 − 300 offerts − 60 de rabais");
const studentLine = { price: 100, quantity: 1, offerType: "student", basePrice: 100, studentDiscount: 50 };
assert.equal(calculate({ lines: [{ ...studentLine, customDiscount: { type: "percent", value: 20 } }], ...noExtras }).total, 50, "Le rabais de ligne en % ne se cumule pas avec le tarif étudiant");
assert.equal(calculate({ lines: [{ ...studentLine, customDiscount: { type: "fixed", value: 10 } }], ...noExtras }).total, 40, "Le rabais de ligne en CHF s’applique après la remise étudiante");
assert.equal(lineDiscountBase(studentLine, 50), 50, "La base du rabais d’une ligne étudiante est le montant après remise étudiante");
assert.equal(calculate({ lines: [{ price: 33.33, quantity: 3, customDiscount: { type: "percent", value: 15 } }], ...noExtras }).lineDiscount, 15, "Les arrondis restent au centime");
assert.deepEqual(installmentMonths(999.99), [3, 4, 6], "Sous CHF 1’000, seules les options 3, 4 et 6 mois sont proposées");
assert.deepEqual(installmentMonths(1000), [3, 4, 6, 10], "Dès CHF 1’000, l’option 10 mois est ajoutée");
assert.deepEqual(installmentMonths(1999.99), [3, 4, 6, 10], "Sous CHF 2’000, l’option 12 mois reste masquée");
assert.deepEqual(installmentMonths(2000), [3, 4, 6, 10, 12], "Dès CHF 2’000, l’option 12 mois est ajoutée");
assert.equal(cleanDocumentPrefix(" fac ! ", "FAC"), "FAC", "Le préfixe documentaire doit rester sûr pour un nom de fichier");
assert.equal(relatedDocumentNumber("DEV-20260806A001", "FAC"), "FAC-20260806A001", "La facture reprend la date, le poste et la séquence du devis");
assert.equal(relatedDocumentNumber("DEV-CL-20260806P01007", "INV"), "INV-20260806P01007", "Un préfixe de devis composé ne doit pas modifier le poste");
assert.equal(relatedDocumentNumber("DEV-20260806-A-001", "FAC"), "FAC-20260806-A-001", "Les anciens numéros conservent aussi leur code poste");
// Garde-fous du rabais personnalisé : plafonnement signalé, avis puis confirmation selon l'ampleur.
const guardQuote = { lines: [{ id: "a", price: 100, quantity: 2, offerType: "single" }, { id: "b", price: 50, quantity: 1, offerType: "single" }], discount: {}, tax: {} };
const guard = (type, value, id = "a", quoteSource = guardQuote) => assessLineDiscount(quoteSource, id, { type, value });
assert.deepEqual([DISCOUNT_GUARD.notice, DISCOUNT_GUARD.confirm, DISCOUNT_GUARD.loss, DISCOUNT_GUARD.quoteConfirm], [0.1, 0.3, 0.51, 0.5], "Les seuils des garde-fous doivent rester explicites");
assert.equal(guard("percent", 5).level, "", "Un rabais usuel ne doit rien signaler");
assert.equal(guard("percent", 10).level, "", "Les remises courantes (jusqu'à 10 %) ne déclenchent aucun avis");
assert.deepEqual([guard("percent", 15).level, guard("percent", 15).reasons], ["warn", ["notice"]], "Au-delà de 10 %, un avis de marge réduite s'affiche sans bloquer");
assert.deepEqual([guard("percent", 30).level, guard("percent", 30).reasons], ["confirm", ["high"]], "À partir de 30 %, la marge est très faible : une confirmation est exigée");
assert.deepEqual([guard("percent", 50).level, guard("percent", 50).reasons], ["confirm", ["high"]], "À 50 %, la prestation n'est pas encore vendue à perte");
assert.deepEqual([guard("percent", 51).level, guard("percent", 51).reasons], ["confirm", ["loss"]], "À partir de 51 %, la vente à perte est signalée");
assert.deepEqual(guard("percent", 51, "s2", { lines: [{ id: "s2", price: 10.02, quantity: 1, offerType: "single" }], discount: {}, tax: {} }).reasons, ["loss"], "L'arrondi au centime ne masque pas le seuil de vente à perte");
assert.deepEqual(guard("fixed", 102).reasons, ["loss"], "Un rabais en CHF de 51 % de la ligne est aussi une vente à perte");
const free = guard("percent", 100);
assert.deepEqual([free.level, free.reasons.includes("free"), free.amount, free.result], ["confirm", true, 200, 0], "Une ligne offerte exige une confirmation");
const over = guard("percent", 150);
assert.deepEqual([over.applied, over.capped, over.reasons.includes("capped-percent"), over.amount], [100, true, true, 200], "Un pourcentage au-delà de 100 est plafonné et signalé");
const overAmount = guard("fixed", 500);
assert.deepEqual([overAmount.applied, overAmount.capped, overAmount.reasons.includes("capped-amount")], [200, true, true], "Un montant supérieur à la ligne est plafonné à la ligne et signalé");
assert.deepEqual([guard("percent", -5).applied, guard("percent", -5).reasons], [0, ["negative"]], "Une valeur négative est ignorée et signalée");
assert.equal(guard("percent", "").level, "", "Un champ vide retire le rabais sans alerte");
assert.equal(guard("percent", "abc").applied, 0, "Une saisie illisible n'applique rien");
assert.equal(guard("percent", 30, "a", { ...guardQuote, discount: { type: "percent", value: 40 } }).reasons.includes("quote-high"), true, "Le cumul avec le coupon est signalé lorsqu'il dépasse la moitié du devis");
assert.equal(free.reasons.includes("quote-high"), false, "Le cumul n'est pas répété quand aucun autre rabais n'existe");
const studentQuote = { lines: [{ id: "s", price: 61, quantity: 1, offerType: "student", basePrice: 122, studentDiscount: 50 }], discount: {}, tax: {} };
assert.equal(guard("percent", 5, "s", studentQuote).level, "", "La remise étudiante automatique ne compte pas comme un rabais au choix");
assert.equal(assessLineDiscount(guardQuote, "inconnue", { type: "percent", value: 5 }), null, "Une ligne inconnue n'a pas d'évaluation");

console.log("QUOTE_CORE_TESTS_OK");
