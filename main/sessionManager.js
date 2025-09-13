// main/sessionManager.js
const { app, ipcMain } = require('electron'); // --- KEY CHANGE: require ipcMain ---
const path = require('path');
const fs = require('fs');

const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');

class SessionManager {
    // --- KEY CHANGE: This is now an async function ---
    async saveSession(viewManager, mainWindow) {
        if (!viewManager || !mainWindow) {
            console.error('[SessionManager] saveSession called without viewManager or mainWindow.');
            return;
        }

        // --- KEY CHANGE: Request the visual tab order from the renderer ---
        mainWindow.webContents.send('get-tab-order');
        const tabOrder = await new Promise(resolve => {
            ipcMain.once('tab-order', (event, order) => resolve(order));
        });

        const tabs = Object.entries(viewManager.views).reduce((acc, [tabId, view]) => {
            // ... (rest of the logic is the same)
            try {
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    return acc;
                }

                const navigationHistory = view.webContents.navigationHistory;
                // --- KEY CHANGE: Get the full history entry objects, not just URLs ---
                const historyEntries = navigationHistory.getAllEntries();
                const activeIndex = navigationHistory.getActiveIndex();
                const url = view.webContents.getURL();

                if (historyEntries.length > 0) {
                    acc.push({
                        tabId,
                        url: url,
                        history: {
                            index: activeIndex,
                            // --- KEY CHANGE: Store the full entries array ---
                            entries: historyEntries,
                        },
                    });
                }

            } catch (error) {
                console.warn(`Could not save session for tab ${tabId} during quit: ${error.message}`);
            }
            
            return acc;
        }, []);

        const session = {
            activeTabId: viewManager.activeTabId,
            // --- KEY CHANGE: Store the visual order of tabs ---
            tabOrder: tabOrder,
            tabs,
        };

        try {
            console.log('[SessionManager] Saving session state:', JSON.stringify(session, null, 2));
            fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
        } catch (error) {
            console.error('Error writing session file:', error);
        }
    }

    loadSession() {
        try {
            if (fs.existsSync(SESSION_PATH)) {
                const sessionData = fs.readFileSync(SESSION_PATH, 'utf-8');
                console.log('[SessionManager] Loaded session data from file:', sessionData);
                const parsedData = JSON.parse(sessionData);
                console.log('[SessionManager] Parsed session object:', parsedData);
                return parsedData;
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

        console.log('[SessionManager] Starting restoreSession...');

        // --- KEY CHANGE: Create a map for quick lookups and sort tabs based on the saved order ---
        const tabMap = new Map(session.tabs.map(tab => [tab.tabId, tab]));
        const orderedTabs = (session.tabOrder || []).map(tabId => tabMap.get(tabId)).filter(Boolean);

        // Add any tabs that might not have been in the order list (fallback)
        session.tabs.forEach(tab => {
            if (!session.tabOrder || !session.tabOrder.includes(tab.tabId)) {
                orderedTabs.push(tab);
            }
        });


        orderedTabs.forEach((tab) => {
            console.log(`[SessionManager] Sending 'create-tab' event to renderer for tabId: ${tab.tabId}`);
            mainWindow.webContents.send('create-tab', {
                tabId: tab.tabId,
                url: tab.url,
                history: tab.history,
            });
        });

        setTimeout(() => {
            if (session.activeTabId) {
                console.log(`[SessionManager] Sending 'switch-tab' event to renderer for active tabId: ${session.activeTabId}`);
                mainWindow.webContents.send('switch-tab', session.activeTabId);
            }
        }, 100);
    }
}

module.exports = { SessionManager };