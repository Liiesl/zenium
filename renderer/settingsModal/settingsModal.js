// renderer/settingsModal/settingsModal.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- Close Button ---
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        window.modalAPI.close();
    });

    // --- Load Initial Settings ---
    const settings = await window.modalAPI.getSettings();
    const currentTheme = settings.theme || 'system';
    const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }

    // --- Theme Change Listener ---
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const newTheme = event.target.value;
            // Use the new, specific API to set the setting
            window.modalAPI.setSetting('theme', newTheme);
        });
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