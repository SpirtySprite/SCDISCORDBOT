const CommandService = require('./command.service');

class SearchService {
    static search(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        const results = [];


        const commands = CommandService.getCommands();
        commands.forEach(cmd => {
            if (cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)) {
                results.push({
                    type: 'command',
                    title: cmd.name,
                    description: cmd.description,
                    link: `#/commands?search=${cmd.name}`
                });
            }
        });


        const categories = [
            { id: 'discord', name: 'Discord Settings' },
            { id: 'moderation', name: 'Moderation Config' },
            { id: 'giveaway', name: 'Giveaway Config' },
            { id: 'tickets', name: 'Tickets Config' },
            { id: 'suggestion', name: 'Suggestion Config' },
            { id: 'market', name: 'Market Config' },
            { id: 'eventLogs', name: 'Event Logs' },
            { id: 'colors', name: 'Color Settings' },
            { id: 'messages', name: 'Message Templates' },
            { id: 'rateLimits', name: 'Rate Limits' },
            { id: 'features', name: 'Feature Flags' },
            { id: 'advanced', name: 'Advanced Settings' }
        ];

        categories.forEach(cat => {
            if (cat.name.toLowerCase().includes(q)) {
                results.push({
                    type: 'config',
                    title: cat.name,
                    description: `Configuration page for ${cat.name}`,
                    link: `#/config/${cat.id}`
                });
            }
        });

        return results;
    }
}

module.exports = SearchService;