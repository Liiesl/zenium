// renderer/settingsModal/settingsModal.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- Close Button ---
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        window.modalAPI.close();
    });

    // --- DOM Element References ---
    const newTabUrlSelect = document.getElementById('new-tab-url-select');
    const newTabUrlInput = document.getElementById('new-tab-url-input');

    // --- Load Initial Settings ---
    const settings = await window.modalAPI.getSettings();

    // Theme
    const currentTheme = settings.theme || 'system';
    const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }

    // New Tab URL
    const currentNewUrl = settings.newTabUrl || 'zenium://newtab';
    if (currentNewUrl === 'zenium://newtab') {
        newTabUrlSelect.value = 'zenium://newtab';
        newTabUrlInput.classList.add('hidden');
    } else {
        newTabUrlSelect.value = 'custom';
        newTabUrlInput.value = currentNewUrl;
        newTabUrlInput.classList.remove('hidden');
    }

    // --- Setting Change Listeners ---
    // Theme
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const newTheme = event.target.value;
            window.modalAPI.setSetting('theme', newTheme);
        });
    });

    // New Tab URL
    newTabUrlSelect.addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        if (selectedValue === 'zenium://newtab') {
            newTabUrlInput.classList.add('hidden');
            window.modalAPI.setSetting('newTabUrl', 'zenium://newtab');
        } else {
            // It's 'custom'
            newTabUrlInput.classList.remove('hidden');
            window.modalAPI.setSetting('newTabUrl', newTabUrlInput.value);
        }
    });

    newTabUrlInput.addEventListener('input', (event) => {
        if (newTabUrlSelect.value === 'custom') {
            window.modalAPI.setSetting('newTabUrl', event.target.value);
        }
    });

    // --- Category Switching Logic ---
    const categories = document.querySelectorAll('.settings-category');
    const pages = document.querySelectorAll('.settings-page');

    categories.forEach(category => {
        category.addEventListener('click', () => {
            const pageId = category.dataset.page;

            // Update active state on category list
            categories.forEach(c => c.classList.remove('active'));
            category.classList.add('active');

            // Show the correct page
            pages.forEach(p => {
                p.classList.toggle('active', p.id === pageId);
            });
        });
    });
});