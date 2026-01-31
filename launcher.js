const { spawn } = require('child_process');
const path = require('path');

let bot = null;
let dashboard = null;
let startTime = Date.now();


const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
};

const formatTime = () => {
    return new Date().toISOString();
};

const logGitHub = (message) => {
    console.log(`${colors.blue}[GITHUB]${colors.reset} ${formatTime()} - ${message}`);
};

const logInfo = (message) => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${formatTime()} - ${message}`);
};

function pullLatestCode(callback) {
    logGitHub('🔄 Pulling latest changes from GitHub...');

    const fetch = spawn('git', ['fetch', 'origin', 'main'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
    });

    let fetchOutput = '';
    let fetchError = '';

    fetch.stdout.on('data', (data) => {
        fetchOutput += data.toString();
    });

    fetch.stderr.on('data', (data) => {
        const errorText = data.toString();
        fetchError += errorText;

        if (!errorText.includes('not a git repository') &&
            !errorText.includes('GIT_DISCOVERY_ACROSS_FILESYSTEM') &&
            !errorText.includes('fatal:')) {
            process.stderr.write(data);
        }
    });

    fetch.on('close', (code) => {


        if (code === 0) {
            logGitHub('✅ Git fetch successful (skipping reset to preserve local config).');
            callback();
        } else {

            if (fetchError.includes('not a git repository') ||
                fetchError.includes('GIT_DISCOVERY_ACROSS_FILESYSTEM')) {
                logGitHub('ℹ️  Not a git repository or git unavailable. Starting bot with current code...');
            } else {
                logGitHub('ℹ️  Git fetch failed. Starting bot with current code...');
            }
            callback();
        }
    });

    fetch.on('error', (error) => {

        if (error.code === 'ENOENT') {
            logGitHub('ℹ️  Git not found. Starting bot with current code...');
        } else {
            logGitHub('ℹ️  Git error. Starting bot with current code...');
        }
        callback();
    });
}

function buildFrontend(callback) {
    logInfo('🔨 Building obfuscated frontend...');



    const isWindows = process.platform === 'win32';

    const build = spawn('npm', ['run', 'build:frontend'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env },
        shell: isWindows
    });

    let buildOutput = '';
    let buildError = '';
    let callbackCalled = false;

    const safeCallback = () => {
        if (!callbackCalled) {
            callbackCalled = true;
            callback();
        }
    };

    build.stdout.on('data', (data) => {
        buildOutput += data.toString();

        process.stdout.write(`\x1b[36m[BUILD]\x1b[0m ${data}`);
    });

    build.stderr.on('data', (data) => {
        buildError += data.toString();
        process.stderr.write(`\x1b[33m[BUILD]\x1b[0m ${data}`);
    });

    build.on('close', (code) => {
        if (code === 0) {
            logInfo('✅ Frontend obfuscation complete');
            safeCallback();
        } else {
            logInfo(`⚠️  Frontend build failed with code ${code}, continuing with existing build or fallback...`);
            if (buildError) {
                logInfo(`Build error: ${buildError.substring(0, 200)}`);
            }
            safeCallback();
        }
    });

    build.on('error', (error) => {
        logInfo(`⚠️  Frontend build error: ${error.message}`);
        logInfo('⚠️  Continuing with existing build or fallback...');
        safeCallback();
    });
}

function startDashboard() {
    logInfo('🌐 Launching dashboard...');

    if (dashboard) {
        dashboard.kill();
        dashboard = null;
    }



    const env = {
        ...process.env,
        NODE_ENV: 'production',
        ALLOW_BYPASS_IN_PRODUCTION: 'true'
    };

    dashboard = spawn('node', ['dashboard/backend/server.js'], {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: env
    });

    dashboard.stdout.on('data', (data) => {
        const output = data.toString();

        process.stdout.write(`\x1b[35m[DASHBOARD]\x1b[0m ${output}`);
    });

    dashboard.stderr.on('data', (data) => {
        const output = data.toString();
        process.stderr.write(`\x1b[31m[DASHBOARD ERROR]\x1b[0m ${output}`);
    });

    dashboard.on('close', (code) => {
        if (code !== 0 && code !== null) {
            logInfo(`⚠️ Dashboard stopped with code ${code}. Restarting in 5 seconds...`);
            setTimeout(startDashboard, 5000);
        }
    });

    dashboard.on('error', (error) => {
        logInfo('❌ Failed to start dashboard:', error);
    });
}

function startBot() {
    startTime = Date.now();
    logGitHub('🚀 Launching bot...');

    if (bot) {
        bot.kill();
        bot = null;
    }

    bot = spawn('node', ['index.js'], {
        stdio: 'pipe',
        cwd: process.cwd()
    });

    let readyMessageShown = false;


    bot.stdout.on('data', (data) => {
        const output = data.toString();
        process.stdout.write(output);



        if (!readyMessageShown && (output.includes('Bot initialisé avec succès') ||
            output.includes('Bot initialized successfully') ||
            output.includes('Bot démarré en'))) {
            readyMessageShown = true;

            const elapsed = Date.now() - startTime;
            if (!output.includes('Bot démarré en')) {
                logInfo(`⚡ Bot démarré en ${(elapsed / 1000).toFixed(2)} secondes`);
            }
        }
    });

    bot.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    bot.on('close', (code) => {
        logInfo(`⚡ Bot stopped with code ${code}.`);

        if (code === 0) {
            logGitHub('🔁 Restarting bot in 1 second...');
            setTimeout(() => pullLatestCode(startBot), 1000);
        } else {
            logInfo('❌ Bot crashed. Not auto-restarting.');
            process.exit(code);
        }
    });

    bot.on('error', (error) => {
        logInfo('❌ Failed to start bot:', error);
        process.exit(1);
    });
}


pullLatestCode(() => {
    buildFrontend(() => {
        startDashboard();
        startBot();
    });
});


process.on('SIGINT', () => {
    logGitHub('\n🛑 Shutting down launcher...');
    if (bot) {
        bot.kill('SIGINT');
    }
    if (dashboard) {
        dashboard.kill('SIGINT');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    logGitHub('\n🛑 Shutting down launcher...');
    if (bot) {
        bot.kill('SIGTERM');
    }
    if (dashboard) {
        dashboard.kill('SIGTERM');
    }
    process.exit(0);
});