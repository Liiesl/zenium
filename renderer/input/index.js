// renderer/titlebar/index.js

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
            <style>
                body {
                    overflow: visible !important;
                }
                #modal-container {
                    display: flex;
                    flex-direction: column;
                    background-color: var(--background-color);
                }
                #modal-url-input {
                    width: 100%;
                    padding: 12px;
                    font-size: 16px;
                    border: 1px solid var(--border-color);
                    background-color: var(--bachground-color);
                    color: var(--text-color);
                    border-radius: 8px;
                    box-sizing: border-box;
                    outline: none;
                    margin-bottom: 10px;
                }
                 #modal-url-input:focus {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
                }
                #suggestions-container {
                    color: var(--text-color);
                    max-height: 300px;
                    overflow-y: auto;
                    padding-top: 0;
                }
                .suggestion-item {
                    padding: 10px 12px;
                    cursor: pointer;
                    font-size: 15px;
                    border-radius: 6px;
                }
                .suggestion-item:hover {
                    background-color: var(--hover-color);
                }
                .suggestion-item.active {
                    background-color: var(--accent-color);
                    color: white;
                }
            </style>
            <div id="modal-container">
                <input type="text" id="modal-url-input" value="${this.fullUrl}" placeholder="Search or enter a URL" />
                <div id="suggestions-container">
                    <!-- Suggestions will be populated here -->
                </div>
            </div>
            <script>
                const input = document.getElementById('modal-url-input');
                const suggestionsContainer = document.getElementById('suggestions-container');
                
                // --- FIX: Get a reference to the container ---
                const modalContainer = document.getElementById('modal-container');

                let debounceTimer;
                let activeSuggestionIndex = -1;

                // --- Main Navigation Logic ---
                function navigateTo(query) {
                    if (!query) return;
                    let url;
                    
                    const isLikelyUrl = (query.includes('.') && !query.includes(' ')) || query.startsWith('localhost') || query.startsWith('127.0.0.1');

                    if (isLikelyUrl) {
                        const isLocal = query.startsWith('localhost') || query.startsWith('127.0.0.1');
                        if (!query.startsWith('http://') && !query.startsWith('https://')) {
                            url = (isLocal ? 'http://' : 'https://') + query;
                        } else {
                            url = query;
                        }
                    } else {
                        url = \`https://www.google.com/search?q=\${encodeURIComponent(query)}\`;
                    }

                    window.modalAPI.sendAction({ type: 'navigate-to-url', url: url, tabId: '${this.activeTabId}' });
                    window.modalAPI.close();
                }

                // --- Render suggestions in the UI ---
                function renderSuggestions(suggestions) {
                    suggestionsContainer.innerHTML = '';
                    if (suggestions.length > 0) {
                        suggestionsContainer.style.borderTop = '1px solid var(--border-color)';
                        suggestionsContainer.style.paddingTop = '10px';
                    } else {
                        suggestionsContainer.style.borderTop = 'none';
                        suggestionsContainer.style.paddingTop = '0';
                    }

                    suggestions.forEach((suggestion, index) => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.textContent = suggestion;
                        item.addEventListener('click', () => {
                            navigateTo(suggestion);
                        });
                        suggestionsContainer.appendChild(item);
                    });
                }
                
                // --- Update the highlighted suggestion ---
                function updateActiveSuggestion(suggestions) {
                    suggestions.forEach((item, index) => {
                        if (index === activeSuggestionIndex) {
                            item.classList.add('active');
                        } else {
                            item.classList.remove('active');
                        }
                    });
                }

                // --- Event Listeners ---
                input.addEventListener('keydown', (e) => {
                    const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
                    if (suggestions.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (activeSuggestionIndex < suggestions.length - 1) {
                            activeSuggestionIndex++;
                            updateActiveSuggestion(suggestions);
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (activeSuggestionIndex >= 0) {
                            activeSuggestionIndex--;
                            updateActiveSuggestion(suggestions);
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const query = (activeSuggestionIndex > -1 && suggestions[activeSuggestionIndex])
                            ? suggestions[activeSuggestionIndex].textContent
                            : e.target.value.trim();
                        navigateTo(query);
                    } else if (e.key === 'Escape') {
                        window.modalAPI.close();
                    }
                });

                input.addEventListener('input', (e) => {
                    const query = e.target.value.trim();
                    activeSuggestionIndex = -1;

                    if (debounceTimer) clearTimeout(debounceTimer);

                    if (query.length === 0) {
                        renderSuggestions([]);
                        return;
                    }

                    debounceTimer = setTimeout(() => {
                        window.modalAPI.getSearchSuggestions(query)
                            .then(suggestions => {
                                renderSuggestions(suggestions);
                            })
                            .catch(error => {
                                console.error('Error fetching suggestions:', error);
                                renderSuggestions([]);
                            });
                    }, 150);
                });

                // --- Resizing Logic ---
                const ro = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        // The target is now modalContainer, so we get its scrollHeight
                        const newHeight = entry.target.scrollHeight;
                        console.log(\`[Modal Renderer] Container scrollHeight changed to: \${newHeight}. Sending 'resize-modal-self'.\`);
                        window.modalAPI.resize({ height: newHeight });
                    }
                });
                
                // --- FIX: Observe the container, not the body ---
                ro.observe(modalContainer);

                input.focus();
                input.select();
            </script>
        `;

        viewApi.showModal({
            id: modalId,
            content: modalContent,
            x: Math.round(displayRect.left),
            y: Math.round(displayRect.top),
            width: modalWidth,
            height: initialModalHeight,
        });
    }
}