document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-site-form');
    const sitesList = document.getElementById('sites-list');
    const errorMessage = document.getElementById('form-error');

    const renderSites = async (sites) => {
        sitesList.innerHTML = ''; // Clear current list
        if (!sites || sites.length === 0) {
            sitesList.innerHTML = '<p>No sites registered yet.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>URL</th>
                    <th>Proxy Target</th>
                    <th>PM2 Process</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        for (const site of sites) {
            const row = document.createElement('tr');
            let pm2Controls = 'N/A';
            let statusIndicator = '<span class="status-indicator offline"></span> offline';

            if (site.pm2_name) {
                const statusResult = await window.pagesAPI.getPm2ProcessStatus(site.pm2_name);
                if (statusResult.status === 'online') {
                    statusIndicator = '<span class="status-indicator online"></span> online';
                    pm2Controls = `<button class="stop-btn" data-pm2-name="${site.pm2_name}">Stop</button>`;
                } else {
                    pm2Controls = `<button class="start-btn" data-pm2-name="${site.pm2_name}" data-pm2-script="${site.pm2_script}">Start</button>`;
                }
            }

            row.innerHTML = `
                <td><a href="zntp://${site.fqdn}" target="_blank">zntp://${site.fqdn}</a></td>
                <td>http://localhost:${site.port}</td>
                <td>${site.pm2_name || 'N/A'}</td>
                <td>${statusIndicator}</td>
                <td class="action-buttons">
                    ${pm2Controls}
                    <button class="edit-btn" data-fqdn="${site.fqdn}">Edit</button>
                    <button class="delete-btn" data-fqdn="${site.fqdn}">Remove</button>
                </td>
            `;
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        sitesList.appendChild(table);
    };

    const loadSites = async () => {
        const sites = await window.pagesAPI.getZntpSites();
        await renderSites(sites);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        const name = document.getElementById('site-name').value;
        const domain = document.getElementById('site-domain').value;
        const port = document.getElementById('site-port').value;
        const pm2_name = document.getElementById('pm2-name').value;
        const pm2_script = document.getElementById('pm2-script').value;

        const result = await window.pagesAPI.addZntpSite({ name, domain, port, pm2_name, pm2_script });

        if (result.success) {
            await renderSites(result.sites);
            form.reset();
        } else {
            errorMessage.textContent = result.message;
        }
    });

    sitesList.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('edit-btn')) {
            const row = target.closest('tr');
            const fqdn = target.dataset.fqdn;
            const name = fqdn.split('.')[0];
            const domain = fqdn.split('.').slice(1).join('.');

            // URL cell
            row.cells[0].innerHTML = `
                zntp://<input type="text" class="edit-name" value="${name}" required pattern="[a-z0-9-]+" title="Use lowercase letters, numbers, and hyphens.">
                <select class="edit-domain">
                    <option value="zum" ${domain === 'zum' ? 'selected' : ''}>.zum</option>
                    <option value="znm" ${domain === 'znm' ? 'selected' : ''}>.znm</option>
                    <option value="zem" ${domain === 'zem' ? 'selected' : ''}>.zem</option>
                </select>
            `;

            // Action buttons cell
            row.cells[4].innerHTML = `
                <button class="save-btn" data-fqdn="${fqdn}">Save</button>
                <button class="cancel-btn">Cancel</button>
            `;
        } else if (target.classList.contains('cancel-btn')) {
            loadSites(); // Just reload the list to cancel editing
        } else if (target.classList.contains('save-btn')) {
            const row = target.closest('tr');
            const originalFqdn = target.dataset.fqdn;
            const newName = row.querySelector('.edit-name').value;
            const newDomain = row.querySelector('.edit-domain').value;
            const result = await window.pagesAPI.updateZntpSite({ originalFqdn, newName, newDomain });
            if (result.success) {
                await renderSites(result.sites);
            } else {
                alert(`Error: ${result.message}`);
            }
        }

        if (target.classList.contains('delete-btn')) {
            const fqdn = target.dataset.fqdn;
            if (confirm(`Are you sure you want to remove ${fqdn}?`)) {
                const result = await window.pagesAPI.removeZntpSite(fqdn);
                if (result.success) {
                    await renderSites(result.sites);
                } else {
                    alert(`Error: ${result.message}`);
                }
            }
        } else if (target.classList.contains('start-btn')) {
            const name = target.dataset.pm2Name;
            const script = target.dataset.pm2Script;
            const result = await window.pagesAPI.startPm2Process({ name, script });
            if (result.success) {
                await loadSites();
            } else {
                alert(`Error starting process: ${result.message}`);
            }
        } else if (target.classList.contains('stop-btn')) {
            const name = target.dataset.pm2Name;
            const result = await window.pagesAPI.stopPm2Process(name);
            if (result.success) {
                await loadSites();
            } else {
                alert(`Error stopping process: ${result.message}`);
            }
        }
    });

    // Initial load
    loadSites();
});