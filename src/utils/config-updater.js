const fs = require('fs');
const yaml = require('js-yaml');
const logger = require('./logger');

class ConfigUpdater {

    static updateDomainConfigByLines(filePath, domainPath, data) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const lines = fileContent.split('\n');
            const config = yaml.load(fileContent);


            const updates = this.flattenObject(data, domainPath);


            const updatesToApply = [];
            for (const [path, value] of Object.entries(updates)) {
                const pathParts = path.split('.');
                const lineInfo = this.findLineForPath(lines, pathParts, config);
                if (lineInfo) {
                    updatesToApply.push({
                        lineIndex: lineInfo.lineIndex,
                        key: lineInfo.key,
                        indent: lineInfo.indent,
                        value: value,
                        originalLine: lines[lineInfo.lineIndex]
                    });
                    logger.debug(`[CONFIG UPDATER] Found line ${lineInfo.lineIndex} for path: ${path}`);
                } else {
                    logger.warn(`[CONFIG UPDATER] Could not find line for path: ${path} (pathParts: ${pathParts.join('.')})`);
                }
            }


            updatesToApply.sort((a, b) => b.lineIndex - a.lineIndex);
            const updatedLines = [...lines];

            for (const update of updatesToApply) {
                const newLine = this.buildYamlLine(update.key, update.value, update.indent);
                updatedLines[update.lineIndex] = newLine;
            }

            fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf8');
            logger.success(`[CONFIG UPDATER] Updated ${updatesToApply.length} values in ${domainPath}`);
            return true;
        } catch (error) {
            logger.error(`[CONFIG UPDATER] Error updating domain config:`, error);
            throw error;
        }
    }


    static findLineForPath(lines, pathParts, config) {
        const pathStack = [];
        const indentStack = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();


            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const indent = line.length - line.trimStart().length;


            while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1]) {
                indentStack.pop();
                pathStack.pop();
            }


            const keyMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
            if (!keyMatch) continue;

            const key = keyMatch[1].trim();
            const value = keyMatch[2].trim();


            const expectedDepth = pathStack.length;
            const expectedKey = expectedDepth < pathParts.length ? pathParts[expectedDepth] : null;

            if (expectedKey && key === expectedKey) {

                pathStack.push(key);
                indentStack.push(indent);


                if (pathStack.length === pathParts.length) {
                    return {
                        lineIndex: i,
                        key: key,
                        indent: indent,
                        value: value
                    };
                }
            }

        }

        return null;
    }


    static buildYamlLine(key, value, indent) {
        const indentStr = ' '.repeat(indent);
        const valueStr = this.formatYamlValue(value);
        return `${indentStr}${key}: ${valueStr}`;
    }


    static formatYamlValue(value) {
        if (value === null || value === undefined) {
            return 'null';
        }

        if (typeof value === 'boolean') {
            return value.toString();
        }

        if (typeof value === 'number') {
            return value.toString();
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }

            if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
                return '[' + value.map(v => typeof v === 'string' ? JSON.stringify(v) : v).join(', ') + ']';
            }
            return JSON.stringify(value);
        }

        if (typeof value === 'object') {

            if (Object.keys(value).length === 0) return '{}';
            return JSON.stringify(value);
        }


        const str = String(value);

        if (str === '' || str.includes(':') || str.includes('#') || str.includes('\n') ||
            str.trim() !== str || str.includes('{') || str.includes('}') ||
            ['true', 'false', 'null'].includes(str.toLowerCase()) || !isNaN(str)) {
            return JSON.stringify(str);
        }

        return str;
    }


    static flattenObject(obj, prefix = '') {
        const result = {};

        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {

                Object.assign(result, this.flattenObject(value, fullKey));
            } else {

                result[fullKey] = value;
            }
        }

        return result;
    }
}

module.exports = ConfigUpdater;