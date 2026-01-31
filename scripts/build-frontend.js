const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const FRONTEND_DIR = path.join(__dirname, '../dashboard/frontend');
const DIST_DIR = path.join(__dirname, '../dashboard/dist');


const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

async function buildFrontend() {
    console.log('🔨 Building frontend with obfuscation...');


    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }


    const nonJsFiles = await glob('**/*', {
        cwd: FRONTEND_DIR,
        ignore: ['**/*.js', 'node_modules/**']
    });

    console.log('📁 Copying non-JS files...');
    for (const file of nonJsFiles) {
        const srcPath = path.join(FRONTEND_DIR, file);
        const destPath = path.join(DIST_DIR, file);
        const destDir = path.dirname(destPath);


        if (fs.statSync(srcPath).isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            continue;
        }

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(srcPath, destPath);
    }


    const jsFiles = await glob('**/*.js', {
        cwd: FRONTEND_DIR,
        ignore: ['node_modules/**']
    });

    console.log(`🔒 Obfuscating ${jsFiles.length} JavaScript files...`);
    for (const file of jsFiles) {
        const srcPath = path.join(FRONTEND_DIR, file);
        const destPath = path.join(DIST_DIR, file);
        const destDir = path.dirname(destPath);

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        try {
            const code = fs.readFileSync(srcPath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
            const obfuscatedCode = obfuscationResult.getObfuscatedCode();

            fs.writeFileSync(destPath, obfuscatedCode, 'utf8');
            console.log(`✅ Obfuscated: ${file}`);
        } catch (error) {
            console.error(`❌ Error obfuscating ${file}:`, error.message);

            fs.copyFileSync(srcPath, destPath);
            console.log(`⚠️  Copied original (non-obfuscated): ${file}`);
        }
    }

    console.log('✨ Build complete! Obfuscated files in dashboard/dist/');
    console.log('💡 Your source code in dashboard/frontend/ remains clean and unchanged.');
}

buildFrontend().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
});
