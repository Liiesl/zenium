const { BrowserView } = require('electron');
const path = require('path');
const { attachKeyBlocker } = require('./keyblocker.js');

class ViewManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.views = {};
        this.loadingViews = {}; // To hold loading overlays
        this.isLoading = {}; // To track loading state per tab
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
            // Clear any pending hide timeouts
            if (this.hideLoadingTimeout[tabId]) {
                clearTimeout(this.hideLoadingTimeout[tabId]);
                delete this.hideLoadingTimeout[tabId];
            }

            // Reset and start the loading animation
            loadingView.webContents.executeJavaScript(
                'const loader = document.querySelector(".loader"); loader.classList.remove("finished"); loader.classList.add("loading");',
                true
            );
            
            const viewBounds = view.getBounds();
            const loadingBarHeight = 5; // Height of the loading bar

            loadingView.setBounds({
                x: viewBounds.x,
                y: viewBounds.y + viewBounds.height - loadingBarHeight, // Positioned at the bottom
                width: viewBounds.width,
                height: loadingBarHeight
            });

            // *** KEY CHANGE: Explicitly bring the loading view to the top ***
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
                    // *** KEY CHANGE: Ensure the main content view is on top after loading finishes ***
                    if (this.views[tabId] && this.activeTabId === tabId) {
                        this.mainWindow.setTopBrowserView(this.views[tabId]);
                    }
                    delete this.hideLoadingTimeout[tabId];
                }, 600); // Wait for animations to complete
            });
        }
    }

    hideLoadingOverlay(tabId) {
        const loadingView = this.loadingViews[tabId];
        if (loadingView) {
            loadingView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        }
    }

    newTab(tabId, url = 'https://www.google.com') {
        const view = new BrowserView();
        // Set initial bounds to 0x0 to keep it hidden until explicitly switched to.
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        
        // Add the content view first
        this.mainWindow.addBrowserView(view);
        this.views[tabId] = view;
        this.isLoading[tabId] = false; // Initialize loading state

        // Create the loading view (which will be added on top)
        this.createLoadingView(tabId);
        
        view.webContents.loadURL(url);

        attachKeyBlocker(view.webContents);

        view.webContents.on('did-start-loading', () => {
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
                this.mainWindow.webContents.send('url-updated', { tabId, url: view.webContents.getURL() });
            }
        };

        view.webContents.on('did-navigate', sendUrlUpdate);
        view.webContents.on('did-navigate-in-page', sendUrlUpdate);
    }

    switchTab(tabId) {
        if (!this.views[tabId]) return;

        this.activeTabId = tabId;

        // Bring the active view to the top so it receives input.
        this.mainWindow.setTopBrowserView(this.views[tabId]);

        // Hide all other views and their overlays.
        for (const id in this.views) {
            if (id !== this.activeTabId) {
                this.views[id].setBounds({ x: 0, y: 0, width: 0, height: 0 });
                this.hideLoadingOverlay(id);
            }
        }
        
        // Position the active view correctly.
        this.updateActiveViewBounds();

        // If the newly active tab is still loading, ensure its overlay is visible.
        if (this.isLoading[tabId]) {
            this.showLoadingOverlay(tabId);
        }

        // Send the current URL of the newly focused tab.
        const webContents = this.views[tabId].webContents;
        if (webContents && !webContents.isDestroyed()) {
            this.mainWindow.webContents.send('url-updated', { tabId, url: webContents.getURL() });
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

        const newBounds = {
            x: this.sidebarWidth + this.VIEW_PADDING,
            y: y,
            width: width - this.sidebarWidth - (this.VIEW_PADDING * 2),
            height: newHeight
        };
        view.setBounds(newBounds);

        // If the loading bar should be visible, update its position.
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

            // Also move the loading bar with the animation
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