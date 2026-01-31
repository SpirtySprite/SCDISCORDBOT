
const logCapture = require('./src/utils/log-capture');
logCapture.initializeLogCapture();

const Bot = require('./src/core/bot');
const logger = require('./src/utils/logger');

let bot = null;
const startTime = Date.now();


async function startBot() {
    try {

        if (process.env.NODE_ENV === 'production') {
            const path = require('path');
            const fs = require('fs');
            const distPath = path.join(__dirname, 'dashboard/dist');


            if (!fs.existsSync(distPath) || process.env.FORCE_REBUILD === 'true') {
                logger.info('🔨 Building obfuscated frontend for production...');
                try {
                    const { execSync } = require('child_process');
                    execSync('npm run build:frontend', {
                        stdio: 'inherit',
                        cwd: __dirname
                    });
                    logger.success('✅ Frontend build complete');
                } catch (buildError) {
                    logger.warn('⚠️  Frontend build failed, continuing with existing build or fallback');
                    logger.warn('⚠️  Run "npm run build:frontend" manually if needed');
                }
            } else {
                logger.debug('📦 Using existing obfuscated frontend build');
            }
        }

        bot = new Bot();

        await bot.initialize();


        const elapsed = Date.now() - startTime;
        logger.success(`⚡ Bot démarré en ${(elapsed / 1000).toFixed(2)} secondes`);
    } catch (error) {
        logger.error('Échec du démarrage du bot', error);

        if (bot && typeof bot.destroy === 'function') {
            try {
                bot.destroy();
            } catch (destroyError) {
                logger.error('Erreur lors du nettoyage du bot', destroyError);
            }
        }
        process.exit(1);
    }
}

startBot();

process.on('SIGINT', () => {
    logger.info('Arrêt en cours...');
    if (bot) {
        bot.destroy();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Arrêt en cours...');
    if (bot) {
        bot.destroy();
    }
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    logger.error('Promesse rejetée non gérée', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Exception non gérée', error);
    process.exit(1);
});