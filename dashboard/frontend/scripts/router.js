const router = {

    pageCache: new Map(),


    cacheTTL: 5 * 60 * 1000,

    routes: {
        '#/login': { page: 'login', title: 'Connexion' },
        '#/dashboard': { page: 'dashboard', title: 'Tableau de bord' },
        '#/monitoring': { page: 'monitoring', title: 'Monitoring' },
        '#/commands': { page: 'commands', title: 'Commandes' },
        '#/config/bot': { page: 'config/bot', title: 'Bot Presence' },
        '#/config/moderation': { page: 'config/moderation', title: 'Modération' },
        '#/config/giveaways': { page: 'config/giveaways', title: 'Concours' },
        '#/config/tickets': { page: 'config/tickets', title: 'Tickets' },
        '#/config/market': { page: 'config/market', title: 'Marché' },
        '#/config/suggestion': { page: 'config/suggestion', title: 'Suggestions' },
        '#/config/logs': { page: 'config/logs', title: 'Logs d\'événements' },
        '#/config/leveling': { page: 'config/leveling', title: 'Système de Niveaux' },
        '#/config/welcome': { page: 'config/welcome', title: 'Messages de Bienvenue' },
        '#/config/branding': { page: 'config/branding', title: 'Branding & UI' },
        '#/config/messages': { page: 'config/messages', title: 'Messages' },
        '#/config/features': { page: 'config/features', title: 'Fonctionnalités' },
        '#/config/limits': { page: 'config/limits', title: 'Limites' },
        '#/config/role-permissions': { page: 'config/role-permissions', title: 'Permissions Basées sur les Rangs' },
        '#/config/database': { page: 'config/database', title: 'Base de Données' },
        '#/config/handlers': { page: 'config/handlers', title: 'Handlers' },
        '#/config/performance': { page: 'config/performance', title: 'Performance' },
        '#/config/soundboard': { page: 'config/soundboard', title: 'Soundboard' },
        '#/config/pvp-tournaments': { page: 'config/pvp-tournaments', title: 'Tournois PvP' },
        '#/config/advanced': { page: 'config/advanced', title: 'Avancé' },
        '#/todos': { page: 'todos', title: 'Todos' },
        '#/applications': { page: 'applications', title: 'Candidatures Orales' },
        '#/pvp-tournaments': { page: 'pvp-tournaments', title: 'Tournois PvP' },
        '#/settings': { page: 'settings', title: 'Paramètres Utilisateur' },
        '#/admin': { page: 'admin', title: 'Administration', adminOnly: true },
        '#/console': { page: 'console', title: 'Console', adminOnly: true },
        '#/modlogs': { page: 'modlogs', title: 'Modération Logs' },
        '#/user-history': { page: 'user-history', title: 'Historique Utilisateur' },
        '#/soundboard': { page: 'soundboard', title: 'Soundboard & Recording' },
        '#/live-audio': { page: 'live-audio', title: 'Live Audio Stream' },
        '#/minecraft/commands': { page: 'minecraft-commands', title: 'Historique Commandes Minecraft' },
        '#/access-denied': { page: 'access-denied', title: 'Accès Refusé' }
    },

    async init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        await this.handleRoute();
    },

    async handleRoute() {
        const hash = window.location.hash || '#/dashboard';
        const route = this.routes[hash] || this.routes['#/dashboard'];


        document.title = `Serenity Craft - ${route.title}`;


        const authCheck = window.auth.checkAuth().catch(() => false);

        let isAuthenticated = false;
        try {
            isAuthenticated = await authCheck;
        } catch (e) {
            console.error('[ROUTER] Auth check failed:', e);
        }

        if (!isAuthenticated && hash !== '#/login' && hash !== '#/access-denied') {
            window.location.hash = '#/login';
            return;
        }

        if (isAuthenticated && hash === '#/login') {

            try {
                const userData = await window.api.get('/auth/me');
                if (userData.hasAccess) {
                    window.location.hash = '#/dashboard';
                } else {
                    window.location.hash = '#/access-denied';
                }
            } catch (error) {
                window.location.hash = '#/dashboard';
            }
            return;
        }


        if (isAuthenticated && hash !== '#/login' && hash !== '#/access-denied') {
            try {
                const userData = await window.api.get('/auth/me');
                if (!userData.hasAccess) {
                    window.location.hash = '#/access-denied';
                    return;
                }
            } catch (error) {

            }
        }

        const loginView = document.getElementById('login-view');
        const dashboardView = document.getElementById('dashboard-view');

        if (hash === '#/login') {
            loginView.classList.remove('d-none');
            dashboardView.classList.add('d-none');
        } else if (hash === '#/access-denied') {

            loginView.classList.add('d-none');
            dashboardView.classList.remove('d-none');


            const sidebarContainer = document.getElementById('sidebar-container');
            const navbarContainer = document.getElementById('navbar-container');
            if (sidebarContainer) sidebarContainer.innerHTML = '';
            if (navbarContainer) navbarContainer.innerHTML = '';

            await this.loadPage(route.page);
        } else {
            loginView.classList.add('d-none');
            dashboardView.classList.remove('d-none');


            const layoutPromise = this.renderLayout();
            const pagePromise = this.loadPage(route.page);

            await Promise.all([layoutPromise, pagePromise]);

            window.sidebar.setActive(hash);
        }
    },

    async renderLayout() {
        const sidebarContainer = document.getElementById('sidebar-container');
        const navbarContainer = document.getElementById('navbar-container');


        try {
            await window.auth.checkAuth();
        } catch (error) {

        }


        if (window.sidebar && typeof window.sidebar.saveScrollPosition === 'function') {
            window.sidebar.saveScrollPosition();
        }


        sidebarContainer.innerHTML = window.sidebar.render();
        if (window.sidebar && typeof window.sidebar.initEvents === 'function') {
            window.sidebar.initEvents();
        }


        if (!navbarContainer.innerHTML) {
            navbarContainer.innerHTML = window.navbar.render();

            window.navbar.loadUserData().then(() => {
                navbarContainer.innerHTML = window.navbar.render();
                window.navbar.initEvents();
            });
            window.navbar.initEvents();
        } else {

            const now = Date.now();
            if (!window.navbar.lastUpdate || (now - window.navbar.lastUpdate) > 30000) {
                window.navbar.loadUserData().then(() => {
                    navbarContainer.innerHTML = window.navbar.render();
                    window.navbar.initEvents();
                });
            }
        }
    },

    async loadPage(pagePath) {
        const pageContent = document.getElementById('page-content');
        const mainContent = document.getElementById('main-content');


        const cacheKey = pagePath;
        const cached = this.pageCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.cacheTTL) {

            if (mainContent) {
                mainContent.classList.add('loading');
            }
            pageContent.innerHTML = '<div class="flex justify-center align-center" style="min-height: 200px; width: 100%;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>';


            requestAnimationFrame(() => {
                this.renderCachedPage(cached.html, pageContent, mainContent, pagePath);
            });
            return;
        }

        if (mainContent) {
            mainContent.classList.add('loading');
            mainContent.scrollTop = 0;
        }

        pageContent.innerHTML = '<div class="flex justify-center align-center" style="min-height: 200px; width: 100%;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>';

        try {
            const response = await fetch(`pages/${pagePath}.html`);

            if (!response.ok) throw new Error(`Page not found: ${pagePath}`);
            const html = await response.text();


            this.pageCache.set(cacheKey, {
                html: html,
                timestamp: now
            });

            this.renderCachedPage(html, pageContent, mainContent, pagePath);

        } catch (error) {
            console.error('[ROUTER] Page load critical error:', error);
            pageContent.innerHTML = `<div class="card"><h2 class="error-text">Erreur</h2><p>Échec du chargement de la page: ${error.message}</p></div>`;
            if (mainContent) {
                mainContent.classList.remove('loading');
            }
        }
    },

    renderCachedPage(html, pageContent, mainContent, pagePath) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        pageContent.innerHTML = '';


        const fragment = document.createDocumentFragment();
        Array.from(temp.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT') {
                fragment.appendChild(node.cloneNode(true));
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                fragment.appendChild(node.cloneNode(true));
            }
        });
        pageContent.appendChild(fragment);

        if (mainContent) {
            mainContent.classList.remove('loading');
            mainContent.scrollTop = 0;
        }
        window.scrollTo(0, 0);


        const scripts = temp.querySelectorAll('script');
        for (const oldScript of scripts) {
            const newScript = document.createElement('script');
            try {
                newScript.textContent = `(function() {
                    try {
                        ${oldScript.innerHTML}
                    } catch (e) {
                        console.error('[ROUTER] Script execution error in ${pagePath}:', e);
                    }
                })();`;
                document.body.appendChild(newScript);
                newScript.remove();
            } catch (e) {
                console.error(`[ROUTER] Failed to prepare script for ${pagePath}:`, e);
            }
        }


        const pageId = pagePath.split('/').pop();

        const camelCaseId = pageId.split('-').map((part, index) =>
            index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        const initFunc = `init${camelCaseId}Page`;


        requestAnimationFrame(() => {
            if (typeof window[initFunc] === 'function') {
                try {
                    window[initFunc]();
                } catch (e) {
                    console.error(`[ROUTER] Init function error for ${pagePath}:`, e);
                }
            }

            setTimeout(() => {
                if (window.initCustomSelects) {
                    window.initCustomSelects();
                }
            }, 150);
        });
    }
};

window.router = router;