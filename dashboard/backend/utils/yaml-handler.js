const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../src/utils/logger');

const CONFIG_PATH = path.join(__dirname, '../../../src/config/discordconfig.yml');

const readYaml = () => {
    try {
        const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
        logger.error('Error reading YAML config:', error);
        throw error;
    }
};

const writeYaml = (data) => {
    try {

        const backupPath = `${CONFIG_PATH}.${Date.now()}.bak`;
        fs.copyFileSync(CONFIG_PATH, backupPath);

        const yamlStr = yaml.dump(data, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });


        const header = "# Serenity Craft Bot Configuration\n# Updated via Dashboard\n\n";
        fs.writeFileSync(CONFIG_PATH, header + yamlStr, 'utf8');

        return true;
    } catch (error) {
        logger.error('Error writing YAML config:', error);
        throw error;
    }
};

module.exports = {
    readYaml,
    writeYaml
};