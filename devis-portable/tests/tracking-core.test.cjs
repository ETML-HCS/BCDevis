"use strict";

const assert = require("node:assert/strict");
const {
  consolidateOpportunities,
  summarizeConversion,
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
  amount = 1000
}) => ({
  id,
  rootQuoteId,
  revisionNumber,
  amount,
  createdAt: `2026-08-${String(9 + revisionNumber).padStart(2, "0")}T09:00:00.000Z`,
  updatedAt: invoicedAt || acceptedAt || refusedAt || sentAt,
  tracking: { status, sentAt, acceptedAt, invoicedAt, refusedAt, events: [] }
});

const quotes = [
  quote({ id: "accepted", status: "accepted", acceptedAt: "2026-09-02T10:00:00.000Z", amount: 1200 }),
  quote({ id: "invoiced", status: "invoiced", acceptedAt: "2026-09-03T10:00:00.000Z", invoicedAt: "2026-09-04T10:00:00.000Z", amount: 800 }),
  quote({ id: "pending", amount: 500 }),
  quote({ id: "refused", status: "refused", refusedAt: "2026-08-12T10:00:00.000Z", amount: 300 }),
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
    medianAcceptanceDays: 24
  },
  "Le résumé conserve les factures comme conversions et ne compte pas deux fois une V2"
);

assert.equal(countAcceptedInMonth(quotes, "2026-09"), 3, "Une facture envoyée reste une acceptation dans le mois de décision");
assert.equal(countAwaitingInvoices(quotes), 2, "Seuls les devis actuellement acceptés attendent une facture");
assert.deepEqual(
  summarizeConversion([quote({ id: "future", sentAt: "2026-09-01T10:00:00.000Z", acceptedAt: "2026-09-02T10:00:00.000Z", status: "accepted" })], { startDate: "2026-08-01", endDate: "2026-08-31" }),
  { sent: 0, converted: 0, refused: 0, expired: 0, pending: 0, conversionRate: null, sentValue: 0, acceptedValue: 0, medianAcceptanceDays: null },
  "La cohorte est définie par la date d’envoi"
);

console.log("TRACKING_CORE_TESTS_OK");