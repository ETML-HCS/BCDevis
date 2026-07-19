"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const handlers = new Map();
const writes = [];
const originalLoad = Module._load;

const fakeApp = {
  isPackaged: false,
  setName() {},
  setPath() {},
  getPath(name) { return name === "downloads" ? "C:\\Downloads" : "C:\\Application"; },
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
      shell: {}
    };
  }
  if (request === "node:fs/promises") {
    return {
      mkdir: async () => {},
      access: async () => { const error = new Error("Missing"); error.code = "ENOENT"; throw error; },
      writeFile: async (filePath, contents) => writes.push({ filePath, contents })
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  require("../main.cjs");
} finally {
  Module._load = originalLoad;
}

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
  assert.equal(result.filePath, path.join("C:\\Downloads", "DEV-000001.pdf"));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].contents.toString(), "%PDF-test");
  const shareResult = await handlers.get("bcdevis:save-pdf-for-share")({
    sender: { printToPDF: async () => Buffer.from("%PDF-share") }
  }, "DEV-000001.pdf");
  assert.equal(shareResult.contentBase64, Buffer.from("%PDF-share").toString("base64"));
  console.log("PDF_MAIN_TESTS_OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
