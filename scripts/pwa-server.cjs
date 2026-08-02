"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const PWA_ROOT = path.resolve(__dirname, "..", "devis-portable");
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"]
]);

function resolveRequestPath(requestUrl, root = PWA_ROOT) {
  const resolvedRoot = path.resolve(root);
  const pathname = decodeURIComponent(new URL(requestUrl || "/", "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) return "";
  return resolvedPath;
}

async function requestHandler(request, response, root = PWA_ROOT) {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let filePath;
  try {
    filePath = resolveRequestPath(request.url, root);
  } catch (_) {
    response.writeHead(400);
    response.end("Requête invalide");
    return;
  }
  if (!filePath) {
    response.writeHead(403);
    response.end("Accès refusé");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    const finalStat = stat.isDirectory() ? await fsp.stat(filePath) : stat;
    const extension = path.extname(filePath).toLowerCase();
    const cacheControl = path.basename(filePath) === "service-worker.js"
      ? "no-cache, no-store, must-revalidate"
      : extension === ".html" || extension === ".webmanifest"
        ? "no-cache"
        : "public, max-age=3600";
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES.get(extension) || "application/octet-stream",
      "Content-Length": finalStat.size,
      "Cache-Control": cacheControl,
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(error?.code === "ENOENT" ? 404 : 500);
    response.end(error?.code === "ENOENT" ? "Introuvable" : "Erreur serveur");
  }
}

function startPwaServer({ host = "127.0.0.1", port = 4173, root = PWA_ROOT } = {}) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer((request, response) => {
    requestHandler(request, response, resolvedRoot).catch((error) => {
      response.writeHead(500);
      response.end("Erreur serveur");
      console.error(error);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      resolve({ server, url: `http://${host}:${address.port}/` });
    });
  });
}

if (require.main === module) {
  const requestedPort = Number(process.env.BCDEVIS_PWA_PORT || process.argv[2] || 4173);
  startPwaServer({ port: Number.isInteger(requestedPort) && requestedPort >= 0 ? requestedPort : 4173 })
    .then(({ server, url }) => {
      console.log(`BCDEVIS_PWA_READY ${url}`);
      const stop = () => server.close(() => process.exit(0));
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { PWA_ROOT, startPwaServer };
