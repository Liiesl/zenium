// sidebar.js
import { viewApi } from './viewApi.js';
import { URLInput } from './urlInput/index.js';

export class Sidebar {
    constructor(settingsModal, initialSettings) {
        this.activeTabId = null;
        this.tabsList = null;
        this.pinnedTabsList = null;
        this.essentialTabsList = null;
        this.urlInput = new URLInput();
        this.settingsModal = settingsModal;
        this.settings = initialSettings || {};
        this.draggedTab = null;

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
        viewApi.onTabRestored(({ tabId, title, url }) => {
            this.updateTabTitle(tabId, title);
            if (tabId === this.activeTabId) {
                this.urlInput.updateURL(url);
            }
        });
        viewApi.onTabUnloaded((tabId) => {
            const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
            if (tabElement) {
                tabElement.classList.add('unloaded');
                // --- KEY CHANGE: Update button for persistent tabs ---
                const isPersistent = tabElement.closest('#pinned-tabs-list, #essential-tabs-list');
                if (isPersistent) {
                    const button = tabElement.querySelector('button');
                    if (button) {
                        button.textContent = 'x';
                        button.dataset.action = 'close';
                        button.className = 'close-tab-btn';
                    }
                }
            }
        });

        viewApi.onTabLoaded((tabId) => {
            const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
            if (tabElement) {
                tabElement.classList.remove('unloaded');
                // --- KEY CHANGE: Update button for persistent tabs ---
                const isPersistent = tabElement.closest('#pinned-tabs-list, #essential-tabs-list');
                if (isPersistent) {
                    const button = tabElement.querySelector('button');
                    if (button) {
                        button.textContent = '-';
                        button.dataset.action = 'unload';
                        button.className = 'unload-tab-btn';
                    }
                }
            }
        });

        viewApi.onSettingUpdated(({ key, value }) => {
            if (this.settings && typeof this.settings === 'object') {
                this.settings[key] = value;
            }
        });
        window.electronAPI.onGetTabOrder(() => {
            const tabOrder = Array.from(this.tabsList.querySelectorAll('.tab')).map(t => t.dataset.tabId);
            window.electronAPI.sendTabOrder(tabOrder);
        });
        window.electronAPI.onGetTabStates(() => {
            const states = {};
            this.essentialTabsList.querySelectorAll('.tab').forEach(t => states[t.dataset.tabId] = 'essential');
            this.pinnedTabsList.querySelectorAll('.tab').forEach(t => states[t.dataset.tabId] = 'pinned');
            this.tabsList.querySelectorAll('.tab').forEach(t => states[t.dataset.tabId] = 'regular');
            window.electronAPI.sendTabStates(states);
        });
    }

    updateTabFavicon(tabId, faviconUrl) {
        const faviconElement = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-favicon`);
        if (faviconElement) {
            faviconElement.src = faviconUrl || '';
            faviconElement.style.display = faviconUrl ? 'inline' : 'none';
        }
    }

    updateTabTitle(tabId, title) {
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
        if (tabElement) {
            tabElement.textContent = title;
            tabElement.title = title;
            if (tabId === this.activeTabId) {
                document.title = `${title} - ZenIUM`;
            }
        }
    }

    // --- KEY CHANGE: Create unload or close button based on tab type and state ---
    _createTabElement(tabId, title = 'New Tab', faviconUrl = null, type = 'regular', isUnloaded = false) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.draggable = true;
        
        const faviconDisplay = faviconUrl ? 'inline' : 'none';
        const faviconSrc = faviconUrl || '';

        let buttonAction = 'close';
        let buttonIcon = 'x';
        let buttonClass = 'close-tab-btn';

        const isPersistent = type === 'pinned' || type === 'essential';
        if (isPersistent && !isUnloaded) {
            buttonAction = 'unload';
            buttonIcon = '-';
            buttonClass = 'unload-tab-btn';
        }

        tabElement.innerHTML = `
            <img class="tab-favicon" src="${faviconSrc}" style="display: ${faviconDisplay};" />
            <span class="tab-title">${title}</span>
            <button class="${buttonClass}" data-action="${buttonAction}">${buttonIcon}</button>
        `;

        const actionBtn = tabElement.querySelector('button');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            if (action === 'close') {
                this.closeTab(tabId);
            } else if (action === 'unload') {
                this.unloadTab(tabId);
            }
        });

        tabElement.addEventListener('click', () => {
            this.switchTab(tabId);
        });

        tabElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTabContextMenu(e, tabId);
        });

        tabElement.addEventListener('dragstart', () => {
            this.draggedTab = tabElement;
            tabElement.classList.add('dragging');
        });

        tabElement.addEventListener('dragend', () => {
            this.draggedTab.classList.remove('dragging');
            this.draggedTab = null;
        });

        return tabElement;
    }

    // --- FIX: Modified to accept an optional URL for creating tabs from links ---
    createTab(initialUrl) {
        const tabId = `tab-${Date.now()}`;
        const tabElement = this._createTabElement(tabId);
        this.tabsList.appendChild(tabElement);
        
        let url = initialUrl || this.settings?.newTabUrl || 'zenium://newtab';
        
        if (url === 'zenium://newtab') {
            url = `zenium://newtab?tabId=${tabId}`;
        }

        viewApi.newTab(tabId, url);
        this.switchTab(tabId);
    }
    
    createRestoredTab({ tabId, url, history, type = 'regular', faviconUrl }) {
        const initialTitle = history?.entries[history.index]?.title || 'Loading...';
        // --- KEY CHANGE: Pass tab type and loaded state to element creator ---
        const tabElement = this._createTabElement(tabId, initialTitle, faviconUrl, type, false);
        
        switch (type) {
            case 'essential':
                this.essentialTabsList.appendChild(tabElement);
                break;
            case 'pinned':
                this.pinnedTabsList.appendChild(tabElement);
                break;
            default:
                this.tabsList.appendChild(tabElement);
                break;
        }

        viewApi.restoreTab(tabId, url, history);
    }

    createUnloadedTab({ tabId, title, type = 'regular', faviconUrl }) {
        // --- KEY CHANGE: Pass tab type and unloaded state to element creator ---
        const tabElement = this._createTabElement(tabId, title, faviconUrl, type, true);
        tabElement.classList.add('unloaded');
        
        switch (type) {
            case 'essential':
                this.essentialTabsList.appendChild(tabElement);
                break;
            case 'pinned':
                this.pinnedTabsList.appendChild(tabElement);
                break;
            default:
                this.tabsList.appendChild(tabElement);
        }
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
                <li class="context-menu-item" id="unload-action">Unload Tab</li>
                <li class="context-menu-item" id="close-action">Close Tab</li>
            </ul>
            <script>
                document.getElementById('close-action').addEventListener('click', () => {
                    window.modalAPI.sendAction({ type: 'close-tab', tabId: '${tabId}' });
                    window.modalAPI.close();
                });
                 document.getElementById('unload-action').addEventListener('click', () => {
                    window.modalAPI.unloadTab('${tabId}');
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
            height: 75
        });
    }

    switchTab(tabId) {
        if (this.activeTabId) {
            const oldTab = document.querySelector(`.tab.active`);
            if (oldTab) oldTab.classList.remove('active');
        }
        const newTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (newTab) {
            newTab.classList.add('active');
            this.activeTabId = tabId;
            document.title = `${newTab.querySelector('.tab-title').textContent} - ZenIUM`;
            this.urlInput.setActiveTabId(tabId);
            viewApi.switchTab(tabId);
        }
    }

    // --- KEY CHANGE: Add unloadTab method ---
    unloadTab(tabId) {
        viewApi.unloadTab(tabId);
    }

    closeTab(tabId) {
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
            viewApi.closeTab(tabId);
            if (this.activeTabId === tabId) {
                const nextTab = document.querySelector('.tab');
                if (nextTab) {
                    this.switchTab(nextTab.dataset.tabId);
                } else {
                    this.activeTabId = null;
                    document.title = 'ZenIUM';
                }
            }
        }
    }

    render() {
        const sidebarContainer = document.createElement('div');
        sidebarContainer.className = 'tabs-container';

        // --- FIX: Build the static HTML structure first with a placeholder ---
        sidebarContainer.innerHTML = `
            <div id="navigation-placeholder"></div>
            <div id="essential-tabs-list"></div>
            <div id="pinned-tabs-list"></div>
            <div class="divider"></div>
            <button id="omnibox-placeholder-btn">+ New Tab</button>
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
        
        // --- FIX: Get the placeholder and append the URLInput's DOM safely ---
        const navigationPlaceholder = sidebarContainer.querySelector('#navigation-placeholder');
        navigationPlaceholder.appendChild(this.urlInput.render());

        this.tabsList = sidebarContainer.querySelector('#tabs-list');
        this.pinnedTabsList = sidebarContainer.querySelector('#pinned-tabs-list');
        this.essentialTabsList = sidebarContainer.querySelector('#essential-tabs-list');

        [this.tabsList, this.pinnedTabsList, this.essentialTabsList].forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = this.getDragAfterElement(list, e.clientY);
                if (afterElement == null) {
                    list.appendChild(this.draggedTab);
                } else {
                    list.insertBefore(this.draggedTab, afterElement);
                }
            });
        });
        sidebarContainer.querySelector('#new-tab-btn').addEventListener('click', () => this.createTab());
        sidebarContainer.querySelector('#settings-btn').addEventListener('click', () => this.settingsModal.open());
        return sidebarContainer;
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.tab:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}