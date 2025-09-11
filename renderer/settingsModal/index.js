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
                        <li class="settings-category active" data-page="appearance-page">Appearance</li>
                        <!-- Add more categories here, e.g., <li class="settings-category" data-page="about-page">About</li> -->
                    </ul>
                </div>
                <div id="settings-main">
                    <!-- Appearance Page -->
                    <div id="appearance-page" class="settings-page active">
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
                    <!-- Add more pages here, matching the data-page attribute above -->
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
        });
    }

    close() {
        viewApi.closeModal(this.modalId);
    }
}