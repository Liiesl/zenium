// renderer/viewApi.js

/**
 * This module centralizes all calls to the electronAPI exposed in the preload script,
 * providing a clean and consistent interface for the rest of the renderer code.
 */
export const viewApi = {
  // Tab Management
  newTab: (tabId, url) => window.electronAPI.newTab(tabId, url),
  restoreTab: (tabId, url, history) => window.electronAPI.restoreTab(tabId, url, history),
  switchTab: (tabId) => window.electronAPI.switchTab(tabId),
  closeTab: (tabId) => window.electronAPI.closeTab(tabId),

  unloadTab: (tabId) => window.electronAPI.unloadTab(tabId),

  navigate: (tabId, url) => window.electronAPI.navigate(tabId, url),
  goBack: (tabId) => window.electronAPI.goBack(tabId),
  goForward: (tabId) => window.electronAPI.goForward(tabId),
  reload: (tabId) => window.electronAPI.reload(tabId),
  onUpdateTitle: (callback) => window.electronAPI.onUpdateTitle(callback),
  onURLUpdated: (callback) => window.electronAPI.onURLUpdated(callback),
  onFaviconUpdated: (callback) => window.electronAPI.onFaviconUpdated(callback),
  // --- FIX: Add the new listener ---
  onTabRestored: (callback) => window.electronAPI.onTabRestored(callback),
  onCreateUnloadedTab: (callback) => window.electronAPI.onCreateUnloadedTab(callback),
  onTabUnloaded: (callback) => window.electronAPI.onTabUnloaded(callback),
  onTabLoaded: (callback) => window.electronAPI.onTabLoaded(callback),
  // Window Controls
  minimizeWindow: () => window.electronAPI.minimizeWindow(),
  maximizeWindow: () => window.electronAPI.maximizeWindow(),
  closeWindow: () => window.electronAPI.closeWindow(),
  
  // Sidebar
  resizeSidebar: (width) => window.electronAPI.resizeSidebar(width),

  // Listeners
  onSetDraggable: (callback) => window.electronAPI.onSetDraggable(callback),

  // Frameless Modal API
  showModal: (options) => window.electronAPI.showModal(options),
  closeModal: (id) => window.electronAPI.closeModal(id),
  onModalEvent: (callback) => window.electronAPI.onModalEvent(callback),
  sendModalAction: (action) => window.electronAPI.sendModalAction(action),

  // Settings
  onSettingUpdated: (callback) => window.electronAPI.onSettingUpdated(callback),
  getSettings: () => window.electronAPI.getSettings(),
  getHistory: () => window.electronAPI.getHistory(),

  // Update Management
  checkForUpdate: () => window.electronAPI.checkForUpdate(),
  startDownload: () => window.electronAPI.startDownload(),
  quitAndInstall: () => window.electronAPI.quitAndInstall(),
  onUpdateInfoAvailable: (callback) => window.electronAPI.onUpdateInfoAvailable(callback),
  onUpdateNotAvailable: (callback) => window.electronAPI.onUpdateNotAvailable(callback),
  onUpdateDownloadProgress: (callback) => window.electronAPI.onUpdateDownloadProgress(callback),
  onUpdateDownloadComplete: (callback) => window.electronAPI.onUpdateDownloadComplete(callback),
};