const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, checkServerAccess } = require('../middleware/auth');
const users = require('../config/default-users');


let logBuffer = [];
const MAX_LOGS = 2000;


const sseClients = new Set();


let logFilters = {
    info: true,
    success: true,
    warn: true,
    error: true,
    debug: true
};


const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
};


function detectLogLevel(message) {
    const msgStr = String(message || '');
    const upperMsg = msgStr.toUpperCase();

    if (upperMsg.includes('[SUCCESS]') || upperMsg.includes('✓') || upperMsg.includes('✅')) {
        return 'success';
    }
    if (upperMsg.includes('[ERROR]') || upperMsg.includes('❌')) {
        return 'error';
    }
    if (upperMsg.includes('[WARN]') || upperMsg.includes('[WARNING]') || upperMsg.includes('⚠')) {
        return 'warn';
    }
    if (upperMsg.includes('[DEBUG]')) {
        return 'debug';
    }
    if (upperMsg.includes('[INFO]') || upperMsg.includes('[DASHBOARD]')) {
        return 'info';
    }

    return 'info';
}


function parseConsoleOutput(args) {
    const parts = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    });

    return parts.join(' ');
}


function addToBuffer(level, message, ...args) {

    if (!logFilters[level]) {
        return;
    }

    const timestamp = new Date().toISOString();
    const fullMessage = args.length > 0 ? `${message} ${parseConsoleOutput(args)}` : message;
    const logEntry = `[${level.toUpperCase()}] ${timestamp} - ${fullMessage}`;

    logBuffer.push(logEntry);
    if (logBuffer.length > MAX_LOGS) {
        logBuffer = logBuffer.slice(-MAX_LOGS);
    }


    broadcastLogToSSE(logEntry);
}


function broadcastLogToSSE(logEntry) {
    const message = `data: ${JSON.stringify({ log: logEntry })}\n\n`;
    sseClients.forEach(client => {
        try {
            client.write(message);
        } catch (error) {

            sseClients.delete(client);
        }
    });
}


console.log = function(...args) {
    const message = parseConsoleOutput(args);
    const level = detectLogLevel(message);
    addToBuffer(level, message);
    return originalConsole.log.apply(console, args);
};

console.error = function(...args) {
    const message = parseConsoleOutput(args);

    const level = detectLogLevel(message);
    if (level === 'error' || message.includes('Error') || message.includes('Stack:')) {
        addToBuffer('error', message);
    } else {
        addToBuffer('error', message);
    }
    return originalConsole.error.apply(console, args);
};

console.warn = function(...args) {
    const message = parseConsoleOutput(args);
    const level = detectLogLevel(message);
    addToBuffer(level === 'warn' ? 'warn' : detectLogLevel(message), message);
    return originalConsole.warn.apply(console, args);
};

console.info = function(...args) {
    const message = parseConsoleOutput(args);
    const level = detectLogLevel(message);
    addToBuffer(level, message);
    return originalConsole.info.apply(console, args);
};

console.debug = function(...args) {
    const message = parseConsoleOutput(args);
    addToBuffer('debug', message);
    return originalConsole.debug.apply(console, args);
};


const logger = require('../../../src/utils/logger');
const originalLogger = {
    info: logger.info,
    success: logger.success,
    warn: logger.warn,
    error: logger.error,
    debug: logger.debug
};

logger.info = function(message, ...args) {
    addToBuffer('info', message, ...args);
    return originalLogger.info.call(this, message, ...args);
};

logger.success = function(message, ...args) {
    addToBuffer('success', message, ...args);
    return originalLogger.success.call(this, message, ...args);
};

logger.warn = function(message, ...args) {
    addToBuffer('warn', message, ...args);
    return originalLogger.warn.call(this, message, ...args);
};

logger.error = function(message, error, ...args) {
    const errorMessage = error ? `${message}${error.stack ? '\nStack: ' + error.stack : ''}` : message;
    addToBuffer('error', errorMessage, ...args);
    return originalLogger.error.call(this, message, error, ...args);
};

logger.debug = function(message, ...args) {
    addToBuffer('debug', message, ...args);
    return originalLogger.debug.call(this, message, ...args);
};

router.get('/users', isAuthenticated, checkServerAccess, isAdmin, (req, res) => {

    const safeUsers = users.map(({ password: _, ...user }) => user);
    res.json(safeUsers);
});


router.get('/status', isAuthenticated, checkServerAccess, isAdmin, (req, res) => {
    res.json({
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
    });
});

router.get('/logs', isAuthenticated, isAdmin, (req, res) => {
    try {
        const level = req.query.level;
        const since = req.query.since;
        const limit = parseInt(req.query.limit) || null;
        let filteredLogs = logBuffer;


        if (since) {
            const sinceTime = new Date(since).getTime();
            filteredLogs = filteredLogs.filter(log => {
                const logMatch = log.match(/(\d{4}-\d{2}-\d{2}T[\d:\.]+Z)/);
                if (logMatch) {
                    const logTime = new Date(logMatch[1]).getTime();
                    return logTime > sinceTime;
                }
                return true;
            });
        }

        if (level) {
            filteredLogs = filteredLogs.filter(log =>
                log.toUpperCase().includes(`[${level.toUpperCase()}]`)
            );
        }


        if (limit && limit > 0) {
            filteredLogs = filteredLogs.slice(-limit);
        }

        res.json({ logs: filteredLogs, total: logBuffer.length });
    } catch (error) {
        logger.error('Failed to get logs', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});


router.get('/logs/stream', isAuthenticated, isAdmin, (req, res) => {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');


    try {
        res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    } catch (error) {
        return res.end();
    }


    sseClients.add(res);


    const recentLogs = logBuffer.slice(-200);
    if (recentLogs.length > 0) {
        try {
            res.write(`data: ${JSON.stringify({ type: 'initial', logs: recentLogs, count: recentLogs.length })}\n\n`);
        } catch (error) {
            sseClients.delete(res);
            return res.end();
        }
    }


    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch (error) {
            clearInterval(heartbeat);
            sseClients.delete(res);
        }
    }, 30000);


    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
        try {
            res.end();
        } catch (error) {

        }
    });

    req.on('error', () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
    });
});

router.post('/logs/clear', isAuthenticated, isAdmin, (req, res) => {
    try {
        logBuffer = [];
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to clear logs', error);
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});


router.get('/logs/filters', isAuthenticated, isAdmin, (req, res) => {
    try {
        res.json({ filters: logFilters });
    } catch (error) {
        logger.error('Failed to get log filters', error);
        res.status(500).json({ error: 'Failed to get log filters' });
    }
});


router.post('/logs/filters', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { filters } = req.body;
        if (filters && typeof filters === 'object') {

            if (typeof filters.info === 'boolean') logFilters.info = filters.info;
            if (typeof filters.success === 'boolean') logFilters.success = filters.success;
            if (typeof filters.warn === 'boolean') logFilters.warn = filters.warn;
            if (typeof filters.error === 'boolean') logFilters.error = filters.error;
            if (typeof filters.debug === 'boolean') logFilters.debug = filters.debug;


            updateLoggerFilters();


            try {
                const axios = require('axios');
                const { getBotApiUrl } = require('../utils/bot-api-url');
                let botApiUrl;
                try {
                    botApiUrl = getBotApiUrl();
                } catch (error) {
                    botApiUrl = `http://localhost:${process.env.BOT_API_PORT || 45049}`;
                }

                const filterUrl = `${botApiUrl}/logs/filters`;
                await axios.post(filterUrl, { filters: logFilters }, {
                    timeout: 2000
                }).catch(error => {

                    logger.warn('Failed to send filter update to bot API:', error.message);
                });
            } catch (error) {

                logger.warn('Bot API not available for filter update:', error.message);
            }

            res.json({ success: true, filters: logFilters });
        } else {
            res.status(400).json({ error: 'Invalid filters object' });
        }
    } catch (error) {
        logger.error('Failed to update log filters', error);
        res.status(500).json({ error: 'Failed to update log filters' });
    }
});


function updateLoggerFilters() {

    try {
        const logger = require('../../../src/utils/logger');
        if (logger.setFilters) {
            logger.setFilters(logFilters);
        }
    } catch (error) {

    }



}


router.post('/logs/add', (req, res) => {
    try {
        const { logs } = req.body;
        if (Array.isArray(logs)) {
            logs.forEach(log => {
                if (typeof log === 'string' && log.trim()) {
                    logBuffer.push(log);


                    broadcastLogToSSE(log);
                }
            });


            if (logBuffer.length > MAX_LOGS) {
                logBuffer = logBuffer.slice(-MAX_LOGS);
            }
        }
        res.json({ success: true, received: Array.isArray(logs) ? logs.length : 0 });
    } catch (error) {
        logger.error('Failed to add logs', error);
        res.status(500).json({ error: 'Failed to add logs' });
    }
});

module.exports = router;