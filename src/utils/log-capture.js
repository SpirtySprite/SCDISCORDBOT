
let logBuffer = [];
const MAX_BUFFER_SIZE = 100;
let dashboardApiUrl = null;
let sendInterval = null;
let axios = null;


function getAxios() {
    if (!axios) {
        try {
            axios = require('axios');
        } catch {

        }
    }
    return axios;
}


function getDashboardApiUrl() {
    if (dashboardApiUrl) return dashboardApiUrl;


    if (process.env.DASHBOARD_API_URL) {
        dashboardApiUrl = process.env.DASHBOARD_API_URL;
        return dashboardApiUrl;
    }


    const port = process.env.DASHBOARD_PORT || 44962;
    dashboardApiUrl = `http://localhost:${port}`;
    return dashboardApiUrl;
}


async function sendLogsToDashboard(logs) {
    if (!logs || logs.length === 0) return;

    const httpClient = getAxios();
    if (!httpClient) return;

    try {
        const url = `${getDashboardApiUrl()}/api/admin/logs/add`;


        httpClient.post(url, { logs }, { timeout: 1000 }).catch(() => {

        });
    } catch (error) {

    }
}


let logFilters = {
    info: true,
    success: true,
    warn: true,
    error: true,
    debug: true
};


function setFilters(filters) {
    if (filters && typeof filters === 'object') {
        if (typeof filters.info === 'boolean') logFilters.info = filters.info;
        if (typeof filters.success === 'boolean') logFilters.success = filters.success;
        if (typeof filters.warn === 'boolean') logFilters.warn = filters.warn;
        if (typeof filters.error === 'boolean') logFilters.error = filters.error;
        if (typeof filters.debug === 'boolean') logFilters.debug = filters.debug;
    }
}


function addLog(level, message, ...args) {

    if (!logFilters[level]) {
        return;
    }

    const timestamp = new Date().toISOString();
    const fullMessage = args.length > 0
        ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`
        : message;

    const logEntry = `[${level.toUpperCase()}] ${timestamp} - ${fullMessage}`;

    logBuffer.push(logEntry);


    if (logBuffer.length >= MAX_BUFFER_SIZE) {
        const logsToSend = logBuffer.splice(0, MAX_BUFFER_SIZE);
        sendLogsToDashboard(logsToSend);
    }
}


function startPeriodicFlush() {
    if (sendInterval) return;

    sendInterval = setInterval(() => {
        if (logBuffer.length > 0) {
            const logsToSend = logBuffer.splice(0, logBuffer.length);
            sendLogsToDashboard(logsToSend);
        }
    }, 2000);
}


function initializeLogCapture() {

    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };


    function detectLevel(message) {
        const msg = String(message || '').toUpperCase();
        if (msg.includes('[SUCCESS]') || msg.includes('✓') || msg.includes('✅')) return 'success';
        if (msg.includes('[ERROR]') || msg.includes('❌')) return 'error';
        if (msg.includes('[WARN]') || msg.includes('[WARNING]') || msg.includes('⚠')) return 'warn';
        if (msg.includes('[DEBUG]')) return 'debug';
        if (msg.includes('[INFO]') || msg.includes('[DASHBOARD]')) return 'info';
        return 'info';
    }


    function parseArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }


    console.log = function (...args) {
        const message = parseArgs(args);
        const level = detectLevel(message);


        if (logFilters[level]) {
            addLog(level, message);
            return originalConsole.log.apply(console, args);
        }

        return;
    };

    console.error = function (...args) {

        if (!logFilters.error) {
            return;
        }

        const message = parseArgs(args);
        addLog('error', message);
        return originalConsole.error.apply(console, args);
    };

    console.warn = function (...args) {
        const message = parseArgs(args);
        const level = detectLevel(message);
        const finalLevel = level === 'warn' ? 'warn' : detectLevel(message);


        if (!logFilters[finalLevel]) {
            return;
        }

        addLog(finalLevel, message);
        return originalConsole.warn.apply(console, args);
    };

    console.info = function (...args) {
        const message = parseArgs(args);
        const level = detectLevel(message);


        if (!logFilters[level]) {
            return;
        }

        addLog(level, message);
        return originalConsole.info.apply(console, args);
    };

    console.debug = function (...args) {

        if (!logFilters.debug) {
            return;
        }

        const message = parseArgs(args);
        addLog('debug', message);
        return originalConsole.debug.apply(console, args);
    };


    startPeriodicFlush();
}

module.exports = {
    initializeLogCapture,
    addLog,
    sendLogsToDashboard,
    setFilters,
    getFilters: () => ({ ...logFilters })
};