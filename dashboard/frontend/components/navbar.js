const navbar = {
    userData: null,
    highestRole: null,
    lastUpdate: null,
    loading: false,

    async loadUserData() {

        if (this.loading) {
            return;
        }

        this.loading = true;
        try {
            const data = await window.api.get('/auth/me');
            this.userData = data.user;
            if (data.selectedGuildId) {
                try {
                    const roleData = await window.api.get(`/auth/role`);
                    this.highestRole = roleData.role;
                } catch (error) {
                    console.debug('Could not fetch user role:', error);
                    this.highestRole = null;
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.userData = null;
            this.highestRole = null;
        } finally {
            this.loading = false;
            this.lastUpdate = Date.now();
        }
    },

    render() {
        const user = this.userData || window.auth.getUser();
        const username = user ? (user.username || user.displayName || 'User') : 'Invité';
        const discriminator = user?.discriminator ? `#${user.discriminator}` : '';
        const displayName = `${username}${discriminator}`;
        const avatarUrl = user?.avatar
            ? `https://cdn.discordapp.com/avatars/${user.discordId || user.id}/${user.avatar}.png?size=128`
            : null;
        const roleName = this.highestRole?.name || (user?.role || '');

        return `
            <header class="navbar">
                <div class="navbar-left">
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="global-search" class="search-input" placeholder="Rechercher config, commandes...">
                        <div id="search-results" class="search-results-dropdown d-none"></div>
                    </div>
                </div>

                <div class="navbar-right align-center flex gap-1">
                    <div class="user-info text-right" style="margin-right: 1rem;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${displayName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize;">${roleName || ''}</div>
                    </div>
                    <div class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%; ${avatarUrl ? `background-image: url('${avatarUrl}'); background-size: cover; background-position: center;` : 'background: var(--secondary); display: flex; align-items: center; justify-content: center; color: white;'}">
                        ${!avatarUrl ? '<i class="fas fa-user"></i>' : ''}
                    </div>
                </div>
            </header>
        `;
    },

    async init() {
        await this.loadUserData();
        this.initEvents();
    },

    initEvents() {
        const searchInput = document.getElementById('global-search');
        const resultsDropdown = document.getElementById('search-results');

        if (searchInput) {

            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();

                if (query.length < 2) {
                    resultsDropdown.classList.add('d-none');
                    return;
                }


                searchTimeout = setTimeout(async () => {
                    try {
                        const results = await window.api.get(`/search?q=${encodeURIComponent(query)}`);
                        this.renderSearchResults(results);
                    } catch (error) {
                        console.error('Search failed:', error);
                    }
                }, 300);
            });


            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
                    resultsDropdown.classList.add('d-none');
                }
            });
        }
    },

    renderSearchResults(results) {
        const resultsDropdown = document.getElementById('search-results');
        if (!results || results.length === 0) {
            resultsDropdown.innerHTML = '<div class="search-result-item">Aucun résultat</div>';
        } else {
            resultsDropdown.innerHTML = results.map(res => `
                <a href="${res.link}" class="search-result-item" onclick="document.getElementById('search-results').classList.add('d-none'); document.getElementById('global-search').value = '';">
                    <div class="flex align-center gap-1">
                        <i class="fas ${res.type === 'command' ? 'fa-terminal' : 'fa-cog'}" style="color: var(--primary);"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 0.9rem;">${res.title}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${res.description}</div>
                        </div>
                    </div>
                </a>
            `).join('');
        }
        resultsDropdown.classList.remove('d-none');
    }
};

window.navbar = navbar;