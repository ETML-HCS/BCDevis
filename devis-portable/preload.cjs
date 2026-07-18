"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bellecourDesktop", {
  savePdf: (defaultName) => ipcRenderer.invoke("bellecour:save-pdf", String(defaultName || "devis.pdf")),
  openExternal: (url) => ipcRenderer.invoke("bellecour:open-external", String(url || ""))
});
