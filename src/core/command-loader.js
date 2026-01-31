const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');
const { validateCommand } = require('../utils/command-validator');
const config = require('../config');

class CommandLoader {

    static getCommandFeature(commandName) {
        const featureMap = {
            'mod': 'moderation',
            'concours': 'giveaway',
            'ticket': 'tickets',
            'suggestion': 'suggestion',
            'market-rotate': 'market',
            'market-publish': 'market',

        };
        return featureMap[commandName];
    }


    static isCommandEnabled(commandName) {


        if (config.commands && config.commands[commandName] !== undefined) {
            return config.commands[commandName] === true;
        }


        const feature = this.getCommandFeature(commandName);
        if (feature && config[feature]?.enabled === false) {
            return false;
        }


        return true;
    }

    static loadCommands() {
        const commands = new Collection();
        const commandsPath = path.join(__dirname, '../commands');

        try {
            if (!fs.existsSync(commandsPath)) {
                logger.warn('Commands directory does not exist');
                return commands;
            }

            const folders = fs.readdirSync(commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const folder of folders) {
                const folderPath = path.join(commandsPath, folder);
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                for (const file of files) {
                    const filePath = path.join(folderPath, file);

                    try {
                        delete require.cache[require.resolve(filePath)];
                        const command = require(filePath);

                        if (validateCommand(command, filePath)) {
                            const commandName = command.data.name;


                            if (!this.isCommandEnabled(commandName)) {
                                logger.info(`Command ${commandName} is disabled, skipping...`);
                                continue;
                            }

                            if (commands.has(commandName)) {
                                logger.warn(`Duplicate command name: ${commandName} (from ${filePath})`);
                            } else {
                                commands.set(commandName, command);
                                logger.success(`Loaded command: ${commandName}`);
                            }
                        }
                    } catch (error) {
                        logger.error(`Failed to load command ${filePath}`, error);
                    }
                }
            }

            return commands;
        } catch (error) {
            logger.error('Failed to load commands', error);
            throw error;
        }
    }
}

module.exports = CommandLoader;