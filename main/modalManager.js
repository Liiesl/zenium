// main/modalManager.js

const { BrowserView } = require('electron');
const path = require('path');
const fs = require('fs');

// Read the global CSS file once when the module is loaded
const globalCSS = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf-8');


/**
 * Manages frameless, floating BrowserView instances (modals) on top of the main window.
 */
class ModalManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.modals = new Map(); // Stores modals by their user-defined ID
    }

    /**
     * Creates and displays a new modal view.
     * @param {object} options - Configuration for the modal.
     * @param {string} options.id - A unique identifier for the modal.
     * @param {string} options.content - The HTML content to be rendered in the modal.
     * @param {string[]} [options.cssPaths=[]] - Paths to CSS files, relative to the renderer directory.
     * @param {string[]} [options.jsPaths=[]] - Paths to JS files, relative to the renderer directory.
     * @param {number} options.x - The x-coordinate.
     * @param {number} options.y - The y-coordinate.
     * @param {number} options.width - The width of the modal.
     * @param {number} options.height - The height of the modal.
     */
    show(options) {
        if (this.modals.has(options.id)) {
            // Close existing modal with the same ID to prevent duplicates
            this.close(options.id);
        }

        const modalView = new BrowserView({
            webPreferences: {
                preload: path.join(__dirname, 'modalPreload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        this.mainWindow.addBrowserView(modalView);
        this.modals.set(options.id, modalView);

        // Make the background transparent
        modalView.setBackgroundColor('#00000000');

        // --- Read and inject external CSS files ---
        const cssStyles = (options.cssPaths || [])
            .map(relativePath => {
                try {
                    const absolutePath = path.join(__dirname, '..', 'renderer', relativePath);
                    const cssContent = fs.readFileSync(absolutePath, 'utf-8');
                    return `<style>${cssContent}</style>`;
                } catch (error) {
                    console.error(`Failed to read CSS file at ${relativePath}:`, error);
                    return '';
                }
            })
            .join('\n');
            
        // --- Read and inject external JS files ---
        const jsScripts = (options.jsPaths || [])
            .map(relativePath => {
                try {
                    const absolutePath = path.join(__dirname, '..', 'renderer', relativePath);
                    const jsContent = fs.readFileSync(absolutePath, 'utf-8');
                    // Use 'defer' to ensure the script runs after the document is parsed
                    return `<script defer>${jsContent}</script>`;
                } catch (error) {
                    console.error(`Failed to read JS file at ${relativePath}:`, error);
                    return '';
                }
            })
            .join('\n');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    /* --- Global Styles from styles.css --- */
                    ${globalCSS}
                </style>
                <style>
                    /* --- Modal Specific Overrides --- */
                    html, body {
                        background-color: transparent;
                        overflow: hidden;
                    }
                </style>
                ${cssStyles}
            </head>
            <body>
                ${options.content}
                ${jsScripts}
            </body>
            </html>
        `;
        
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        modalView.webContents.loadURL(dataUrl);

        // Position the modal relative to the main window's content area
        const [winX, winY] = this.mainWindow.getPosition();
        modalView.setBounds({
            x: options.x,
            y: options.y,
            width: options.width,
            height: options.height,
        });

        // Add a one-time listener to close the modal when it loses focus
        modalView.webContents.once('blur', () => {
            this.close(options.id);
        });
    }

    /**
     * Closes and destroys a modal view by its ID.
     * @param {string} id - The unique identifier of the modal to close.
     */
    close(id) {
        const modalView = this.modals.get(id);
        if (modalView) {
            this.mainWindow.removeBrowserView(modalView);
            modalView.webContents.destroy();
            this.modals.delete(id);
        }
    }
}

module.exports = { ModalManager };