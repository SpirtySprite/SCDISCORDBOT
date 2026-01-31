const { query } = require('../../../src/database/connection');
const crypto = require('crypto');

class TranscriptService {
    async createTranscript(data) {
        const ticketId = crypto.randomUUID();
        const { channelName, closedBy, messages } = data;

        await query(
            'INSERT INTO ticket_transcripts (ticket_id, channel_name, closed_by, messages) VALUES (?, ?, ?, ?)',
            [ticketId, channelName, closedBy, JSON.stringify(messages)]
        );

        return ticketId;
    }

    async getTranscript(ticketId) {
        const results = await query(
            'SELECT * FROM ticket_transcripts WHERE ticket_id = ?',
            [ticketId]
        );

        if (results.length === 0) {
            return null;
        }


        const transcript = results[0];

        if (typeof transcript.messages === 'string') {
            try {
                transcript.messages = JSON.parse(transcript.messages);
            } catch (e) {
                console.error('Failed to parse transcript messages', e);
                transcript.messages = [];
            }
        }

        return transcript;
    }
}

module.exports = new TranscriptService();