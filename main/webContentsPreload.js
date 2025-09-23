const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pagesAPI', {
  getHistory: () => ipcRenderer.invoke('get-history'),
  navigate: (tabId, url) => ipcRenderer.send('navigate', { tabId, url }),
  getSearchSuggestions: (query) => ipcRenderer.invoke('get-search-suggestions', query),
  isDarkMode: () => ipcRenderer.invoke('is-dark-mode'),
  // --- NEWLY EXPOSED ZNTP FUNCTIONS ---
  getZntpSites: () => ipcRenderer.invoke('get-zntp-sites'),
  addZntpSite: (site) => ipcRenderer.invoke('add-zntp-site', site),
  updateZntpSite: (data) => ipcRenderer.invoke('update-zntp-site', data),
  removeZntpSite: (fqdn) => ipcRenderer.invoke('remove-zntp-site', fqdn),
  startPm2Process: (processInfo) => ipcRenderer.invoke('start-pm2-process', processInfo),
  stopPm2Process: (name) => ipcRenderer.invoke('stop-pm2-process', name),
  getPm2ProcessStatus: (name) => ipcRenderer.invoke('get-pm2-process-status', name),
});