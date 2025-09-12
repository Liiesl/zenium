// renderer/urlInput/urlInputModal.js

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('modal-url-input');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const modalContainer = document.getElementById('modal-container');

    const activeTabId = modalContainer.dataset.activeTabId;

    let debounceTimer;
    let activeSuggestionIndex = -1;

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
            url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }

        window.modalAPI.sendAction({ type: 'navigate-to-url', url: url, tabId: activeTabId });
        window.modalAPI.close();
    }

    function renderSuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        if (suggestions.length > 0) {
            suggestionsContainer.style.borderTop = '1px solid var(--border-color)';
            suggestionsContainer.style.paddingTop = '10px';
        } else {
            suggestionsContainer.style.borderTop = 'none';
            suggestionsContainer.style.paddingTop = '0';
        }

        suggestions.forEach((suggestion) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                navigateTo(suggestion);
            });
            suggestionsContainer.appendChild(item);
        });
    }
    
    function updateActiveSuggestion(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === activeSuggestionIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

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

    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const newHeight = entry.target.scrollHeight;
            window.modalAPI.resize({ height: newHeight });
        }
    });
    
    ro.observe(modalContainer);

    input.focus();
    input.select();
});