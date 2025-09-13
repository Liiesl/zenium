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

        // --- KEY CHANGE: Asynchronously gather tab data, including favicons ---
        const tabPromises = Object.entries(viewManager.views).map(async ([tabId, view]) => {
            try {
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    return null;
                }

                const navigationHistory = view.webContents.navigationHistory;
                const historyEntries = navigationHistory.getAllEntries();
                const activeIndex = navigationHistory.getActiveIndex();
                const url = view.webContents.getURL();
                const tabType = tabStates[tabId] || 'regular';

                // --- NEW: Actively query for the favicon URL ---
                let faviconUrl = null;
                try {
                     const potentialFavicons = await view.webContents.executeJavaScript(
                        'Array.from(document.querySelectorAll("link[rel~=\'icon\']")).map(link => link.href)'
                    );
                    if (potentialFavicons && potentialFavicons.length > 0) {
                        faviconUrl = potentialFavicons[0];
                    }
                } catch (e) {
                    console.warn(`[SessionManager] Could not query favicon for tab ${tabId}. It will not be saved.`);
                }

                if (historyEntries.length > 0) {
                    return {
                        tabId,
                        url: url,
                        history: {
                            index: activeIndex,
                            entries: historyEntries,
                        },
                        type: tabType, 
                        faviconUrl: faviconUrl, // --- NEW: Save the favicon ---
                        isUnloaded: false,
                    };
                }
                return null;

            } catch (error) {
                console.warn(`Could not save session for tab ${tabId} during quit: ${error.message}`);
                return null;
            }
        });

        const resolvedTabs = (await Promise.all(tabPromises)).filter(Boolean);

        for (const [tabId, state] of Object.entries(viewManager.unloadedTabs)) {
            const tabType = tabStates[tabId] || 'regular';
            resolvedTabs.push({
                tabId,
                url: state.url,
                history: state.history,
                type: tabType,
                faviconUrl: state.faviconUrl,
                isUnloaded: true,
            });
        }

        const session = {
            activeTabId: viewManager.activeTabId,
            tabOrder: tabOrder,
            tabs: resolvedTabs,
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
    
        session.tabs.forEach(tab => {
            if (!session.tabOrder || !session.tabOrder.includes(tab.tabId)) {
                orderedTabs.push(tab);
            }
        });
    
        const activeTabId = session.activeTabId;
    
        orderedTabs.forEach((tab) => {
            // A tab is restored as unloaded if it wasn't the active tab when the session was saved.
            const shouldBeUnloaded = tab.tabId !== activeTabId;
    
            if (shouldBeUnloaded) {
                console.log(`[SessionManager] Restoring tab as UNLOADED on startup: ${tab.tabId}`);
                viewManager.unloadedTabs[tab.tabId] = { url: tab.url, history: tab.history, faviconUrl: tab.faviconUrl };
                
                mainWindow.webContents.send('create-unloaded-tab', {
                    tabId: tab.tabId,
                    title: tab.history?.entries[tab.history.index]?.title || 'Unloaded Tab',
                    faviconUrl: tab.faviconUrl,
                    type: tab.type,
                });
            } else { 
                // This block only runs for the single active tab. Restore it fully.
                console.log(`[SessionManager] Restoring ACTIVE tab: ${tab.tabId}`);
                mainWindow.webContents.send('create-tab', {
                    tabId: tab.tabId, url: tab.url, history: tab.history, type: tab.type, faviconUrl: tab.faviconUrl,
                });
            }
        });
    
        // After creating all tab UIs, explicitly switch to the active tab.
        // This ensures its view is visible and it is marked as active in the sidebar.
        setTimeout(() => {
            if (activeTabId) {
                console.log(`[SessionManager] Setting active tab to: ${activeTabId}`);
                mainWindow.webContents.send('switch-tab', activeTabId);
            }
        }, 100); 
    }
}

module.exports = { SessionManager };