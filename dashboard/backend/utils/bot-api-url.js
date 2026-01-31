/**
 * Gets and cleans the BOT_API_URL from environment variables
 * Handles cases where the URL might have comments or extra text
 * @returns {string} Clean bot API URL
 */
function getBotApiUrl() {
    let botApiUrl = process.env.BOT_API_URL;

    if (!botApiUrl) {

        return 'http://localhost:45049';
    }



    botApiUrl = botApiUrl.trim();


    const urlMatch = botApiUrl.match(/^(https?:\/\/[^\s\(\)]+)/);
    if (urlMatch) {
        botApiUrl = urlMatch[1];
    }


    if (!botApiUrl.startsWith('http://') && !botApiUrl.startsWith('https://')) {
        botApiUrl = `http://${botApiUrl}`;
    }


    try {
        new URL(botApiUrl);
        return botApiUrl;
    } catch (urlError) {
        throw new Error(`Invalid BOT_API_URL format: ${process.env.BOT_API_URL}. Please set it to a valid URL like http://localhost:45049`);
    }
}

module.exports = { getBotApiUrl };