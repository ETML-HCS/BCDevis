"use strict";

// Parcours réel des demandes du site : import du CSV de site-crm, file « Nouvelles demandes »,
// demande traitée, devis créé depuis une demande et conservation après rechargement.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const TEST_ENV = "BCDEVIS_CONTACT_REQUESTS_TEST";

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
  assert.equal(result.status, 0, "Le parcours des nouvelles demandes a échoué");
  console.log("CONTACT_REQUESTS_TESTS_OK");
  process.exit(0);
}

const { app, BrowserWindow } = require("electron");
const profileDirectory = path.join(os.tmpdir(), `bcdevis-requests-${process.pid}-${Date.now()}`);

const SITE_EXPORT = [
  String.fromCharCode(0xFEFF) + "Nom;Téléphone;E-mail;Provenance;Demande;Date de la demande",
  "Marie Dupont;+41 79 000 00 00;marie@exemple.ch;Site internet;Rendez-vous : Épilation laser définitive (demande n° 12 sur le site);2026-10-05T08:30:00+00:00",
  "Léa Roux;;lea@exemple.ch;Site internet;Message du formulaire de contact (n° 3 sur le site);2026-10-01T08:00:00+00:00"
].join("\r\n");

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
    width: 1440,
    height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await window.loadFile(path.resolve(__dirname, "..", "index.html"), { query: { windowShell: "custom" } });
    const imported = await window.webContents.executeJavaScript(`(async () => {
      const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
      const noTransitions = document.createElement("style");
      noTransitions.textContent = "*{transition:none!important}";
      document.head.append(noTransitions);
      window.confirm = () => true;
      // L’écran des nouveautés s’ouvre juste après le premier chargement : on le referme avant de travailler.
      const releaseLayer = document.querySelector("#releaseNotesLayer");
      for (let attempt = 0; attempt < 40 && releaseLayer.hidden; attempt += 1) await wait(25);
      await wait(80);
      if (!releaseLayer.hidden) releaseLayer.querySelector("[data-initial-focus]").click();
      if (!releaseLayer.hidden) throw new Error("L’écran des nouveautés ne se ferme pas");
      document.querySelector("#settingsButton").click();
      document.querySelector("#settingsTabDocument").click();
      const settings = document.querySelector("#settingsForm");
      settings.elements.quoteTrackingEnabled.checked = true;
      settings.elements.quoteTrackingEnabled.dispatchEvent(new Event("input", { bubbles: true }));
      settings.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      if (!JSON.parse(localStorage.getItem("bcdevis-v1") || "{}").settings?.quoteTrackingEnabled) throw new Error("Le suivi commercial n’a pas été activé");

      document.querySelector("#clientButton").click();
      if (document.querySelector("#clientLayer").hidden) throw new Error("Le répertoire ne s’ouvre pas");
      const input = document.querySelector("#contactImportInput");
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(SITE_EXPORT)}], "rendez-vous-bcdevis-2026-10-05.csv", { type: "text/csv" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // L’import lit le fichier de façon asynchrone : on attend l’écriture locale.
      let stored = {};
      for (let attempt = 0; attempt < 80; attempt += 1) {
        stored = JSON.parse(localStorage.getItem("bcdevis-v1") || "{}");
        if (Object.keys(stored.contacts || {}).length >= 2) break;
        await wait(25);
      }
      document.querySelector('[data-close="clientLayer"]').click();

      const marie = Object.values(stored.contacts || {}).find((contact) => contact.name === "Marie Dupont");
      document.querySelector("#historyButton").click();
      document.querySelector('[data-history-view="tracking"]').click();
      const section = document.querySelector(".tracking-today-section--requests");
      const cards = [...document.querySelectorAll(".history-item--request")];
      return {
        contacts: Object.keys(stored.contacts || {}).length,
        source: marie?.source,
        requestedAt: marie?.requestedAt,
        sectionFirst: Boolean(section) && document.querySelector("#historyList > .tracking-today-section") === section,
        names: cards.map((card) => card.querySelector(".history-item-head strong").textContent),
        request: cards[1]?.querySelector(".history-item-client").textContent,
        badge: document.querySelector("#trackingDueCount").textContent,
        description: document.querySelector("#historyWorkspaceDescription").textContent
      };
    })()`);
    assert.deepEqual(imported, {
      contacts: 2,
      source: "Site internet",
      requestedAt: "2026-10-05T08:30:00.000Z",
      sectionFirst: true,
      names: ["Léa Roux", "Marie Dupont"],
      request: "Rendez-vous : Épilation laser définitive (demande n° 12 sur le site)",
      badge: "2",
      description: "2 demandes à traiter aujourd’hui."
    });

    const handled = await window.webContents.executeJavaScript(`(() => {
      const lea = [...document.querySelectorAll(".history-item--request")].find((card) => card.textContent.includes("Léa Roux"));
      lea.querySelector("[data-request-handled]").click();
      const stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      const contact = Object.values(stored.contacts).find((item) => item.name === "Léa Roux");
      return {
        remaining: [...document.querySelectorAll(".history-item--request")].map((card) => card.querySelector(".history-item-head strong").textContent),
        handledAt: Boolean(contact.requestHandledAt),
        undoOffered: /Demande de Léa Roux traitée/.test(document.querySelector("#toastRegion").textContent)
      };
    })()`);
    assert.deepEqual(handled, { remaining: ["Marie Dupont"], handledAt: true, undoOffered: true });

    const quoteFromRequest = await window.webContents.executeJavaScript(`(() => {
      document.querySelector(".history-item--request [data-request-quote]").click();
      const stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      const marie = Object.values(stored.contacts).find((item) => item.name === "Marie Dupont");
      const historyClosed = document.querySelector("#historyLayer").hidden;
      document.querySelector("#historyButton").click();
      document.querySelector('[data-history-view="tracking"]').click();
      const requestsLeft = document.querySelectorAll(".history-item--request").length;
      document.querySelector('[data-close="historyLayer"]').click();
      document.querySelector("#clientButton").click();
      const form = document.querySelector("#clientForm");
      const sourceShown = form.elements.source.value;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const afterSave = Object.values(JSON.parse(localStorage.getItem("bcdevis-v1")).contacts).find((item) => item.name === "Marie Dupont");
      return {
        historyClosed,
        client: stored.current.client.name,
        linked: stored.current.client.contactId === marie.id,
        requestsLeft,
        sourceShown,
        requestKept: afterSave.requestedAt === marie.requestedAt && afterSave.request === marie.request
      };
    })()`);
    assert.deepEqual(quoteFromRequest, { historyClosed: true, client: "Marie Dupont", linked: true, requestsLeft: 0, sourceShown: "Site internet", requestKept: true });

    await reload(window.webContents);
    const afterReload = await window.webContents.executeJavaScript(`(() => {
      const releaseLayer = document.querySelector("#releaseNotesLayer");
      if (releaseLayer && !releaseLayer.hidden) releaseLayer.querySelector("[data-initial-focus]").click();
      document.querySelector("#historyButton").click();
      document.querySelector('[data-history-view="tracking"]').click();
      return { requests: document.querySelectorAll(".history-item--request").length, client: document.querySelector("#clientButton").textContent.includes("Marie Dupont") };
    })()`);
    assert.deepEqual(afterReload, { requests: 0, client: true });

    // Le contrôleur extrait reste opérationnel après le rechargement : recherche, création, suppression.
    const directory = await window.webContents.executeJavaScript(`(() => {
      window.confirm = () => true;
      document.querySelector('[data-close="historyLayer"]').click();
      document.querySelector("#clientButton").click();
      const search = document.querySelector("#contactSearch");
      search.value = "lea";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      const matches = [...document.querySelectorAll("#contactList [data-contact-id]")];
      matches[0].click();
      const form = document.querySelector("#clientForm");
      const selectedName = form.elements.name.value;
      document.querySelector("#newContactButton").click();
      form.elements.name.value = "Nora Test";
      form.elements.email.value = "nora@exemple.ch";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      let stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      const created = Object.values(stored.contacts).find((contact) => contact.email === "nora@exemple.ch");
      const linked = Boolean(created) && stored.current.client.contactId === created.id;
      document.querySelector("#clientButton").click();
      document.querySelector("#deleteContactButton").click();
      stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      const deleted = Boolean(created) && !stored.contacts[created.id];
      const snapshotKept = stored.current.client.name === "Nora Test" && stored.current.client.contactId === "";
      document.querySelector("#clearClientButton").click();
      stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      return { matches: matches.length, selectedName, linked, deleted, snapshotKept, cleared: stored.current.client.name === "", count: Object.keys(stored.contacts).length };
    })()`);
    assert.deepEqual(directory, { matches: 1, selectedName: "Léa Roux", linked: true, deleted: true, snapshotKept: true, cleared: true, count: 2 });
  } finally {
    window.destroy();
  }
}

run().then(() => app.exit(0)).catch((error) => {
  console.error(error);
  app.exit(1);
});
