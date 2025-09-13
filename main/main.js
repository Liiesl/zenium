// main.js
const { app, BrowserWindow, ipcMain, screen, net } = require('electron');
const path = require('path');
const { ViewManager } = require('./viewManager.js');
const { ModalManager } = require('./modalManager.js');
const { SettingsManager } = require('./settingsManager.js');
const { SessionManager } = require('./sessionManager.js');
const { HistoryManager } = require('./historyManager.js');
const { attachKeyBlocker } = require('./keyblocker.js');
const { registerZeniumProtocol } = require('./protocol.js');

let mainWindow;
let viewManager;
let modalManager;
let settingsManager;
let historyManager;
let sessionManager;
let pollMouseInterval = null;
// --- KEY CHANGE: Flag to ensure the save process only runs once ---
let isQuitting = false;

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
  viewManager = new ViewManager(mainWindow, historyManager);
  modalManager = new ModalManager(mainWindow);
  sessionManager = new SessionManager();
  settingsManager = new SettingsManager();
  
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.openDevTools({ mode: 'undocked' });

  mainWindow.on('resize', () => viewManager.updateActiveViewBounds());

  // --- KEY CHANGE: The entire shutdown logic is now handled here ---
  mainWindow.on('close', async (event) => {
    // If we're not already in the process of quitting...
    if (!isQuitting) {
      console.log('[main.js] Window "close" event intercepted.');
      
      // 1. Prevent the window from closing immediately. This keeps the renderer alive.
      event.preventDefault();
      
      // 2. Set the flag to prevent this code from running again.
      isQuitting = true;

      try {
        // 3. Perform the asynchronous session save while the renderer is still available.
        console.log('[main.js] Starting session save from "close" event.');
        await sessionManager.saveSession(viewManager, mainWindow);
        console.log('[main.js] Session save complete.');
      } catch (err) {
        console.error('[main.js] An error occurred during session saving:', err);
      } finally {
        // 4. Now that saving is done, quit the application for real.
        console.log('[main.js] Proceeding with application quit.');
        app.quit();
      }
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

// These listeners are now guaranteed to have a live renderer to talk to.
ipcMain.on('tab-order', (event, order) => {
    // This simply forwards the event to the promise in saveSession
});
ipcMain.on('tab-states', (event, states) => {
    // This forwards the tab states to the promise in saveSession
});

// --- KEY CHANGE: This is no longer needed for session saving and can be removed ---
// It was the source of the race condition.
/*
app.on('before-quit', async (event) => {
  // ... removed ...
});
*/

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