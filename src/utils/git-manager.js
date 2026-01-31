const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execAsync = promisify(exec);

class GitManager {

    static async pullFromGitHub(branch = 'main') {
        try {
            logger.info(`Pulling latest changes from GitHub (branch: ${branch})...`);


            const { stdout: fetchOutput, stderr: fetchError } = await execAsync(
                `git fetch origin ${branch}`,
                { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
            );

            if (fetchError && !fetchError.includes('Already up to date')) {
                logger.warn(`Git fetch warning: ${fetchError}`);
            }


            let targetBranch = branch;
            if (!targetBranch || targetBranch === 'main') {
                try {
                    const { stdout: branchOutput } = await execAsync(
                        'git branch --show-current',
                        { cwd: process.cwd() }
                    );
                    targetBranch = branchOutput.trim() || 'main';
                } catch (error) {
                    logger.warn('Could not determine current branch, using main');
                    targetBranch = 'main';
                }
            }


            let pullOutput = '';
            let pullError = '';

            try {
                const result = await execAsync(
                    `git pull origin ${targetBranch}`,
                    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
                );
                pullOutput = result.stdout || '';
                pullError = result.stderr || '';
            } catch (error) {

                const errorMessage = error.stderr || error.message || '';
                if (errorMessage.includes('refusing to merge unrelated histories')) {
                    logger.warn('Unrelated histories detected, attempting merge with --allow-unrelated-histories flag');
                    try {
                        const result = await execAsync(
                            `git pull origin ${targetBranch} --allow-unrelated-histories --no-edit`,
                            { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
                        );
                        pullOutput = result.stdout || '';
                        pullError = result.stderr || '';
                    } catch (retryError) {

                        logger.warn('Merge with unrelated histories flag failed');
                        await execAsync(
                            `git fetch origin ${targetBranch}`,
                            { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
                        ).catch(() => {});
                        return {
                            success: false,
                            error: 'Unable to merge unrelated histories. Please merge manually using: git pull origin ' + targetBranch + ' --allow-unrelated-histories'
                        };
                    }
                } else {

                    pullError = errorMessage;
                    pullOutput = error.stdout || '';
                    return { success: false, error: pullError };
                }
            }

            const output = pullOutput || pullError || '';

            if (pullOutput.includes('Already up to date')) {
                logger.success('Repository is already up to date');
                return { success: true, output: 'Already up to date' };
            }

            if (pullOutput.includes('Updating') || pullOutput.includes('Fast-forward')) {
                logger.success('Successfully pulled latest changes from GitHub');
                logger.info(`Git output: ${output.trim()}`);
                return { success: true, output: output.trim() };
            }

            if (pullError && !pullError.includes('Already up to date')) {
                logger.error(`Git pull error: ${pullError}`);
                return { success: false, error: pullError };
            }

            return { success: true, output: output.trim() };
        } catch (error) {
            logger.error('Failed to pull from GitHub', error);
            return {
                success: false,
                error: error.message || 'Unknown error during git pull'
            };
        }
    }


    static async getCurrentCommit() {
        try {
            const { stdout } = await execAsync(
                'git rev-parse --short HEAD',
                { cwd: process.cwd() }
            );
            return stdout.trim();
        } catch (error) {
            logger.warn('Could not get current commit hash', error);
            return 'unknown';
        }
    }


    static async getCurrentBranch() {
        try {
            const { stdout } = await execAsync(
                'git branch --show-current',
                { cwd: process.cwd() }
            );
            return stdout.trim() || 'main';
        } catch (error) {
            logger.warn('Could not get current branch', error);
            return 'main';
        }
    }


    static async hasUncommittedChanges() {
        try {
            const { stdout } = await execAsync(
                'git status --porcelain',
                { cwd: process.cwd() }
            );
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }
}

module.exports = GitManager;