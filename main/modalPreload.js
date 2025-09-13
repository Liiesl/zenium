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

  /**
   * Notifies the main process to resize this modal to fit its content.
   * @param {object} dimensions - The new dimensions for the modal.
   * @param {number} dimensions.height - The new required height for the content.
   */
  resize: (dimensions) => ipcRenderer.send('resize-modal-self', dimensions),

  /**
   * Fetches search suggestions from the main process.
   * @param {string} query - The search query.
   * @returns {Promise<string[]>} A promise that resolves to an array of suggestions.
   */
  getSearchSuggestions: (query) => ipcRenderer.invoke('get-search-suggestions', query),

  /**
   * Tells the main process to open the DevTools for the main window.
   */
  openMainDevTools: () => ipcRenderer.send('open-main-devtools'),

  /**
   * Closes all open modal dialogs and their DevTools.
   */
  resetAllModals: () => ipcRenderer.send('reset-all-modals'),

  unloadTab: (tabId) => ipcRenderer.send('unload-tab', tabId),

  // --- KEY CHANGE: Manual Update API ---
  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  startDownload: () => ipcRenderer.send('start-download'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateInfoAvailable: (callback) => ipcRenderer.on('update-info-available', (_event, value) => callback(value)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_event) => callback()),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, value) => callback(value)),
  onUpdateDownloadComplete: (callback) => ipcRenderer.on('update-download-complete', (_event) => callback()),
});