// main.js
const { app, BrowserWindow, ipcMain, screen, net } = require('electron');
const path = require('path');
const { ViewManager } = require('./viewManager.js');
const { ModalManager } = require('./modalManager.js');
const { SettingsManager } = require('./settingsManager.js');
const { HistoryManager } = require('./historyManager.js'); // <-- ADD THIS
const { attachKeyBlocker } = require('./keyblocker.js');
const { registerZeniumProtocol } = require('./protocol.js');

let mainWindow;
let viewManager;
let modalManager;
let settingsManager;
let historyManager; // <-- ADD THIS
let pollMouseInterval = null;

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

  historyManager = new HistoryManager(); // <-- ADD THIS
  viewManager = new ViewManager(mainWindow, historyManager); // <-- PASS TO ViewManager
  modalManager = new ModalManager(mainWindow);
  settingsManager = new SettingsManager();
  
  // Correctly load index.html from the 'renderer' directory
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.openDevTools({ mode: 'undocked' });

  mainWindow.on('resize', () => viewManager.updateActiveViewBounds());

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
  // --- CENTRALIZED PROTOCOL HANDLING ---
  registerZeniumProtocol();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  attachKeyBlocker(mainWindow.webContents);
  
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- NEW IPC handler for Search Suggestions ---
ipcMain.handle('get-search-suggestions', (event, query) => {
    if (!query) {
        return [];
    }

    console.log("Fetching search suggestions for query:", query);

    // Use a Promise to handle the async network request
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
                    // Slice the suggestions to a maximum of 5
                    resolve(suggestions.slice(0, 5));
                } catch (e) {
                    console.error("Failed to parse search suggestions:", e);
                    resolve([]);
                }
            });
            response.on('error', (error) => {
                console.error("Error in search suggestion response:", error);
                resolve([]);
            });
        });

        request.on('error', (error) => {
            console.error("Failed to fetch search suggestions:", error);
            resolve([]);
        });
        
        request.end();
    });
});


// --- NEW IPC Listener ---
ipcMain.on('focus-main-window', () => {
    if (mainWindow) {
        mainWindow.webContents.focus();
    }
});

// --- IPC Listeners for Modals ---
ipcMain.on('show-modal', (event, options) => {
    modalManager.show(options);
});

ipcMain.on('close-modal', (event, id) => {
    modalManager.close(id);
});

// This is now a general-purpose action forwarder.
// We will use a more specific 'set-setting' channel for settings.
ipcMain.on('modal-action', (event, action) => {
    mainWindow.webContents.send('modal-event', action);
});

// Handle a modal requesting to close itself
// The `event.sender.id` directly gives the webContents ID of the BrowserView that sent the message.
ipcMain.on('request-close-self-modal', (event) => {
    const senderWebContentsId = event.sender.id;
    for (const [id, view] of modalManager.modals.entries()) {
        if (view.webContents.id === senderWebContentsId) {
            modalManager.close(id);
            break;
        }
    }
});

// --- NEW IPC Listener for resizing ---
ipcMain.on('resize-modal-self', (event, dimensions) => {
    const senderWebContentsId = event.sender.id;
    console.log(`[main.js] Received 'resize-modal-self' from webContentsId: ${senderWebContentsId} with dimensions:`, dimensions);
    if (modalManager) {
        modalManager.resize(senderWebContentsId, dimensions);
    }
});

// --- NEW IPC HANDLER for History ---
ipcMain.handle('get-history', (event) => {
    return historyManager.getAll();
});

ipcMain.on('sidebar-resize', (event, newWidth) => {
    if (viewManager) viewManager.updateSidebarWidth(newWidth);
});

ipcMain.on('new-tab', (event, { tabId, url }) => {
    if (viewManager) viewManager.newTab(tabId, url);
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

// --- NEW IPC HANDLER: Allows a view to request its own tabId ---
ipcMain.handle('get-my-tab-id', (event) => {
    // event.sender is the webContents that sent the message
    const senderWebContentsId = event.sender.id;

    // We need to find which tabId in our ViewManager corresponds to this webContents ID.
    if (viewManager && viewManager.views) {
        for (const [tabId, view] of Object.entries(viewManager.views)) {
            if (view.webContents.id === senderWebContentsId) {
                return tabId; // Found it! Return the tabId.
            }
        }
    }
    return null; // Return null if not found (e.g., it's not a tab view)
});