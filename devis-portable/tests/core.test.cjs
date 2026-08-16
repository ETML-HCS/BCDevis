const assert = require("node:assert/strict");
const { calculate, installmentMonths, referenceLineTotal, cleanDocumentPrefix, relatedDocumentNumber } = require("../quote-core.js");

const base = {
  lines: [{ price: 122, quantity: 7 }, { price: 322, quantity: 7 }, { price: 222, quantity: 7 }],
  discount: { type: "percent", value: 50 },
  tax: { enabled: false, rate: 8.1, mode: "included" }
};
assert.deepEqual(calculate(base), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, discount: 2331, totalDiscount: 2331, discounted: 2331, net: 2331, tax: 0, total: 2331, rate: 8.1 });
assert.equal(calculate({ ...base, discount: { type: "fixed", value: 9000 } }).total, 0, "La remise fixe ne peut pas rendre le total négatif");
assert.deepEqual(calculate({ ...base, discount: { type: "percent", value: 0 }, tax: { enabled: true, rate: 8.1, mode: "excluded" } }), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, discount: 0, totalDiscount: 0, discounted: 4662, net: 4662, tax: 377.62, total: 5039.62, rate: 8.1 });
assert.deepEqual(calculate({ ...base, discount: { type: "percent", value: 0 }, tax: { enabled: true, rate: 8.1, mode: "included" } }), { subtotal: 4662, packDiscount: 0, studentDiscount: 0, studentRate: 0, discount: 0, totalDiscount: 0, discounted: 4662, net: 4312.67, tax: 349.33, total: 4662, rate: 8.1 });
assert.equal(calculate({ lines: [], discount: {}, tax: {} }).total, 0);
const pack = calculate({ lines: [{ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }], discount: {}, tax: {} });
assert.deepEqual(pack, { subtotal: 900, packDiscount: 300, studentDiscount: 0, studentRate: 0, discount: 0, totalDiscount: 300, discounted: 600, net: 600, tax: 0, total: 600, rate: 0 }, "Les séances offertes sont visibles dans la valeur catalogue puis entièrement déduites");
assert.equal(referenceLineTotal({ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }), 900, "La ligne Pack affiche sa valeur avant offre");
assert.deepEqual(calculate({ lines: [{ price: 61, quantity: 1, offerType: "student", basePrice: 122, studentDiscount: 50 }], discount: {}, tax: {} }), { subtotal: 122, packDiscount: 0, studentDiscount: 61, studentRate: 50, discount: 0, totalDiscount: 61, discounted: 61, net: 61, tax: 0, total: 61, rate: 0 }, "Le prix catalogue et l’économie étudiante sont séparés");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, offerType: "student", basePrice: 100, studentDiscount: 50 }], discount: { type: "percent", value: 20 }, tax: {} }).total, 50, "Un coupon en pourcentage ne se cumule pas avec le tarif étudiant");
assert.equal(calculate({ lines: [{ price: 100, quantity: 1, offerType: "student", basePrice: 100, studentDiscount: 50 }], discount: { type: "fixed", value: 10 }, tax: {} }).total, 40, "Un coupon en CHF s’applique après le rabais étudiant");
assert.deepEqual(
  calculate({ lines: [{ price: 100, quantity: 6, freeQuantity: 3, offerType: "pack" }], discount: { type: "percent", value: 10 }, tax: {} }),
  { subtotal: 900, packDiscount: 300, studentDiscount: 0, studentRate: 0, discount: 60, totalDiscount: 360, discounted: 540, net: 540, tax: 0, total: 540, rate: 0 },
  "Un coupon en pourcentage s’applique au montant payant, pas aux séances offertes"
);
assert.deepEqual(installmentMonths(999.99), [3, 4, 6], "Sous CHF 1’000, seules les options 3, 4 et 6 mois sont proposées");
assert.deepEqual(installmentMonths(1000), [3, 4, 6, 10], "Dès CHF 1’000, l’option 10 mois est ajoutée");
assert.deepEqual(installmentMonths(1999.99), [3, 4, 6, 10], "Sous CHF 2’000, l’option 12 mois reste masquée");
assert.deepEqual(installmentMonths(2000), [3, 4, 6, 10, 12], "Dès CHF 2’000, l’option 12 mois est ajoutée");
assert.equal(cleanDocumentPrefix(" fac ! ", "FAC"), "FAC", "Le préfixe documentaire doit rester sûr pour un nom de fichier");
assert.equal(relatedDocumentNumber("DEV-20260806A001", "FAC"), "FAC-20260806A001", "La facture reprend la date, le poste et la séquence du devis");
assert.equal(relatedDocumentNumber("DEV-CL-20260806P01007", "INV"), "INV-20260806P01007", "Un préfixe de devis composé ne doit pas modifier le poste");
assert.equal(relatedDocumentNumber("DEV-20260806-A-001", "FAC"), "FAC-20260806-A-001", "Les anciens numéros conservent aussi leur code poste");
console.log("QUOTE_CORE_TESTS_OK");
