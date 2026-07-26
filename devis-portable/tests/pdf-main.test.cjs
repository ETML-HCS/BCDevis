"use strict";

const assert = require("node:assert/strict");
const fsSync = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
Object.defineProperty(process, "platform", { ...originalPlatformDescriptor, value: "win32" });
const testRoot = path.resolve(__dirname, ".pdf-main-fixtures");
const testDownloads = path.join(testRoot, "Downloads");
const testTemp = path.join(testRoot, "Temp");
const restorePlatform = () => Object.defineProperty(process, "platform", originalPlatformDescriptor);

const handlers = new Map();
const writes = [];
const externalTargets = [];
const openedPaths = [];
const processRuns = [];
const deletedFiles = [];
let failOutlook = false;
const originalLoad = Module._load;

const fakeApp = {
  isPackaged: false,
  setName() {},
  setPath() {},
  getPath(name) {
    if (name === "downloads") return testDownloads;
    if (name === "temp") return testTemp;
    return path.join(testRoot, "Application");
  },
  whenReady() { return { then() { return { catch() {} }; } }; },
  on() {},
  requestSingleInstanceLock() { return false; },
  quit() {}
};

Module._load = function loadWithElectronMocks(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: fakeApp,
      BrowserWindow: { fromWebContents() { return null; } },
      dialog: {},
      ipcMain: { handle(channel, handler) { handlers.set(channel, handler); } },
      shell: {
        openExternal: async (target) => externalTargets.push(target),
        openPath: async (target) => { openedPaths.push(target); return ""; }
      }
    };
  }
  if (request === "node:fs/promises") {
    return {
      mkdir: async () => {},
      access: async () => { const error = new Error("Missing"); error.code = "ENOENT"; throw error; },
      readFile: async () => Buffer.from("%PDF-email-fallback"),
      writeFile: async (filePath, contents) => writes.push({ filePath, contents }),
      unlink: async (filePath) => deletedFiles.push(filePath)
    };
  }
  if (request === "node:child_process") {
    return {
      execFile(file, args, options, callback) {
        processRuns.push({ file, args, options });
        callback(failOutlook ? new Error("Outlook indisponible") : null, "", "");
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  require("../main.cjs");
} finally {
  Module._load = originalLoad;
}
const mainSource = fsSync.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const localLauncherSource = fsSync.readFileSync(path.join(__dirname, "..", "Lancer BCDevis.cmd"), "utf8");

assert.match(
  localLauncherSource,
  /node_modules\\electron\\dist\\electron\.exe/i,
  "Le lanceur local doit ouvrir Electron pour conserver le téléchargement PDF direct"
);
assert.doesNotMatch(
  localLauncherSource,
  /msedge|chrome\.exe|--app=|file:\/\/\//i,
  "Le lanceur local ne doit pas ouvrir la version navigateur qui remplace le PDF par l'impression"
);

(async () => {
  const result = await handlers.get("bcdevis:save-pdf")({
    sender: {
      printToPDF: async (options) => {
        assert.deepEqual(options, { pageSize: "A4", printBackground: true, preferCSSPageSize: true });
        return Buffer.from("%PDF-test");
      }
    }
  }, "DEV-000001.pdf");

  assert.equal(result.saved, true);
  assert.equal(result.fileName, "DEV-000001.pdf");
  assert.equal(result.filePath, path.join(testDownloads, "DEV-000001.pdf"));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].contents.toString(), "%PDF-test");
  const shareResult = await handlers.get("bcdevis:save-pdf-for-share")({
    sender: { printToPDF: async () => Buffer.from("%PDF-share") }
  }, "DEV-000001.pdf");
  assert.equal(shareResult.contentBase64, Buffer.from("%PDF-share").toString("base64"));
  const emailResult = await handlers.get("bcdevis:compose-email")(null, {
    to: "sophie@example.test",
    subject: "Votre devis DEV-000001",
    body: "Bonjour Sophie,\n\nVoici votre devis.",
    attachmentPath: path.join(testDownloads, "DEV-000001.pdf")
  });
  assert.deepEqual(emailResult, { opened: true, attached: true, client: "outlook" });
  assert.equal(processRuns.length, 1);
  assert.match(processRuns[0].file, /powershell\.exe$/i);
  assert.ok(processRuns[0].args.includes("-EncodedCommand"));
  assert.equal(path.dirname(processRuns[0].options.env.BCDEVIS_EMAIL_PAYLOAD), testTemp);
  assert.match(path.basename(processRuns[0].options.env.BCDEVIS_EMAIL_PAYLOAD), /^bcdevis-email-.+\.json$/);
  const emailPayloadWrite = writes.find(({ filePath }) => filePath === processRuns[0].options.env.BCDEVIS_EMAIL_PAYLOAD);
  assert.deepEqual(JSON.parse(emailPayloadWrite.contents), {
    to: "sophie@example.test",
    subject: "Votre devis DEV-000001",
    body: "Bonjour Sophie,\n\nVoici votre devis.",
    attachmentPath: path.join(testDownloads, "DEV-000001.pdf")
  });
  assert.deepEqual(deletedFiles, [processRuns[0].options.env.BCDEVIS_EMAIL_PAYLOAD]);
  failOutlook = true;
  const fallbackResult = await handlers.get("bcdevis:compose-email")(null, {
    to: "sophie@example.test",
    subject: "Votre devis DEV-000002",
    body: "Bonjour Sophie,\n\nVoici votre devis de secours.",
    attachmentPath: path.join(testDownloads, "DEV-000002.pdf")
  });
  assert.equal(fallbackResult.opened, true);
  assert.equal(fallbackResult.attached, true);
  assert.equal(fallbackResult.client, "eml");
  assert.equal(fallbackResult.draftPath, path.join(testDownloads, "DEV-000002-email.eml"));
  assert.deepEqual(openedPaths, [fallbackResult.draftPath]);
  const emlWrite = writes.find(({ filePath }) => filePath === fallbackResult.draftPath);
  assert.ok(emlWrite, "Le brouillon EML de secours doit être écrit");
  assert.match(emlWrite.contents, /^X-Unsent: 1\r\n/);
  assert.match(emlWrite.contents, /Content-Type: multipart\/mixed/);
  assert.match(emlWrite.contents, /Content-Disposition: attachment; filename="DEV-000002\.pdf"/);
  assert.match(emlWrite.contents, new RegExp(Buffer.from("%PDF-email-fallback").toString("base64")));
  assert.match(emlWrite.contents, new RegExp(Buffer.from("Bonjour Sophie,\n\nVoici votre devis de secours.").toString("base64")));
  assert.deepEqual(deletedFiles, processRuns.map(({ options }) => options.env.BCDEVIS_EMAIL_PAYLOAD));
  assert.match(mainSource, /process\.platform !== "win32"\) return composeEmailWithEml\(email\)/, "macOS et Linux doivent aussi ouvrir un brouillon EML avec le PDF joint");
  assert.doesNotMatch(mainSource, /reason:\s*"unsupported-platform"/, "L’envoi e-mail de bureau ne doit pas être désactivé hors Windows");
  failOutlook = false;
  await assert.rejects(
    handlers.get("bcdevis:compose-email")(null, {
      to: "sophie@example.test",
      subject: "Test",
      body: "Test",
      attachmentPath: path.join(testRoot, "outside", "secret.pdf")
    }),
    /Pièce jointe e-mail non autorisée/
  );
  await handlers.get("bcdevis:open-external")(null, "https://wa.me/?text=Devis");
  assert.deepEqual(externalTargets, ["https://wa.me/?text=Devis"]);
  await assert.rejects(
    handlers.get("bcdevis:open-external")(null, "mailto:sophie@example.test?subject=Devis"),
    /Lien externe non autorisé/
  );
  await assert.rejects(
    handlers.get("bcdevis:open-external")(null, "file:///C:/Windows/System32"),
    /Lien externe non autorisé/
  );
  console.log("PDF_MAIN_TESTS_OK");
})().then(restorePlatform).catch((error) => {
  restorePlatform();
  console.error(error);
  process.exitCode = 1;
});
