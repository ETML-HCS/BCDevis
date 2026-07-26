"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bcdevisDesktop", {
  savePdf: (defaultName) => ipcRenderer.invoke("bcdevis:save-pdf", String(defaultName || "devis.pdf")),
  savePdfForShare: (defaultName) => ipcRenderer.invoke("bcdevis:save-pdf-for-share", String(defaultName || "devis.pdf")),
  composeEmail: (payload) => ipcRenderer.invoke("bcdevis:compose-email", {
    to: String(payload?.to || ""),
    subject: String(payload?.subject || ""),
    body: String(payload?.body || ""),
    attachmentPath: String(payload?.attachmentPath || "")
  }),
  openExternal: (url) => ipcRenderer.invoke("bcdevis:open-external", String(url || ""))
});
