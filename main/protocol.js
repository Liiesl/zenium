// protocol.js
const { protocol } = require('electron');
const path = require('path');

function registerZeniumProtocol() {
  protocol.registerFileProtocol('zenium', (request, callback) => {
    try {
      console.log(`[protocol.js] Handling request for URL: "${request.url}"`);

      // 1. Strip the protocol prefix 'zenium://'
      const urlPath = request.url.slice('zenium://'.length);

      // 2. Robustly handle query parameters that might be in the middle of the path.
      // This is necessary because relative asset paths can be appended after a query string.
      // Example: zenium://newtab?tabId=123/newtab.css -> should resolve to "newtab/newtab.css"
      let requestedPath;
      const queryIndex = urlPath.indexOf('?');

      if (queryIndex !== -1) {
        const pathBeforeQuery = urlPath.slice(0, queryIndex);
        const pathAfterQuery = urlPath.slice(queryIndex);
        const slashIndexInRemainder = pathAfterQuery.indexOf('/');
        
        if (slashIndexInRemainder !== -1) {
          // If a slash exists after the query, it's part of the path.
          requestedPath = path.join(pathBeforeQuery, pathAfterQuery.slice(slashIndexInRemainder));
        } else {
          // No slash, so the path is just what came before the query.
          requestedPath = pathBeforeQuery;
        }
      } else {
        // No query parameter, the whole string is the path.
        requestedPath = urlPath;
      }

      // 3. If the resolved path has no file extension (e.g., "newtab", "settings"),
      //    assume it's a directory and append '/index.html'.
      if (!path.extname(requestedPath)) {
        requestedPath = path.join(requestedPath, 'index.html');
      }

      // 4. Construct the full, absolute file path to the resource.
      const pagesRoot = path.join(__dirname, '..', 'pages');
      const finalPath = path.normalize(path.join(pagesRoot, requestedPath));
      
      console.log(`[protocol.js] Resolved to absolute path: "${finalPath}"`);

      // 5. Security Check: Ensure the resolved path is still within the 'pages' directory
      //    to prevent directory traversal attacks.
      if (!finalPath.startsWith(pagesRoot)) {
        console.error(`[protocol.js] Security violation: Attempted to access path outside of pages directory: "${finalPath}"`);
        callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        return;
      }
      
      const response = { path: finalPath };
      console.log('[protocol.js] Successfully generated response:', response);
      callback(response);

    } catch (e) {
      console.error("[protocol.js] Failed to handle zenium protocol request:", e, request.url);
      const errorResponse = { error: -3 }; // net::ERR_ABORTED
      console.log('[protocol.js] Responding with error:', errorResponse);
      callback(errorResponse);
    }
  });
}

module.exports = { registerZeniumProtocol };