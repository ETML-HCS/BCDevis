"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { normalizeSnapshot, same } = require("./sync-merge.cjs");
const { MIGRATIONS } = require("./migrations.cjs");

const now = () => new Date().toISOString();
const DELETE_BATCH_SIZE = 500;
const INSERT_BATCH_SIZE = 100;

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
const identifier = () => crypto.randomUUID();
const tokenHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function passwordHash(password, salt = crypto.randomBytes(16)) {
  const digest = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

function passwordMatches(password, encoded) {
  const [, saltText, expectedText] = String(encoded || "").split("$");
  if (!saltText || !expectedText) return false;
  const actual = crypto.scryptSync(String(password), Buffer.from(saltText, "base64url"), 64);
  const expected = Buffer.from(expectedText, "base64url");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function databasePool(options = {}) {
  if (options.pool) return options.pool;
  const connectionString = options.connectionString || process.env.BCDEVIS_DATABASE_URL;
  const host = options.host || process.env.BCDEVIS_PGHOST;
  if (!connectionString && !host) throw new Error("Configurez BCDEVIS_DATABASE_URL ou les variables BCDEVIS_PGHOST, BCDEVIS_PGDATABASE, BCDEVIS_PGUSER et BCDEVIS_PGPASSWORD.");
  const sslEnabled = String(options.ssl ?? process.env.BCDEVIS_DATABASE_SSL ?? "").toLowerCase() === "true";
  return new Pool({
    ...(connectionString ? { connectionString } : {
      host,
      port: Number(options.port || process.env.BCDEVIS_PGPORT || 5432),
      database: options.database || process.env.BCDEVIS_PGDATABASE || "bcdevis",
      user: options.user || process.env.BCDEVIS_PGUSER,
      password: options.password || process.env.BCDEVIS_PGPASSWORD
    }),
    max: Math.max(2, Number(options.poolSize || process.env.BCDEVIS_DATABASE_POOL_SIZE || 10)),
    ssl: sslEnabled ? { rejectUnauthorized: true } : undefined
  });
}

class CentralDatabase {
  constructor(options = {}) {
    this.pool = databasePool(options);
    this.schemaPath = options.schemaPath || path.join(__dirname, "schema.sql");
    this.migrations = Array.isArray(options.migrations) ? options.migrations : MIGRATIONS;
  }

  async ensureMigrationTable(client = this.pool) {
    let exists = false;
    try {
      await client.query("SELECT 1 FROM schema_migrations LIMIT 1");
      exists = true;
    } catch {
      exists = false;
    }
    if (!exists && fs.existsSync(this.schemaPath)) {
      await client.query(fs.readFileSync(this.schemaPath, "utf8"));
      // schema.sql décrit toujours le schéma le plus récent : sur une base neuve, les migrations
      // sont seulement enregistrées, sans être rejouées.
      this.baselineCreated = true;
    }
  }

  async getAppliedMigrations(client = this.pool) {
    await this.ensureMigrationTable(client);
    const result = await client.query("SELECT version_id, name, applied_at FROM schema_migrations");
    // Tri numérique : un tri textuel placerait la version 10 avant la version 2.
    return result.rows.map((row) => ({
      version: isNaN(Number(row.version_id)) ? row.version_id : Number(row.version_id),
      name: row.name,
      applied_at: row.applied_at
    })).sort((left, right) => Number(left.version) - Number(right.version));
  }

  // Sur une base existante, chaque migration en attente est exécutée puis enregistrée dans la même
  // transaction : un échec ne laisse jamais une version marquée « appliquée » sans que son schéma existe.
  async migrate() {
    await this.ensureMigrationTable();
    const fromBaseline = this.baselineCreated === true;
    const appliedRows = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedRows.map((r) => String(r.version)));
    const newlyApplied = [];

    for (const migration of [...this.migrations].sort((left, right) => left.version - right.version)) {
      if (!appliedVersions.has(String(migration.version))) {
        await this.withTransaction(async (client) => {
          if (!fromBaseline) await migration.up(client);
          await client.query(
            "INSERT INTO schema_migrations (version_id, name, applied_at) VALUES ($1, $2, $3) ON CONFLICT (version_id) DO NOTHING",
            [String(migration.version), migration.name, now()]
          );
        });
        newlyApplied.push(migration.version);
      }
    }
    this.baselineCreated = false;
    return { applied: newlyApplied, total: this.migrations.length };
  }

  async schemaVersion() {
    const applied = await this.getAppliedMigrations();
    return applied.reduce((latest, row) => Math.max(latest, Number(row.version) || 0), 0);
  }

  async getMigrationStatus() {
    const appliedRows = await this.getAppliedMigrations();
    const appliedMap = new Map(appliedRows.map((r) => [String(r.version), r]));
    return this.migrations.map((m) => {
      const record = appliedMap.get(String(m.version));
      return {
        version: m.version,
        name: m.name,
        applied: Boolean(record),
        applied_at: record ? new Date(record.applied_at).toISOString() : null
      };
    });
  }

  async cleanupExpiredSessions() {
    const expiredAt = now();
    const result = await this.pool.query("DELETE FROM sessions WHERE expires_at <= $1 RETURNING token_hash", [expiredAt]);
    return result.rowCount;
  }

  async withTransaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    const result = await this.pool.query("SELECT 1 AS ready");
    return result.rows[0]?.ready === 1;
  }

  async bootstrap({ organizationName, adminEmail, adminPassword }) {
    const count = Number((await this.pool.query("SELECT COUNT(*)::int AS count FROM users")).rows[0].count);
    if (count > 0) return false;
    const email = normalizeEmail(adminEmail);
    if (!email || !email.includes("@")) throw new Error("BCDEVIS_ADMIN_EMAIL doit contenir une adresse valide pour initialiser le serveur.");
    if (String(adminPassword || "").length < 12) throw new Error("BCDEVIS_ADMIN_PASSWORD doit contenir au moins 12 caractères pour initialiser le serveur.");
    const organizationId = identifier();
    const userId = identifier();
    const createdAt = now();
    return this.withTransaction(async (client) => {
      await client.query("INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)", [organizationId, String(organizationName || "Clinique Bellecour"), createdAt]);
      await client.query("INSERT INTO users (id, organization_id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, 'admin', $5)", [userId, organizationId, email, passwordHash(adminPassword), createdAt]);
      await client.query("INSERT INTO workspace_state (organization_id, revision, updated_at) VALUES ($1, 0, $2)", [organizationId, createdAt]);
      await client.query("INSERT INTO audit_log (organization_id, user_id, action, revision, details, created_at) VALUES ($1, $2, 'server.bootstrap', 0, $3::jsonb, $4)", [organizationId, userId, JSON.stringify({ email }), createdAt]);
      return true;
    });
  }

  async login({ email, password, deviceId, deviceName, sessionDays = 30 }) {
    const userResult = await this.pool.query(`
      SELECT users.*, organizations.name AS organization_name
      FROM users JOIN organizations ON organizations.id = users.organization_id
      WHERE users.email = $1 AND users.active = TRUE
    `, [normalizeEmail(email)]);
    const user = userResult.rows[0];
    if (!user || !passwordMatches(password, user.password_hash)) return null;
    return this.withTransaction(async (client) => {
      const knownDevice = (await client.query("SELECT * FROM devices WHERE id = $1 FOR UPDATE", [deviceId])).rows[0];
      if (knownDevice && knownDevice.organization_id !== user.organization_id) return null;
      const seenAt = now();
      let device = knownDevice;
      if (!device) {
        const organization = (await client.query("SELECT next_device_number FROM organizations WHERE id = $1 FOR UPDATE", [user.organization_id])).rows[0];
        const nextNumber = Number(organization.next_device_number) || 1;
        const code = `P${String(nextNumber).padStart(2, "0")}`;
        await client.query("UPDATE organizations SET next_device_number = $1 WHERE id = $2", [nextNumber + 1, user.organization_id]);
        device = (await client.query(`
          INSERT INTO devices (id, organization_id, user_id, name, code, last_seen_at)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [deviceId, user.organization_id, user.id, String(deviceName || code).slice(0, 80), code, seenAt])).rows[0];
      } else {
        device = (await client.query("UPDATE devices SET user_id = $1, name = $2, last_seen_at = $3 WHERE id = $4 RETURNING *", [user.id, String(deviceName || device.name).slice(0, 80), seenAt, deviceId])).rows[0];
      }
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + Math.max(1, Number(sessionDays) || 30) * 86400000).toISOString();
      await client.query("DELETE FROM sessions WHERE expires_at <= $1", [seenAt]);
      await client.query("INSERT INTO sessions (token_hash, user_id, device_id, expires_at, created_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)", [tokenHash(token), user.id, device.id, expiresAt, seenAt, seenAt]);
      await client.query("INSERT INTO audit_log (organization_id, user_id, device_id, action, details, created_at) VALUES ($1, $2, $3, 'auth.login', $4::jsonb, $5)", [user.organization_id, user.id, device.id, JSON.stringify({ email: user.email }), seenAt]);
      return {
        token,
        expiresAt,
        user: { id: user.id, email: user.email, role: user.role },
        organization: { id: user.organization_id, name: user.organization_name },
        device: { id: device.id, name: device.name, code: device.code }
      };
    });
  }

  async authenticate(token) {
    const result = await this.pool.query(`
            SELECT sessions.*, users.organization_id, users.email, users.role, users.active,
              organizations.name AS organization_name,
              devices.name AS device_name, devices.code AS device_code
      FROM sessions
      JOIN users ON users.id = sessions.user_id
            JOIN organizations ON organizations.id = users.organization_id
      JOIN devices ON devices.id = sessions.device_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > $2 AND users.active = TRUE
    `, [tokenHash(token), now()]);
    const session = result.rows[0];
    if (!session) return null;
    const seenAt = now();
    await Promise.all([
      this.pool.query("UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2", [seenAt, session.token_hash]),
      this.pool.query("UPDATE devices SET last_seen_at = $1 WHERE id = $2", [seenAt, session.device_id])
    ]);
    return session;
  }

  async logout(token) {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }

  async workspace(organizationId, executor = this.pool) {
    const [stateResult, settingsResult, countersResult, servicesResult, overridesResult, contactsResult, quotesResult] = await Promise.all([
      executor.query("SELECT revision, updated_at FROM workspace_state WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT key, value FROM shared_settings WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT key, value FROM quote_counters WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT id, payload FROM custom_services WHERE organization_id = $1 ORDER BY position, id", [organizationId]),
      executor.query("SELECT service_id, payload FROM catalog_overrides WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT id, payload FROM contacts WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT id, payload FROM quotes WHERE organization_id = $1", [organizationId])
    ]);
    const state = stateResult.rows[0];
    return {
      revision: Number(state?.revision) || 0,
      updatedAt: state?.updated_at ? new Date(state.updated_at).toISOString() : null,
      snapshot: normalizeSnapshot({
        settings: Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value])),
        quoteCounters: Object.fromEntries(countersResult.rows.map((row) => [row.key, Number(row.value)])),
        customServices: servicesResult.rows.map((row) => row.payload),
        catalogOverrides: Object.fromEntries(overridesResult.rows.map((row) => [row.service_id, row.payload])),
        contacts: Object.fromEntries(contactsResult.rows.map((row) => [row.id, row.payload])),
        quotes: Object.fromEntries(quotesResult.rows.map((row) => [row.id, row.payload]))
      })
    };
  }

  async device(deviceId) {
    const row = (await this.pool.query("SELECT * FROM devices WHERE id = $1", [deviceId])).rows[0];
    if (!row) return null;
    return {
      ...row,
      last_revision: row.last_revision === null ? null : Number(row.last_revision),
      last_snapshot: row.last_snapshot ? normalizeSnapshot(row.last_snapshot) : null
    };
  }

  // Écrit uniquement les lignes qui ont changé. Les lignes modifiées sont supprimées puis réinsérées :
  // deux devis qui échangent leurs numéros ne heurtent jamais la contrainte d'unicité en cours de route.
  async syncKeyedRows(client, organizationId, { table, keyColumn, columns, current, next, values }) {
    const changed = Object.keys(next).filter((key) => !Object.hasOwn(current, key) || !same(current[key], next[key]));
    const removed = Object.keys(current).filter((key) => !Object.hasOwn(next, key));
    const stale = [...removed, ...changed.filter((key) => Object.hasOwn(current, key))];
    for (const batch of chunks(stale, DELETE_BATCH_SIZE)) {
      const placeholders = batch.map((_, index) => `$${index + 2}`).join(", ");
      await client.query(`DELETE FROM ${table} WHERE organization_id = $1 AND ${keyColumn} IN (${placeholders})`, [organizationId, ...batch]);
    }
    for (const batch of chunks(changed, INSERT_BATCH_SIZE)) {
      const parameters = [organizationId];
      const tuples = batch.map((key) => {
        const placeholders = values(key, next[key]).map(([value, cast]) => {
          parameters.push(value);
          return `$${parameters.length}${cast ? `::${cast}` : ""}`;
        });
        return `($1, ${placeholders.join(", ")})`;
      });
      await client.query(`INSERT INTO ${table} (organization_id, ${columns.join(", ")}) VALUES ${tuples.join(", ")}`, parameters);
    }
    return { written: changed.length, removed: removed.length };
  }

  async writeSharedChanges(client, organizationId, current, next) {
    const counts = {};
    counts.settings = await this.syncKeyedRows(client, organizationId, {
      table: "shared_settings", keyColumn: "key", columns: ["key", "value"], current: current.settings, next: next.settings,
      values: (key, value) => [[key], [JSON.stringify(value), "jsonb"]]
    });
    counts.quoteCounters = await this.syncKeyedRows(client, organizationId, {
      table: "quote_counters", keyColumn: "key", columns: ["key", "value"], current: current.quoteCounters, next: next.quoteCounters,
      values: (key, value) => [[key], [Number(value)]]
    });
    // L'ordre des prestations personnalisées compte : la petite liste est réécrite dès qu'elle change.
    if (!same(current.customServices, next.customServices)) {
      await client.query("DELETE FROM custom_services WHERE organization_id = $1", [organizationId]);
      const positioned = Object.fromEntries(next.customServices.map((service, position) => [String(position), service]));
      await this.syncKeyedRows(client, organizationId, {
        table: "custom_services", keyColumn: "id", columns: ["id", "position", "payload"], current: {}, next: positioned,
        values: (position, service) => [[String(service.id)], [Number(position)], [JSON.stringify(service), "jsonb"]]
      });
      counts.customServices = { written: next.customServices.length, removed: current.customServices.length };
    }
    counts.catalogOverrides = await this.syncKeyedRows(client, organizationId, {
      table: "catalog_overrides", keyColumn: "service_id", columns: ["service_id", "payload"], current: current.catalogOverrides, next: next.catalogOverrides,
      values: (serviceId, payload) => [[serviceId], [JSON.stringify(payload), "jsonb"]]
    });
    counts.contacts = await this.syncKeyedRows(client, organizationId, {
      table: "contacts", keyColumn: "id", columns: ["id", "payload", "updated_at"], current: current.contacts, next: next.contacts,
      values: (contactId, payload) => [[contactId], [JSON.stringify(payload), "jsonb"], [payload.updatedAt || now()]]
    });
    counts.quotes = await this.syncKeyedRows(client, organizationId, {
      table: "quotes", keyColumn: "id", columns: ["id", "number", "payload", "updated_at"], current: current.quotes, next: next.quotes,
      values: (quoteId, payload) => [[quoteId], [String(payload.number || "")], [JSON.stringify(payload), "jsonb"], [payload.updatedAt || now()]]
    });
    return counts;
  }

  async commitSync({ session, snapshot, previousRevision, action, details }) {
    const synchronizedAt = now();
    const normalized = normalizeSnapshot(snapshot);
    return this.withTransaction(async (client) => {
      const state = (await client.query("SELECT revision FROM workspace_state WHERE organization_id = $1 FOR UPDATE", [session.organization_id])).rows[0];
      if (Number(state.revision) !== Number(previousRevision)) throw Object.assign(new Error("La base centrale a changé pendant la synchronisation."), { code: "CENTRAL_RETRY" });
      const current = await this.workspace(session.organization_id, client);
      const changed = !same(current.snapshot, normalized);
      const revision = changed ? Number(state.revision) + 1 : Number(state.revision);
      if (changed) {
        await this.writeSharedChanges(client, session.organization_id, current.snapshot, normalized);
        await client.query("UPDATE workspace_state SET revision = $1, updated_at = $2 WHERE organization_id = $3", [revision, synchronizedAt, session.organization_id]);
      }
      await client.query("UPDATE devices SET last_revision = $1, last_snapshot = $2::jsonb, last_seen_at = $3 WHERE id = $4", [revision, JSON.stringify(normalized), synchronizedAt, session.device_id]);
      await client.query("INSERT INTO audit_log (organization_id, user_id, device_id, action, revision, details, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)", [session.organization_id, session.user_id, session.device_id, action, revision, JSON.stringify(details || {}), synchronizedAt]);
      return { revision, synchronizedAt, changed };
    });
  }

  async audit(organizationId, limit = 50) {
    const result = await this.pool.query(`
      SELECT audit_log.id, audit_log.action, audit_log.revision, audit_log.details,
             audit_log.created_at, users.email, devices.name AS device_name, devices.code AS device_code
      FROM audit_log
      LEFT JOIN users ON users.id = audit_log.user_id
      LEFT JOIN devices ON devices.id = audit_log.device_id
      WHERE audit_log.organization_id = $1
      ORDER BY audit_log.id DESC LIMIT $2
    `, [organizationId, Math.min(200, Math.max(1, Number(limit) || 50))]);
    return result.rows;
  }

  async reserveQuoteNumbers({ session, prefix, quoteDay, count }) {
    const reservedAt = now();
    return this.withTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO quote_number_sequences (organization_id, prefix, quote_day, next_value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (organization_id, prefix, quote_day)
        DO UPDATE SET next_value = quote_number_sequences.next_value + EXCLUDED.next_value - 1
        RETURNING next_value
      `, [session.organization_id, prefix, quoteDay, count + 1]);
      const nextValue = Number(result.rows[0].next_value);
      const firstValue = nextValue - count;
      const lastValue = nextValue - 1;
      await client.query(`
        INSERT INTO quote_number_reservations
          (organization_id, device_id, prefix, quote_day, first_value, last_value, reserved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [session.organization_id, session.device_id, prefix, quoteDay, firstValue, lastValue, reservedAt]);
      await client.query(`
        INSERT INTO audit_log (organization_id, user_id, device_id, action, details, created_at)
        VALUES ($1, $2, $3, 'quote_numbers.reserve', $4::jsonb, $5)
      `, [session.organization_id, session.user_id, session.device_id, JSON.stringify({ prefix, quoteDay, firstValue, lastValue }), reservedAt]);
      return {
        prefix,
        quoteDay,
        numbers: Array.from({ length: count }, (_, index) => `${prefix}-${quoteDay}C${String(firstValue + index).padStart(6, "0")}`),
        reservedAt
      };
    });
  }

  async listDocuments(organizationId, limit = 250) {
    const result = await this.pool.query(`
      SELECT documents.id, documents.quote_id, documents.quote_number, documents.client_name, documents.kind, documents.title,
             documents.filename, documents.mime_type, documents.byte_size, documents.sha256,
             documents.created_at, users.email AS uploaded_by_email,
             devices.name AS uploaded_by_device, devices.code AS uploaded_by_device_code
      FROM documents
      LEFT JOIN users ON users.id = documents.uploaded_by_user_id
      LEFT JOIN devices ON devices.id = documents.uploaded_by_device_id
      WHERE documents.organization_id = $1
      ORDER BY documents.created_at DESC
      LIMIT $2
    `, [organizationId, Math.min(500, Math.max(1, Number(limit) || 250))]);
    return result.rows.map((row) => ({
      id: row.id,
      quoteId: row.quote_id || "",
      quoteNumber: row.quote_number || "",
      clientName: row.client_name || "",
      kind: row.kind === "invoice" ? "invoice" : "document",
      title: row.title,
      filename: row.filename,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sha256: row.sha256,
      createdAt: new Date(row.created_at).toISOString(),
      uploadedBy: row.uploaded_by_email || "",
      deviceName: row.uploaded_by_device || "",
      deviceCode: row.uploaded_by_device_code || ""
    }));
  }

  async createDocument({ session, quoteId, quoteNumber, clientName, kind = "document", title, filename, content }) {
    const id = identifier();
    const createdAt = now();
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    await this.pool.query(`
      INSERT INTO documents
        (id, organization_id, quote_id, quote_number, client_name, kind, title, filename, mime_type,
         byte_size, sha256, content, uploaded_by_user_id, uploaded_by_device_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'application/pdf', $9, $10, $11, $12, $13, $14)
    `, [id, session.organization_id, quoteId || null, quoteNumber || null, clientName || null, kind, title, filename, content.length, sha256, content, session.user_id, session.device_id, createdAt]);
    await this.pool.query(`
      INSERT INTO audit_log (organization_id, user_id, device_id, action, details, created_at)
      VALUES ($1, $2, $3, 'document.upload', $4::jsonb, $5)
    `, [session.organization_id, session.user_id, session.device_id, JSON.stringify({ documentId: id, kind, quoteId: quoteId || null, quoteNumber: quoteNumber || null, filename, byteSize: content.length, sha256 }), createdAt]);
    return { id, quoteId: quoteId || "", quoteNumber: quoteNumber || "", clientName: clientName || "", kind, title, filename, mimeType: "application/pdf", byteSize: content.length, sha256, createdAt };
  }

  async document(organizationId, documentId) {
    const row = (await this.pool.query(`
      SELECT id, filename, mime_type, byte_size, sha256, content
      FROM documents WHERE organization_id = $1 AND id = $2
    `, [organizationId, documentId])).rows[0];
    if (!row) return null;
    return { id: row.id, filename: row.filename, mimeType: row.mime_type, byteSize: Number(row.byte_size), sha256: row.sha256, content: Buffer.from(row.content) };
  }

  // Vue d'ensemble pour l'administration : schéma, volumes et dernière synchronisation.
  async status(organizationId) {
    const count = async (sql, parameters = [organizationId]) => Number((await this.pool.query(sql, parameters)).rows[0]?.count) || 0;
    const [schemaVersion, users, devices, quotes, contacts, documents, invoices, state] = await Promise.all([
      this.schemaVersion(),
      count("SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1 AND active = TRUE"),
      count("SELECT COUNT(*)::int AS count FROM devices WHERE organization_id = $1"),
      count("SELECT COUNT(*)::int AS count FROM quotes WHERE organization_id = $1"),
      count("SELECT COUNT(*)::int AS count FROM contacts WHERE organization_id = $1"),
      count("SELECT COUNT(*)::int AS count FROM documents WHERE organization_id = $1 AND kind = 'document'"),
      count("SELECT COUNT(*)::int AS count FROM documents WHERE organization_id = $1 AND kind = 'invoice'"),
      this.pool.query("SELECT revision, updated_at FROM workspace_state WHERE organization_id = $1", [organizationId])
    ]);
    const workspace = state.rows[0];
    return {
      schemaVersion,
      latestSchemaVersion: this.migrations.reduce((latest, migration) => Math.max(latest, migration.version), 0),
      users,
      devices,
      quotes,
      contacts,
      documents,
      invoices,
      revision: Number(workspace?.revision) || 0,
      updatedAt: workspace?.updated_at ? new Date(workspace.updated_at).toISOString() : null
    };
  }

  async getPrimaryOrganization() {
    const row = (await this.pool.query("SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1")).rows[0];
    return row || null;
  }

  async createUser({ organizationId, email, password, role = "editor" }) {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) throw new Error("Adresse e-mail invalide.");
    if (String(password || "").length < 12) throw new Error("Le mot de passe doit comporter au moins 12 caractères.");
    if (!["admin", "editor", "reader"].includes(role)) throw new Error("Rôle invalide (doit être admin, editor ou reader).");
    const id = identifier();
    const createdAt = now();
    const hash = passwordHash(password);
    return this.withTransaction(async (client) => {
      await client.query(
        "INSERT INTO users (id, organization_id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, organizationId, normalized, hash, role, createdAt]
      );
      await client.query(
        "INSERT INTO audit_log (organization_id, user_id, action, details, created_at) VALUES ($1, $2, 'user.create', $3::jsonb, $4)",
        [organizationId, id, JSON.stringify({ email: normalized, role }), createdAt]
      );
      return { id, organization_id: organizationId, email: normalized, role, active: true, created_at: createdAt };
    });
  }

  async listUsers(organizationId) {
    const result = await this.pool.query(
      "SELECT id, email, role, active, created_at FROM users WHERE organization_id = $1 ORDER BY created_at ASC",
      [organizationId]
    );
    return result.rows;
  }

  async findUserByEmail(email) {
    const result = await this.pool.query(
      "SELECT id, organization_id, email, role, active, created_at FROM users WHERE email = $1",
      [normalizeEmail(email)]
    );
    return result.rows[0] || null;
  }

  async setUserActive({ userId, active }) {
    const isActive = Boolean(active);
    return this.withTransaction(async (client) => {
      const user = (await client.query("SELECT id, organization_id, email FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
      if (!user) throw new Error("Utilisateur introuvable.");
      await client.query("UPDATE users SET active = $1 WHERE id = $2", [isActive, userId]);
      if (!isActive) {
        await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      }
      await client.query(
        "INSERT INTO audit_log (organization_id, user_id, action, details, created_at) VALUES ($1, $2, 'user.status', $3::jsonb, $4)",
        [user.organization_id, userId, JSON.stringify({ active: isActive, email: user.email }), now()]
      );
      return { ...user, active: isActive };
    });
  }

  async setUserRole({ userId, role }) {
    if (!["admin", "editor", "reader"].includes(role)) throw new Error("Rôle invalide (doit être admin, editor ou reader).");
    return this.withTransaction(async (client) => {
      const user = (await client.query("SELECT id, organization_id, email FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
      if (!user) throw new Error("Utilisateur introuvable.");
      await client.query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
      await client.query(
        "INSERT INTO audit_log (organization_id, user_id, action, details, created_at) VALUES ($1, $2, 'user.role', $3::jsonb, $4)",
        [user.organization_id, userId, JSON.stringify({ role, email: user.email }), now()]
      );
      return { ...user, role };
    });
  }

  async setUserPassword({ userId, newPassword }) {
    if (String(newPassword || "").length < 12) throw new Error("Le mot de passe doit comporter au moins 12 caractères.");
    const hash = passwordHash(newPassword);
    return this.withTransaction(async (client) => {
      const user = (await client.query("SELECT id, organization_id, email FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
      if (!user) throw new Error("Utilisateur introuvable.");
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await client.query(
        "INSERT INTO audit_log (organization_id, user_id, action, details, created_at) VALUES ($1, $2, 'user.password_reset', $3::jsonb, $4)",
        [user.organization_id, userId, JSON.stringify({ email: user.email }), now()]
      );
      return { ...user };
    });
  }

  async listDevices(organizationId) {
    const result = await this.pool.query(`
      SELECT devices.id, devices.name, devices.code, devices.last_seen_at, devices.last_revision,
             users.email AS user_email
      FROM devices
      LEFT JOIN users ON users.id = devices.user_id
      WHERE devices.organization_id = $1
      ORDER BY devices.code ASC
    `, [organizationId]);
    return result.rows;
  }

  async revokeDevice({ deviceId }) {
    return this.withTransaction(async (client) => {
      const device = (await client.query("SELECT id, organization_id, name, code FROM devices WHERE id = $1 FOR UPDATE", [deviceId])).rows[0];
      if (!device) throw new Error("Appareil introuvable.");
      const deletedSessions = (await client.query("DELETE FROM sessions WHERE device_id = $1 RETURNING token_hash", [deviceId])).rowCount;
      await client.query(
        "INSERT INTO audit_log (organization_id, device_id, action, details, created_at) VALUES ($1, $2, 'device.revoke_sessions', $3::jsonb, $4)",
        [device.organization_id, deviceId, JSON.stringify({ code: device.code, name: device.name, revokedSessionsCount: deletedSessions }), now()]
      );
      return { ...device, revokedSessionsCount: deletedSessions };
    });
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { CentralDatabase, databasePool, normalizeEmail, passwordHash, passwordMatches };
