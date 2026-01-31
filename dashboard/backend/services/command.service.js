const fs = require('fs');
const path = require('path');
const ConfigManager = require('./config.manager');

class CommandService {
    static getCommands() {
        try {
            console.log('[COMMANDS] Scanning for bot commands...');
            const commandsPath = path.join(__dirname, '../../../src/commands');
            const commands = [];

            if (!fs.existsSync(commandsPath)) {
                console.error(`[COMMANDS ERROR] Directory not found: ${commandsPath}`);
                return [];
            }

            const folders = fs.readdirSync(commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            console.log(`[COMMANDS] Found ${folders.length} command folders: ${folders.join(', ')}`);

            const config = ConfigManager.getFullConfig();

            for (const folder of folders) {
                const folderPath = path.join(commandsPath, folder);
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');


                        const nameMatch = content.match(/\.setName\(['"](.+?)['"]\)/);
                        const descMatch = content.match(/\.setDescription\(['"](.+?)['"]\)/);

                        if (nameMatch) {
                            const name = nameMatch[1];
                            const description = descMatch ? descMatch[1] : 'Pas de description';


                            const featureMap = {
                                'mod': 'moderation',
                                'concours': 'giveaways',
                                'ticket': 'tickets',
                                'suggestion': 'logs',
                                'market-rotate': 'market',
                                'market-publish': 'market',
                            };

                            const featureKey = featureMap[name];
                            const section = featureKey ? config[featureKey] : null;

                            const commandConfig = config.commands || {};
                            let isEnabled = true;


                            if (section && section.enabled === false) {
                                isEnabled = false;
                            }


                            if (commandConfig[name] !== undefined) {
                                isEnabled = commandConfig[name] === true;
                            }

                            commands.push({
                                name,
                                description,
                                category: folder,
                                enabled: isEnabled,
                                feature: featureKey || name
                            });
                        }
                    } catch (error) {
                        console.error(`[COMMANDS ERROR] Failed to parse file ${file}:`, error.message);
                    }
                }
            }

            console.log(`[COMMANDS] Successfully indexed ${commands.length} commands`);
            return commands;
        } catch (error) {
            console.error('[COMMANDS ERROR] Critical failure scanning commands:', error);
            return [];
        }
    }

    static toggleCommand(commandName, enabled) {
        return ConfigManager.toggleCommand(commandName, enabled);
    }
}

module.exports = CommandService;