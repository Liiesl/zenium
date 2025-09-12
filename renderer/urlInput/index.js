// renderer/urlInput/index.js

import { viewApi } from '../viewApi.js';

export class URLInput {
    constructor() {
        this.fullUrl = '';
        this.urlDisplay = null;
        this.activeTabId = null; // We need to know which tab to navigate
    }

    render() {
        const navigation = document.createElement('div');
        navigation.className = 'navigation';

        this.urlDisplay = document.createElement('div');
        this.urlDisplay.id = 'url-display';
        this.urlDisplay.className = 'url-display'; // Add a class for styling
        this.urlDisplay.textContent = 'New Tab';

        navigation.appendChild(this.urlDisplay);

        this.urlDisplay.addEventListener('click', () => {
            this.showInputModal();
        });

        return navigation;
    }

    updateURL(url) {
        this.fullUrl = url;
        try {
            const urlObject = new URL(url);
            this.urlDisplay.textContent = urlObject.hostname;
        } catch (error) {
            this.urlDisplay.textContent = url;
        }
    }
    
    setActiveTabId(tabId) {
        this.activeTabId = tabId;
    }

    showInputModal() {
        if (!this.activeTabId) return;

        const modalId = 'url-input-modal';
        const displayRect = this.urlDisplay.getBoundingClientRect();

        const modalWidth = 600;
        const initialModalHeight = 50; 

        const modalContent = `
            <div id="modal-container" data-active-tab-id="${this.activeTabId}">
                <input type="text" id="modal-url-input" value="${this.fullUrl}" placeholder="Search or enter a URL" />
                <div id="suggestions-container">
                    <!-- Suggestions will be populated here -->
                </div>
            </div>
        `;

        viewApi.showModal({
            id: modalId,
            content: modalContent,
            x: Math.round(displayRect.left),
            y: Math.round(displayRect.top),
            width: modalWidth,
            height: initialModalHeight,
            cssPaths: ['../renderer/urlInput/urlInputModal.css'], // <-- PATH UPDATED
            jsPaths: ['../renderer/urlInput/urlInputModal.js'],   // <-- PATH UPDATED
            closeOnBlur: true,
        });
    }
}