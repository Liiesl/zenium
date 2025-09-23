// renderer.js
import { Titlebar } from './titlebar.js';
import { Sidebar } from './sidebar.js';
import { SettingsModal } from './settingsModal/index.js';
import { viewApi } from './viewApi.js';

class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.sidebar = null;
        this.init();
    }

    async init() {
        const titlebar = new Titlebar().render();
        const settingsModal = new SettingsModal();
        const settings = await viewApi.getSettings();
        this.sidebar = new Sidebar(settingsModal, settings);
        const sidebarElement = this.sidebar.render();
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'content-container';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        contentWrapper.appendChild(contentContainer);

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'resize-handle';
        
        const container = document.createElement('div');
        container.className = 'container';
        container.appendChild(sidebarElement);
        container.appendChild(resizeHandle);
        container.appendChild(contentWrapper);
        
        this.appElement.appendChild(titlebar);
        this.appElement.appendChild(container);

        this.addResizeFunctionality(resizeHandle, sidebarElement, contentContainer);
        await this.initTheme();
        this.initEventListeners();
        this.initNavigationControls();

        // --- KEY CHANGE: Signal to the main process that the renderer is fully initialized ---
        window.electronAPI.rendererReady();
    }

    initNavigationControls() {
        const backBtn = document.getElementById('back-btn');
        const forwardBtn = document.getElementById('forward-btn');
        const reloadBtn = document.getElementById('reload-btn');

        backBtn.addEventListener('click', () => {
            if (this.sidebar.activeTabId) {
                window.electronAPI.goBack(this.sidebar.activeTabId);
            }
        });

        forwardBtn.addEventListener('click', () => {
            if (this.sidebar.activeTabId) {
                window.electronAPI.goForward(this.sidebar.activeTabId);
            }
        });

        reloadBtn.addEventListener('click', () => {
            if (this.sidebar.activeTabId) {
                viewApi.reload(this.sidebar.activeTabId);
            }
        });
    }

    initEventListeners() {
        window.electronAPI.onSettingUpdated(({ key, value }) => {
            if (key === 'theme') {
                this.applyTheme();
            }
        });

        // Listen for the 'create-tab' event from session restore
        window.electronAPI.onCreateTab((data) => {
            console.log('[Renderer] Received create-tab event for session restore:', data);
            this.sidebar.createRestoredTab(data);
        });

        // --- FIX: Listen for requests from main process to create a tab from a link ---
        viewApi.onCreateTabWithUrl((url) => {
            console.log(`[Renderer] Received request to create tab for URL: ${url}`);
            this.sidebar.createTab(url);
        });

        // --- KEY CHANGE: Listen for unloaded tabs during session restore ---
        viewApi.onCreateUnloadedTab((data) => {
            console.log('[Renderer] Received create-unloaded-tab event:', data);
            this.sidebar.createUnloadedTab(data);
        });

        // Listen for the 'switch-tab' event from session restore
        window.electronAPI.onSwitchTab((tabId) => {
            console.log(`[Renderer] Received switch-tab event for tabId: ${tabId}`);
            this.sidebar.switchTab(tabId);
        });

        // --- KEY CHANGE: Correctly listen for the "create initial tab" event via the preload API ---
        window.electronAPI.onInitialTab(() => {
            console.log('[Renderer] No session found. Creating a new initial tab.');
            this.sidebar.createTab();
        });

        window.electronAPI.onModalEvent(async (action) => {
            switch (action.type) {
                case 'close-tab':
                    this.sidebar.closeTab(action.tabId);
                    break;
                case 'navigate-to-url':
                    if (action.tabId && action.url) {
                        viewApi.navigate(action.tabId, action.url);
                    }
                    break;
            }
        });

        // --- NEW: Add listeners for fullscreen state changes ---
        window.electronAPI.onEnterFullscreen(() => {
            document.body.classList.add('fullscreen-active');
        });

        window.electronAPI.onLeaveFullscreen(() => {
            document.body.classList.remove('fullscreen-active');
        });
    }
    // ... rest of the file is unchanged ...
    addResizeFunctionality(handle, sidebar, contentContainer) {
        let isResizing = false;
        const titleBarLeftArea = document.querySelector('.title-bar-left-area');

        const handleMouseMove = (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 150) newWidth = 150;
            if (newWidth > 500) newWidth = 500;
            
            sidebar.style.width = `${newWidth}px`;
            if (titleBarLeftArea) {
                titleBarLeftArea.style.width = `${newWidth}px`;
            }
            contentContainer.style.width = `${newWidth}px`;
            window.electronAPI.resizeSidebar(newWidth);
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault();
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        });
    }
    
    async initTheme() {
        await this.applyTheme();

        window.electronAPI.onSetDraggable(isDraggable => {
            const titleBar = document.getElementById('title-bar');
            titleBar.classList.toggle('draggable', isDraggable);
        });
    }

    async applyTheme() {
        const isDarkMode = await window.electronAPI.isDarkMode();
        document.body.classList.toggle('dark-theme', isDarkMode);
        document.body.classList.toggle('light-theme', !isDarkMode);
    }
}

new App();