"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { normalizeSnapshot, same } = require("./sync-merge.cjs");

const now = () => new Date().toISOString();
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
  }

  async migrate() {
    await this.pool.query(fs.readFileSync(this.schemaPath, "utf8"));
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
             devices.name AS device_name, devices.code AS device_code
      FROM sessions
      JOIN users ON users.id = sessions.user_id
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
    const [stateResult, settingsResult, countersResult, servicesResult, overridesResult, quotesResult] = await Promise.all([
      executor.query("SELECT revision, updated_at FROM workspace_state WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT key, value FROM shared_settings WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT key, value FROM quote_counters WHERE organization_id = $1", [organizationId]),
      executor.query("SELECT id, payload FROM custom_services WHERE organization_id = $1 ORDER BY position, id", [organizationId]),
      executor.query("SELECT service_id, payload FROM catalog_overrides WHERE organization_id = $1", [organizationId]),
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

  async replaceSharedRows(client, organizationId, snapshot) {
    for (const table of ["shared_settings", "quote_counters", "custom_services", "catalog_overrides", "quotes"]) {
      await client.query(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
    }
    for (const [key, value] of Object.entries(snapshot.settings)) {
      await client.query("INSERT INTO shared_settings (organization_id, key, value) VALUES ($1, $2, $3::jsonb)", [organizationId, key, JSON.stringify(value)]);
    }
    for (const [key, value] of Object.entries(snapshot.quoteCounters)) {
      await client.query("INSERT INTO quote_counters (organization_id, key, value) VALUES ($1, $2, $3)", [organizationId, key, Number(value)]);
    }
    for (const [position, service] of snapshot.customServices.entries()) {
      await client.query("INSERT INTO custom_services (organization_id, id, position, payload) VALUES ($1, $2, $3, $4::jsonb)", [organizationId, String(service.id), position, JSON.stringify(service)]);
    }
    for (const [serviceId, payload] of Object.entries(snapshot.catalogOverrides)) {
      await client.query("INSERT INTO catalog_overrides (organization_id, service_id, payload) VALUES ($1, $2, $3::jsonb)", [organizationId, serviceId, JSON.stringify(payload)]);
    }
    for (const [quoteId, payload] of Object.entries(snapshot.quotes)) {
      await client.query("INSERT INTO quotes (organization_id, id, number, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5)", [organizationId, quoteId, String(payload.number || ""), JSON.stringify(payload), payload.updatedAt || now()]);
    }
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
        await this.replaceSharedRows(client, session.organization_id, normalized);
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

  async close() {
    await this.pool.end();
  }
}

module.exports = { CentralDatabase, databasePool, normalizeEmail, passwordHash, passwordMatches };
