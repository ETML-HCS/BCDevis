"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const APP_ROOT = path.join(PROJECT_ROOT, "devis-portable");
const TEMP_ROOT = path.join(PROJECT_ROOT, "tmp", "pdfs", "bcdevis-v7");
const PDF_ARCHIVE_ROOT = path.join(PROJECT_ROOT, "output", "pdf");
const VERSION_LABEL = "V7.1.5";
const DOCUMENTS = [
  {
    source: "MODE-D-EMPLOI.md",
    output: "MODE-D-EMPLOI.pdf",
    archive: "BCDevis-V7-Mode-d-emploi.pdf",
    title: "Mode d'emploi"
  },
  {
    source: "UTILISATION-RAPIDE.md",
    output: "UTILISATION-RAPIDE.pdf",
    archive: "BCDevis-V7-Utilisation-rapide.pdf",
    title: "Utilisation rapide"
  },
  {
    source: "RACCOURCIS-CLAVIER-V7.md",
    output: "RACCOURCIS-CLAVIER-V7.pdf",
    archive: "BCDevis-V7-Raccourcis-clavier.pdf",
    title: "Raccourcis clavier"
  },
  {
    source: "MODELE-DEVIS-V7.md",
    output: "MODELE-DEVIS-V7.pdf",
    archive: "BCDevis-V7-Modele-devis.pdf",
    title: "Modele de devis"
  }
];

const BASE_CSS = `
  :root {
    --ink: #20201e;
    --muted: #696a66;
    --black: #111111;
    --taupe: #a89d89;
    --taupe-soft: #eeeae3;
    --paper: #ffffff;
    --line: #d9d7d0;
  }
  @page {
    size: A4;
    margin: 17mm 16mm 20mm;
  }
  * { box-sizing: border-box; }
  html { background: #fff; }
  body {
    max-width: 920px;
    margin: 0 auto;
    padding: 30px 34px 48px;
    color: var(--ink);
    background: var(--paper);
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.52;
  }
  h1, h2, h3 { color: var(--black); page-break-after: avoid; }
  h1 {
    margin: 0 0 14px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 29pt;
    line-height: 1.08;
  }
  h2 {
    margin: 27px 0 11px;
    padding: 8px 12px;
    border-left: 5px solid var(--taupe);
    background: var(--taupe-soft);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 17pt;
    line-height: 1.2;
  }
  h3 {
    margin: 19px 0 7px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12.5pt;
  }
  p, ul, ol, table { orphans: 3; widows: 3; }
  ul, ol { padding-left: 23px; }
  li { margin: 4px 0; }
  strong { color: var(--black); }
  code, kbd {
    padding: 1px 5px;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: #4d473d;
    background: #f0eee9;
    font-family: Consolas, "Courier New", monospace;
    font-size: .9em;
  }
  table {
    width: 100%;
    margin: 13px 0 20px;
    border-collapse: collapse;
    border: 1px solid var(--line);
    page-break-inside: avoid;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th {
    color: #fff;
    background: var(--black);
    text-align: left;
  }
  th, td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #faf9f6; }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 17px auto 22px;
    border: 1px solid var(--line);
    border-radius: 10px;
    page-break-inside: avoid;
  }
  .document-cover {
    margin: -30px -34px 30px;
    padding: 47px 39px 36px;
    color: #fff;
    background: linear-gradient(135deg, #111 0%, #292722 72%, #665f52 100%);
    border-bottom: 7px solid var(--taupe);
  }
  .document-cover p { margin: 0; color: #f1efe9; }
  .document-cover .kicker {
    margin-bottom: 14px;
    color: #c9bfad;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: .16em;
  }
  .document-cover h1 { margin-bottom: 13px; color: #fff; }
  .document-cover .version {
    display: inline-block;
    margin-top: 18px;
    padding: 6px 11px;
    border: 1px solid rgba(255,255,255,.3);
    border-radius: 999px;
    font-size: 9pt;
  }
  .callout {
    margin: 14px 0;
    padding: 11px 13px;
    border-left: 4px solid var(--taupe);
    background: #f6f3ee;
  }
  .page-break { break-before: page; }
  @media print {
    body { max-width: none; padding: 0; }
    .document-cover { margin: 0 0 27px; }
  }
`;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function footerTemplate(title) {
  return `<div style="width:100%;padding:0 16mm;color:#777;font:8px Arial,sans-serif;display:flex;justify-content:space-between;align-items:center;">
    <span>BCDevis ${VERSION_LABEL} - ${escapeHTML(title)}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

async function renderDocument(marked, document) {
  const markdownPath = path.join(APP_ROOT, document.source);
  const markdown = await fs.readFile(markdownPath, "utf8");
  const body = await marked.parse(markdown, { gfm: true });
  const baseHref = pathToFileURL(`${APP_ROOT}${path.sep}`).href;
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <base href="${baseHref}">
  <title>${escapeHTML(document.title)} - BCDevis ${VERSION_LABEL}</title>
  <style>${BASE_CSS}</style>
</head>
<body>${body}</body>
</html>`;
  const htmlPath = path.join(TEMP_ROOT, document.source.replace(/\.md$/i, ".html"));
  await fs.writeFile(htmlPath, html, "utf8");

  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  try {
    await window.loadFile(htmlPath);
    await window.webContents.executeJavaScript(`
      (async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => {
          if (image.complete) return image.decode ? image.decode().catch(() => {}) : Promise.resolve();
          return new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
        }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()
    `);
    const pdf = await window.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(document.title),
      margins: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    if (pdf.length < 10000 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new Error(`PDF invalide pour ${document.source}.`);
    }
    const appOutput = path.join(APP_ROOT, document.output);
    const archiveOutput = path.join(PDF_ARCHIVE_ROOT, document.archive);
    await Promise.all([
      fs.writeFile(appOutput, pdf),
      fs.writeFile(archiveOutput, pdf)
    ]);
    return { source: document.source, output: appOutput, archive: archiveOutput, bytes: pdf.length };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

async function main() {
  const { marked } = await import("marked");
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  await fs.mkdir(PDF_ARCHIVE_ROOT, { recursive: true });
  const results = [];
  for (const document of DOCUMENTS) results.push(await renderDocument(marked, document));
  console.log("BCDEVIS_DOCS_PDF_OK");
  console.log(JSON.stringify(results, null, 2));
}

app.commandLine.appendSwitch("disable-gpu");
// Keep the Electron process alive while each document is rendered in its own
// temporary window. Without this listener Windows exits after the first close.
app.on("window-all-closed", () => {});
app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
