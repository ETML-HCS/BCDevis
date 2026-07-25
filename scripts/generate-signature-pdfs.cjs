"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { startPwaServer } = require("./pwa-server.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PDF_OUTPUT = path.join(PROJECT_ROOT, "output", "pdf");
const CHROMEOS_OUTPUT = path.join(PROJECT_ROOT, "tmp", "chromeos");
const CHROMEOS_USER_AGENT = "Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

app.commandLine.appendSwitch("disable-gpu");

async function loadVariation(window, url, label) {
  await window.loadURL(`${url}?pdf-test=${label.toLowerCase()}`);
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker indisponible")), 10000));
      await Promise.race([navigator.serviceWorker.ready, timeout]);
      await document.fonts.load('400 16px "Red Hat Display"');
      await document.fonts.load('600 16px "Red Hat Display"');
      await document.fonts.load('800 16px "Red Hat Display"');
      window.print = () => {};
      const printButton = document.querySelector("#checkoutPrintButton, #printButton");
      if (!printButton) throw new Error("Action d’impression introuvable");
      printButton.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll("#printQuote img")].map((image) => image.decode ? image.decode().catch(() => {}) : Promise.resolve()));
      return {
        title: document.querySelector("#printQuote .print-hero h1")?.textContent,
        signatureCount: document.querySelectorAll("#printQuote .print-signature").length,
        durationMetaCount: [...document.querySelectorAll("#printQuote .print-item-meta")]
          .filter((item) => /\\b\\d+\\s*min\\b/i.test(item.textContent || "")).length,
        officialLogoLoaded: Boolean(document.querySelector("#printQuote .print-logo-official")?.naturalWidth),
        font400: document.fonts.check('400 16px "Red Hat Display"'),
        font600: document.fonts.check('600 16px "Red Hat Display"'),
        font800: document.fonts.check('800 16px "Red Hat Display"'),
        userAgent: navigator.userAgent
      };
    })()
  `);
  window.webContents.debugger.attach("1.3");
  try {
    await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { media: "print" });
    const printStyles = await window.webContents.executeJavaScript(`(() => ({
      devisWeight: getComputedStyle(document.querySelector("#printQuote .print-hero h1")).fontWeight,
      destinataireWeight: getComputedStyle(document.querySelector("#printQuote .print-client-card .print-label")).fontWeight,
      coordonneesWeight: getComputedStyle(document.querySelector("#printQuote .print-contact-label")).fontWeight
    }))()`);
    return { ...result, ...printStyles };
  } finally {
    await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { media: "screen" }).catch(() => {});
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach();
  }
}

async function main() {
  await fs.mkdir(PDF_OUTPUT, { recursive: true });
  await fs.mkdir(CHROMEOS_OUTPUT, { recursive: true });
  const { server, url } = await startPwaServer({ port: 0 });
  const variations = [["ON", true], ["OFF", false]];
  const windows = variations.map(([label, showSignatures]) => {
    const window = new BrowserWindow({
      show: false,
      width: 1365,
      height: 768,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, "pdf-test-preload.cjs"),
        additionalArguments: [`--bcdevis-signatures=${showSignatures ? "on" : "off"}`],
        partition: `bcdevis-chromeos-test-${label.toLowerCase()}-${process.pid}-${Date.now()}`
      }
    });
    window.webContents.setUserAgent(CHROMEOS_USER_AGENT);
    return window;
  });
  try {
    const evidence = {};
    for (let index = 0; index < variations.length; index += 1) {
      const [label, showSignatures] = variations[index];
      const window = windows[index];
      const result = await loadVariation(window, url, label);
      const expectedCount = showSignatures ? 1 : 0;
      if (
        result.title !== "DEVIS"
        || result.signatureCount !== expectedCount
        || result.durationMetaCount !== 0
        || !result.officialLogoLoaded
        || !result.font400
        || !result.font600
        || !result.font800
        || result.devisWeight !== "800"
        || result.destinataireWeight !== "600"
        || result.coordonneesWeight !== "600"
      ) {
        throw new Error(`Contrôle ${label} invalide : ${JSON.stringify(result)}`);
      }
      if (!/CrOS/.test(result.userAgent)) throw new Error("L’émulation Chrome OS n’est pas active.");
      const pdf = await window.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        preferCSSPageSize: true
      });
      const pdfPath = path.join(PDF_OUTPUT, `BCDevis-test-signatures-${label}.pdf`);
      await fs.writeFile(pdfPath, pdf);
      evidence[label] = { ...result, pdfPath, bytes: pdf.length };
      if (label === "ON") {
        const screenshot = await window.webContents.capturePage();
        await fs.writeFile(path.join(CHROMEOS_OUTPUT, "BCDevis-ChromeOS-1365x768.png"), screenshot.toPNG());
      }
    }
    await fs.writeFile(
      path.join(CHROMEOS_OUTPUT, "verification.json"),
      `${JSON.stringify({ url, viewport: "1365x768", evidence }, null, 2)}\n`
    );
    console.log("CHROMEOS_PWA_PDF_OK");
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    windows.forEach((window) => {
      if (!window.isDestroyed()) window.destroy();
    });
    await new Promise((resolve) => server.close(resolve));
  }
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
