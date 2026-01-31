const { TIME_UNITS, DURATION_REGEX } = require('./constants');

const parseDuration = (durationString) => {
    if (!durationString || typeof durationString !== 'string') {
        return null;
    }

    const matches = [...durationString.matchAll(DURATION_REGEX)];
    if (!matches.length) return null;

    const unitMap = {
        's': TIME_UNITS.SECOND,
        'm': TIME_UNITS.MINUTE,
        'h': TIME_UNITS.HOUR,
        'd': TIME_UNITS.DAY
    };

    let totalMs = 0;
    for (const match of matches) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const multiplier = unitMap[unit] || 0;
        totalMs += value * multiplier;
    }

    return totalMs || null;
};

const formatTime = (endTime) => {
    const end = typeof endTime === 'string' ? new Date(endTime + 'Z') : endTime;
    const diff = end.getTime() - Date.now();

    if (diff <= 0) return 'Terminé';

    const days = Math.floor(diff / TIME_UNITS.DAY);
    const hours = Math.floor((diff % TIME_UNITS.DAY) / TIME_UNITS.HOUR);
    const minutes = Math.floor((diff % TIME_UNITS.HOUR) / TIME_UNITS.MINUTE);
    const seconds = Math.floor((diff % TIME_UNITS.MINUTE) / TIME_UNITS.SECOND);

    const parts = [];
    if (days) parts.push(`${days}j`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds && parts.length < 2) parts.push(`${seconds}s`);

    return parts.join(' ') || 'Moins d\'une seconde';
};

const pickRandomWinners = (participants, count) => {
    if (!Array.isArray(participants) || !participants.length) return [];

    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, participants.length));
};

const safeJsonParse = (jsonString, defaultValue = []) => {
    try {
        return JSON.parse(jsonString || '[]');
    } catch {
        return defaultValue;
    }
};


const convertDurationToMs = (value) => {
    if (value === null || value === undefined) {
        return null;
    }


    if (typeof value === 'number') {
        return value;
    }


    if (typeof value === 'string') {
        const trimmed = value.trim();


        if (trimmed.toLowerCase().endsWith('ms')) {
            const numValue = parseInt(trimmed.slice(0, -2), 10);
            if (!isNaN(numValue)) {
                return numValue;
            }
        }


        const numValue = parseInt(trimmed, 10);
        if (!isNaN(numValue) && trimmed === numValue.toString()) {
            return numValue;
        }


        const parsed = parseDuration(trimmed);
        if (parsed !== null) {
            return parsed;
        }
    }


    return null;
};

module.exports = {
    parseDuration,
    formatTime,
    pickRandomWinners,
    safeJsonParse,
    convertDurationToMs
};