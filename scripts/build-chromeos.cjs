"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const { startPwaServer } = require("./pwa-server.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "devis-portable");
const DIST_ROOT = path.join(SOURCE_ROOT, "dist", "chromeos");
const { version } = require(path.join(PROJECT_ROOT, "package.json"));
const RELEASE_NAME = `BCDevis-${version}-ChromeOS`;
const RELEASE_ROOT = path.join(DIST_ROOT, RELEASE_NAME);
const SITE_ROOT = path.join(RELEASE_ROOT, "site");
const ARCHIVE_PATH = path.join(DIST_ROOT, `BCDevis-${version}-chromeos.zip`);
const CHECKSUM_PATH = `${ARCHIVE_PATH}.sha256`;

const APP_FILES = [
  "app.js",
  "body-anatomy.js",
  "catalog.js",
  "central-sync.js",
  "index.html",
  "manifest.webmanifest",
  "quote-core.js",
  "service-worker.js",
  "styles.css"
];

function assertSafeOutput(targetPath) {
  const relative = path.relative(DIST_ROOT, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Sortie ChromeOS non sûre : ${targetPath}`);
  }
}

function archiveRelease() {
  let result;
  if (process.platform === "win32") {
    result = spawnSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Compress-Archive -LiteralPath $env:BCDEVIS_CHROMEOS_SOURCE -DestinationPath $env:BCDEVIS_CHROMEOS_ARCHIVE -CompressionLevel Optimal -Force"
      ],
      {
        cwd: DIST_ROOT,
        encoding: "utf8",
        windowsHide: true,
        env: {
          ...process.env,
          BCDEVIS_CHROMEOS_SOURCE: RELEASE_ROOT,
          BCDEVIS_CHROMEOS_ARCHIVE: ARCHIVE_PATH
        }
      }
    );
  } else {
    result = spawnSync("zip", ["-q", "-r", ARCHIVE_PATH, RELEASE_NAME], {
      cwd: DIST_ROOT,
      encoding: "utf8"
    });
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Création de l'archive ChromeOS impossible.\n${result.stderr || result.stdout || ""}`);
  }
}

async function copyApp() {
  await fsp.mkdir(SITE_ROOT, { recursive: true });
  for (const relativePath of APP_FILES) {
    const source = path.join(SOURCE_ROOT, relativePath);
    const destination = path.join(SITE_ROOT, relativePath);
    await fsp.copyFile(source, destination);
  }
  await fsp.cp(path.join(SOURCE_ROOT, "assets"), path.join(SITE_ROOT, "assets"), { recursive: true });
}

async function verifyAssembledSite() {
  const { server, url } = await startPwaServer({ port: 0, root: SITE_ROOT });
  try {
    const [page, manifest, serviceWorker, icon, bodyAnatomy] = await Promise.all([
      fetch(url),
      fetch(new URL("manifest.webmanifest", url)),
      fetch(new URL("service-worker.js", url)),
      fetch(new URL("assets/pwa-icon-512.png", url)),
      fetch(new URL("body-anatomy.js", url))
    ]);
    if (!page.ok || !manifest.ok || !serviceWorker.ok || !icon.ok || !bodyAnatomy.ok) {
      throw new Error("Le dossier ChromeOS assemblé contient une ressource inaccessible.");
    }
    if (!String(page.headers.get("content-type")).startsWith("text/html")) {
      throw new Error("La page ChromeOS assemblée n'est pas servie en HTML.");
    }
    if (!String(manifest.headers.get("content-type")).startsWith("application/manifest+json")) {
      throw new Error("Le manifeste ChromeOS assemblé a un type MIME incorrect.");
    }
    if (!String(serviceWorker.headers.get("content-type")).startsWith("text/javascript")) {
      throw new Error("Le service worker ChromeOS assemblé a un type MIME incorrect.");
    }
    if (!String(bodyAnatomy.headers.get("content-type")).startsWith("text/javascript")) {
      throw new Error("Le sélecteur anatomique ChromeOS a un type MIME incorrect.");
    }
    const parsedManifest = await manifest.json();
    if (parsedManifest.display !== "standalone" || parsedManifest.start_url !== "./") {
      throw new Error("Le manifeste ChromeOS assemblé n'est pas installable en mode autonome.");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  for (const target of [RELEASE_ROOT, ARCHIVE_PATH, CHECKSUM_PATH]) assertSafeOutput(target);
  await fsp.mkdir(DIST_ROOT, { recursive: true });
  await Promise.all([
    fsp.rm(RELEASE_ROOT, { recursive: true, force: true }),
    fsp.rm(ARCHIVE_PATH, { force: true }),
    fsp.rm(CHECKSUM_PATH, { force: true })
  ]);
  await copyApp();
  await verifyAssembledSite();

  const installation = [
    `BCDevis ${version} - livraison ChromeOS`,
    "",
    "1. Publier le contenu du dossier site sur un hébergement HTTPS.",
    "2. Ouvrir cette adresse dans Chrome sur le Chromebook.",
    "3. Choisir le menu Chrome > Caster, enregistrer et partager > Installer la page en tant qu'application.",
    "4. Lancer ensuite BCDevis depuis le lanceur ChromeOS.",
    "",
    "Les devis et réglages restent dans le stockage local du profil Chrome.",
    "La sauvegarde complète JSON est recommandée avant un changement de Chromebook ou de profil.",
    "Le PDF est créé via Imprimer > Enregistrer au format PDF.",
    "",
    "Le dossier site est statique et fonctionne seul en mode local. Pour partager les devis, configurez facultativement l'API HTTPS BCDevis Central dans Réglages > Données ; la PWA ne se connecte jamais directement à PostgreSQL.",
    ""
  ].join("\n");
  await fsp.writeFile(path.join(RELEASE_ROOT, "INSTALLATION-CHROMEOS.txt"), installation, "utf8");

  archiveRelease();
  const digest = crypto.createHash("sha256").update(fs.readFileSync(ARCHIVE_PATH)).digest("hex").toUpperCase();
  await fsp.writeFile(CHECKSUM_PATH, `${digest}  ${path.basename(ARCHIVE_PATH)}\n`, "utf8");

  console.log(`CHROMEOS_ASSEMBLED_SITE_OK ${SITE_ROOT}`);
  console.log(`CHROMEOS_DELIVERABLE_OK ${ARCHIVE_PATH}`);
  console.log(`SHA256 ${digest}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
