const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, message) => callback(message));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },

  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners("update-status");
    ipcRenderer.removeAllListeners("update-downloaded");
  },
});

window.addEventListener("DOMContentLoaded", () => {
  console.log("Electron app loaded successfully");
});
