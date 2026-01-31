const logger = require('./logger');
const { ERROR_CODES, BotError } = require('./error-codes');


class DatabaseFallback {
    constructor() {
        this.isAvailable = true;
        this.lastCheck = null;
        this.checkInterval = 30000;
        this.fallbackMode = false;
        this.healthCheckInterval = null;
    }


    async checkAvailability(testConnection, silent = false) {
        try {

            const available = await testConnection(silent);
            this.isAvailable = available;
            this.lastCheck = Date.now();


            if (available && this.fallbackMode) {
                logger.success('Base de données rétablie - Mode normal activé');
                this.fallbackMode = false;
            } else if (!available && !this.fallbackMode) {
                logger.warn('Base de données indisponible - Mode dégradé activé');
                this.fallbackMode = true;
            }

            return available;
        } catch (error) {
            this.isAvailable = false;
            this.lastCheck = Date.now();
            if (!this.fallbackMode) {
                logger.warn('Base de données indisponible - Mode dégradé activé');
                this.fallbackMode = true;
            }
            return false;
        }
    }


    async executeWithFallback(queryFn, fallbackFn = null, context = '') {
        if (!this.isAvailable && this.fallbackMode) {
            logger.warn(`Tentative d'exécution en mode dégradé: ${context}`);

            if (fallbackFn) {
                try {
                    return await fallbackFn();
                } catch (fallbackError) {
                    logger.error(`Fallback échoué pour: ${context}`, fallbackError);
                    throw new BotError(
                        ERROR_CODES.DB_CONNECTION_FAILED,
                        'La base de données est indisponible et aucune alternative n\'est disponible.',
                        { context, fallbackFailed: true }
                    );
                }
            }

            throw new BotError(
                ERROR_CODES.DB_CONNECTION_FAILED,
                'La base de données est temporairement indisponible. Veuillez réessayer plus tard.',
                { context, fallbackMode: true }
            );
        }

        try {
            return await queryFn();
        } catch (error) {
            const errorCode = require('./error-codes').getErrorCode(error);


            if (errorCode === ERROR_CODES.DB_CONNECTION_FAILED ||
                errorCode === ERROR_CODES.DB_TIMEOUT ||
                errorCode === ERROR_CODES.DB_POOL_EXHAUSTED) {

                if (!this.fallbackMode) {
                    logger.warn('Erreur de base de données détectée - Activation du mode dégradé');
                    this.fallbackMode = true;
                    this.isAvailable = false;
                }


                if (fallbackFn) {
                    logger.info(`Tentative de fallback pour: ${context}`);
                    try {
                        return await fallbackFn();
                    } catch (fallbackError) {
                        logger.error(`Fallback échoué pour: ${context}`, fallbackError);
                    }
                }
            }

            throw error;
        }
    }


    startHealthCheck(testConnection) {

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        this.checkAvailability(testConnection, false);


        this.healthCheckInterval = setInterval(() => {
            this.checkAvailability(testConnection, true);
        }, this.checkInterval);
    }

    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }


    getStatus() {
        return {
            isAvailable: this.isAvailable,
            fallbackMode: this.fallbackMode,
            lastCheck: this.lastCheck
        };
    }
}

module.exports = new DatabaseFallback();