// main/modalManager.js

const { BrowserView } = require('electron');
const path = require('path');
const fs = require('fs');

// Read the global CSS file once when the module is loaded
const globalCSS = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf-8');


/**
 * @file Manages frameless, floating BrowserView instances (modals) on top of the main window.
 * @author [Your Name]
 *
 * @class ModalManager
 * @description Centralized handler for creating, showing, and destroying modal dialogs.
 * This manager uses Electron's `BrowserView` instead of `BrowserWindow` for modals.
 *
 * ### Best Practices & Architecture
 *
 * 1.  **Use of `BrowserView` over `BrowserWindow`**:
 *     - **Lightweight**: `BrowserView`s are lighter than creating a full new window, making them ideal for temporary dialogs like settings or prompts. They are attached to an existing window rather than creating a new native window.
 *     - **No Native Frame**: They are "frameless" by nature, allowing for fully custom-designed modals that match the application's theme.
 *     - **Parent-Child Relationship**: They are intrinsically tied to the `mainWindow`, ensuring they are always on top and managed within the main application's lifecycle.
 *
 * 2.  **Centralized Management**:
 *     - A single `ModalManager` instance (created in `main.js`) is responsible for all modals. This avoids scattered logic and provides a single source of truth for all active modals.
 *     - The `modals` Map stores active modals by a unique ID, allowing for easy access and management (e.g., closing a specific modal by its ID).
 *
 * 3.  **Secure Inter-Process Communication (IPC)**:
 *     - **Main Process Control**: All modal creation (`show`) and destruction (`close`) logic resides in the main process. The renderer process can only request these actions via IPC. This is a crucial security and stability pattern.
 *     - **Dedicated Preload Script**: Each modal `BrowserView` gets a specific `modalPreload.js`. This script uses `contextBridge` to securely expose a minimal, controlled API (`window.modalAPI`) to the modal's renderer context. This prevents the modal's content from having direct access to Node.js or Electron APIs.
 *     - **Specific IPC Channels**:
 *       - `show-modal`: Renderer requests the main process to create and show a modal.
 *       - `close-modal`: Renderer requests the main process to close a specific modal by ID.
 *       - `request-close-self-modal`: A modal's renderer can ask to be closed without knowing its own ID. The main process identifies the sender's `webContents` and closes the corresponding `BrowserView`. This is a clean, self-contained pattern.
 *       - `resize-modal-self`: A modal's renderer can request a resize based on its content, and the main process will adjust its `BrowserView` bounds.
 *       - `get-settings`/`set-setting`: Dedicated channels for settings, handled by the `SettingsManager`, but exposed to the modal via its preload script. This keeps concerns separated.
 *
 * 4.  **Dynamic Content Injection**:
 *     - The HTML, CSS, and JavaScript for a modal are passed as strings/paths in the `show` method options.
 *     - The `ModalManager` dynamically constructs a full HTML document and loads it into the `BrowserView` using a Data URL (`data:text/html;charset=utf-8,...`).
 *     - This approach is highly flexible, as it avoids the need for creating separate HTML files for every modal and allows for shared, global styles to be injected easily.
 *
 * 5.  **Lifecycle and Behavior**:
 *     - **Focus Management**: A `'blur'` event listener is attached to the modal's `webContents`. This common UX pattern automatically closes the modal if the user clicks outside of it, making for a less intrusive experience. This behavior can be disabled.
 *     - **Singleton IDs**: The manager ensures only one modal with a given ID can exist at a time by closing any pre-existing modal with the same ID before showing a new one.
 *
 * ### Example Flow: Opening a Settings Modal
 *
 * 1.  **Renderer (e.g., `index.js`)**: A user clicks a "Settings" button.
 * 2.  **Renderer**: The `SettingsModal.open()` method is called.
 * 3.  **Renderer**: Inside `open()`, it calls `viewApi.showModal({...})`, which sends an IPC message over the `'show-modal'` channel with all the necessary HTML content, CSS/JS paths, and dimensions.
 * 4.  **Main (`main.js`)**: The `ipcMain` listener for `'show-modal'` receives the request and calls `modalManager.show(options)`.
 * 5.  **Main (`modalManager.js`)**:
 *     - A new `BrowserView` is created.
 *     - Its preload script (`modalPreload.js`) is set.
 *     - The manager reads the global CSS and any specified CSS/JS files from the filesystem.
 *     - It constructs the full HTML string and loads it as a Data URL.
 *     - The `BrowserView` is attached to the `mainWindow` and its bounds are set.
 *     - A `'blur'` listener is attached (if not disabled).
 * 6.  **Modal Renderer (`settingsModal.js`)**:
 *     - The script runs. It can now use `window.modalAPI.getSettings()` or `window.modalAPI.close()` to securely communicate back with the main process.
 */
class ModalManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.modals = new Map(); // Stores modals by their user-defined ID
        this.modalIdByWebContentsId = new Map(); // Maps webContents.id to user-defined ID
    }

    /**
     * Creates and displays a new modal view.
     * @param {object} options - Configuration for the modal.
     * @param {string} options.id - A unique identifier for the modal.
     * @param {string} options.content - The HTML content to be rendered in the modal.
     * @param {boolean} [options.closeOnBlur=true] - If false, the modal will not close on focus loss.
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
        this.modalIdByWebContentsId.set(modalView.webContents.id, options.id);

        // Cleanup the map when the view is destroyed
        modalView.webContents.on('destroyed', () => {
            this.modalIdByWebContentsId.delete(modalView.webContents.id);
        });

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

        // Open DevTools for the modal for debugging
        // modalView.webContents.openDevTools({ mode: 'undocked' });

        // *** CHANGE: Wait for the modal content to load, then focus it ***
        modalView.webContents.on('did-finish-load', () => {
            modalView.webContents.focus();
        });

        // Add a one-time listener to close the modal when it loses focus, unless disabled.
        if (options.closeOnBlur !== false) {
            modalView.webContents.once('blur', () => {
                this.close(options.id);
            });
        }

    }

    /**
     * Resizes a modal view based on its webContents ID.
     * @param {number} webContentsId - The webContents ID of the modal view.
     * @param {object} dimensions - The new dimensions.
     * @param {number} dimensions.height - The new height.
     */
    resize(webContentsId, dimensions) {
        console.log(`[modalManager.js] resize() called for webContentsId: ${webContentsId}`);

        const id = this.modalIdByWebContentsId.get(webContentsId);
        if (!id) {
            console.error(`[modalManager.js] No modal ID found for webContentsId: ${webContentsId}`);
            return;
        }

        console.log(`[modalManager.js] Found modal ID: '${id}' for webContentsId: ${webContentsId}`);

        const modalView = this.modals.get(id);
        if (modalView) {
            const currentBounds = modalView.getBounds();
            console.log(`[modalManager.js] Current bounds for modal '${id}':`, currentBounds);

            const newBounds = {
                x: currentBounds.x,
                y: currentBounds.y,
                width: currentBounds.width,
                height: Math.round(dimensions.height), // Use the new height
            };

            console.log(`[modalManager.js] Setting new bounds for modal '${id}':`, newBounds);
            modalView.setBounds(newBounds);
            
            // This existing log confirms the final step
            console.log(`Resized modal ${id} to height: ${dimensions.height}`);
        } else {
            console.error(`[modalManager.js] Modal view with ID '${id}' not found in 'this.modals' map.`);
        }
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