const auth = {
    user: null,

    login() {

        window.location.href = '/api/auth/discord';
    },

    async logout() {
        try {
            await window.api.post('/auth/logout');
            this.user = null;
            localStorage.removeItem('sc_user');
            window.location.hash = '#/login';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    },

    async checkAuth() {
        try {
            const data = await window.api.get('/auth/me');
            if (data && data.user) {
                this.user = data.user;
                this.hasAccess = data.hasAccess || false;
                localStorage.setItem('sc_user', JSON.stringify(this.user));
                localStorage.setItem('sc_hasAccess', String(this.hasAccess));
                return true;
            }
            throw new Error('Invalid user data');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.user = null;
                this.hasAccess = false;
                localStorage.removeItem('sc_user');
                localStorage.removeItem('sc_hasAccess');
                return false;
            }
            if (error.message && error.message.includes('Unauthorized')) {
                this.user = null;
                this.hasAccess = false;
                localStorage.removeItem('sc_user');
                localStorage.removeItem('sc_hasAccess');
                return false;
            }
            console.debug('Auth check failed:', error.message);
            this.user = null;
            this.hasAccess = false;
            localStorage.removeItem('sc_user');
            localStorage.removeItem('sc_hasAccess');
            return false;
        }
    },

    getUser() {
        if (!this.user) {
            const saved = localStorage.getItem('sc_user');
            if (saved) this.user = JSON.parse(saved);
        }
        return this.user;
    },

    isAdmin() {

        if (this.hasAccess !== undefined) {
            return this.hasAccess;
        }
        const savedAccess = localStorage.getItem('sc_hasAccess');
        if (savedAccess !== null) {
            this.hasAccess = savedAccess === 'true';
            return this.hasAccess;
        }

        return false;
    }
};

window.auth = auth;