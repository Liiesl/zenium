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
        this.sidebar = new Sidebar(settingsModal);
        const sidebarElement = this.sidebar.render();
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'content-container';

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'resize-handle';
        
        const container = document.createElement('div');
        container.className = 'container';
        container.appendChild(sidebarElement);
        container.appendChild(resizeHandle);
        container.appendChild(contentContainer);
        
        this.appElement.appendChild(titlebar);
        this.appElement.appendChild(container);

        this.addResizeFunctionality(resizeHandle, sidebarElement);
        await this.initTheme(); // Make init async to await theme
        this.initEventListeners();
        this.initNavigationControls();
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
        // Listen for live setting updates from the main process
        window.electronAPI.onSettingUpdated(({ key, value }) => {
            if (key === 'theme') {
                this.applyTheme(); // Re-apply theme based on new setting
            }
        });

        // Listen for other actions from modals
        window.electronAPI.onModalEvent(async (action) => {
            switch (action.type) {
                case 'close-tab':
                    this.sidebar.closeTab(action.tabId);
                    break;
                // 'set-theme' is no longer handled here
            }
        });
    }

    addResizeFunctionality(handle, sidebar) {
        let isResizing = false;

        const handleMouseMove = (e) => {
            if (!isResizing) return;
            // Add constraints for min/max width
            let newWidth = e.clientX;
            if (newWidth < 150) newWidth = 150;
            if (newWidth > 500) newWidth = 500;
            
            sidebar.style.width = `${newWidth}px`;
            window.electronAPI.resizeSidebar(newWidth);
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Re-enable text selection
            document.body.style.userSelect = '';
        };

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault(); // Prevent text selection
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            // Disable text selection during resize
            document.body.style.userSelect = 'none';
        });
    }
    
    async initTheme() {
        await this.applyTheme(); // Apply theme on initial load

        window.electronAPI.onSetDraggable(isDraggable => {
            const titleBar = document.getElementById('title-bar');
            titleBar.classList.toggle('draggable', isDraggable);
        });
    }

    async applyTheme() {
        // Ask main process what the effective theme is
        const isDarkMode = await window.electronAPI.isDarkMode();
        document.body.classList.toggle('dark-theme', isDarkMode);
        document.body.classList.toggle('light-theme', !isDarkMode);
    }
}

new App();