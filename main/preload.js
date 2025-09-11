// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tab/View Management
  newTab: (tabId) => ipcRenderer.send('new-tab', tabId),
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  navigate: (tabId, url) => ipcRenderer.send('navigate', { tabId, url }),
  goBack: (tabId) => ipcRenderer.send('go-back', tabId),
  goForward: (tabId) => ipcRenderer.send('go-forward', tabId),
  reload: (tabId) => ipcRenderer.send('reload', tabId),
  onUpdateTitle: (callback) => ipcRenderer.on('update-tab-title', (_event, value) => callback(value)),
  onURLUpdated: (callback) => ipcRenderer.on('url-updated', (_event, value) => callback(value)),
    
    // Window Controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Sidebar
    resizeSidebar: (width) => ipcRenderer.send('sidebar-resize', width),

    // Listeners
    onSetDraggable: (callback) => ipcRenderer.on('set-draggable', (_event, value) => callback(value)),
    
    // Frameless Modal API
    showModal: (options) => ipcRenderer.send('show-modal', options),
    closeModal: (id) => ipcRenderer.send('close-modal', id),
    onModalEvent: (callback) => ipcRenderer.on('modal-event', (_event, value) => callback(value)),
    sendModalAction: (action) => ipcRenderer.send('modal-action', action),

    // --- Settings API ---
    onSettingUpdated: (callback) => ipcRenderer.on('setting-updated', (_event, value) => callback(value)),
    isDarkMode: () => ipcRenderer.invoke('is-dark-mode')
});