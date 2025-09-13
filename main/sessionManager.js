// main/sessionManager.js
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');

class SessionManager {
    async saveSession(viewManager, mainWindow) {
        if (!viewManager || !mainWindow) {
            console.error('[SessionManager] saveSession called without viewManager or mainWindow.');
            return;
        }

        // --- KEY CHANGE: Helper function for robust IPC with timeout ---
        const ipcPromiseWithTimeout = (requestChannel, responseChannel, timeout = 2000) => {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    // Clean up the listener to prevent memory leaks
                    ipcMain.removeListener(responseChannel, listener);
                    reject(new Error(`IPC request '${requestChannel}' timed out after ${timeout}ms.`));
                }, timeout);

                const listener = (event, data) => {
                    clearTimeout(timer);
                    resolve(data);
                };
                
                ipcMain.once(responseChannel, listener);
                mainWindow.webContents.send(requestChannel);
            });
        };

        let tabOrder = [];
        let tabStates = {};
        
        try {
            // --- KEY CHANGE: Use the new robust promise function ---
            console.log('[SessionManager] Requesting tab order from renderer...');
            tabOrder = await ipcPromiseWithTimeout('get-tab-order', 'tab-order');
            console.log('[SessionManager] Received tab order:', tabOrder);

            console.log('[SessionManager] Requesting tab states from renderer...');
            tabStates = await ipcPromiseWithTimeout('get-tab-states', 'tab-states');
            console.log('[SessionManager] Received tab states:', tabStates);

        } catch (error) {
            console.error('[SessionManager] Failed to get data from renderer for session save:', error.message);
            // Even if we fail, we should proceed to save what we can, rather than hanging.
            // tabOrder and tabStates will be empty, which is a safe fallback.
        }


        const tabs = Object.entries(viewManager.views).reduce((acc, [tabId, view]) => {
            try {
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    return acc;
                }

                const navigationHistory = view.webContents.navigationHistory;
                const historyEntries = navigationHistory.getAllEntries();
                const activeIndex = navigationHistory.getActiveIndex();
                const url = view.webContents.getURL();
                
                const tabType = tabStates[tabId] || 'regular';

                if (historyEntries.length > 0) {
                    acc.push({
                        tabId,
                        url: url,
                        history: {
                            index: activeIndex,
                            entries: historyEntries,
                        },
                        type: tabType, 
                    });
                }

            } catch (error) {
                console.warn(`Could not save session for tab ${tabId} during quit: ${error.message}`);
            }
            
            return acc;
        }, []);

        const session = {
            activeTabId: viewManager.activeTabId,
            tabOrder: tabOrder,
            tabs,
        };

        try {
            console.log('[SessionManager] Saving session state to disk...');
            fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
            console.log('[SessionManager] Session state saved.');
        } catch (error) {
            console.error('Error writing session file:', error);
        }
    }

    loadSession() {
        try {
            if (fs.existsSync(SESSION_PATH)) {
                const sessionData = fs.readFileSync(SESSION_PATH, 'utf-8');
                console.log('[SessionManager] Loaded session data from file.');
                return JSON.parse(sessionData);
            }
        } catch (error) {
            console.error('Error loading session:', error);
        }
        console.log('[SessionManager] No session file found.');
        return null;
    }

    restoreSession(viewManager, mainWindow, session) {
        if (!viewManager || !session || !session.tabs) {
            console.error('[SessionManager] restoreSession called with invalid arguments.');
            return;
        }

        console.log('[SessionManager] Starting session restore...');

        const tabMap = new Map(session.tabs.map(tab => [tab.tabId, tab]));
        const orderedTabs = (session.tabOrder || []).map(tabId => tabMap.get(tabId)).filter(Boolean);

        // Add any tabs that might not have been in the order list (fallback)
        session.tabs.forEach(tab => {
            if (!session.tabOrder || !session.tabOrder.includes(tab.tabId)) {
                orderedTabs.push(tab);
            }
        });


        orderedTabs.forEach((tab) => {
            console.log(`[SessionManager] Restoring tab: ${tab.tabId} with type: ${tab.type}`);
            mainWindow.webContents.send('create-tab', {
                tabId: tab.tabId,
                url: tab.url,
                history: tab.history,
                type: tab.type,
            });
        });

        setTimeout(() => {
            if (session.activeTabId) {
                console.log(`[SessionManager] Setting active tab to: ${session.activeTabId}`);
                mainWindow.webContents.send('switch-tab', session.activeTabId);
            }
        }, 100);
    }
}

module.exports = { SessionManager };