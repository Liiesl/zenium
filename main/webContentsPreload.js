const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pagesAPI', {
  getHistory: () => ipcRenderer.invoke('get-history'),
  navigate: (tabId, url) => ipcRenderer.send('navigate', { tabId, url }),
  getSearchSuggestions: (query) => ipcRenderer.invoke('get-search-suggestions', query),
  isDarkMode: () => ipcRenderer.invoke('is-dark-mode'),
});