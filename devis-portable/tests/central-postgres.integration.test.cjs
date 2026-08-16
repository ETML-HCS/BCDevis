"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const { startCentralServer } = require("../../central-server/server.cjs");

const connectionString = String(process.env.BCDEVIS_TEST_DATABASE_URL || "").trim();
if (!connectionString) {
  throw new Error("BCDEVIS_TEST_DATABASE_URL doit pointer vers une base PostgreSQL de test dédiée.");
}

const connectionUrl = new URL(connectionString);
if (!/^postgres(?:ql)?:$/.test(connectionUrl.protocol)) {
  throw new Error("BCDEVIS_TEST_DATABASE_URL doit utiliser le protocole PostgreSQL.");
}
const databaseName = decodeURIComponent(connectionUrl.pathname.replace(/^\//, ""));
if (!/test/i.test(databaseName)) {
  throw new Error("La base d’intégration doit contenir « test » dans son nom afin d’éviter toute exécution sur une base de production.");
}

const schemaName = `bcdevis_it_${process.pid}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
const quoteDay = "20260805";
const adminEmail = "integration-admin@bellecour.test";
const adminPassword = "mot-de-passe-integration-fort";

const clone = (value) => JSON.parse(JSON.stringify(value));

function quote(id, number, amount, updatedAt) {
  return {
    id,
    number,
    status: "saved",
    date: "2026-08-05",
    validUntil: "2026-09-04",
    client: { name: `Client ${id}`, phone: "+41 22 000 00 00", email: `${id}@example.test`, address: "Genève" },
    lines: [{ id: `line-${id}`, name: "Soin", price: amount, quantity: 1, categoryId: 1, duration: 30, offerType: "single" }],
    discount: { code: "", type: "percent", value: 0 },
    tax: { enabled: false, rate: 8.1, mode: "included" },
    conditions: "Paiement",
    note: "",
    tracking: { status: "draft", nextFollowUpAt: "", note: "", events: [] },
    createdAt: "2026-08-05T08:00:00.000Z",
    updatedAt
  };
}

function snapshot(quotes = {}) {
  return {
    schemaVersion: 1,
    quoteCounters: {},
    settings: { companyName: "Clinique Bellecour", quotePrefix: "DEV", conditions: "Paiement" },
    customServices: [],
    catalogOverrides: {},
    quotes
  };
}

async function api(base, route, { token, body, method = "GET" } = {}) {
  const response = await fetch(new URL(`api/v1/${route}`, base), {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function login(base, deviceId, deviceName) {
  const response = await api(base, "auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword, deviceId, deviceName }
  });
  assert.equal(response.status, 200);
  return response.payload;
}

async function closeServer(started) {
  if (!started) return;
  started.server.removeAllListeners("close");
  await new Promise((resolve, reject) => {
    started.server.close((error) => error ? reject(error) : resolve());
  });
  await started.database.close();
}

async function main() {
  const adminPool = new Pool({ connectionString });
  let applicationPool;
  let started;
  try {
    const database = await adminPool.query("SELECT current_database() AS name");
    assert.equal(database.rows[0].name, databaseName);
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);

    applicationPool = new Pool({
      connectionString,
      options: `-c search_path=${schemaName}`,
      max: 8
    });
    started = await startCentralServer({
      port: 0,
      pool: applicationPool,
      organizationName: "Clinique Bellecour — intégration",
      adminEmail,
      adminPassword,
      allowedOrigins: ["*"]
    });

    const health = await api(started.url, "health");
    assert.equal(health.status, 200);
    assert.equal(health.payload.databaseEngine, "postgresql");

    const loginA = await login(started.url, "postgres-device-a", "Accueil");
    const loginB = await login(started.url, "postgres-device-b", "Cabinet");
    assert.notEqual(loginA.device.code, loginB.device.code);

    const reservations = await Promise.all([
      api(started.url, "quote-numbers/reserve", {
        method: "POST",
        token: loginA.token,
        body: { prefix: "DEV", quoteDay, count: 20 }
      }),
      api(started.url, "quote-numbers/reserve", {
        method: "POST",
        token: loginB.token,
        body: { prefix: "DEV", quoteDay, count: 20 }
      })
    ]);
    reservations.forEach((result) => assert.equal(result.status, 200));
    const reservedNumbers = reservations.flatMap((result) => result.payload.numbers);
    assert.equal(reservedNumbers.length, 40);
    assert.equal(new Set(reservedNumbers).size, 40, "Les réservations concurrentes ne doivent produire aucun doublon.");
    const reservedIndexes = reservedNumbers.map((number) => Number(number.slice(-6))).sort((left, right) => left - right);
    assert.deepEqual(reservedIndexes, Array.from({ length: 40 }, (_, index) => index + 1));

    const original = snapshot({
      q1: quote("q1", "DEV-20260805C000001", 100, "2026-08-05T08:00:00.000Z")
    });
    const firstSync = await api(started.url, "sync", {
      method: "POST",
      token: loginA.token,
      body: { snapshot: original }
    });
    assert.equal(firstSync.status, 200);
    assert.equal(firstSync.payload.revision, 1);

    const storedQuote = await applicationPool.query(`
      SELECT pg_typeof(payload)::text AS payload_type, payload->>'number' AS number
      FROM quotes WHERE id = 'q1'
    `);
    assert.equal(storedQuote.rows[0].payload_type, "jsonb");
    assert.equal(storedQuote.rows[0].number, "DEV-20260805C000001");

    const secondDevicePull = await api(started.url, "sync", {
      method: "POST",
      token: loginB.token,
      body: { snapshot: snapshot() }
    });
    assert.equal(secondDevicePull.status, 200);
    assert.ok(secondDevicePull.payload.snapshot.quotes.q1);

    const changedA = clone(original);
    changedA.quotes.q1.lines[0].price = 120;
    changedA.quotes.q1.updatedAt = "2026-08-05T09:00:00.000Z";
    const pushA = await api(started.url, "sync", {
      method: "POST",
      token: loginA.token,
      body: { snapshot: changedA }
    });
    assert.equal(pushA.status, 200);
    assert.equal(pushA.payload.revision, 2);

    const changedB = clone(secondDevicePull.payload.snapshot);
    changedB.quotes.q1.lines[0].price = 130;
    changedB.quotes.q1.updatedAt = "2026-08-05T09:05:00.000Z";
    const conflictB = await api(started.url, "sync", {
      method: "POST",
      token: loginB.token,
      body: { snapshot: changedB }
    });
    assert.equal(conflictB.status, 409);
    assert.deepEqual(conflictB.payload.conflicts, ["quotes.q1"]);

    const pdfContents = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF", "utf8");
    const uploaded = await api(started.url, "documents", {
      method: "POST",
      token: loginA.token,
      body: {
        filename: "devis-integration.pdf",
        title: "Devis intégration",
        quoteId: "q1",
        quoteNumber: "DEV-20260805C000001",
        clientName: "Client intégration",
        kind: "invoice",
        contentBase64: pdfContents.toString("base64")
      }
    });
    assert.equal(uploaded.status, 201);
    const storedDocument = await applicationPool.query("SELECT octet_length(content) AS size, sha256, kind FROM documents WHERE id = $1", [uploaded.payload.document.id]);
    assert.equal(Number(storedDocument.rows[0].size), pdfContents.length);
    assert.equal(storedDocument.rows[0].sha256, crypto.createHash("sha256").update(pdfContents).digest("hex"));
    assert.equal(storedDocument.rows[0].kind, "invoice");

    const audit = await api(started.url, "audit?limit=200", { token: loginA.token });
    assert.equal(audit.status, 200);
    assert.ok(audit.payload.events.some((event) => event.action === "quote_numbers.reserve"));
    assert.ok(audit.payload.events.some((event) => event.action === "document.upload"));

    const tables = await applicationPool.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name IN ('organizations', 'users', 'devices', 'sessions', 'quotes', 'documents', 'audit_log')
    `, [schemaName]);
    assert.equal(tables.rows[0].count, 7);

    console.log("CENTRAL_POSTGRES_INTEGRATION_TESTS_OK");
  } finally {
    if (started) {
      await closeServer(started);
    } else if (applicationPool) {
      await applicationPool.end().catch(() => {});
    }
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await adminPool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
