const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const STATE_PATH = path.join(__dirname, '../data/market-state.json');
const PREVIOUS_STATE_PATH = path.join(__dirname, '../data/market-state-previous.json');

/**
 * Charge l'état actuel du marché
 */
function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const fileContents = fs.readFileSync(STATE_PATH, 'utf8');
            const state = JSON.parse(fileContents);


            if (!state.buffed) state.buffed = [];
            if (!state.nerfed) state.nerfed = [];
            if (!state.reset) state.reset = [];

            return state;
        } else {

            return {
                lastUpdated: new Date().toISOString().split('T')[0],
                buffed: [],
                nerfed: [],
                reset: []
            };
        }
    } catch (error) {
        logger.error('Failed to load market-state.json', error);
        throw new Error(`Failed to load state: ${error.message}`);
    }
}

/**
 * Charge l'état précédent du marché
 */
function loadPreviousState() {
    try {
        if (fs.existsSync(PREVIOUS_STATE_PATH)) {
            const fileContents = fs.readFileSync(PREVIOUS_STATE_PATH, 'utf8');
            const state = JSON.parse(fileContents);

            if (!state.buffed) state.buffed = [];
            if (!state.nerfed) state.nerfed = [];
            if (!state.reset) state.reset = [];

            return state;
        }
        return null;
    } catch (error) {
        logger.error('Failed to load previous market-state.json', error);
        return null;
    }
}

/**
 * Sauvegarde l'état du marché (sauvegarde automatiquement l'état précédent)
 */
function saveState(state) {
    try {

        if (fs.existsSync(STATE_PATH)) {
            const currentStateContent = fs.readFileSync(STATE_PATH, 'utf8');
            fs.writeFileSync(PREVIOUS_STATE_PATH, currentStateContent, 'utf8');
        }


        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
        logger.error('Failed to save market-state.json', error);
        throw new Error(`Failed to save state: ${error.message}`);
    }
}

/**
 * Reviens à l'état précédent du marché
 */

function revertToPreviousState() {
    try {
        if (!fs.existsSync(PREVIOUS_STATE_PATH)) {
            throw new Error('No previous state found');
        }

        const previousStateContent = fs.readFileSync(PREVIOUS_STATE_PATH, 'utf8');
        const previousState = JSON.parse(previousStateContent);


        if (!previousState.buffed) previousState.buffed = [];
        if (!previousState.nerfed) previousState.nerfed = [];
        if (!previousState.reset) previousState.reset = [];


        if (fs.existsSync(STATE_PATH)) {
            const currentStateContent = fs.readFileSync(STATE_PATH, 'utf8');


            const tempBackupPath = PREVIOUS_STATE_PATH + '.temp';
            fs.writeFileSync(tempBackupPath, currentStateContent, 'utf8');
        }


        fs.writeFileSync(STATE_PATH, previousStateContent, 'utf8');


        const tempBackupPath = PREVIOUS_STATE_PATH + '.temp';
        if (fs.existsSync(tempBackupPath)) {
            fs.writeFileSync(PREVIOUS_STATE_PATH, fs.readFileSync(tempBackupPath, 'utf8'), 'utf8');
            fs.unlinkSync(tempBackupPath);
        }

        return previousState;
    } catch (error) {
        logger.error('Failed to revert to previous state', error);
        throw new Error(`Failed to revert state: ${error.message}`);
    }
}

module.exports = {
    loadState,
    loadPreviousState,
    saveState,
    revertToPreviousState,
    STATE_PATH,
    PREVIOUS_STATE_PATH
};