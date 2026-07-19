"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const TEST_ENV = "BCDEVIS_DESKTOP_PERSISTENCE_SMOKE";

if (process.env[TEST_ENV] !== "1") {
  const electron = require("electron");
  const environment = { ...process.env, [TEST_ENV]: "1" };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], {
    cwd: path.resolve(__dirname, "..", ".."),
    env: environment,
    encoding: "utf8",
    timeout: 60000
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Le test de persistance Electron a échoué");
  console.log("DESKTOP_PERSISTENCE_SMOKE_OK");
  process.exit(0);
}

const { app, BrowserWindow } = require("electron");
const profileDirectory = path.join(os.tmpdir(), `bcdevis-smoke-${process.pid}-${Date.now()}`);

function reload(webContents) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Rechargement de l'application trop long")), 15000);
    webContents.once("did-finish-load", () => {
      clearTimeout(timeout);
      resolve();
    });
    webContents.reload();
  });
}

async function run() {
  app.setPath("userData", profileDirectory);
  app.commandLine.appendSwitch("disable-gpu");
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await window.loadFile(path.resolve(__dirname, "..", "index.html"));
    const initial = await window.webContents.executeJavaScript(`(() => {
      const service = document.querySelector("[data-family-service-id]");
      if (!service) throw new Error("Aucune prestation disponible");
      service.click();

      document.querySelector("#clientButton").click();
      const client = document.querySelector("#clientForm");
      client.elements.name.value = "Sophie Martin";
      client.elements.phone.value = "+41 79 111 22 33";
      client.elements.email.value = "sophie@example.test";
      client.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      document.querySelector("#settingsButton").click();
      document.querySelector('[data-theme="forest"]').click();
      const settings = document.querySelector("#settingsForm");
      settings.elements.companyName.value = "Clinique Bellecour Test";
      settings.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      document.querySelector("#saveButton").click();
      return {
        client: document.querySelector("#clientName").textContent,
        lines: document.querySelectorAll(".cart-line").length,
        theme: document.documentElement.dataset.theme,
        company: document.querySelector(".brand-block .eyebrow")?.textContent || ""
      };
    })()`);
    assert.deepEqual(initial, { client: "Sophie Martin", lines: 1, theme: "forest", company: "Clinique Bellecour Test" });

    await reload(window.webContents);
    const restored = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      return {
        client: document.querySelector("#clientName").textContent,
        lines: document.querySelectorAll(".cart-line").length,
        theme: document.documentElement.dataset.theme,
        company: document.querySelector(".brand-block .eyebrow")?.textContent || "",
        savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length
      };
    })()`);
    assert.deepEqual(restored, { client: "Sophie Martin", lines: 1, theme: "forest", company: "Clinique Bellecour Test", savedQuotes: 1 });

    const backupRestored = await window.webContents.executeJavaScript(`(() => {
      const today = new Date().toISOString().slice(0, 10);
      const restoredQuote = {
        id: "backup-smoke-quote",
        number: "DEV-" + today.replaceAll("-", "") + "A999",
        date: today,
        client: { name: "Sauvegarde vérifiée", phone: "+41 79 999 00 00", email: "backup@example.test", address: "Genève" },
        lines: [{ id: "backup-line", name: "Prestation restaurée", price: 120, quantity: 2, categoryId: 1, duration: 30, offerType: "single" }],
        discount: { code: "", type: "percent", value: 0 },
        tax: { enabled: true, rate: 8.1, mode: "included" }
      };
      const payload = { type: "atelier-devis-backup", version: 17, database: { settings: { companyName: "Clinique sauvegardée", theme: "night" }, quotes: { [restoredQuote.id]: restoredQuote }, current: restoredQuote, customServices: [{ id: "custom-backup", name: "Soin sauvegardé", price: 75, duration: 20, categoryId: 1 }] } };
      const input = document.querySelector("#backupImportInput");
      const file = new File([JSON.stringify(payload)], "backup.json", { type: "application/json" });
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      window.confirm = () => true;
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const verify = () => {
          if (document.querySelector("#clientName").textContent === "Sauvegarde vérifiée") return resolve({
            client: document.querySelector("#clientName").textContent,
            lines: document.querySelectorAll(".cart-line").length,
            theme: document.documentElement.dataset.theme,
            company: document.querySelector(".brand-block .eyebrow")?.textContent || ""
          });
          if (++attempts >= 30) return reject(new Error("La sauvegarde complète n’a pas été restaurée"));
          setTimeout(verify, 50);
        };
        input.dispatchEvent(new Event("change", { bubbles: true }));
        verify();
      });
    })()`);
    assert.deepEqual(backupRestored, { client: "Sauvegarde vérifiée", lines: 1, theme: "night", company: "Clinique sauvegardée" });

    await reload(window.webContents);
    const backupAfterReload = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      return { client: document.querySelector("#clientName").textContent, savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length };
    })()`);
    assert.deepEqual(backupAfterReload, { client: "Sauvegarde vérifiée", savedQuotes: 1 });
    console.log("DESKTOP_PERSISTENCE_SMOKE_OK");
  } finally {
    if (!window.isDestroyed()) window.destroy();
    await app.quit();
    await fs.rm(profileDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
});
