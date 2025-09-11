// main/modalPreload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modalAPI', {
  /**
   * Sends a generic action object to the main process, which will be forwarded
   * to the renderer process.
   * @param {object} action - The action payload to send.
   */
  sendAction: (action) => ipcRenderer.send('modal-action', action),
  
  /**
   * Requests the main process to close this modal.
   */
  close: () => ipcRenderer.send('request-close-self-modal'),

  /**
   * Gets the current application settings. Returns a Promise.
   */
  getSettings: () => ipcRenderer.invoke('get-settings'),

  /**
   * Sets a specific setting.
   * @param {string} key - The setting key.
   * @param {*} value - The new value.
   */
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }),
});