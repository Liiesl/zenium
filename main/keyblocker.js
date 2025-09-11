// keyblocker.js

/**
 * Attaches a listener to the webContents to block specific keyboard shortcuts.
 * This prevents Electron's default behavior for actions like reloading,
 * allowing them to be handled by the browser instance within the BrowserView.
 *
 * @param {Electron.WebContents} webContents The webContents object to attach the listener to.
 */
function attachKeyBlocker(webContents) {
  webContents.on('before-input-event', (event, input) => {
    // A list of key combinations to block.
    // We're targeting browser-specific shortcuts that Electron might otherwise handle.
    const blockedShortcuts = [
      // Standard reload
      { control: true, key: 'r' },
      // Force reload
      { control: true, shift: true, key: 'r' },
      // Developer tools (F12 is handled per-view in main.js, but we can block others)
      { control: true, shift: true, key: 'i' },
      // Standard refresh button
      { key: 'F5' }
    ];

    // Normalize the input key to lowercase for consistent checking
    const normalizedKey = input.key.toLowerCase();

    // Check if the current input matches any of the blocked shortcuts
    for (const shortcut of blockedShortcuts) {
      // Check for modifier keys (Control, Shift, Alt)
      const controlMatch = shortcut.control ? input.control : !input.control;
      const shiftMatch = shortcut.shift ? input.shift : !input.shift;
      const altMatch = shortcut.alt ? input.alt : !input.alt;

      if (shortcut.key === normalizedKey && controlMatch && shiftMatch && altMatch) {
        // If it matches a blocked shortcut, prevent the default Electron action.
        // This allows the event to be passed to the renderer process (the BrowserView's web page).
        event.preventDefault();
        return; // Stop checking once a match is found
      }
    }
  });
}

module.exports = { attachKeyBlocker };