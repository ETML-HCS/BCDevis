"use strict";

const http = require("node:http");
const { CentralDatabase } = require("./database.cjs");
const { duplicateQuoteNumbers, emptySnapshot, mergeSnapshots, normalizeSnapshot, same } = require("./sync-merge.cjs");

const SERVER_VERSION = "7.1.3";
const API_PREFIX = "/api/v1";
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DOCUMENT_CONTENT_PATTERN = /^\/api\/v1\/documents\/([A-Za-z0-9_-]{8,128})\/content$/;

function json(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders
  });
  response.end(body);
}

function binary(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/octet-stream",
    "content-length": body.length,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders
  });
  response.end(body);
}

function safePdfFilename(value) {
  const cleaned = String(value || "document.pdf").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().slice(0, 180) || "document.pdf";
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("La requête dépasse 12 Mo."), { status: 413, code: "PAYLOAD_TOO_LARGE" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("Le corps JSON est invalide."), { status: 400, code: "INVALID_JSON" }));
      }
    });
    request.on("error", reject);
  });
}

function bearerToken(request) {
  const match = String(request.headers.authorization || "").match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
  return match?.[1] || "";
}

function normalizedOrigins(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return new Set(values.map((item) => item.trim()).filter(Boolean));
}

function startCentralServer(options = {}) {
  const host = options.host || process.env.BCDEVIS_CENTRAL_HOST || "127.0.0.1";
  const port = options.port ?? Number(process.env.BCDEVIS_CENTRAL_PORT || 8787);
  const allowedOrigins = normalizedOrigins(options.allowedOrigins || process.env.BCDEVIS_ALLOWED_ORIGINS || "null,http://localhost:4173,http://127.0.0.1:4173");
  const sessionDays = options.sessionDays || Number(process.env.BCDEVIS_SESSION_DAYS || 30);
  const database = new CentralDatabase({
    pool: options.pool,
    connectionString: options.connectionString,
    ssl: options.ssl,
    schemaPath: options.schemaPath
  });
  const ready = (async () => {
    await database.migrate();
    return database.bootstrap({
    organizationName: options.organizationName || process.env.BCDEVIS_ORGANIZATION || "Clinique Bellecour",
    adminEmail: options.adminEmail || process.env.BCDEVIS_ADMIN_EMAIL,
    adminPassword: options.adminPassword || process.env.BCDEVIS_ADMIN_PASSWORD
    });
  })();
  const loginAttempts = new Map();

  const server = http.createServer(async (request, response) => {
    const requestOrigin = String(request.headers.origin || "");
    const originAllowed = !requestOrigin || allowedOrigins.has("*") || allowedOrigins.has(requestOrigin);
    const corsHeaders = requestOrigin && originAllowed
      ? { "access-control-allow-origin": requestOrigin, vary: "Origin" }
      : {};
    if (requestOrigin && !originAllowed) {
      json(response, 403, { code: "ORIGIN_FORBIDDEN", message: "Cette origine n’est pas autorisée par le serveur BCDevis." });
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...corsHeaders,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600"
      });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === `${API_PREFIX}/health`) {
        if (!await database.health()) throw new Error("PostgreSQL n’a pas confirmé sa disponibilité.");
        json(response, 200, { ok: true, service: "BCDevis Central", version: SERVER_VERSION, database: "ready", databaseEngine: "postgresql" }, corsHeaders);
        return;
      }

      if (request.method === "POST" && url.pathname === `${API_PREFIX}/auth/login`) {
        const body = await readJson(request);
        const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
        const password = String(body.password || "");
        const deviceId = String(body.deviceId || "");
        const deviceName = String(body.deviceName || "Poste BCDevis").trim().slice(0, 80);
        if (!email || password.length > 1024 || !DEVICE_ID_PATTERN.test(deviceId) || !deviceName) {
          json(response, 400, { code: "LOGIN_INPUT_INVALID", message: "Les informations de connexion ou l’identifiant de l’appareil sont invalides." }, corsHeaders);
          return;
        }
        const key = `${request.socket.remoteAddress || "unknown"}:${email}`;
        const attempts = (loginAttempts.get(key) || []).filter((timestamp) => timestamp > Date.now() - 5 * 60 * 1000);
        if (attempts.length >= 5) {
          json(response, 429, { code: "LOGIN_RATE_LIMIT", message: "Trop de tentatives. Réessayez dans quelques minutes." }, corsHeaders);
          return;
        }
        const session = await database.login({
          email,
          password,
          deviceId,
          deviceName,
          sessionDays
        });
        if (!session) {
          loginAttempts.set(key, [...attempts, Date.now()]);
          json(response, 401, { code: "LOGIN_FAILED", message: "Adresse e-mail ou mot de passe incorrect." }, corsHeaders);
          return;
        }
        loginAttempts.delete(key);
        json(response, 200, session, corsHeaders);
        return;
      }

      const token = bearerToken(request);
      const session = token ? await database.authenticate(token) : null;
      if (!session) {
        json(response, 401, { code: "AUTH_REQUIRED", message: "La session centrale est absente ou expirée." }, corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === `${API_PREFIX}/session`) {
        const workspace = await database.workspace(session.organization_id);
        json(response, 200, {
          user: { email: session.email, role: session.role },
          device: { id: session.device_id, name: session.device_name, code: session.device_code },
          revision: workspace.revision,
          updatedAt: workspace.updatedAt,
          expiresAt: session.expires_at
        }, corsHeaders);
        return;
      }

      if (request.method === "POST" && url.pathname === `${API_PREFIX}/auth/logout`) {
        await database.logout(token);
        json(response, 200, { ok: true }, corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === `${API_PREFIX}/audit`) {
        if (session.role !== "admin") {
          json(response, 403, { code: "ROLE_FORBIDDEN", message: "Le journal d’activité est réservé aux administrateurs." }, corsHeaders);
          return;
        }
        json(response, 200, { events: await database.audit(session.organization_id, url.searchParams.get("limit")) }, corsHeaders);
        return;
      }

      if (request.method === "POST" && url.pathname === `${API_PREFIX}/quote-numbers/reserve`) {
        if (session.role === "reader") {
          json(response, 403, { code: "ROLE_FORBIDDEN", message: "Ce compte dispose d’un accès en lecture seule." }, corsHeaders);
          return;
        }
        const body = await readJson(request);
        const prefix = String(body.prefix || "DEV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "DEV";
        const quoteDay = String(body.quoteDay || "").replace(/[^0-9]/g, "").slice(0, 8);
        const count = Math.min(50, Math.max(1, Math.floor(Number(body.count) || 20)));
        if (!/^\d{8}$/.test(quoteDay)) {
          json(response, 400, { code: "QUOTE_DAY_INVALID", message: "La date de réservation des numéros est invalide." }, corsHeaders);
          return;
        }
        json(response, 200, await database.reserveQuoteNumbers({ session, prefix, quoteDay, count }), corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === `${API_PREFIX}/documents`) {
        json(response, 200, { documents: await database.listDocuments(session.organization_id, url.searchParams.get("limit")) }, corsHeaders);
        return;
      }

      if (request.method === "POST" && url.pathname === `${API_PREFIX}/documents`) {
        if (session.role === "reader") {
          json(response, 403, { code: "ROLE_FORBIDDEN", message: "Ce compte dispose d’un accès en lecture seule." }, corsHeaders);
          return;
        }
        const body = await readJson(request);
        const filename = safePdfFilename(body.filename);
        const title = String(body.title || filename.replace(/\.pdf$/i, "")).trim().slice(0, 180) || "Document PDF";
        const quoteId = /^[A-Za-z0-9:_-]{1,128}$/.test(String(body.quoteId || "")) ? String(body.quoteId) : "";
        const quoteNumber = String(body.quoteNumber || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 64);
        const clientName = String(body.clientName || "").trim().slice(0, 180);
        const kind = body.kind === "invoice" ? "invoice" : "document";
        const content = Buffer.from(String(body.contentBase64 || ""), "base64");
        if (content.length < 5 || content.length > MAX_PDF_BYTES || content.subarray(0, 5).toString("ascii") !== "%PDF-") {
          json(response, 400, { code: "PDF_INVALID", message: "Le fichier doit être un PDF valide de 8 Mo maximum." }, corsHeaders);
          return;
        }
        json(response, 201, { document: await database.createDocument({ session, quoteId, quoteNumber, clientName, kind, title, filename, content }) }, corsHeaders);
        return;
      }

      const documentContentMatch = url.pathname.match(DOCUMENT_CONTENT_PATTERN);
      if (request.method === "GET" && documentContentMatch) {
        const document = await database.document(session.organization_id, documentContentMatch[1]);
        if (!document) {
          json(response, 404, { code: "DOCUMENT_NOT_FOUND", message: "Ce document PDF n’existe plus." }, corsHeaders);
          return;
        }
        binary(response, 200, document.content, {
          ...corsHeaders,
          "content-type": "application/pdf",
          "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
          "x-bcdevis-document-sha256": document.sha256
        });
        return;
      }

      if (request.method === "POST" && url.pathname === `${API_PREFIX}/sync`) {
        if (session.role === "reader") {
          json(response, 403, { code: "ROLE_FORBIDDEN", message: "Ce compte dispose d’un accès en lecture seule." }, corsHeaders);
          return;
        }
        const body = await readJson(request);
        const localSnapshot = normalizeSnapshot(body.snapshot);
        const strategy = ["local", "server"].includes(body.conflictStrategy) ? body.conflictStrategy : "conflict";
        let attempts = 0;
        while (attempts < 3) {
          attempts += 1;
          const workspace = await database.workspace(session.organization_id);
          const device = await database.device(session.device_id);
          const firstSync = !device?.last_snapshot;
          let result;
          if (workspace.revision === 0 && same(workspace.snapshot, emptySnapshot())) {
            result = { snapshot: localSnapshot, conflicts: [] };
          } else if (firstSync) {
            result = mergeSnapshots(emptySnapshot(), localSnapshot, workspace.snapshot, { strategy, initial: true });
          } else {
            result = mergeSnapshots(device.last_snapshot, localSnapshot, workspace.snapshot, { strategy });
          }
          if (result.conflicts.length && strategy === "conflict") {
            json(response, 409, {
              code: "SYNC_CONFLICT",
              message: "Certaines données ont été modifiées sur ce poste et sur le serveur.",
              conflicts: result.conflicts,
              revision: workspace.revision,
              updatedAt: workspace.updatedAt
            }, corsHeaders);
            return;
          }
          const duplicates = duplicateQuoteNumbers(result.snapshot);
          if (duplicates.length) {
            json(response, 409, {
              code: "DUPLICATE_QUOTE_NUMBER",
              message: "Des numéros de devis identiques existent sur plusieurs fiches.",
              conflicts: duplicates.map((number) => `quoteNumber.${number}`),
              revision: workspace.revision
            }, corsHeaders);
            return;
          }
          try {
            const committed = await database.commitSync({
              session,
              snapshot: result.snapshot,
              previousRevision: workspace.revision,
              action: strategy === "conflict" ? "sync.merge" : `sync.resolve.${strategy}`,
              details: { conflictsResolved: result.conflicts.length, firstSync }
            });
            json(response, 200, {
              snapshot: result.snapshot,
              revision: committed.revision,
              synchronizedAt: committed.synchronizedAt,
              changed: committed.changed,
              conflictsResolved: result.conflicts
            }, corsHeaders);
            return;
          } catch (error) {
            if (error.code !== "CENTRAL_RETRY" || attempts >= 3) throw error;
          }
        }
      }

      json(response, 404, { code: "NOT_FOUND", message: "Route BCDevis Central inconnue." }, corsHeaders);
    } catch (error) {
      console.error(error);
      json(response, error.status || 500, {
        code: error.code || "SERVER_ERROR",
        message: error.status ? error.message : "Le serveur central n’a pas pu traiter la demande."
      }, corsHeaders);
    }
  });

  server.on("close", () => void database.close());
  return new Promise((resolve, reject) => {
    ready.then((bootstrapped) => server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        database,
        bootstrapped,
        url: `http://${address.address.includes(":") ? `[${address.address}]` : address.address}:${address.port}/`
      });
    })).catch(async (error) => {
      await database.close().catch(() => {});
      reject(error);
    });
    server.once("error", reject);
  });
}

if (require.main === module) {
  startCentralServer().then(({ url, bootstrapped }) => {
    console.log(`BCDEVIS_CENTRAL_READY ${url}`);
    if (bootstrapped) console.log("BCDEVIS_CENTRAL_ADMIN_CREATED");
  }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { API_PREFIX, SERVER_VERSION, startCentralServer };
