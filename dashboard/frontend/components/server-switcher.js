class ServerSwitcher {
    constructor() {
        this.servers = [];
        this.currentServer = null;
        this.container = null;
    }

    async init(container) {
        this.container = container;
        await this.loadServers();
        this.render();
    }

    async loadServers() {
        try {
            this.servers = await window.api.get('/servers');

            const userData = await window.api.get('/auth/me');
            if (userData.selectedGuildId) {
                this.currentServer = this.servers.find(s => s.id === userData.selectedGuildId);
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            window.toast?.error('Failed to load servers');
        }
    }

    render() {
        if (!this.container) return;

        const hasServers = this.servers.length > 0;
        const currentServerName = this.currentServer?.name || 'No server selected';
        const currentServerIcon = this.currentServer?.icon || null;

        this.container.innerHTML = `
            <div class="server-switcher" style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">
                    Current Server
                </label>
                <div class="server-select-wrapper" style="position: relative;">
                    <select id="server-select" class="form-control" style="padding-right: 2.5rem; ${!hasServers ? 'opacity: 0.5;' : ''}">
                        ${!hasServers
                            ? '<option value="">No servers available</option>'
                            : this.servers.map(server => `
                                <option value="${server.id}" ${server.id === this.currentServer?.id ? 'selected' : ''}
                                        style="${!server.botPresent ? 'color: #999;' : ''}">
                                    ${server.botPresent ? '✓' : '○'} ${server.name}
                                </option>
                            `).join('')
                        }
                    </select>
                    ${currentServerIcon ? `
                        <img src="${currentServerIcon}"
                             alt="${currentServerName}"
                             style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 4px; pointer-events: none;">
                    ` : ''}
                </div>
                ${!hasServers ? `
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                        You need "Manage Server" permission to manage servers here.
                    </div>
                ` : ''}
            </div>
        `;

        const select = this.container.querySelector('#server-select');
        if (select && hasServers) {
            select.addEventListener('change', async (e) => {
                await this.selectServer(e.target.value);
            });
        }
    }

    async selectServer(guildId) {
        if (!guildId) return;

        try {
            await window.api.post('/auth/select-server', { guildId });
            this.currentServer = this.servers.find(s => s.id === guildId);
            this.render();


            const currentHash = window.location.hash;
            if (currentHash) {
                window.location.hash = currentHash;
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to select server:', error);
            window.toast?.error('Failed to select server');
        }
    }

    getCurrentServer() {
        return this.currentServer;
    }

    getCurrentServerId() {
        return this.currentServer?.id || null;
    }
}


window.serverSwitcher = new ServerSwitcher();