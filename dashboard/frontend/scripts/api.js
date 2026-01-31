const API_BASE_URL = '/api';

const api = {

    cache: new Map(),
    cacheTTL: 30000,
    authCacheTTL: 60000,


    pendingRequests: new Map(),

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const method = options.method || 'GET';
        const cacheKey = `${method}:${endpoint}`;


        if (method === 'GET') {

            const cached = this.cache.get(cacheKey);
            const now = Date.now();
            const ttl = endpoint.includes('/auth/') ? this.authCacheTTL : this.cacheTTL;

            if (cached && (now - cached.timestamp) < ttl) {
                return Promise.resolve(cached.data);
            }


            if (this.pendingRequests.has(cacheKey)) {
                return this.pendingRequests.get(cacheKey);
            }
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            ...options
        };


        if (defaultOptions.body && typeof defaultOptions.body === 'object' &&
            ['POST', 'PUT', 'PATCH'].includes(method)) {
            defaultOptions.body = JSON.stringify(defaultOptions.body);
        }

        const requestPromise = (async () => {
            try {
                const response = await fetch(url, defaultOptions);

                if (response.status === 401) {
                    if (url.includes('/auth/me')) {
                        throw new Error('Unauthorized');
                    }
                    if (!url.includes('/auth/login') && !url.includes('/auth/me')) {

                        if (window.location.hash !== '#/login') {
                            window.location.hash = '#/login';
                        }
                        throw new Error('Unauthorized');
                    }
                }

                if (response.status === 403) {

                    if (window.location.hash !== '#/access-denied' && !url.includes('/auth/')) {
                        window.location.hash = '#/access-denied';
                    }
                    throw new Error('Access denied');
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'API Request failed');
                }


                if (method === 'GET' && response.ok) {
                    this.cache.set(cacheKey, {
                        data: data,
                        timestamp: Date.now()
                    });
                }

                return data;
            } catch (error) {
                if (!(error.message === 'Unauthorized' && url.includes('/auth/me'))) {
                    console.error(`API Error (${endpoint}):`, error);
                }
                throw error;
            } finally {

                if (method === 'GET') {
                    this.pendingRequests.delete(cacheKey);
                }
            }
        })();


        if (method === 'GET') {
            this.pendingRequests.set(cacheKey, requestPromise);
        }

        return requestPromise;
    },


    clearCache(endpoint = null) {
        if (endpoint) {
            for (const [key] of this.cache) {
                if (key.includes(endpoint)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, data) {

        this.clearCache(endpoint);
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {

        this.clearCache(endpoint);
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    patch(endpoint, data) {

        this.clearCache(endpoint);
        return this.request(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined
        });
    },

    delete(endpoint) {

        this.clearCache(endpoint);
        return this.request(endpoint, { method: 'DELETE' });
    }
};

window.api = api;