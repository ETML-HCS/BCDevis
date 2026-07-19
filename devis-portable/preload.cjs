"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bcdevisDesktop", {
  savePdf: (defaultName) => ipcRenderer.invoke("bcdevis:save-pdf", String(defaultName || "devis.pdf")),
  savePdfForShare: (defaultName) => ipcRenderer.invoke("bcdevis:save-pdf-for-share", String(defaultName || "devis.pdf")),
  openExternal: (url) => ipcRenderer.invoke("bcdevis:open-external", String(url || ""))
});
