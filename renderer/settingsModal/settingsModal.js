// renderer/settingsModal/settingsModal.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- Close Button ---
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        window.modalAPI.close();
    });

    // --- DOM Element References ---
    const newTabUrlSelect = document.getElementById('new-tab-url-select');
    const newTabUrlInput = document.getElementById('new-tab-url-input');
    const checkUpdateBtn = document.getElementById('check-update-btn');
    const updateStatusMsg = document.getElementById('update-status-message');
    const updateInfoContainer = document.getElementById('update-info-container');
    const downloadUpdateBtn = document.getElementById('download-update-btn');
    const installRelaunchBtn = document.getElementById('install-relaunch-btn');
    const downloadProgressContainer = document.getElementById('download-progress-container');

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

    // --- Update Logic ---
    const resetUpdateUI = () => {
        checkUpdateBtn.disabled = false;
        updateStatusMsg.textContent = '';
        updateInfoContainer.classList.add('hidden');
        downloadProgressContainer.classList.add('hidden');
        downloadProgressContainer.innerHTML = '';
        installRelaunchBtn.classList.add('hidden');
        downloadUpdateBtn.classList.remove('hidden');
    };

    checkUpdateBtn.addEventListener('click', () => {
        resetUpdateUI();
        checkUpdateBtn.disabled = true;
        updateStatusMsg.textContent = 'Checking for updates...';
        window.modalAPI.checkForUpdate();
    });

    downloadUpdateBtn.addEventListener('click', () => {
        updateStatusMsg.textContent = 'Downloading update...';
        updateInfoContainer.classList.add('hidden');
        downloadProgressContainer.classList.remove('hidden');
        downloadProgressContainer.innerHTML = '<p>Starting download...</p>';
        window.modalAPI.startDownload();
    });

    installRelaunchBtn.addEventListener('click', () => {
        window.modalAPI.quitAndInstall();
    });

    window.modalAPI.onUpdateInfoAvailable(({ version, size }) => {
        checkUpdateBtn.disabled = false;
        updateStatusMsg.textContent = 'An update is available.';
        document.getElementById('update-version').textContent = version;
        document.getElementById('update-size').textContent = size;
        updateInfoContainer.classList.remove('hidden');
    });

    window.modalAPI.onUpdateNotAvailable(() => {
        checkUpdateBtn.disabled = false;
        updateStatusMsg.textContent = 'You are using the latest version.';
    });

    window.modalAPI.onUpdateDownloadProgress((progress) => {
        updateStatusMsg.textContent = 'Downloading update...';
        const percent = Math.round(progress.percent);
        const speed = progress.bytesPerSecond > 0 ? `${(progress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s` : '';
        downloadProgressContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <span>Downloaded ${percent}%</span>
                <span style="color: var(--subtle-text-color);">${speed}</span>
            </div>
            <progress value="${percent}" max="100"></progress>
        `;
    });

    window.modalAPI.onUpdateDownloadComplete(() => {
        // --- KEY CHANGE: Update messaging for deferred install ---
        updateStatusMsg.textContent = 'Update downloaded. It will be installed when you restart the application.';
        downloadProgressContainer.classList.add('hidden');
        installRelaunchBtn.classList.remove('hidden');
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