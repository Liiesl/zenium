// main/viewManager.js
const { BrowserView } = require('electron');
const path = require('path');
const { attachKeyBlocker } = require('./keyblocker.js');

class ViewManager {
    constructor(mainWindow, historyManager) {
        this.mainWindow = mainWindow;
        this.historyManager = historyManager;
        this.views = {};
        this.loadingViews = {};
        this.isLoading = {};
        this.activeTabId = null;
        this.sidebarWidth = 200;
        this.animationInterval = null;
        this.VIEW_PADDING = 10;
        this.hideLoadingTimeout = {}; // To manage hide timeouts
    }

    updateSidebarWidth(newWidth) {
        this.sidebarWidth = newWidth;
        this.updateActiveViewBounds();
    }

    createLoadingView(tabId) {
        const loadingView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        this.mainWindow.addBrowserView(loadingView);
        loadingView.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'loading.html'));
        this.loadingViews[tabId] = loadingView;
        this.hideLoadingOverlay(tabId); // Initially hidden
    }

    showLoadingOverlay(tabId) {
        const view = this.views[tabId];
        const loadingView = this.loadingViews[tabId];
        if (view && loadingView) {
            if (this.hideLoadingTimeout[tabId]) {
                clearTimeout(this.hideLoadingTimeout[tabId]);
                delete this.hideLoadingTimeout[tabId];
            }

            loadingView.webContents.executeJavaScript(
                'const loader = document.querySelector(".loader"); loader.classList.remove("finished"); loader.classList.add("loading");',
                true
            );
            
            const viewBounds = view.getBounds();
            const loadingBarHeight = 5;

            loadingView.setBounds({
                x: viewBounds.x,
                y: viewBounds.y + viewBounds.height - loadingBarHeight,
                width: viewBounds.width,
                height: loadingBarHeight
            });

            this.mainWindow.setTopBrowserView(loadingView);
        }
    }

    finishLoading(tabId) {
        const loadingView = this.loadingViews[tabId];
        if (loadingView) {
            loadingView.webContents.executeJavaScript(
                'document.querySelector(".loader").classList.add("finished");',
                true
            ).then(() => {
                if (this.hideLoadingTimeout[tabId]) {
                    clearTimeout(this.hideLoadingTimeout[tabId]);
                }
                this.hideLoadingTimeout[tabId] = setTimeout(() => {
                    this.hideLoadingOverlay(tabId);
                    if (this.views[tabId] && this.activeTabId === tabId) {
                        this.mainWindow.setTopBrowserView(this.views[tabId]);
                    }
                    delete this.hideLoadingTimeout[tabId];
                }, 600);
            });
        }
    }

    hideLoadingOverlay(tabId) {
        const loadingView = this.loadingViews[tabId];
        if (loadingView) {
            loadingView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        }
    }

    newTab(tabId, url = 'zenium://newtab', history = null) {
        const view = new BrowserView({
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        
        this.mainWindow.addBrowserView(view);
        this.views[tabId] = view;
        this.isLoading[tabId] = false;

        this.createLoadingView(tabId);
        
        // --- KEY CHANGE: Use the modern, fast history restoration API ---
        const restoreHistory = async () => {
            if (view.webContents.isDestroyed()) return;

            try {
                console.log(`[ViewManager] Restoring history for tab ${tabId} with ${history.entries.length} entries at index ${history.index}.`);
                // This single, efficient call loads the page at history.index AND populates the back/forward list.
                await view.webContents.navigationHistory.restore({
                    index: history.index,
                    entries: history.entries
                });
                console.log(`[ViewManager] History restoration complete for tab ${tabId}.`);

                // --- FIX: After successful restoration, immediately send the final state to the renderer ---
                if (!view.webContents.isDestroyed()) {
                    const finalTitle = view.webContents.getTitle();
                    const finalURL = view.webContents.getURL();
                    const favicons = view.webContents.getFavicons(); // This might be empty if not yet loaded, which is okay.
                    
                    this.mainWindow.webContents.send('tab-restored', {
                        tabId: tabId,
                        title: finalTitle,
                        url: finalURL,
                        faviconUrl: (favicons && favicons.length > 0) ? favicons[0] : null
                    });
                }

            } catch (error) {
                console.error(`[ViewManager] Failed to restore history for tab ${tabId}:`, error.message);
                // Fallback: If restore fails, at least load the active URL.
                if (!view.webContents.isDestroyed()) {
                    const activeUrl = history.entries[history.index]?.url;
                    if (activeUrl) {
                        console.log(`[ViewManager] Fallback: Loading active URL ${activeUrl}`);
                        await view.webContents.loadURL(activeUrl);
                    }
                }
            }
        };

        if (history && history.entries && history.entries.length > 0 && history.index > -1) {
            // This is a restored tab.
            restoreHistory();
        } else {
            // This is a brand new tab, just load the URL.
            view.webContents.loadURL(url);
        }

        attachKeyBlocker(view.webContents);

        // ... (all event listeners like 'did-start-loading', 'page-title-updated', etc. remain the same) ...
        view.webContents.on('did-start-loading', () => {
            if (view.webContents.getURL().startsWith('zenium://')) return;
            this.isLoading[tabId] = true;
            if (this.activeTabId === tabId) {
                this.showLoadingOverlay(tabId);
            }
        });

        view.webContents.on('did-stop-loading', () => {
            this.isLoading[tabId] = false;
            if (this.activeTabId === tabId) {
                this.finishLoading(tabId);
            }

            if (view.webContents && !view.webContents.isDestroyed()) {
                const pageUrl = view.webContents.getURL();
                const pageTitle = view.webContents.getTitle();

                if (!pageUrl.startsWith('zenium://') && pageUrl !== 'about:blank') {
                    this.historyManager.add({ url: pageUrl, title: pageTitle });
                }
            }
        });

        view.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12') {
                const webContents = view.webContents;
                if (webContents.isDevToolsOpened()) {
                    webContents.closeDevTools();
                } else {
                    webContents.openDevTools({ mode: 'right' });
                }
            }
        });

        view.webContents.on('page-title-updated', (event, title) => {
            this.mainWindow.webContents.send('update-tab-title', { tabId, title });
        });
        
        view.webContents.on('page-favicon-updated', (event, favicons) => {
            if (favicons && favicons.length > 0) {
                this.mainWindow.webContents.send('update-tab-favicon', { tabId, faviconUrl: favicons[0] });
            }
        });

        view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error(`[ViewManager] Page failed to load: ${validatedURL}`);
            console.error(`[ViewManager] Error [${errorCode}]: ${errorDescription}`);
        });

        const sendUrlUpdate = () => {
            if (view.webContents && !view.webContents.isDestroyed()) {
                const currentURL = view.webContents.getURL();
                this.mainWindow.webContents.send('url-updated', { tabId, url: currentURL });
            }
        };

        view.webContents.on('did-navigate', () => {
            sendUrlUpdate();
        });
        view.webContents.on('did-navigate-in-page', sendUrlUpdate);
    }
    
    switchTab(tabId) {
        if (!this.views[tabId]) return;

        this.activeTabId = tabId;

        this.mainWindow.setTopBrowserView(this.views[tabId]);

        for (const id in this.views) {
            if (id !== this.activeTabId) {
                this.views[id].setBounds({ x: 0, y: 0, width: 0, height: 0 });
                this.hideLoadingOverlay(id);
            }
        }
        
        this.updateActiveViewBounds();

        if (this.isLoading[tabId]) {
            this.showLoadingOverlay(tabId);
        }

        const webContents = this.views[tabId].webContents;
        if (webContents && !webContents.isDestroyed()) {
            const currentURL = webContents.getURL();
            this.mainWindow.webContents.send('url-updated', { tabId, url: currentURL });
        }
    }

    closeTab(tabId) {
        if (this.views[tabId]) {
            const view = this.views[tabId];
            this.mainWindow.removeBrowserView(view);
            if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.destroy();
            }
            delete this.views[tabId];
        }

        if (this.loadingViews[tabId]) {
            const loadingView = this.loadingViews[tabId];
            this.mainWindow.removeBrowserView(loadingView);
            if (loadingView.webContents && !loadingView.webContents.isDestroyed()) {
                loadingView.webContents.destroy();
            }
            delete this.loadingViews[tabId];
        }

        if (this.hideLoadingTimeout[tabId]) {
            clearTimeout(this.hideLoadingTimeout[tabId]);
            delete this.hideLoadingTimeout[tabId];
        }

        delete this.isLoading[tabId];
        
        if (this.activeTabId === tabId) {
            this.activeTabId = null;
        }
    }

    navigate(tabId, url) {
        if (this.views[tabId]) {
            this.views[tabId].webContents.loadURL(url);
        }
    }

    goBack(tabId) {
        if (this.views[tabId] && this.views[tabId].webContents.canGoBack()) {
            this.views[tabId].webContents.goBack();
        }
    }

    goForward(tabId) {
        if (this.views[tabId] && this.views[tabId].webContents.canGoForward()) {
            this.views[tabId].webContents.goForward();
        }
    }

    reload(tabId) {
        if (this.views[tabId]) {
            this.views[tabId].webContents.reload();
        }
    }

    getActiveView() {
        return this.views[this.activeTabId] || null;
    }

    updateActiveViewBounds() {
        const view = this.getActiveView();
        if (!view || !this.mainWindow) return;

        const { width, height } = this.mainWindow.getContentBounds();
        const currentBounds = view.getBounds();
        
        const isTitlebarExpanded = currentBounds.y > 10;
        const y = isTitlebarExpanded ? 40 : 10;
        const newHeight = isTitlebarExpanded ? height - 50 : height - 20;
        const RESIZE_HANDLE_WIDTH = 10;

        const newBounds = {
            x: this.sidebarWidth + this.VIEW_PADDING + RESIZE_HANDLE_WIDTH,
            y: y,
            width: width - this.sidebarWidth - (this.VIEW_PADDING * 2) - RESIZE_HANDLE_WIDTH,
            height: newHeight
        };
        view.setBounds(newBounds);

        if (this.isLoading[this.activeTabId]) {
            this.showLoadingOverlay(this.activeTabId);
        }
    }

    animateViewBounds(targetY, targetHeight, duration = 150) {
        const view = this.getActiveView();
        if (!view) return;

        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }

        const startBounds = view.getBounds();
        const targetBounds = { ...startBounds, y: targetY, height: targetHeight };
        const startTime = Date.now();

        this.animationInterval = setInterval(() => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);

            const newY = Math.round(startBounds.y + (targetBounds.y - startBounds.y) * progress);
            const newHeight = Math.round(startBounds.height + (targetBounds.height - startBounds.height) * progress);
            const newBounds = { ...startBounds, y: newY, height: newHeight };
            
            view.setBounds(newBounds);

            if (this.isLoading[this.activeTabId]) {
                this.showLoadingOverlay(this.activeTabId);
            }

            if (progress === 1) {
                clearInterval(this.animationInterval);
                this.animationInterval = null;
            }
        }, 16);
    }
}

module.exports = { ViewManager };