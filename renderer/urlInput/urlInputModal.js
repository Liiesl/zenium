// renderer/urlInput/urlInputModal.js

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('modal-url-input');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const modalContainer = document.getElementById('modal-container');

    const activeTabId = modalContainer.dataset.activeTabId;

    let debounceTimer;
    let activeSuggestionIndex = -1;

    function navigateTo(query) {
        console.log(`[navigateTo] Received query: "${query}"`); // <-- LOG 1: Raw input
        if (!query) {
            console.warn('[navigateTo] Query is empty. Aborting.');
            return;
        }
        let url;

        // Check 1: Does the query include a protocol handler '://'?
        if (query.includes('://')) {
            console.log('[navigateTo] Condition met: query includes "://". Treating as a full URL.'); // <-- LOG 2: Condition matched
            url = query;
        }
        // Check 2: Does it look like a local address?
        else if (query.startsWith('localhost') || query.startsWith('127.0.0.1')) {
            console.log('[navigateTo] Condition met: query looks like a local address.'); // <-- LOG 2: Condition matched
            url = 'http://' + query;
        }
        // Check 3: Does it look like a typical domain name (e.g., 'google.com')?
        else if (query.includes('.') && !query.includes(' ')) {
            console.log('[navigateTo] Condition met: query looks like a domain name.'); // <-- LOG 2: Condition matched
            url = 'https://' + query;
        }
        // Fallback: If none of the above, treat it as a search query.
        else {
            console.log('[navigateTo] Fallback: Treating as a search query.'); // <-- LOG 2: Condition matched
            url = `https://www.google.com/search?hl=en&gl=us&q=${encodeURIComponent(query)}`;
        }

        console.log(`[navigateTo] Final URL to be sent for navigation: "${url}"`); // <-- LOG 3: Final URL
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

        if (e.key === 'Enter') {
            e.preventDefault();
            const query = (activeSuggestionIndex > -1 && suggestions[activeSuggestionIndex])
                ? suggestions[activeSuggestionIndex].textContent
                : e.target.value.trim();
            navigateTo(query);
            return; 
        }

        if (suggestions.length === 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) return;
        
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