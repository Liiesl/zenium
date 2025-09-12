// renderer/settingsModal/index.js
import { viewApi } from '../viewApi.js';

export class SettingsModal {
    constructor() {
        this.modalId = 'settings-modal';
    }

    open() {
        const modalContent = `
            <div class="modal-content" id="settings-modal-content">
                <div id="settings-sidebar">
                    <h3>Settings</h3>
                    <ul>
                        <li class="settings-category active" data-page="general-page">General</li>
                        <li class="settings-category" data-page="appearance-page">Appearance</li>
                    </ul>
                </div>
                <div id="settings-main">
                    <!-- General Page -->
                    <div id="general-page" class="settings-page active">
                        <h2>General</h2>
                        <div class="setting-item">
                            <h4>New Tab Page</h4>
                            <p>Set the page that loads when you open a new tab.</p>
                            <select id="new-tab-url-select">
                                <option value="zenium://newtab">Zenium New Tab</option>
                                <option value="custom">Custom URL</option>
                            </select>
                            <input type="text" id="new-tab-url-input" class="hidden" placeholder="e.g., https://www.google.com">
                        </div>
                    </div>
                    <!-- Appearance Page -->
                    <div id="appearance-page" class="settings-page">
                        <h2>Appearance</h2>
                        <div class="setting-item">
                            <h4>Theme</h4>
                            <p>Select your preferred theme for the application.</p>
                            <div class="theme-options">
                                <label><input type="radio" name="theme" value="light"> Light</label>
                                <label><input type="radio" name="theme" value="dark"> Dark</label>
                                <label><input type="radio" name="theme" value="system"> System</label>
                            </div>
                        </div>
                    </div>
                </div>
                <button id="close-modal-btn" class="close-modal-btn">&times;</button>
            </div>
        `;

        const width = 700;
        const height = 500;
        const x = Math.round((window.innerWidth - width) / 2);
        const y = Math.round((window.innerHeight - height) / 2);

        viewApi.showModal({
            id: this.modalId,
            content: modalContent,
            x, y, width, height,
            cssPaths: ['../renderer/settingsModal/settingsModal.css'],
            jsPaths: ['../renderer/settingsModal/settingsModal.js'],
            closeOnBlur: false, // Don't close when focus is lost
        });
    }

    close() {
        viewApi.closeModal(this.modalId);
    }
}