const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../src/utils/logger');

const CONFIG_PATH = path.join(__dirname, '../../../src/config/discordconfig.yml');

/**
 * YAML Config Manager - Single source of truth for YAML file operations
 * Uses simple load/update/write approach instead of fragile line-by-line updates
 */
class YAMLConfigManager {
    /**
     * Load the full config from YAML file
     * @returns {Object} Full config object with Discord root key
     */
    static loadConfig() {
        try {
            if (!fs.existsSync(CONFIG_PATH)) {
                throw new Error('Config file not found');
            }

            const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
            const config = yaml.load(fileContents);


            if (!config || typeof config !== 'object') {
                throw new Error('Invalid config file format');
            }


            if (!config.Discord) {
                return { Discord: config };
            }

            return config;
        } catch (error) {
            logger.error('[YAML CONFIG MANAGER] Failed to load config:', error);
            throw error;
        }
    }

    /**
     * Save the full config to YAML file
     * @param {Object} config - Full config object
     * @returns {boolean} Success
     */
    static saveConfig(config) {
        try {

            if (fs.existsSync(CONFIG_PATH)) {
                const backupPath = `${CONFIG_PATH}.${Date.now()}.bak`;
                fs.copyFileSync(CONFIG_PATH, backupPath);
                logger.debug(`[YAML CONFIG MANAGER] Created backup: ${path.basename(backupPath)}`);
            }


            const configToSave = config.Discord ? config : { Discord: config };


            const yamlStr = yaml.dump(configToSave, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: false,
                sortKeys: false
            });

            fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');
            logger.success('[YAML CONFIG MANAGER] Config saved successfully');
            return true;
        } catch (error) {
            logger.error('[YAML CONFIG MANAGER] Failed to save config:', error);
            throw error;
        }
    }

    /**
     * Get a specific domain from config
     * @param {string} domainPath - Dot-separated path (e.g., "Discord.moderation")
     * @returns {Object|null} Domain config or null if not found
     */
    static getDomain(domainPath) {
        try {
            const config = this.loadConfig();
            const keys = domainPath.split('.');

            let result = config;
            for (const key of keys) {
                if (result && result[key] !== undefined) {
                    result = result[key];
                } else {
                    return null;
                }
            }

            return result;
        } catch (error) {
            logger.error(`[YAML CONFIG MANAGER] Failed to get domain ${domainPath}:`, error);
            throw error;
        }
    }

    /**
     * Deep merge utility - merges source into target
     * Arrays are replaced, not merged
     */
    static deepMerge(target, source) {
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key]) && this.isObject(target[key])) {
                    output[key] = this.deepMerge(target[key], source[key]);
                } else if (Array.isArray(source[key])) {

                    output[key] = source[key];
                } else {
                    output[key] = source[key];
                }
            });
        }

        return output;
    }

    /**
     * Check if value is a plain object
     */
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Update a specific domain in config
     * @param {string} domainPath - Dot-separated path (e.g., "Discord.moderation")
     * @param {Object} data - Data to merge into the domain
     * @param {boolean} merge - If true, merge with existing data. If false, replace entirely
     * @returns {boolean} Success
     */
    static updateDomain(domainPath, data, merge = true) {
        try {
            const config = this.loadConfig();
            const keys = domainPath.split('.');


            let current = config;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || !this.isObject(current[key])) {
                    current[key] = {};
                }
                current = current[key];
            }


            const targetKey = keys[keys.length - 1];


            if (merge && current[targetKey] && this.isObject(current[targetKey]) && this.isObject(data)) {

                current[targetKey] = this.deepMerge(current[targetKey], data);
            } else {

                current[targetKey] = data;
            }


            return this.saveConfig(config);
        } catch (error) {
            logger.error(`[YAML CONFIG MANAGER] Failed to update domain ${domainPath}:`, error);
            throw error;
        }
    }
}

module.exports = YAMLConfigManager;