const sidebar = {
    configExpanded: true,
    managementExpanded: true,
    minecraftExpanded: true,
    systemExpanded: false,
    savedScrollPosition: 0,

    render() {
        return `
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <img src="/assets/sc-logo.png" alt="SC Logo" class="sidebar-logo-img"
                             onerror="this.onerror=null; this.src='/assets/logo.png'; this.onerror=function(){this.style.display='none';};">
                        <span class="sidebar-logo-text">SERENITY CRAFT</span>
                    </div>
                </div>

                <nav class="sidebar-nav">
                    <ul>
                        <li><a href="#/dashboard" class="nav-item" data-hash="#/dashboard"><i class="fas fa-home"></i> <span>Dashboard</span></a></li>
                        <li><a href="#/monitoring" class="nav-item" data-hash="#/monitoring"><i class="fas fa-chart-line"></i> <span>Monitoring</span></a></li>

                        <li class="nav-section">
                            <a href="javascript:void(0)" class="nav-section-header" onclick="window.sidebar.toggleSection('config')">
                                <i class="fas fa-cog"></i>
                                <span>Configuration</span>
                                <i class="fas fa-chevron-down nav-section-icon ${this.configExpanded ? 'expanded' : ''}"></i>
                            </a>
                            <ul class="nav-section-items ${this.configExpanded ? 'expanded' : ''}">
                                <li><a href="#/config/bot" class="nav-item nav-sub-item" data-hash="#/config/bot"><i class="fab fa-discord"></i> <span>Bot</span></a></li>
                                <li><a href="#/config/moderation" class="nav-item nav-sub-item" data-hash="#/config/moderation"><i class="fas fa-shield-alt"></i> <span>Modération</span></a></li>
                                <li><a href="#/config/giveaways" class="nav-item nav-sub-item" data-hash="#/config/giveaways"><i class="fas fa-gift"></i> <span>Concours</span></a></li>
                                <li><a href="#/config/tickets" class="nav-item nav-sub-item" data-hash="#/config/tickets"><i class="fas fa-ticket-alt"></i> <span>Tickets</span></a></li>
                                <li><a href="#/config/market" class="nav-item nav-sub-item" data-hash="#/config/market"><i class="fas fa-store"></i> <span>Marché</span></a></li>
                                <li><a href="#/config/suggestion" class="nav-item nav-sub-item" data-hash="#/config/suggestion"><i class="fas fa-lightbulb"></i> <span>Suggestions</span></a></li>
                                <li><a href="#/config/logs" class="nav-item nav-sub-item" data-hash="#/config/logs"><i class="fas fa-history"></i> <span>Logs</span></a></li>
                                <li><a href="#/config/leveling" class="nav-item nav-sub-item" data-hash="#/config/leveling"><i class="fas fa-level-up-alt"></i> <span>Niveaux</span></a></li>
                                <li><a href="#/config/welcome" class="nav-item nav-sub-item" data-hash="#/config/welcome"><i class="fas fa-door-open"></i> <span>Bienvenue</span></a></li>
                                <li><a href="#/config/branding" class="nav-item nav-sub-item" data-hash="#/config/branding"><i class="fas fa-palette"></i> <span>Branding</span></a></li>
                                <li><a href="#/config/messages" class="nav-item nav-sub-item" data-hash="#/config/messages"><i class="fas fa-comment-dots"></i> <span>Messages</span></a></li>
                                <li><a href="#/config/features" class="nav-item nav-sub-item" data-hash="#/config/features"><i class="fas fa-toggle-on"></i> <span>Fonctionnalités</span></a></li>
                                <li><a href="#/config/limits" class="nav-item nav-sub-item" data-hash="#/config/limits"><i class="fas fa-clock"></i> <span>Limites</span></a></li>
                                <li><a href="#/config/role-permissions" class="nav-item nav-sub-item" data-hash="#/config/role-permissions"><i class="fas fa-user-lock"></i> <span>Permissions</span></a></li>
                                <li><a href="#/config/database" class="nav-item nav-sub-item" data-hash="#/config/database"><i class="fas fa-database"></i> <span>Base de Données</span></a></li>
                                <li><a href="#/config/handlers" class="nav-item nav-sub-item" data-hash="#/config/handlers"><i class="fas fa-cogs"></i> <span>Handlers</span></a></li>
                                <li><a href="#/config/performance" class="nav-item nav-sub-item" data-hash="#/config/performance"><i class="fas fa-tachometer-alt"></i> <span>Performance</span></a></li>
                                <li><a href="#/config/soundboard" class="nav-item nav-sub-item" data-hash="#/config/soundboard"><i class="fas fa-volume-up"></i> <span>Soundboard</span></a></li>
                                <li><a href="#/config/pvp-tournaments" class="nav-item nav-sub-item" data-hash="#/config/pvp-tournaments"><i class="fas fa-trophy"></i> <span>Tournois PvP</span></a></li>
                                <li><a href="#/config/advanced" class="nav-item nav-sub-item" data-hash="#/config/advanced"><i class="fas fa-sliders-h"></i> <span>Avancé</span></a></li>
                            </ul>
                        </li>

                        <li class="nav-section">
                            <a href="javascript:void(0)" class="nav-section-header" onclick="window.sidebar.toggleSection('minecraft')">
                                <i class="fas fa-cube"></i>
                                <span>Minecraft</span>
                                <i class="fas fa-chevron-down nav-section-icon ${this.minecraftExpanded ? 'expanded' : ''}"></i>
                            </a>
                            <ul class="nav-section-items ${this.minecraftExpanded ? 'expanded' : ''}">
                                <li><a href="#/minecraft/commands" class="nav-item nav-sub-item" data-hash="#/minecraft/commands"><i class="fas fa-terminal"></i> <span>Historique Commandes</span></a></li>
                            </ul>
                        </li>

                        <li class="nav-section">
                            <a href="javascript:void(0)" class="nav-section-header" onclick="window.sidebar.toggleSection('management')">
                                <i class="fas fa-tasks"></i>
                                <span>Gestion</span>
                                <i class="fas fa-chevron-down nav-section-icon ${this.managementExpanded ? 'expanded' : ''}"></i>
                            </a>
                            <ul class="nav-section-items ${this.managementExpanded ? 'expanded' : ''}">
                                <li><a href="#/modlogs" class="nav-item nav-sub-item" data-hash="#/modlogs"><i class="fas fa-clipboard-list"></i> <span>Logs Modération</span></a></li>
                                <li><a href="#/pvp-tournaments" class="nav-item nav-sub-item" data-hash="#/pvp-tournaments"><i class="fas fa-trophy"></i> <span>Tournois PvP</span></a></li>
                                <li><a href="#/todos" class="nav-item nav-sub-item" data-hash="#/todos"><i class="fas fa-check-square"></i> <span>Todos</span></a></li>
                                <li><a href="#/applications" class="nav-item nav-sub-item" data-hash="#/applications"><i class="fas fa-user-check"></i> <span>Candidatures</span></a></li>
                                <li><a href="#/commands" class="nav-item nav-sub-item" data-hash="#/commands"><i class="fas fa-terminal"></i> <span>Commandes</span></a></li>
                                <li><a href="#/soundboard" class="nav-item nav-sub-item" data-hash="#/soundboard"><i class="fas fa-volume-up"></i> <span>Soundboard</span></a></li>
                            </ul>
                        </li>

                        ${window.auth.isAdmin() ? `
                        <li class="nav-section">
                            <a href="javascript:void(0)" class="nav-section-header" onclick="window.sidebar.toggleSection('system')">
                                <i class="fas fa-server"></i>
                                <span>Système</span>
                                <i class="fas fa-chevron-down nav-section-icon ${this.systemExpanded ? 'expanded' : ''}"></i>
                            </a>
                            <ul class="nav-section-items ${this.systemExpanded ? 'expanded' : ''}">
                                <li><a href="#/admin" class="nav-item nav-sub-item" data-hash="#/admin"><i class="fas fa-user-shield"></i> <span>Admin Panel</span></a></li>
                                <li><a href="#/console" class="nav-item nav-sub-item" data-hash="#/console"><i class="fas fa-terminal"></i> <span>Console</span></a></li>
                            </ul>
                        </li>
                        ` : ''}
                    </ul>
                </nav>

                <div class="sidebar-footer">
                    <a href="javascript:void(0)" onclick="window.auth.logout()" class="nav-item logout-btn">
                        <i class="fas fa-sign-out-alt"></i> <span>Déconnexion</span>
                    </a>
                </div>
            </aside>
        `;
    },

    toggleSection(section) {
        this[`${section}Expanded`] = !this[`${section}Expanded`];
        this.updateSectionUI(section);

        localStorage.setItem('sidebarConfig', JSON.stringify({
            configExpanded: this.configExpanded,
            managementExpanded: this.managementExpanded,
            minecraftExpanded: this.minecraftExpanded,
            systemExpanded: this.systemExpanded
        }));
    },

    updateSectionUI(section) {
        const header = document.querySelector(`.nav-section-header[onclick*="'${section}'"]`);
        if (!header) return;

        const sectionEl = header.closest('.nav-section');
        const items = sectionEl?.querySelector('.nav-section-items');
        const icon = header.querySelector('.nav-section-icon');

        if (items && icon) {
            if (this[`${section}Expanded`]) {
                items.classList.add('expanded');
                icon.classList.add('expanded');
            } else {
                items.classList.remove('expanded');
                icon.classList.remove('expanded');
            }
        }
    },

    setActive(hash) {

        const sidebarNav = document.querySelector('.sidebar-nav');
        const scrollPosition = sidebarNav ? sidebarNav.scrollTop : 0;


        const items = document.querySelectorAll('.nav-item');
        items.forEach(item => item.classList.remove('active'));


        let activeItem = document.querySelector(`.nav-item[data-hash="${hash}"]`);


        if (!activeItem) {
            const parts = hash.split('/');
            if (parts.length > 2 && parts[1] === 'config') {

                if (!this.configExpanded) {
                    this.configExpanded = true;
                    this.updateSectionUI('config');
                }
                const baseHash = parts.slice(0, 2).join('/');
                activeItem = document.querySelector(`.nav-item[data-hash^="${baseHash}"]`);
            }
        }

        if (activeItem) {
            activeItem.classList.add('active');

            const section = activeItem.closest('.nav-section');
            if (section) {
                const header = section.querySelector('.nav-section-header');
                const sectionName = header?.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
                if (sectionName && !this[`${sectionName}Expanded`]) {
                    this[`${sectionName}Expanded`] = true;
                    this.updateSectionUI(sectionName);
                }
            }
        }


        if (sidebarNav) {
            requestAnimationFrame(() => {
                sidebarNav.scrollTop = scrollPosition;
            });
        }
    },

    saveScrollPosition() {
        try {
            const sidebarNav = document.querySelector('.sidebar-nav');
            if (sidebarNav) {
                this.savedScrollPosition = sidebarNav.scrollTop;
            }
        } catch (e) {
            console.warn('[SIDEBAR] Failed to save scroll position:', e);
        }
    },

    restoreScrollPosition() {
        try {
            const sidebarNav = document.querySelector('.sidebar-nav');
            if (sidebarNav && this.savedScrollPosition !== undefined) {

                requestAnimationFrame(() => {
                    if (sidebarNav) sidebarNav.scrollTop = this.savedScrollPosition;
                    requestAnimationFrame(() => {
                        if (sidebarNav) sidebarNav.scrollTop = this.savedScrollPosition;
                    });
                });
            }
        } catch (e) {
            console.warn('[SIDEBAR] Failed to restore scroll position:', e);
        }
    },

    initEvents() {

        this.restoreScrollPosition();


        const savedConfig = localStorage.getItem('sidebarConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.configExpanded = config.configExpanded ?? true;
                this.managementExpanded = config.managementExpanded ?? true;
                this.minecraftExpanded = config.minecraftExpanded ?? true;
                this.systemExpanded = config.systemExpanded ?? false;


                ['config', 'management', 'minecraft', 'system'].forEach(section => {
                    this.updateSectionUI(section);
                });
            } catch (e) {
                console.warn('Failed to load sidebar state:', e);
            }
        } else {

            this.updateSectionUI('management');
        }


        setTimeout(() => this.restoreScrollPosition(), 50);
    }
};

window.sidebar = sidebar;