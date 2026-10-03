"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { newDb } = require("pg-mem");
const { CentralDatabase } = require("../../central-server/database.cjs");
const { MIGRATIONS } = require("../../central-server/migrations.cjs");
const { startCentralServer } = require("../../central-server/server.cjs");

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

async function main() {
  const postgres = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = postgres.adapters.createPg();
  const pool = new Pool();

  const database = new CentralDatabase({ pool });
  const migrationResult = await database.migrate();
  assert.equal(migrationResult.total, 3);
  assert.deepEqual(migrationResult.applied, [1, 2, 3]);

  // Check migration idempotency
  const secondMigrate = await database.migrate();
  assert.deepEqual(secondMigrate.applied, [], "Une seconde migration ne doit rien réappliquer");

  // Check migration status
  const migrationStatus = await database.getMigrationStatus();
  assert.equal(migrationStatus.length, 3);
  assert.ok(migrationStatus.every((m) => m.applied === true));
  assert.equal(migrationStatus[0].name, "001_initial_schema");
  assert.equal(migrationStatus[1].name, "002_add_document_kind");
  assert.equal(migrationStatus[2].name, "003_add_contacts_table");

  const bootstrapped = await database.bootstrap({
    organizationName: "Clinique Bellecour",
    adminEmail: "admin@bellecour.test",
    adminPassword: "mot-de-passe-admin-robuste"
  });
  assert.equal(bootstrapped, true);

  const org = await database.getPrimaryOrganization();
  assert.ok(org);
  assert.equal(org.name, "Clinique Bellecour");

  // 1. Create a user
  const newUser = await database.createUser({
    organizationId: org.id,
    email: "docteur.martin@bellecour.test",
    password: "mot-de-passe-docteur-fort",
    role: "editor"
  });
  assert.equal(newUser.email, "docteur.martin@bellecour.test");
  assert.equal(newUser.role, "editor");
  assert.equal(newUser.active, true);

  // 2. List users
  const users = await database.listUsers(org.id);
  assert.equal(users.length, 2);
  assert.ok(users.some((u) => u.email === "admin@bellecour.test"));
  assert.ok(users.some((u) => u.email === "docteur.martin@bellecour.test"));

  // 3. Update role
  const updatedRole = await database.setUserRole({ userId: newUser.id, role: "admin" });
  assert.equal(updatedRole.role, "admin");

  // 4. Update password
  await database.setUserPassword({ userId: newUser.id, newPassword: "nouveau-mot-de-passe-tres-long" });

  // 5. Test login with new password and device registration
  const loginSession = await database.login({
    email: "docteur.martin@bellecour.test",
    password: "nouveau-mot-de-passe-tres-long",
    deviceId: "device-ipad-cabinet-01",
    deviceName: "iPad Cabinet 1"
  });
  assert.ok(loginSession);
  assert.equal(loginSession.device.code, "P01");

  // 6. List devices
  const devices = await database.listDevices(org.id);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].code, "P01");
  assert.equal(devices[0].user_email, "docteur.martin@bellecour.test");

  // 7. Revoke device
  const revokeResult = await database.revokeDevice({ deviceId: "device-ipad-cabinet-01" });
  assert.equal(revokeResult.revokedSessionsCount, 1);

  // Check authenticate fails now that session was revoked
  const authAfterRevoke = await database.authenticate(loginSession.token);
  assert.equal(authAfterRevoke, null, "La session doit être invalidée après révocation de l'appareil");

  // 8. Test session cleanup
  // Add an expired session directly in DB
  const pastDate = new Date(Date.now() - 10000).toISOString();
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, device_id, expires_at, created_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)",
    ["dummy-expired-hash", newUser.id, "device-ipad-cabinet-01", pastDate, pastDate, pastDate]
  );
  const cleanedCount = await database.cleanupExpiredSessions();
  assert.equal(cleanedCount, 1, "La session expirée doit être purgée");

  // 9. Disable user
  await database.setUserActive({ userId: newUser.id, active: false });
  const disabledUser = await database.findUserByEmail("docteur.martin@bellecour.test");
  assert.equal(disabledUser.active, false);

  // Check login fails for disabled user
  const loginDisabled = await database.login({
    email: "docteur.martin@bellecour.test",
    password: "nouveau-mot-de-passe-tres-long",
    deviceId: "device-ipad-cabinet-01",
    deviceName: "iPad Cabinet 1"
  });
  assert.equal(loginDisabled, null, "Un utilisateur inactif ne doit pas pouvoir se connecter");

  // 8.6.5 — une migration ajoutée plus tard s’exécute vraiment sur une base existante.
  const probeMigration = { version: 4, name: "004_probe", up: (client) => client.query("CREATE TABLE IF NOT EXISTS migration_probe (id TEXT PRIMARY KEY)") };
  const upgraded = new CentralDatabase({ pool, migrations: [...MIGRATIONS, probeMigration] });
  assert.deepEqual((await upgraded.migrate()).applied, [4], "Seule la nouvelle migration doit être appliquée");
  await pool.query("INSERT INTO migration_probe (id) VALUES ('ok')");
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM migration_probe")).rows[0].count, 1, "La migration doit avoir créé son schéma, pas seulement être enregistrée");
  assert.equal(await upgraded.schemaVersion(), 4);
  const failingMigration = { version: 5, name: "005_failing", up: async () => { throw new Error("échec volontaire"); } };
  const failing = new CentralDatabase({ pool, migrations: [...MIGRATIONS, probeMigration, failingMigration] });
  await assert.rejects(failing.migrate(), /échec volontaire/);
  assert.equal((await failing.getMigrationStatus()).find((migration) => migration.version === 5).applied, false, "Une migration en échec ne doit jamais être marquée appliquée");

  // 8.6.5 — une synchronisation n’écrit que les lignes modifiées.
  const syncLogin = await database.login({ email: "admin@bellecour.test", password: "mot-de-passe-admin-robuste", deviceId: "device-sync-test-01", deviceName: "Poste test" });
  const syncSession = await database.authenticate(syncLogin.token);
  const quoteFor = (index, extra = {}) => ({ id: `q${index}`, number: `DEV-20261003T${String(index).padStart(3, "0")}`, lines: [], client: { name: `Client ${index}` }, tracking: { status: "sent", events: [] }, updatedAt: "2026-10-03T08:00:00.000Z", ...extra });
  const bigSnapshot = { settings: { companyName: "Clinique Bellecour", pdfLanguage: "de" }, quoteCounters: { "20261003:T": 300 }, customServices: [], catalogOverrides: {}, contacts: {}, quotes: Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`q${index}`, quoteFor(index)])) };
  const firstCommit = await database.commitSync({ session: syncSession, snapshot: bigSnapshot, previousRevision: 0, action: "sync.merge", details: {} });
  assert.equal(firstCommit.changed, true);
  const statements = [];
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async (...args) => {
    const client = await originalConnect(...args);
    const originalQuery = client.query.bind(client);
    client.query = (sql, ...rest) => { statements.push(String(sql?.text || sql)); return originalQuery(sql, ...rest); };
    return client;
  };
  const oneChange = structuredClone(bigSnapshot);
  oneChange.quotes.q42.tracking = { status: "accepted", lossReason: "", events: [{ type: "contact", status: "sent", channel: "WhatsApp" }] };
  const secondCommit = await database.commitSync({ session: syncSession, snapshot: oneChange, previousRevision: firstCommit.revision, action: "sync.merge", details: {} });
  pool.connect = originalConnect;
  const writes = statements.filter((sql) => /^\s*(INSERT INTO|DELETE FROM) (shared_settings|quote_counters|custom_services|catalog_overrides|contacts|quotes)\b/.test(sql));
  assert.equal(secondCommit.changed, true);
  assert.deepEqual(writes.map((sql) => sql.trim().split(" (")[0].replace(/ WHERE.*$/, "")), ["DELETE FROM quotes", "INSERT INTO quotes"], "Un seul devis modifié ne doit réécrire qu’une ligne");
  const stored = await database.workspace(syncSession.organization_id);
  assert.equal(Object.keys(stored.snapshot.quotes).length, 300);
  assert.equal(stored.snapshot.quotes.q42.tracking.events[0].type, "contact", "Les relances confirmées doivent être conservées par le serveur");
  assert.equal(stored.snapshot.settings.pdfLanguage, "de", "La langue du PDF doit être partagée");
  // Deux devis qui échangent leurs numéros ne doivent pas heurter la contrainte d’unicité.
  const swapped = structuredClone(oneChange);
  [swapped.quotes.q1.number, swapped.quotes.q2.number] = [swapped.quotes.q2.number, swapped.quotes.q1.number];
  delete swapped.quotes.q299;
  const thirdCommit = await database.commitSync({ session: syncSession, snapshot: swapped, previousRevision: secondCommit.revision, action: "sync.merge", details: {} });
  const afterSwap = await database.workspace(syncSession.organization_id);
  assert.equal(afterSwap.revision, thirdCommit.revision);
  assert.equal(afterSwap.snapshot.quotes.q1.number, bigSnapshot.quotes.q2.number);
  assert.equal(afterSwap.snapshot.quotes.q299, undefined, "Un devis supprimé doit disparaître du serveur");
  const status = await database.status(syncSession.organization_id);
  assert.equal(status.quotes, 299);
  assert.equal(status.revision, thirdCommit.revision);
  assert.equal(status.schemaVersion, 4);
  assert.equal(status.latestSchemaVersion, 3, "La version de schéma attendue vient des migrations livrées");

  // 10. Test Server API Admin Endpoints
  const started = await startCentralServer({
    port: 0,
    pool,
    adminEmail: "admin@bellecour.test",
    adminPassword: "mot-de-passe-admin-robuste",
    allowedOrigins: ["*"]
  });

  try {
    const adminLogin = await api(started.url, "auth/login", {
      method: "POST",
      body: { email: "admin@bellecour.test", password: "mot-de-passe-admin-robuste", deviceId: "device-admin-001", deviceName: "Poste Admin" }
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.payload.token;

    // Admin routes
    const apiUsers = await api(started.url, "admin/users", { token: adminToken });
    assert.equal(apiUsers.status, 200);
    assert.ok(apiUsers.payload.users.length >= 2);

    const apiDevices = await api(started.url, "admin/devices", { token: adminToken });
    assert.equal(apiDevices.status, 200);
    assert.ok(apiDevices.payload.devices.length >= 1);

    const apiMigrations = await api(started.url, "admin/migrations", { token: adminToken });
    assert.equal(apiMigrations.status, 200);
    assert.equal(apiMigrations.payload.migrations.length, 3);

    const apiRevoke = await api(started.url, "admin/devices/revoke", {
      method: "POST",
      token: adminToken,
      body: { deviceId: "device-ipad-cabinet-01" }
    });
    assert.equal(apiRevoke.status, 200);
    assert.equal(apiRevoke.payload.ok, true);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }

  // 11. Verify audit log
  const audit = await database.audit(org.id, 50);
  const actions = audit.map((e) => e.action);
  assert.ok(actions.includes("user.create"));
  assert.ok(actions.includes("user.role"));
  assert.ok(actions.includes("user.password_reset"));
  assert.ok(actions.includes("device.revoke_sessions"));
  assert.ok(actions.includes("user.status"));

  await database.close();
  console.log("CENTRAL_ADMIN_TESTS_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
