const fs = require('fs');
const path = require('path');

const LEVEL_XP_PATH = path.join(__dirname, '../data/level-xp-requirements.json');

let levelRequirements = null;

function loadLevelRequirements() {
    if (levelRequirements) return levelRequirements;

    try {
        const data = JSON.parse(fs.readFileSync(LEVEL_XP_PATH, 'utf8'));
        levelRequirements = data.levels;
        return levelRequirements;
    } catch (error) {
        throw new Error('Failed to load level requirements');
    }
}

/**
 * Get XP required for a specific level
 * @param {number} level - The level (1-100)
 * @returns {number} XP required for that level, or null if level doesn't exist
 */
function getXPForLevel(level) {
    const requirements = loadLevelRequirements();
    const levelStr = level.toString();
    return requirements[levelStr] || null;
}

/**
 * Calculate the current level based on total XP
 * @param {number} totalXP - Total XP accumulated
 * @returns {Object} { level, currentXP, nextXP }
 */
function calculateLevel(totalXP) {
    const requirements = loadLevelRequirements();

    if (totalXP < 0) {
        return { level: 0, currentXP: 0, nextXP: 100 };
    }


    let currentLevel = 0;
    let currentXP = 0;
    let nextXP = 0;


    for (let level = 1; level <= 100; level++) {
        const requiredXP = requirements[level.toString()];

        if (totalXP >= requiredXP) {
            currentLevel = level;
            currentXP = totalXP - requiredXP;


            if (level < 100) {
                const nextLevelXP = requirements[(level + 1).toString()];
                nextXP = nextLevelXP - requiredXP;
            } else {

                nextXP = 0;
            }
        } else {

            break;
        }
    }


    if (currentLevel === 0) {
        currentLevel = 0;
        currentXP = totalXP;
        nextXP = requirements['1'];
    }

    return {
        level: currentLevel,
        currentXP: currentXP,
        nextXP: nextXP
    };
}

/**
 * Get progress percentage to next level
 * @param {number} currentXP - XP in current level
 * @param {number} nextXP - XP needed for next level
 * @returns {number} Percentage (0-100)
 */
function getProgressPercentage(currentXP, nextXP) {
    if (!nextXP || nextXP === 0) return 100;
    return Math.min(100, Math.round((currentXP / nextXP) * 100));
}

/**
 * Get all level requirements as an array
 * @returns {Array} Array of { level, xpRequired }
 */
function getAllLevelRequirements() {
    const requirements = loadLevelRequirements();
    return Object.entries(requirements).map(([level, xp]) => ({
        level: parseInt(level),
        xpRequired: xp
    }));
}

module.exports = {
    getXPForLevel,
    calculateLevel,
    getProgressPercentage,
    getAllLevelRequirements,
    loadLevelRequirements
};