const logger = require('./logger');

const validateCommand = (command, filePath) => {
    const errors = [];

    if (!command.data) {
        errors.push('Missing data property');
    }

    if (!command.execute) {
        errors.push('Missing execute function');
    }

    if (command.data) {
        if (!command.data.name) {
            errors.push('Command name is required');
        }

        if (command.data.name && command.data.name.length > 32) {
            errors.push('Command name must be 32 characters or less');
        }

        if (command.data.name && !/^[\w-]{1,32}$/.test(command.data.name)) {
            errors.push('Command name contains invalid characters');
        }
    }

    if (errors.length > 0) {
        logger.warn(`Invalid command in ${filePath}: ${errors.join(', ')}`);
        return false;
    }

    return true;
};

module.exports = {
    validateCommand
};