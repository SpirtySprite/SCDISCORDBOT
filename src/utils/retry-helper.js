const logger = require('./logger');
const { getErrorCode, ERROR_CODES } = require('./error-codes');


class RetryHelper {

    static async retry(fn, options = {}) {
        const {
            maxRetries = 3,
            delay = 1000,
            backoff = 2,
            shouldRetry = null,
            operationName = 'Opération'
        } = options;

        let lastError;
        let currentDelay = delay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (attempt > 0) {
                    logger.success(`${operationName} réussie après ${attempt} tentative(s)`);
                }
                return result;
            } catch (error) {
                lastError = error;
                const errorCode = getErrorCode(error);


                const canRetry = shouldRetry
                    ? shouldRetry(error, attempt)
                    : this.shouldRetryDefault(error, attempt, maxRetries);

                if (!canRetry || attempt >= maxRetries) {
                    if (attempt > 0) {
                        logger.error(`${operationName} échouée après ${attempt + 1} tentative(s)`, error);
                    }
                    throw error;
                }


                logger.warn(`${operationName} échouée (tentative ${attempt + 1}/${maxRetries + 1}). Nouvelle tentative dans ${currentDelay}ms...`);
                logger.debug(`Code d'erreur: ${errorCode}`, error);


                await this.sleep(currentDelay);


                currentDelay *= backoff;
            }
        }

        throw lastError;
    }


    static shouldRetryDefault(error, attempt, maxRetries) {
        if (attempt >= maxRetries) {
            return false;
        }

        const errorCode = getErrorCode(error);
        const retryableCodes = [
            ERROR_CODES.DB_CONNECTION_FAILED,
            ERROR_CODES.DB_TIMEOUT,
            ERROR_CODES.DB_POOL_EXHAUSTED,
            ERROR_CODES.DISCORD_API_ERROR,
            ERROR_CODES.DISCORD_RATE_LIMIT,
            ERROR_CODES.GENERIC_TIMEOUT
        ];


        if (retryableCodes.includes(errorCode)) {
            return true;
        }


        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return true;
        }


        if (error.code === 429 || error.retryAfter) {
            return true;
        }


        if (errorCode === ERROR_CODES.CMD_INVALID_INPUT ||
            errorCode === ERROR_CODES.CMD_MISSING_PERMISSION ||
            errorCode === ERROR_CODES.DISCORD_PERMISSION_DENIED) {
            return false;
        }

        return false;
    }


    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = RetryHelper;