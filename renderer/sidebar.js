import { viewApi } from './viewApi.js';
import { URLInput } from './urlInput/index.js'; // Import the new URLInput

export class Sidebar {
    constructor(settingsModal, initialSettings) {
        this.activeTabId = null;
        this.tabsList = null;
        this.urlInput = new URLInput(); // Instantiate the new URLInput
        this.settingsModal = settingsModal;
        this.settings = initialSettings || {};

        viewApi.onUpdateTitle(({ tabId, title }) => {
            this.updateTabTitle(tabId, title);
        });

        viewApi.onFaviconUpdated(({ tabId, faviconUrl }) => {
            this.updateTabFavicon(tabId, faviconUrl);
        });

        viewApi.onURLUpdated(({ tabId, url }) => {
            if (tabId === this.activeTabId) {
                this.urlInput.updateURL(url);
            }
        });

        // Listen for live setting updates
        viewApi.onSettingUpdated(({ key, value }) => {
            if (this.settings && typeof this.settings === 'object') {
                this.settings[key] = value;
            }
        });
    }

    updateTabFavicon(tabId, faviconUrl) {
        const faviconElement = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-favicon`);
        if (faviconElement) {
            faviconElement.src = faviconUrl;
            faviconElement.style.display = 'inline';
        }
    }

    updateTabTitle(tabId, title) {
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
        if (tabElement) {
            tabElement.textContent = title;
            tabElement.title = title;
        }
    }

    createTab() {
        const tabId = `tab-${Date.now()}`;
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.innerHTML = `
            <img class="tab-favicon" src="" style="display: none;" />
            <span class="tab-title">New Tab</span>
            <button class="close-tab-btn">x</button>
        `;
        this.tabsList.appendChild(tabElement);

        const closeBtn = tabElement.querySelector('.close-tab-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });

        tabElement.addEventListener('click', () => {
            this.switchTab(tabId);
        });

        // Add context menu listener to the tab
        tabElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTabContextMenu(e, tabId);
        });
        
        const url = this.settings?.newTabUrl || 'https://www.google.com';
        viewApi.newTab(tabId, url);
        this.switchTab(tabId);
    }

    showTabContextMenu(event, tabId) {
        const modalId = `context-menu-${tabId}`;
        const menuContent = `
            <style>
                .context-menu {
                    list-style: none;
                    margin: 0;
                    padding: 8px 0;
                    background-color: var(--background-color);
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .context-menu-item {
                    padding: 8px 16px;
                    font-size: 14px;
                    cursor: pointer;
                }
                .context-menu-item:hover {
                    background-color: var(--hover-color);
                }
            </style>
            <ul class="context-menu">
                <li class="context-menu-item" id="close-action">Close Tab</li>
            </ul>
            <script>
                document.getElementById('close-action').addEventListener('click', () => {
                    // Send action to the main renderer via main process
                    window.modalAPI.sendAction({ type: 'close-tab', tabId: '${tabId}' });
                    // Close the context menu itself
                    window.modalAPI.close();
                });
            </script>
        `;

        viewApi.showModal({
            id: modalId,
            content: menuContent,
            x: event.clientX,
            y: event.clientY,
            width: 150,
            height: 45
        });
    }

    switchTab(tabId) {
        if (this.activeTabId) {
            const oldActiveTab = document.querySelector(`.tab[data-tab-id="${this.activeTabId}"]`);
            if (oldActiveTab) {
                oldActiveTab.classList.remove('active');
            }
        }
        const newActiveTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (newActiveTab) {
            newActiveTab.classList.add('active');
            this.activeTabId = tabId;
            this.urlInput.setActiveTabId(tabId); // Inform the URLInput of the active tab
            viewApi.switchTab(tabId);
        }
    }

    closeTab(tabId) {
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabElement) {
            this.tabsList.removeChild(tabElement);
            viewApi.closeTab(tabId);
            if (this.activeTabId === tabId) {
                const firstTab = document.querySelector('.tab');
                if (firstTab) {
                    this.switchTab(firstTab.dataset.tabId);
                } else {
                    this.activeTabId = null;
                }
            }
        }
    }

    render() {
        const sidebarContainer = document.createElement('div');
        sidebarContainer.className = 'tabs-container';
        
        const urlInputContainer = this.urlInput.render();

        sidebarContainer.innerHTML = `
            <div id="tabs-list"></div>
            <div class="sidebar-footer">
                <button id="new-tab-btn">
                    <svg viewBox="0 0 16 16"><path d="M15,7H9V1c0-0.6-0.4-1-1-1S7,0.4,7,1v6H1C0.4,7,0,7.4,0,8s0.4,1,1,1h6v6c0,0.6,0.4,1,1,1s1-0.4,1-1V9h6c0.6,0,1-0.4,1-1 S15.6,7,15,7z"></path></svg>
                </button>
                <button id="settings-btn">
                    <svg viewBox="0 0 16 16"><path d="M15.5,8c0,0.2-0.1,0.4-0.2,0.6l-2,1.2c-0.1,0-0.1,0.1-0.2,0.1c-0.1,0.2-0.2,0.5-0.3,0.7c0,0.1,0,0.2,0.1,0.3 l0.8,2.2c0.1,0.2,0,0.5-0.1,0.7s-0.4,0.3-0.6,0.2l-2.1-1c-0.1,0-0.2-0.1-0.3-0.1c-0.2,0.1-0.5,0.2-0.7,0.3c-0.1,0-0.2,0-0.3,0.1 l-1.2,2c-0.2,0.2-0.4,0.3-0.6,0.3s-0.4-0.1-0.6-0.2l-1.2-2c-0.1-0.1-0.2-0.1-0.3-0.1c-0.2-0.1-0.5-0.2-0.7-0.3 c-0.1,0-0.2,0-0.3,0.1l-2.1,1c-0.2,0.1-0.5,0.1-0.7-0.1c-0.1-0.2-0.2-0.4-0.1-0.7l0.8-2.2c0-0.1,0-0.2-0.1-0.3 c-0.1-0.2-0.2-0.5-0.3-0.7c0-0.1,0-0.1-0.1-0.2l-2-1.2C0.1,8.4,0,8.2,0,8s0.1-0.4,0.2-0.6l2-1.2c0.1,0,0.1-0.1,0.2-0.1 c0.1-0.2,0.2-0.5,0.3-0.7c0-0.1,0-0.2-0.1-0.3L1.9,3c-0.1-0.2,0-0.5,0.1-0.7s0.4-0.3,0.6-0.2l2.1,1c0.1,0,0.2,0.1,0.3,0.1 c0.2-0.1,0.5-0.2,0.7-0.3c0.1,0,0.2,0,0.3-0.1l1.2-2C7.4,0.1,7.6,0,7.8,0s0.4,0.1,0.6,0.2l1.2,2c0.1,0.1,0.2,0.1,0.3,0.1 c0.2,0.1,0.5,0.2,0.7,0.3c0.1,0,0.2,0,0.3-0.1l2.1-1c0.2-0.1,0.5-0.1,0.7,0.1c0.1,0.2,0.2,0.4,0.1,0.7L14,5.1 c0,0.1,0,0.2,0.1,0.3c0.1,0.2,0.2,0.5,0.3,0.7c0,0.1,0,0.1,0.1,0.2l2,1.2C15.4,7.6,15.5,7.8,15.5,8z M8,5.5 C6.6,5.5,5.5,6.6,5.5,8S6.6,10.5,8,10.5S10.5,9.4,10.5,8S9.4,5.5,8,5.5z"></path></svg>
                </button>
            </div>
        `;
        
        sidebarContainer.prepend(urlInputContainer);

        this.tabsList = sidebarContainer.querySelector('#tabs-list');
        const newTabBtn = sidebarContainer.querySelector('#new-tab-btn');
        const settingsBtn = sidebarContainer.querySelector('#settings-btn');
        
        newTabBtn.addEventListener('click', () => this.createTab());
        settingsBtn.addEventListener('click', () => this.settingsModal.open());

        // this.createTab(); // <- REMOVE THIS LINE
        
        return sidebarContainer;
    }
}