// main/zntpManager.js
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const pm2 = require('pm2');

const SITES_PATH = path.join(app.getPath('userData'), 'zntp-sites.json');

class ZntpManager {
    constructor() {
        this.sites = this.loadSites();
        this.initIpc();
        this.connectToPm2();
    }

    connectToPm2() {
        pm2.connect((err) => {
            if (err) {
                console.error('[ZntpManager] Error connecting to PM2:', err);
                process.exit(2);
            }
        });
    }

    loadSites() {
        try {
            if (fs.existsSync(SITES_PATH)) {
                const data = fs.readFileSync(SITES_PATH, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error("[ZntpManager] Error loading zntp sites:", error);
        }
        return []; // Return an empty array if file doesn't exist or is corrupt
    }

    saveSites() {
        try {
            fs.writeFileSync(SITES_PATH, JSON.stringify(this.sites, null, 2));
        } catch (error) {
            console.error("[ZntpManager] Error saving zntp sites:", error);
        }
    }

    /**
     * Finds a registered site by its fully qualified domain name (e.g., "my-site.local").
     * @param {string} fqdn The fully qualified domain name to look for.
     * @returns {object|undefined} The site object if found, otherwise undefined.
     */
    findSiteByFqdn(fqdn) {
        return this.sites.find(site => site.fqdn === fqdn);
    }

    initIpc() {
        ipcMain.handle('get-zntp-sites', () => {
            return this.sites;
        });

        ipcMain.handle('add-zntp-site', (event, { name, domain, port, pm2_name, pm2_script }) => {
            if (!name || !domain || !port) {
                return { success: false, message: 'All fields are required.' };
            }

            const fqdn = `${name}.${domain}`;

            if (this.sites.some(site => site.fqdn === fqdn)) {
                return { success: false, message: 'This site name and domain combination is already registered.' };
            }
            if (this.sites.some(site => site.port.toString() === port.toString())) {
                return { success: false, message: `Port ${port} is already in use by another site.` };
            }

            const newSite = { name, domain, port, fqdn, pm2_name, pm2_script };
            this.sites.push(newSite);
            this.saveSites();
            console.log(`[ZntpManager] Added new site: ${fqdn} -> localhost:${port}`);
            return { success: true, sites: this.sites };
        });

        ipcMain.handle('update-zntp-site', (event, { originalFqdn, newName, newDomain }) => {
            if (!newName || !newDomain) {
                return { success: false, message: 'Site name and domain are required.' };
            }

            const newFqdn = `${newName}.${newDomain}`;
            // Check if the new FQDN already exists for a *different* site
            if (this.sites.some(site => site.fqdn === newFqdn && site.fqdn !== originalFqdn)) {
                return { success: false, message: 'This site name and domain combination is already registered.' };
            }

            const siteToUpdate = this.findSiteByFqdn(originalFqdn);
            if (siteToUpdate) {
                siteToUpdate.name = newName;
                siteToUpdate.domain = newDomain;
                siteToUpdate.fqdn = newFqdn;
                this.saveSites();
                console.log(`[ZntpManager] Updated site: ${originalFqdn} -> ${newFqdn}`);
                return { success: true, sites: this.sites };
            }
            return { success: false, message: 'Original site not found.' };
        });

        ipcMain.handle('remove-zntp-site', (event, fqdn) => {
            const initialCount = this.sites.length;
            this.sites = this.sites.filter(site => site.fqdn !== fqdn);
            if (this.sites.length < initialCount) {
                this.saveSites();
                console.log(`[ZntpManager] Removed site: ${fqdn}`);
                return { success: true, sites: this.sites };
            }
            return { success: false, message: 'Site not found.' };
        });

        ipcMain.handle('start-pm2-process', (event, { name, script }) => {
            return new Promise((resolve) => {
                pm2.start({ name, script }, (err, apps) => {
                    if (err) {
                        console.error('[ZntpManager] PM2 start error:', err);
                        resolve({ success: false, message: err.message });
                    } else {
                        resolve({ success: true, apps });
                    }
                });
            });
        });

        ipcMain.handle('stop-pm2-process', (event, name) => {
            return new Promise((resolve) => {
                pm2.stop(name, (err, apps) => {
                    if (err) {
                        console.error('[ZntpManager] PM2 stop error:', err);
                        resolve({ success: false, message: err.message });
                    } else {
                        resolve({ success: true, apps });
                    }
                });
            });
        });

        ipcMain.handle('get-pm2-process-status', (event, name) => {
            return new Promise((resolve) => {
                pm2.describe(name, (err, processDescription) => {
                    if (err || processDescription.length === 0) {
                        resolve({ status: 'offline' });
                    } else {
                        resolve({ status: processDescription[0].pm2_env.status });
                    }
                });
            });
        });
    }
}

module.exports = { ZntpManager };