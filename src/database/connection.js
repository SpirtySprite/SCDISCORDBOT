const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const createPool = () => {
    const poolConfig = config.database.connectionPool || {};
    const dbConfig = {
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        waitForConnections: true,
        connectionLimit: poolConfig.connectionLimit || config.database.connectionLimit || 100,
        queueLimit: poolConfig.queueLimit || 0,
        enableKeepAlive: poolConfig.enableKeepAlive !== false,
        keepAliveInitialDelay: poolConfig.keepAliveInitialDelay || 0,
        connectTimeout: poolConfig.connectTimeout || 10000,
        idleTimeout: poolConfig.idleTimeout || 600000,
        maxIdle: poolConfig.maxIdle || 10
    };

    if (config.database.ssl) {


        const defaultCertPath = path.join('certs', 'server-ca.pem');
        let certPath = config.database.caPath || defaultCertPath;


        if (config.database.caPath && fs.existsSync(config.database.caPath)) {
            const stat = fs.statSync(config.database.caPath);
            if (stat.isDirectory()) {

                certPath = path.join(config.database.caPath, 'server-ca.pem');
            } else if (stat.isFile()) {

                certPath = config.database.caPath;
            }
        }


        const resolvedCertPath = path.resolve(certPath);


        if (fs.existsSync(certPath) && fs.statSync(certPath).isFile()) {
            try {
                dbConfig.ssl = {
                    ca: fs.readFileSync(certPath),
                    rejectUnauthorized: true
                };
                logger.info(`Certificat SSL chargé depuis ${resolvedCertPath}`);
            } catch (error) {
                logger.warn(`Échec du chargement du certificat SSL: ${error.message}`);

                dbConfig.ssl = { rejectUnauthorized: false };
                logger.warn('Connexion sans vérification du certificat (moins sécurisé).');
            }
        } else {


            dbConfig.ssl = { rejectUnauthorized: false };
            if (config.database.caPath) {
                const providedPath = fs.existsSync(config.database.caPath) && fs.statSync(config.database.caPath).isDirectory()
                    ? path.join(config.database.caPath, 'server-ca.pem')
                    : config.database.caPath;
                logger.warn(`Fichier de certificat SSL introuvable à ${path.resolve(providedPath)}.`);
            } else {
                logger.warn(`Fichier de certificat SSL introuvable à l'emplacement par défaut: ${path.resolve(defaultCertPath)}`);
            }
            logger.warn('Tentative de connexion sans vérification du certificat (moins sécurisé).');
            logger.warn('Pour activer la vérification SSL sécurisée, téléchargez le certificat CA du serveur depuis Google Cloud Console.');
        }
    }

    return mysql.createPool(dbConfig);
};

const pool = createPool();


const testConnection = async (silent = false) => {
    const { ERROR_CODES, BotError } = require('../utils/error-codes');

    try {
        const connection = await pool.getConnection();
        await connection.ping();


        const [dbResult] = await connection.query('SELECT DATABASE() as current_db');
        const currentDb = dbResult[0]?.current_db || 'unknown';


        if (!silent) {
            logger.info(`Connecté à la base de données: ${currentDb}`);

            if (currentDb !== config.database.database) {
                logger.warn(`ATTENTION: Connecté à '${currentDb}' mais '${config.database.database}' était attendu`);
            }

            logger.success('Connexion à la base de données réussie');
        }

        connection.release();
        return true;
    } catch (error) {
        const errorCode = error instanceof BotError ? error.code : ERROR_CODES.DB_CONNECTION_FAILED;


        if (!silent) {
            logger.error('Échec de la connexion à la base de données', error);
            logger.error(`Détails de connexion: ${config.database.host}:${config.database.port}/${config.database.database}`);

            if (error.code === 'ENOTFOUND') {
                logger.error('Résolution DNS échouée. Vérifiez que l\'adresse de l\'hôte est correcte.');
            } else if (error.code === 'ECONNREFUSED') {
                logger.error('Connexion refusée. Vérifiez que la base de données est en cours d\'exécution et accessible.');
            } else if (error.message && error.message.includes('certificate')) {
                logger.error('Erreur de certificat SSL. Vous devrez peut-être télécharger le certificat CA du serveur depuis Google Cloud Console.');
                logger.error('Consultez README.md pour les instructions de téléchargement du certificat.');
            }
        }
        return false;
    }
};

const { ERROR_CODES, BotError } = require('../utils/error-codes');
const RetryHelper = require('../utils/retry-helper');
const dbFallback = require('../utils/db-fallback');

const query = async (sql, params = [], options = {}) => {
    const { useRetry = true, useFallback = true, context = '' } = options;

    const executeQuery = async () => {
        let connection;
        try {
            const queryConfig = config.database.query || {};
            const acquireTimeout = queryConfig.acquireTimeout || 30000;
            connection = await Promise.race([
                pool.getConnection(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new BotError(
                        ERROR_CODES.DB_TIMEOUT,
                        'Timeout lors de l\'obtention d\'une connexion depuis le pool',
                        { sql: sql.substring(0, 100), timeout: acquireTimeout }
                    )), acquireTimeout)
                )
            ]);

            const [rows] = await connection.query(sql, params);
            return rows;
        } catch (error) {

            if (!(error instanceof BotError)) {
                let errorCode = ERROR_CODES.DB_QUERY_FAILED;
                let errorMessage = 'Erreur lors de l\'exécution de la requête';

                if (error.message && error.message.includes('pool exhausted')) {
                    errorCode = ERROR_CODES.DB_POOL_EXHAUSTED;
                    errorMessage = 'Trop de connexions simultanées à la base de données';
                } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    errorCode = ERROR_CODES.DB_CONNECTION_FAILED;
                    errorMessage = 'Impossible de se connecter à la base de données';
                }


                throw new BotError(errorCode, errorMessage, {
                    originalError: error.message || String(error),
                    originalErrorCode: error.code,
                    originalErrorObj: {
                        code: error.code,
                        errno: error.errno,
                        sqlState: error.sqlState,
                        sqlMessage: error.sqlMessage
                    },
                    sql: sql.substring(0, 200),
                    context: context || 'query'
                });
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    };

    if (useRetry) {
        const queryConfig = config.database.query || {};
        const retryConfig = queryConfig.retry || {};
        return await RetryHelper.retry(executeQuery, {
            maxRetries: retryConfig.maxRetries || 3,
            delay: retryConfig.initialDelay || 1000,
            backoff: retryConfig.backoffMultiplier || 2,
            operationName: `Requête DB${context ? ` (${context})` : ''}`
        });
    }

    return await executeQuery();
};

const transaction = async (callback, options = {}) => {
    const { useRetry = true, context = '' } = options;
    const { ERROR_CODES, BotError } = require('../utils/error-codes');

    const executeTransaction = async () => {
        let connection;
        try {
            const queryConfig = config.database.query || {};
            const acquireTimeout = queryConfig.acquireTimeout || 30000;
            connection = await Promise.race([
                pool.getConnection(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new BotError(
                        ERROR_CODES.DB_TIMEOUT,
                        'Timeout lors de l\'obtention d\'une connexion pour la transaction',
                        { timeout: acquireTimeout, context }
                    )), acquireTimeout)
                )
            ]);

            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            if (connection) {
                logger.error('Erreur de transaction, annulation des modifications', error);
                await connection.rollback().catch(rollbackError => {
                    logger.error('Échec de l\'annulation de la transaction', rollbackError);
                });
            }


            if (!(error instanceof BotError)) {
                throw new BotError(
                    ERROR_CODES.DB_TRANSACTION_FAILED,
                    'Erreur lors de l\'exécution de la transaction',
                    { originalError: error.message, context }
                );
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    };

    if (useRetry) {
        const queryConfig = config.database.query || {};
        const retryConfig = queryConfig.retry || {};
        return await RetryHelper.retry(executeTransaction, {
            maxRetries: Math.min(retryConfig.maxRetries || 3, 2),
            delay: retryConfig.initialDelay || 1000,
            backoff: retryConfig.backoffMultiplier || 2,
            operationName: `Transaction DB${context ? ` (${context})` : ''}`
        });
    }

    return await executeTransaction();
};

module.exports = {
    pool,
    query,
    transaction,
    testConnection
};