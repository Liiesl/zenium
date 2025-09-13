// pages/history/script.js
(async () => {
    const historyList = document.getElementById('history-list');
    const searchInput = document.getElementById('search');

    if (!window.pagesAPI) {
        console.error('pagesAPI is not available');
        historyList.innerHTML = '<p class="no-history">Could not load history.</p>';
        return;
    }

    const history = await window.pagesAPI.getHistory();
    console.log(history);

    const renderHistory = (searchTerm = '') => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredHistory = history.filter(item =>
            (item.title && item.title.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (item.url && item.url.toLowerCase().includes(lowerCaseSearchTerm))
        );

        if (filteredHistory.length === 0) {
            historyList.innerHTML = '<p class="no-history">No results found.</p>';
            return;
        }

        const groupedHistory = filteredHistory.reduce((groups, item) => {
            const date = new Date(item.timestamp).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(item);
            return groups;
        }, {});

        historyList.innerHTML = '';

        for (const date in groupedHistory) {
            const dateHeader = document.createElement('h2');
            dateHeader.className = 'date-header';
            dateHeader.textContent = date;
            historyList.appendChild(dateHeader);

            groupedHistory[date].forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';

                const time = new Date(item.timestamp).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                div.innerHTML = `
                    <a href="${item.url}" title="${item.url}">
                        <div class="item-details">
                            <div class="title">${item.title || 'No Title'}</div>
                            <div class="url">${item.url}</div>
                        </div>
                    </a>
                    <div class="item-timestamp">${time}</div>
                `;
                historyList.appendChild(div);
            });
        }
    };

    if (history.length === 0) {
        historyList.innerHTML = '<p class="no-history">No history yet.</p>';
    } else {
        renderHistory();
    }

    searchInput.addEventListener('input', (e) => {
        renderHistory(e.target.value);
    });
})();