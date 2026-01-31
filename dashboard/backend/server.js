require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const logger = require('../../src/utils/logger');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 44962;

const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';


if (process.env.TRUST_PROXY === 'true' || process.env.BEHIND_PROXY === 'true') {
    app.set('trust proxy', 1);
    logger.info('Trust proxy enabled - running behind reverse proxy');
}

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const sessionStore = new (require('express-session').MemoryStore)();

app.use(session({
    secret: process.env.SESSION_SECRET || 'sc-dashboard-secret-key',
    resave: true,
    saveUninitialized: true,
    store: sessionStore,
    name: 'connect.sid',
    cookie: {

        secure: process.env.FORCE_SECURE_COOKIES === 'true' || false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,


    }
}));


const { restoreSession } = require('./middleware/session-restore');
const cacheMiddleware = require('./middleware/cache');


app.use((req, res, next) => {
    if (req.path.includes('/auth/discord')) {
        logger.debug(`[SESSION DEBUG] Path: ${req.path}, Session ID: ${req.sessionID || 'none'}, Cookie: ${req.headers.cookie || 'none'}, User-Agent: ${req.headers['user-agent'] || 'none'}`);
    }
    next();
});

app.use(restoreSession);

app.use('/api', (req, res, next) => {

    if (req.path.startsWith('/auth/') ||
        req.path.startsWith('/monitoring/market') ||
        req.path.startsWith('/monitoring/tickets') ||
        req.path.startsWith('/applications') ||
        req.path.startsWith('/minecraft')) {
        return next();
    }
    return cacheMiddleware.middleware(5 * 60 * 1000)(req, res, next);
});





let frontendPath;

if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, '../dist');
    const fallbackPath = path.resolve(__dirname, '../frontend');

    if (fs.existsSync(distPath)) {
        frontendPath = distPath;
        logger.info('📦 Serving obfuscated frontend from dashboard/dist/');
    } else {
        frontendPath = fallbackPath;
        logger.warn('⚠️  Production build not found! Run "npm run build:frontend" first.');
        logger.warn('⚠️  Falling back to development frontend (non-obfuscated)');
    }
} else {
    frontendPath = path.resolve(__dirname, '../frontend');
    logger.debug('🔧 Serving development frontend from dashboard/frontend/');
}

app.use(express.static(frontendPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));


app.get('/favicon.ico', (req, res) => res.status(204).end());


const transcriptsStoragePath = path.resolve(__dirname, '../../data/transcripts');
if (!fs.existsSync(transcriptsStoragePath)) {
    fs.mkdirSync(transcriptsStoragePath, { recursive: true });
}
app.use('/transcripts-files', express.static(transcriptsStoragePath));


const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const commandRoutes = require('./routes/commands');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const monitoringRoutes = require('./routes/monitoring');
const todoRoutes = require('./routes/todos');
const serverRoutes = require('./routes/servers');
const applicationRoutes = require('./routes/applications');
const voiceRoutes = require('./routes/voice');
const pvpTournamentRoutes = require('./routes/pvp-tournaments');

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/level-roles', require('./routes/level-roles'));
app.use('/api/modlogs', require('./routes/modlogs'));
app.use('/api/pvp-tournaments', pvpTournamentRoutes);
app.use('/api/minecraft', require('./routes/minecraft'));
app.use('/api/transcripts', require('./routes/transcripts'));





app.use((err, req, res, next) => {
    logger.error('Dashboard Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
    logger.success(`Dashboard server running on port ${PORT} (accessible on ${displayHost}, use http://91.197.6.156:${PORT} to access)`);
});