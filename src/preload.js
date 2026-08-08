const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("dictaste", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (c) => ipcRenderer.invoke("save-config", c),
  polishAndPaste: (t) => ipcRenderer.invoke("polish-and-paste", t),
  openExternal: (u) => ipcRenderer.invoke("open-external", u),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
});
