// main.js
const { app, BrowserWindow, ipcMain, screen, net, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { ViewManager } = require('./viewManager.js');
const { ModalManager } = require('./modalManager.js');
const { SettingsManager } = require('./settingsManager.js');
const { SessionManager } = require('./sessionManager.js');
const { HistoryManager } = require('./historyManager.js');
const { attachKeyBlocker } = require('./keyblocker.js');
const { registerZeniumProtocol } = require('./protocol.js');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

const formatBytes = (bytes, decimals = 2) => bytes === 0 ? '0 Bytes' : (decimals = decimals < 0 ? 0 : decimals, `${parseFloat((bytes / Math.pow(1024, 2)).toFixed(decimals))} MB`);

let mainWindow;
let modalManager;
let viewManager;
let settingsManager;
let historyManager;
let sessionManager;
let pollMouseInterval = null;
let isQuitting = false;
let updateReadyToInstall = false;
let isQuittingForUpdate = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  historyManager = new HistoryManager();
  modalManager = new ModalManager(mainWindow);
  viewManager = new ViewManager(mainWindow, historyManager, modalManager);
  sessionManager = new SessionManager();
  settingsManager = new SettingsManager();
  
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.openDevTools({ mode: 'undocked' });

  mainWindow.on('resize', () => viewManager.updateActiveViewBounds());

  // --- KEY CHANGE: The shutdown logic is simplified to auto-install on quit ---
  mainWindow.on('close', async (event) => {
    // If we're already in the process of quitting, do nothing to prevent loops.
    if (isQuittingForUpdate || isQuitting) {
      return;
    }
    
    // Prevent the window from closing immediately.
    event.preventDefault();

    // If an update has been downloaded and deferred, install it now.
    if (updateReadyToInstall) {
      console.log('[main.js] An update is ready. Proceeding with quit and install.');
      // Set the flag to prevent other quit logic from running.
      isQuittingForUpdate = true;
      // The updater will handle shutting down the app. No need to save the session.
      autoUpdater.quitAndInstall();
      return; // Stop here.
    }
    
    // --- Standard shutdown procedure if no update is pending ---
    isQuitting = true;

    try {
      console.log('[main.js] Starting session save from "close" event.');
      await sessionManager.saveSession(viewManager, mainWindow);
      console.log('[main.js] Session save complete.');
    } catch (err) {
      console.error('[main.js] An error occurred during session saving:', err);
    } finally {
      console.log('[main.js] Proceeding with application quit.');
      app.quit();
    }
  });
  
  const startPolling = () => {
    if (pollMouseInterval) return;  

    let isMouseInTitlebar = false;
    pollMouseInterval = setInterval(() => {
      if (!mainWindow) return;

      const point = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      
      const expandedTitleBarHeight = 40; 
      const triggerAreaHeight = 10; 

      const isInExpandedArea = point.x >= bounds.x &&
                               point.x <= (bounds.x + bounds.width) &&
                               point.y >= bounds.y &&
                               point.y <= (bounds.y + expandedTitleBarHeight);

      const isInTriggerArea = point.x >= bounds.x &&
                              point.x <= (bounds.x + bounds.width) &&
                              point.y >= bounds.y &&
                              point.y <= (bounds.y + triggerAreaHeight);

      if (isInTriggerArea && !isMouseInTitlebar) {
          isMouseInTitlebar = true;
          mainWindow.webContents.send('set-draggable', true);
          const { height } = mainWindow.getContentBounds();
          viewManager.animateViewBounds(40, height - 50);
      } else if (!isInExpandedArea && isMouseInTitlebar) {
          isMouseInTitlebar = false;
          mainWindow.webContents.send('set-draggable', false);
          const { height } = mainWindow.getContentBounds();
          viewManager.animateViewBounds(10, height - 20);
      }
    }, 250);
  };

  const stopPolling = () => {
    if (pollMouseInterval) {
      clearInterval(pollMouseInterval);
      pollMouseInterval = null;
    }
  };

  mainWindow.on('focus', startPolling);
  mainWindow.on('blur', stopPolling);
  mainWindow.on('closed', stopPolling);
}

app.whenReady().then(() => {
  registerZeniumProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    attachKeyBlocker(mainWindow.webContents);
  });

  ipcMain.on('renderer-ready', () => {
    console.log('[main.js] Received renderer-ready signal.');
    const savedSession = sessionManager.loadSession();
    if (savedSession && savedSession.tabs && savedSession.tabs.length > 0) {
      console.log(`[main.js] Found ${savedSession.tabs.length} tabs to restore.`);
      sessionManager.restoreSession(viewManager, mainWindow, savedSession);
    } else {
      console.log('[main.js] No saved session found. Instructing renderer to create an initial tab.');
      mainWindow.webContents.send('create-initial-tab');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('tab-order', (event, order) => {
    // This simply forwards the event to the promise in saveSession
});

ipcMain.on('check-for-update', () => {
  autoUpdater.forceDevUpdateConfig = true;
  console.log('[main.js] User requested update check.');
  autoUpdater.checkForUpdates();
});

ipcMain.on('start-download', () => {
  console.log('[main.js] User requested update download.');
  autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', () => {
  console.log('[main.js] User requested quit and install.');
  isQuittingForUpdate = true;
  autoUpdater.quitAndInstall();
});

autoUpdater.on('update-available', (info) => {
    console.log('[main.js] Update available:', info);
    const updateInfo = {
        version: info.version,
        size: info.files[0] ? formatBytes(info.files[0].size) : 'N/A'
    };
    if (mainWindow) mainWindow.webContents.send('update-info-available', updateInfo);
    if (modalManager && modalManager.modals) {
        for (const [, view] of modalManager.modals.entries()) {
            if (view && view.webContents) view.webContents.send('update-info-available', updateInfo);
        }
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('[main.js] No update available.');
    if (mainWindow) mainWindow.webContents.send('update-not-available');
    if (modalManager && modalManager.modals) {
        for (const [, view] of modalManager.modals.entries()) {
            if (view && view.webContents) view.webContents.send('update-not-available');
        }
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[main.js] Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
    if (modalManager && modalManager.modals) {
        for (const [, view] of modalManager.modals.entries()) {
            if (view && view.webContents) view.webContents.send('update-download-progress', progressObj);
        }
    }
});

autoUpdater.on('update-downloaded', async (info) => {
    console.log('[main.js] Update downloaded.');
    updateReadyToInstall = true;
    
    if (mainWindow) mainWindow.webContents.send('update-download-complete');
    if (modalManager && modalManager.modals) {
        for (const [, view] of modalManager.modals.entries()) {
            if (view && view.webContents) view.webContents.send('update-download-complete');
        }
    }
    
    const dialogOpts = {
        type: 'info',
        buttons: ['Restart and Install', 'Later'],
        title: 'Update Ready to Install',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Do you want to restart and install it now?'
    };

    const { response } = await dialog.showMessageBox(mainWindow, dialogOpts);

    if (response === 0) { // User chose "Restart and Install"
        isQuittingForUpdate = true;
        autoUpdater.quitAndInstall();
    }
});


ipcMain.on('tab-states', (event, states) => {
    // This forwards the tab states to the promise in saveSession
});

// --- All other IPC handlers remain the same ---

ipcMain.handle('get-search-suggestions', (event, query) => {
    if (!query) {
        return [];
    }
    return new Promise((resolve) => {
        const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=en&gl=us&q=${encodeURIComponent(query)}`;
        const request = net.request(url);
        let body = '';
        request.on('response', (response) => {
            response.on('data', (chunk) => {
                body += chunk.toString();
            });
            response.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const suggestions = data[1] || [];
                    resolve(suggestions.slice(0, 5));
                } catch (e) {
                    resolve([]);
                }
            });
            response.on('error', (error) => {
                resolve([]);
            });
        });
        request.on('error', (error) => {
            resolve([]);
        });
        request.end();
    });
});

ipcMain.on('focus-main-window', () => {
    if (mainWindow) {
        mainWindow.webContents.focus();
    }
});

ipcMain.on('show-modal', (event, options) => {
    modalManager.show(options);
});

ipcMain.on('close-modal', (event, id) => {
    modalManager.close(id);
});

ipcMain.on('modal-action', (event, action) => {
    mainWindow.webContents.send('modal-event', action);
});

ipcMain.on('request-close-self-modal', (event) => {
    const senderWebContentsId = event.sender.id;
    for (const [id, view] of modalManager.modals.entries()) {
        if (view.webContents.id === senderWebContentsId) {
            modalManager.close(id);
            break;
        }
    }
});

ipcMain.on('resize-modal-self', (event, dimensions) => {
    const senderWebContentsId = event.sender.id;
    if (modalManager) {
        modalManager.resize(senderWebContentsId, dimensions);
    }
});

ipcMain.handle('get-history', (event) => {
    return historyManager.getAll();
});

ipcMain.on('sidebar-resize', (event, newWidth) => {
    if (viewManager) viewManager.updateSidebarWidth(newWidth);
});

ipcMain.on('new-tab', (event, { tabId, url }) => {
    if (viewManager) viewManager.newTab(tabId, url);
});

ipcMain.on('restore-tab', (event, { tabId, url, history }) => {
    if (viewManager) viewManager.newTab(tabId, url, history);
});

ipcMain.on('switch-tab', (event, tabId) => {
    if (viewManager) viewManager.switchTab(tabId);
});

ipcMain.on('close-tab', (event, tabId) => {
    if (viewManager) viewManager.closeTab(tabId);
});

ipcMain.on('unload-tab', (event, tabId) => {
    if (viewManager) viewManager.unloadTab(tabId);
});

ipcMain.on('navigate', (event, { tabId, url }) => {
    if (viewManager) viewManager.navigate(tabId, url);
});

ipcMain.on('go-back', (event, tabId) => {
    if (viewManager) viewManager.goBack(tabId);
});

ipcMain.on('go-forward', (event, tabId) => {
    if (viewManager) viewManager.goForward(tabId);
});

ipcMain.on('reload', (event, tabId) => {
    if (viewManager) viewManager.reload(tabId);
});

ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    mainWindow.close();
});

ipcMain.handle('get-my-tab-id', (event) => {
    const senderWebContentsId = event.sender.id;
    if (viewManager && viewManager.views) {
        for (const [tabId, view] of Object.entries(viewManager.views)) {
            if (view.webContents.id === senderWebContentsId) {
                return tabId;
            }
        }
    }
    return null;
});