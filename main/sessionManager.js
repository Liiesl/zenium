// main/sessionManager.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const SESSION_PATH = path.join(app.getPath('userData'), 'session.json');

class SessionManager {
    saveSession(viewManager) {
        if (!viewManager) {
            console.error('[SessionManager] saveSession called without viewManager.');
            return;
        }

        const tabs = Object.entries(viewManager.views).reduce((acc, [tabId, view]) => {
            try {
                if (!view || !view.webContents || view.webContents.isDestroyed()) {
                    return acc;
                }

                // Use navigationHistory API instead of getHistory and getActiveIndex
                const navigationHistory = view.webContents.navigationHistory;
                const historyEntries = navigationHistory.getAllEntries().map(entry => entry.url); // get array of URLs
                const activeIndex = navigationHistory.getActiveIndex();
                const url = view.webContents.getURL();

                if (historyEntries.length > 0) {
                    acc.push({
                        tabId,
                        url: url, // The last active URL
                        history: {
                            index: activeIndex,
                            entries: historyEntries, // Array of URL strings
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
        session.tabs.forEach((tab) => {
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