const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const formatTime = () => {
    return new Date().toISOString();
};

const { getErrorCode } = require('./error-codes');


let logCapture = null;
try {
    logCapture = require('./log-capture');
} catch {

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

const logger = {
    info: (message, ...args) => {

        if (!logFilters.info) return;

        const formatted = `${colors.cyan}[INFO]${colors.reset} ${formatTime()} - ${message}`;
        console.log(formatted, ...args);

        if (logCapture) {
            logCapture.addLog('info', `${formatTime()} - ${message}`, ...args);
        }
    },
    success: (message, ...args) => {

        if (!logFilters.success) return;

        const formatted = `${colors.green}[SUCCESS]${colors.reset} ${formatTime()} - ${message}`;
        console.log(formatted, ...args);
        if (logCapture) {
            logCapture.addLog('success', `${formatTime()} - ${message}`, ...args);
        }
    },
    warn: (message, ...args) => {

        if (!logFilters.warn) return;

        const formatted = `${colors.yellow}[WARN]${colors.reset} ${formatTime()} - ${message}`;
        console.warn(formatted, ...args);
        if (logCapture) {
            logCapture.addLog('warn', `${formatTime()} - ${message}`, ...args);
        }
    },
    error: (message, error = null, ...args) => {

        if (!logFilters.error) return;

        let errorInfo = '';
        if (error) {
            const errorCode = getErrorCode(error);
            errorInfo = ` [${errorCode}]`;
            if (error.context) {
                errorInfo += ` Contexte: ${JSON.stringify(error.context)}`;
            }
        }
        const formatted = `${colors.red}[ERROR]${colors.reset}${errorInfo} ${formatTime()} - ${message}`;
        console.error(formatted, ...args);
        if (error) {
            console.error(`${colors.red}Stack:${colors.reset}`, error.stack || error);
            if (logCapture) {
                logCapture.addLog('error', `${formatTime()} - ${message}${errorInfo}\nStack: ${error.stack || error}`, ...args);
            }
        } else {
            if (logCapture) {
                logCapture.addLog('error', `${formatTime()} - ${message}${errorInfo}`, ...args);
            }
        }
    },
    debug: (message, ...args) => {

        if (!logFilters.debug) return;

        if (process.env.DEBUG === 'true') {
            const formatted = `${colors.magenta}[DEBUG]${colors.reset} ${formatTime()} - ${message}`;
            console.log(formatted, ...args);
            if (logCapture) {
                logCapture.addLog('debug', `${formatTime()} - ${message}`, ...args);
            }
        }
    },
    setFilters: setFilters,
    getFilters: () => ({ ...logFilters })
};

module.exports = logger;