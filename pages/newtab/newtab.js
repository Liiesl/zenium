// renderer/newtab.js
class NewTabPage {
    constructor() {
        this.tabId = null;
        this.searchForm = document.getElementById('search-form');
        this.searchInput = document.getElementById('search-input');
        this.suggestionsContainer = document.getElementById('suggestions-container');
        
        this.currentSuggestionIndex = -1; // -1 means no suggestion is selected
        this.originalQuery = '';

        this.init();
    }

    async init() {
        this.getTabIdFromUrl();
        this.applyTheme();
        this.addEventListeners();
    }
    
    getTabIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        this.tabId = urlParams.get('tabId');
    }

    addEventListeners() {
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch();
            });
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.handleInputChange());
            this.searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
            this.searchInput.addEventListener('blur', () => this.clearSuggestions());
        }
    }

    async handleInputChange() {
        const query = this.searchInput.value.trim();
        this.originalQuery = query;

        if (query.length === 0) {
            this.clearSuggestions();
            return;
        }

        // --- NEW: Ask main process for suggestions ---
        const suggestions = await window.electronAPI.getSearchSuggestions(query);
        this.renderSuggestions(suggestions);
    }

    renderSuggestions(suggestions) {
        this.clearSuggestions();
        if (suggestions.length === 0) return;

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.classList.add('suggestion-item');
            item.textContent = suggestion;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur event from firing before click
                this.searchInput.value = suggestion;
                this.handleSearch();
            });
            this.suggestionsContainer.appendChild(item);
        });

        this.suggestionsContainer.style.display = 'block';
        this.currentSuggestionIndex = -1;
    }

    clearSuggestions() {
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.style.display = 'none';
    }

    handleKeyDown(event) {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.currentSuggestionIndex = (this.currentSuggestionIndex + 1) % items.length;
            this.updateSelection(items);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.currentSuggestionIndex = (this.currentSuggestionIndex - 1 + items.length) % items.length;
            this.updateSelection(items);
        } else if (event.key === 'Escape') {
            this.searchInput.value = this.originalQuery;
            this.clearSuggestions();
        }
    }

    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.currentSuggestionIndex);
        });
        this.searchInput.value = items[this.currentSuggestionIndex].textContent;
    }

    handleSearch() {
        if (!this.tabId) {
            console.error("No active tab ID found.");
            return;
        }

        const query = this.searchInput.value.trim();
        if (!query) return;

        this.clearSuggestions();

        let url;
        try {
            new URL(query);
            url = query;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
        } catch (_) {
            url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }

        window.electronAPI.navigate(this.tabId, url);
    }
    
    async applyTheme() {
        const isDarkMode = await window.electronAPI.isDarkMode();
        document.body.classList.toggle('dark-theme', isDarkMode);
        document.body.classList.toggle('light-theme', !isDarkMode);
    }
}

new NewTabPage();