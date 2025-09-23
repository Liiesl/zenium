// main/zntp-protocol.js
const { protocol } = require('electron');

function registerZntpProtocol(zntpManager) {
  protocol.registerHttpProtocol('zntp', (request, callback) => {
    try {
      const url = new URL(request.url);
      // The port from the zntp URL is ignored. We only use the hostname.
      const { hostname, pathname, search } = url;

      // SECURITY: Find the registered site configuration by its hostname (FQDN).
      const site = zntpManager.findSiteByFqdn(hostname);

      if (!site) {
        console.error(`[zntp-protocol] SECURITY VIOLATION: Denied request for unregistered zntp site: "${hostname}"`);
        // Use an error code that indicates the resource is unavailable.
        return callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
      }

      // The port is retrieved from the site configuration, not the original URL.
      const redirectUrl = `http://localhost:${site.port}${pathname}${search}`;
      console.log(`[zntp-protocol] Proxying "${request.url}" to "${redirectUrl}"`);
      callback({ url: redirectUrl });

    } catch (e) {
      console.error("[zntp-protocol] Failed to handle zntp protocol request:", e, request.url);
      callback({ error: -3 }); // net::ERR_ABORTED
    }
  });
}

module.exports = { registerZntpProtocol };