// main/settingsManager.js
const { app, ipcMain, nativeTheme, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.initIpc();
        this.applyTheme(); // Apply theme on startup
    }

    loadSettings() {
        const defaults = {
            theme: 'system',
            newTabUrl: 'https://www.google.com'
        };
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
                // Ensure defaults are applied if settings file is missing keys
                return { ...defaults, ...settings };
            }
        } catch (error) {
            console.error("Error loading settings, falling back to defaults:", error);
        }
        return defaults;
    }

    saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();

        // Special handling for theme changes
        if (key === 'theme') {
            this.applyTheme();
        }
        
        // Broadcast the change to all windows so they can react
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('setting-updated', { key, value });
        });
    }

    applyTheme() {
        const theme = this.settings.theme || 'system';
        nativeTheme.themeSource = theme;
    }

    initIpc() {
        ipcMain.handle('get-settings', () => {
            return this.settings;
        });

        ipcMain.on('set-setting', (event, { key, value }) => {
            this.setSetting(key, value);
        });

        // This allows the renderer to check what the effective theme is
        ipcMain.handle('is-dark-mode', () => {
            return nativeTheme.shouldUseDarkColors;
        });
    }
}

module.exports = { SettingsManager };