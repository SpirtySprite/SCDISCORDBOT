const { query } = require('../connection');

class ClashRoyalRepository {
    constructor() {
        this.ensureTables();
    }

    async ensureTables() {

        await query("DROP TABLE IF EXISTS event_clash_royal_entries");


        try {

            await query("SELECT message_id FROM event_clash_royal LIMIT 1");

            await query("DROP TABLE event_clash_royal");
        } catch (error) {

        }

        const createTable = `
            CREATE TABLE IF NOT EXISTS event_clash_royal (
                user_id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await query(createTable);
    }

    async addEntry(userId, username) {
        try {
            const sql = `
                INSERT INTO event_clash_royal
                (user_id, username)
                VALUES (?, ?)
            `;
            await query(sql, [userId, username]);
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return false;
            }

            if ((error.context && error.context.originalErrorCode === 'ER_DUP_ENTRY') ||
                (error.context && error.context.originalErrorObj && error.context.originalErrorObj.code === 'ER_DUP_ENTRY')) {
                return false;
            }
            throw error;
        }
    }

    async removeEntry(userId) {
        const result = await query(
            "DELETE FROM event_clash_royal WHERE user_id = ?",
            [userId]
        );
        return result.affectedRows > 0;
    }

    async getEntries() {
        return await query(
            "SELECT * FROM event_clash_royal ORDER BY registered_at ASC"
        );
    }

    async clearEntries() {
        await query("TRUNCATE TABLE event_clash_royal");
    }
}

module.exports = new ClashRoyalRepository();