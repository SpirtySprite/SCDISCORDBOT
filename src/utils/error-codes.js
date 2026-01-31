
const ERROR_CODES = {

    DB_CONNECTION_FAILED: 'DB_001',
    DB_QUERY_FAILED: 'DB_002',
    DB_TRANSACTION_FAILED: 'DB_003',
    DB_POOL_EXHAUSTED: 'DB_004',
    DB_TIMEOUT: 'DB_005',


    DISCORD_API_ERROR: 'DISCORD_001',
    DISCORD_PERMISSION_DENIED: 'DISCORD_002',
    DISCORD_CHANNEL_NOT_FOUND: 'DISCORD_003',
    DISCORD_USER_NOT_FOUND: 'DISCORD_004',
    DISCORD_ROLE_NOT_FOUND: 'DISCORD_005',
    DISCORD_MESSAGE_NOT_FOUND: 'DISCORD_006',
    DISCORD_INTERACTION_EXPIRED: 'DISCORD_007',
    DISCORD_RATE_LIMIT: 'DISCORD_008',


    CMD_EXECUTION_FAILED: 'CMD_001',
    CMD_INVALID_INPUT: 'CMD_002',
    CMD_MISSING_PERMISSION: 'CMD_003',
    CMD_NOT_FOUND: 'CMD_004',
    CMD_TIMEOUT: 'CMD_005',


    FILE_READ_ERROR: 'FILE_001',
    FILE_WRITE_ERROR: 'FILE_002',
    FILE_NOT_FOUND: 'FILE_003',
    FILE_PARSE_ERROR: 'FILE_004',


    CONFIG_LOAD_ERROR: 'CONFIG_001',
    CONFIG_INVALID: 'CONFIG_002',
    CONFIG_MISSING: 'CONFIG_003',


    VALIDATION_FAILED: 'VALIDATION_001',
    VALIDATION_INVALID_FORMAT: 'VALIDATION_002',


    GENERIC_ERROR: 'GENERIC_001',
    GENERIC_UNKNOWN: 'GENERIC_002',
    GENERIC_TIMEOUT: 'GENERIC_003'
};


const ERROR_MESSAGES = {
    [ERROR_CODES.DB_CONNECTION_FAILED]: 'Impossible de se connecter à la base de données. Veuillez vérifier la configuration.',
    [ERROR_CODES.DB_QUERY_FAILED]: 'Erreur lors de l\'exécution d\'une requête à la base de données.',
    [ERROR_CODES.DB_TRANSACTION_FAILED]: 'Erreur lors de l\'exécution d\'une transaction. Les modifications ont été annulées.',
    [ERROR_CODES.DB_POOL_EXHAUSTED]: 'Trop de connexions simultanées à la base de données. Veuillez réessayer plus tard.',
    [ERROR_CODES.DB_TIMEOUT]: 'La requête à la base de données a pris trop de temps. Veuillez réessayer.',

    [ERROR_CODES.DISCORD_API_ERROR]: 'Erreur de communication avec Discord. Veuillez réessayer.',
    [ERROR_CODES.DISCORD_PERMISSION_DENIED]: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.',
    [ERROR_CODES.DISCORD_CHANNEL_NOT_FOUND]: 'Le canal spécifié est introuvable ou inaccessible.',
    [ERROR_CODES.DISCORD_USER_NOT_FOUND]: 'L\'utilisateur spécifié est introuvable.',
    [ERROR_CODES.DISCORD_ROLE_NOT_FOUND]: 'Le rôle spécifié est introuvable.',
    [ERROR_CODES.DISCORD_MESSAGE_NOT_FOUND]: 'Le message spécifié est introuvable.',
    [ERROR_CODES.DISCORD_INTERACTION_EXPIRED]: 'Cette interaction a expiré. Veuillez réessayer.',
    [ERROR_CODES.DISCORD_RATE_LIMIT]: 'Trop de requêtes. Veuillez patienter quelques instants.',

    [ERROR_CODES.CMD_EXECUTION_FAILED]: 'Erreur lors de l\'exécution de la commande.',
    [ERROR_CODES.CMD_INVALID_INPUT]: 'Les paramètres fournis sont invalides.',
    [ERROR_CODES.CMD_MISSING_PERMISSION]: 'Vous n\'avez pas la permission d\'utiliser cette commande.',
    [ERROR_CODES.CMD_NOT_FOUND]: 'Commande introuvable.',
    [ERROR_CODES.CMD_TIMEOUT]: 'La commande a pris trop de temps à s\'exécuter.',

    [ERROR_CODES.FILE_READ_ERROR]: 'Erreur lors de la lecture du fichier.',
    [ERROR_CODES.FILE_WRITE_ERROR]: 'Erreur lors de l\'écriture du fichier.',
    [ERROR_CODES.FILE_NOT_FOUND]: 'Fichier introuvable.',
    [ERROR_CODES.FILE_PARSE_ERROR]: 'Erreur lors de l\'analyse du fichier.',

    [ERROR_CODES.CONFIG_LOAD_ERROR]: 'Erreur lors du chargement de la configuration.',
    [ERROR_CODES.CONFIG_INVALID]: 'La configuration est invalide.',
    [ERROR_CODES.CONFIG_MISSING]: 'Configuration manquante.',

    [ERROR_CODES.VALIDATION_FAILED]: 'La validation des données a échoué.',
    [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Le format des données est invalide.',

    [ERROR_CODES.GENERIC_ERROR]: 'Une erreur est survenue.',
    [ERROR_CODES.GENERIC_UNKNOWN]: 'Erreur inconnue.',
    [ERROR_CODES.GENERIC_TIMEOUT]: 'L\'opération a pris trop de temps.'
};


class BotError extends Error {
    constructor(code, message, context = {}) {
        const errorMessage = message || ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.GENERIC_ERROR];
        super(errorMessage);
        this.name = 'BotError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.isRetryable = this.isRetryableError(code);
    }

    isRetryableError(code) {
        const retryableCodes = [
            ERROR_CODES.DB_CONNECTION_FAILED,
            ERROR_CODES.DB_TIMEOUT,
            ERROR_CODES.DB_POOL_EXHAUSTED,
            ERROR_CODES.DISCORD_API_ERROR,
            ERROR_CODES.DISCORD_RATE_LIMIT,
            ERROR_CODES.GENERIC_TIMEOUT
        ];
        return retryableCodes.includes(code);
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            isRetryable: this.isRetryable
        };
    }
}


function getErrorCode(error) {
    if (error instanceof BotError) {
        return error.code;
    }


    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return ERROR_CODES.DB_CONNECTION_FAILED;
    }
    if (error.message && error.message.includes('pool exhausted')) {
        return ERROR_CODES.DB_POOL_EXHAUSTED;
    }
    if (error.message && error.message.includes('timeout')) {
        return ERROR_CODES.DB_TIMEOUT;
    }
    if (error.sqlMessage || error.sqlState) {
        return ERROR_CODES.DB_QUERY_FAILED;
    }


    if (error.code === 50001 || error.code === 50013) {
        return ERROR_CODES.DISCORD_PERMISSION_DENIED;
    }
    if (error.code === 10003 || error.code === 10008) {
        return ERROR_CODES.DISCORD_CHANNEL_NOT_FOUND;
    }
    if (error.code === 10004) {
        return ERROR_CODES.DISCORD_USER_NOT_FOUND;
    }
    if (error.code === 10011) {
        return ERROR_CODES.DISCORD_INTERACTION_EXPIRED;
    }
    if (error.code === 429 || error.retryAfter) {
        return ERROR_CODES.DISCORD_RATE_LIMIT;
    }
    if (error.code && error.code >= 50000) {
        return ERROR_CODES.DISCORD_API_ERROR;
    }


    if (error.code === 'ENOENT') {
        return ERROR_CODES.FILE_NOT_FOUND;
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
        return ERROR_CODES.FILE_READ_ERROR;
    }

    return ERROR_CODES.GENERIC_ERROR;
}


function formatUserErrorMessage(error, includeCode = false) {
    const code = getErrorCode(error);
    const message = error instanceof BotError
        ? error.message
        : (ERROR_MESSAGES[code] || error.message || ERROR_MESSAGES[ERROR_CODES.GENERIC_ERROR]);

    if (includeCode) {
        return `${message}\n\n\`Code d'erreur: ${code}\``;
    }

    return message;
}

module.exports = {
    ERROR_CODES,
    ERROR_MESSAGES,
    BotError,
    getErrorCode,
    formatUserErrorMessage
};