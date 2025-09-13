// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- ADD THIS TO SEND THE "READY" SIGNAL ---
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  
  // --- ADD THIS LISTENER FOR WHEN NO SESSION EXISTS ---
  onInitialTab: (callback) => ipcRenderer.on('create-initial-tab', (_event) => callback()),

  // Listeners for session restore
  onCreateTab: (callback) => ipcRenderer.on('create-tab', (_event, value) => callback(value)),
  onSwitchTab: (callback) => ipcRenderer.on('switch-tab', (_event, value) => callback(value)),
  // --- FIX: Add the new listener for when a restored tab is fully ready ---
  onTabRestored: (callback) => ipcRenderer.on('tab-restored', (_event, value) => callback(value)),
  
  // Tab/View Management
  newTab: (tabId, url) => ipcRenderer.send('new-tab', { tabId, url }),
  restoreTab: (tabId, url, history) => {
    ipcRenderer.send('restore-tab', { tabId, url, history });
  },
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  navigate: (tabId, url) => ipcRenderer.send('navigate', { tabId, url }),
  goBack: (tabId) => ipcRenderer.send('go-back', tabId),
  goForward: (tabId) => ipcRenderer.send('go-forward', tabId),
  reload: (tabId) => ipcRenderer.send('reload', tabId),
  onUpdateTitle: (callback) => ipcRenderer.on('update-tab-title', (_event, value) => callback(value)),
  onURLUpdated: (callback) => ipcRenderer.on('url-updated', (_event, value) => callback(value)),
  onFaviconUpdated: (callback) => ipcRenderer.on('update-tab-favicon', (_event, value) => callback(value)),
    
  // ... rest of the API remains the same
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeSidebar: (width) => ipcRenderer.send('sidebar-resize', width),
  onSetDraggable: (callback) => ipcRenderer.on('set-draggable', (_event, value) => callback(value)),
  showModal: (options) => ipcRenderer.send('show-modal', options),
  closeModal: (id) => ipcRenderer.send('close-modal', id),
  onModalEvent: (callback) => ipcRenderer.on('modal-event', (_event, value) => callback(value)),
  sendModalAction: (action) => ipcRenderer.send('modal-action', action),
  onSettingUpdated: (callback) => ipcRenderer.on('setting-updated', (_event, value) => callback(value)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  isDarkMode: () => ipcRenderer.invoke('is-dark-mode'),
  getTabId: () => ipcRenderer.invoke('get-my-tab-id'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  getSearchSuggestions: (query) => ipcRenderer.invoke('get-search-suggestions', query),

  // --- KEY CHANGE: Add the missing functions for tab reordering ---
  onGetTabOrder: (callback) => ipcRenderer.on('get-tab-order', (event, ...args) => callback(...args)),
  sendTabOrder: (order) => ipcRenderer.send('tab-order', order),
});