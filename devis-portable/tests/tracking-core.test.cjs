"use strict";

const assert = require("node:assert/strict");
const {
  LOSS_REASONS,
  consolidateOpportunities,
  summarizeConversion,
  monthlyConversion,
  periodRange,
  exportConversionCSV,
  followUpCount,
  countAcceptedInMonth,
  countAwaitingInvoices
} = require("../tracking-core.js");

const quote = ({
  id,
  rootQuoteId = id,
  revisionNumber = 1,
  status = "sent",
  sentAt = "2026-08-10T10:00:00.000Z",
  acceptedAt = "",
  invoicedAt = "",
  refusedAt = "",
  amount = 1000,
  lossReason = "",
  contacts = 0,
  channel = ""
}) => ({
  id,
  rootQuoteId,
  revisionNumber,
  amount,
  createdAt: `2026-08-${String(9 + revisionNumber).padStart(2, "0")}T09:00:00.000Z`,
  updatedAt: invoicedAt || acceptedAt || refusedAt || sentAt,
  tracking: {
    status, sentAt, acceptedAt, invoicedAt, refusedAt, lossReason,
    events: [
      ...(channel ? [{ type: "status", status: "sent", at: sentAt, channel }] : []),
      ...Array.from({ length: contacts }, (_, index) => ({ type: "contact", status: "sent", at: `2026-08-2${index}T10:00:00.000Z`, channel: "WhatsApp" }))
    ]
  }
});

const quotes = [
  quote({ id: "accepted", status: "accepted", acceptedAt: "2026-09-02T10:00:00.000Z", amount: 1200, contacts: 2, channel: "E-mail" }),
  quote({ id: "invoiced", status: "invoiced", acceptedAt: "2026-09-03T10:00:00.000Z", invoicedAt: "2026-09-04T10:00:00.000Z", amount: 800 }),
  quote({ id: "pending", amount: 500 }),
  quote({ id: "refused", status: "refused", refusedAt: "2026-08-12T10:00:00.000Z", amount: 300, lossReason: "price" }),
  quote({ id: "v1", rootQuoteId: "chain", status: "expired", amount: 900 }),
  quote({ id: "v2", rootQuoteId: "chain", revisionNumber: 2, status: "accepted", sentAt: "2026-08-20T10:00:00.000Z", acceptedAt: "2026-09-05T10:00:00.000Z", amount: 1100 })
];

const opportunities = consolidateOpportunities(quotes, { amountOf: (item) => item.amount });
assert.equal(opportunities.length, 5, "Les versions d’un même devis forment une seule opportunité");
assert.equal(opportunities.find((item) => item.id === "chain").sentAt, "2026-08-10T10:00:00.000Z", "La cohorte utilise le premier envoi de la chaîne");
assert.equal(opportunities.find((item) => item.id === "chain").acceptedAmount, 1100, "La valeur acceptée vient de la version convertie");

assert.deepEqual(
  summarizeConversion(quotes, { startDate: "2026-08-01", endDate: "2026-08-31", amountOf: (item) => item.amount }),
  {
    sent: 5,
    converted: 3,
    refused: 1,
    expired: 0,
    pending: 1,
    conversionRate: 0.6,
    sentValue: 3900,
    acceptedValue: 3100,
    pendingValue: 500,
    medianAcceptanceDays: 24,
    acceptedAfterFollowUp: 1,
    expiredWithoutFollowUp: 0,
    lossReasons: [{ key: "price", label: "Prix", count: 1 }]
  },
  "Le résumé conserve les factures comme conversions et ne compte pas deux fois une V2"
);

assert.equal(countAcceptedInMonth(quotes, "2026-09"), 3, "Une facture envoyée reste une acceptation dans le mois de décision");
assert.equal(countAwaitingInvoices(quotes), 2, "Seuls les devis actuellement acceptés attendent une facture");
assert.deepEqual(
  summarizeConversion([quote({ id: "future", sentAt: "2026-09-01T10:00:00.000Z", acceptedAt: "2026-09-02T10:00:00.000Z", status: "accepted" })], { startDate: "2026-08-01", endDate: "2026-08-31" }),
  { sent: 0, converted: 0, refused: 0, expired: 0, pending: 0, conversionRate: null, sentValue: 0, acceptedValue: 0, pendingValue: 0, medianAcceptanceDays: null, acceptedAfterFollowUp: 0, expiredWithoutFollowUp: 0, lossReasons: [] },
  "La cohorte est définie par la date d’envoi"
);

assert.equal(followUpCount(quotes[0]), 2, "Seules les relances confirmées sont comptées");
assert.equal(opportunities.find((item) => item.id === "accepted").channel, "E-mail", "Le canal d’envoi est repris de la chronologie");
assert.equal(opportunities.find((item) => item.id === "pending").pendingAmount, 500, "La valeur en attente vient de la dernière version");
assert.equal(opportunities.find((item) => item.id === "chain").lossReason, "", "Une chaîne convertie n’a pas de motif de perte");
assert.ok(LOSS_REASONS.some((reason) => reason.key === "no-answer"), "Les motifs de perte structurés doivent être disponibles");

const expiredSilently = [
  quote({ id: "silent", status: "expired" }),
  quote({ id: "followed", status: "expired", contacts: 1, lossReason: "no-answer" }),
  quote({ id: "bogus", status: "refused", lossReason: "inconnu" })
];
const losses = summarizeConversion(expiredSilently, { amountOf: (item) => item.amount });
assert.equal(losses.expiredWithoutFollowUp, 1, "Une expiration sans relance confirmée doit être repérée");
assert.deepEqual(losses.lossReasons, [
  { key: "no-answer", label: "Ne répond plus", count: 1 },
  { key: "unspecified", label: "Non renseigné", count: 2 }
].sort((left, right) => right.count - left.count), "Un motif inconnu est classé comme non renseigné");

assert.deepEqual(periodRange("month", "2026-10-02"), { startDate: "2026-10-01", endDate: "2026-10-02" });
assert.deepEqual(periodRange("previous-month", "2026-03-15"), { startDate: "2026-02-01", endDate: "2026-02-28" }, "Le mois précédent est un mois calendaire complet");
assert.deepEqual(periodRange("previous-month", "2026-01-10"), { startDate: "2025-12-01", endDate: "2025-12-31" }, "Le mois précédent traverse le changement d’année");
assert.deepEqual(periodRange("quarter", "2026-02-10"), { startDate: "2025-12-01", endDate: "2026-02-10" });
assert.deepEqual(periodRange("year", "2026-10-02"), { startDate: "2025-11-01", endDate: "2026-10-02" });
assert.deepEqual(periodRange("all", "2026-10-02"), { startDate: "", endDate: "2026-10-02" });

const trend = monthlyConversion(quotes, { endDate: "2026-09-30", months: 3, amountOf: (item) => item.amount });
assert.deepEqual(trend.map((item) => item.month), ["2026-07", "2026-08", "2026-09"], "La tendance couvre les mois demandés, du plus ancien au plus récent");
assert.equal(trend[1].sent, 5, "Les envois d’août forment la cohorte d’août");
assert.equal(trend[1].converted, 3);
assert.equal(trend[2].sent, 0, "Une acceptation en septembre reste dans la cohorte d’envoi d’août");

const csv = exportConversionCSV([
  ...quotes.map((item) => ({ ...item, number: item.id, client: { name: item.id === "refused" ? "=HYPERLINK(\"x\")" : "Client ; test" } }))
], { startDate: "2026-08-01", endDate: "2026-08-31", amountOf: (item) => item.amount, statusLabel: (status) => status.toUpperCase() });
const csvLines = csv.replace(/^\uFEFF/, "").split("\r\n");
assert.ok(csv.startsWith("\uFEFF"), "L’export CSV doit s’ouvrir correctement dans Excel");
assert.equal(csvLines.length, 6, "Une ligne par opportunité envoyée dans la période");
assert.match(csvLines[0], /^Devis;Version;Client;/);
assert.ok(csvLines.some((line) => line.includes('"Client ; test"')), "Les cellules contenant le séparateur sont protégées");
assert.ok(csvLines.some((line) => line.includes(`"'=HYPERLINK(""x"")"`)), "Une formule de tableur est neutralisée");
assert.ok(csvLines.some((line) => line.startsWith("refused;V1;") && line.includes(";Prix;300.00;0.00")), "Le motif et les montants sont exportés");

console.log("TRACKING_CORE_TESTS_OK");