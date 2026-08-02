"use strict";

const showSignatures = process.argv.includes("--bcdevis-signatures=on");
const now = "2026-07-25T10:00:00.000Z";
const database = {
  version: 18,
  sequence: 1,
  quoteCounters: {},
  settings: { showSignatures },
  customServices: [],
  quotes: {},
  current: {
    id: "test-signatures",
    number: "DEV-20260725A001",
    status: "draft",
    date: "2026-07-25",
    validUntil: "2026-08-24",
    client: {
      name: "Camille Martin",
      phone: "+41 79 555 42 18",
      email: "camille@example.ch",
      address: "Quai du Mont-Blanc 12 · 1201 Genève"
    },
    lines: [
      {
        id: "test-line-1",
        serviceId: 96,
        name: "Mésothérapie capillaire",
        categoryId: 32,
        duration: 30,
        offerType: "single",
        basePrice: 280,
        studentDiscount: 50,
        price: 280,
        quantity: 2,
        freeQuantity: 0
      },
      {
        id: "test-line-2",
        serviceId: 99,
        name: "Consultation avec Docteur Mickaël Poiraud",
        categoryId: 32,
        duration: 15,
        offerType: "single",
        basePrice: 100,
        studentDiscount: 50,
        price: 100,
        quantity: 1,
        freeQuantity: 0
      }
    ],
    discount: { code: "", type: "percent", value: 0 },
    tax: { enabled: true, rate: 8.1, mode: "included" },
    conditions: "Le règlement est exigible au fur et à mesure des séances ou lors de l’achat d’un forfait.",
    note: "",
    createdAt: now,
    updatedAt: now
  }
};

window.localStorage.setItem("bcdevis-v1", JSON.stringify(database));
