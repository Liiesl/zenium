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
                        <li class="settings-category" data-page="updates-page">Updates</li>
                        <li class="settings-category" data-page="developer-page">Developer</li>
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
                    <!-- Updates Page -->
                    <div id="updates-page" class="settings-page">
                        <h2>Application Updates</h2>
                        <div class="setting-item">
                           <button id="check-update-btn">Check for Updates</button>
                           <div id="update-status-message"></div>
                           <div id="update-info-container" class="hidden">
                                <p>A new version is available!</p>
                                <ul>
                                    <li><strong>Version:</strong> <span id="update-version"></span></li>
                                    <li><strong>Size:</strong> <span id="update-size"></span></li>
                                </ul>
                                <button id="download-update-btn">Download Update</button>
                           </div>
                           <div id="download-progress-container" class="hidden"></div>
                           <button id="install-relaunch-btn" class="hidden">Restart and Install Update</button>
                        </div>
                    </div>
                    <!-- Developer Page -->
                    <div id="developer-page" class="settings-page">
                        <h2>Developer Tools</h2>
                        <div class="setting-item">
                            <h4>Main Window DevTools</h4>
                            <p>Access the developer tools for the main application window.</p>
                            <button id="open-main-devtools-btn">Open Main DevTools</button>
                        </div>
                        <div class="setting-item">
                            <h4>Open DevTools on Startup</h4>
                            <p>Automatically open the main window's developer tools when the application starts.</p>
                            <label class="checkbox-label">
                                <input type="checkbox" id="dev-open-on-startup-checkbox">
                                <span>Enable</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <h4>Debug Modals</h4>
                            <p>For all modals: disable auto-close on blur and open their DevTools automatically.</p>
                            <label class="checkbox-label">
                                <input type="checkbox" id="dev-debug-modals-checkbox">
                                <span>Enable</span>
                            </label>
                        </div>
                        <!-- NEW: Reset Modals Button -->
                        <div class="setting-item">
                            <h4>Reset All Modals</h4>
                            <p>Close all open modal dialogs and their DevTools.</p>
                            <button id="reset-all-modals-btn">Close All Modals</button>
                        </div>
                    </div>
                <button id="close-modal-btn" class="close-modal-btn">&times;</button>
                </div>
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