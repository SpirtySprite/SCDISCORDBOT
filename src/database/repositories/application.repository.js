const { query } = require('../connection');
const logger = require('../../utils/logger');

class ApplicationRepository {
    async create(data) {
        try {
            const sql = `
                INSERT INTO applications
                (user_id, user_tag, user_avatar, guild_id, answers, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const answersJson = typeof data.answers === 'string' ? data.answers : JSON.stringify(data.answers);
            const result = await query(sql, [
                data.userId,
                data.userTag,
                data.userAvatar || null,
                data.guildId,
                answersJson,
                data.status || 'pending',
                data.createdBy
            ]);
            return result.insertId;
        } catch (error) {
            logger.error('Failed to create application', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            const rows = await query(
                'SELECT * FROM applications WHERE id = ?',
                [id]
            );
            if (rows.length === 0) return null;
            const app = rows[0];

            if (!app.answers) {
                app.answers = {};
            } else if (typeof app.answers === 'string') {
                try {
                    app.answers = JSON.parse(app.answers);
                } catch (parseError) {
                    logger.warn(`Failed to parse answers for application ${id}: ${parseError.message}`);
                    app.answers = {};
                }
            }

            return app;
        } catch (error) {
            logger.error('Failed to find application by id', error);
            throw error;
        }
    }

    async findByUserId(guildId, userId) {
        try {
            const rows = await query(
                'SELECT * FROM applications WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
                [guildId, userId]
            );
            return rows.map(row => {
                try {
                    row.answers = row.answers ? JSON.parse(row.answers) : {};
                } catch (parseError) {
                    logger.warn(`Failed to parse answers for application ${row.id}, using empty object`);
                    row.answers = {};
                }
                return row;
            });
        } catch (error) {
            logger.error('Failed to find applications by user id', error);
            throw error;
        }
    }

    async findAll(guildId, status = null) {
        try {
            let sql = 'SELECT * FROM applications WHERE guild_id = ?';
            const params = [guildId];

            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }

            sql += ' ORDER BY created_at DESC';

            const rows = await query(sql, params);
            return rows.map(row => {

                if (!row.answers) {
                    row.answers = {};
                } else if (typeof row.answers === 'string') {
                    try {
                        row.answers = JSON.parse(row.answers);
                    } catch (parseError) {
                        logger.warn(`Failed to parse answers for application ${row.id}: ${parseError.message}`);
                        row.answers = {};
                    }
                }

                return row;
            });
        } catch (error) {
            logger.error('Failed to find all applications', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const updates = [];
            const params = [];

            if (data.answers !== undefined) {
                updates.push('answers = ?');

                const answersJson = typeof data.answers === 'string' ? data.answers : JSON.stringify(data.answers);
                params.push(answersJson);
            }
            if (data.status !== undefined) {
                updates.push('status = ?');
                params.push(data.status);
            }
            if (data.reviewedBy !== undefined) {
                updates.push('reviewed_by = ?');
                params.push(data.reviewedBy);
            }
            if (data.reviewedAt !== undefined) {
                updates.push('reviewed_at = ?');
                params.push(data.reviewedAt);
            }
            if (data.notes !== undefined) {
                updates.push('notes = ?');
                params.push(data.notes);
            }

            if (updates.length === 0) {
                return await this.findById(id);
            }

            params.push(id);
            const sql = `UPDATE applications SET ${updates.join(', ')} WHERE id = ?`;
            await query(sql, params);
            return await this.findById(id);
        } catch (error) {
            logger.error('Failed to update application', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            const result = await query('DELETE FROM applications WHERE id = ?', [id]);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Failed to delete application', error);
            throw error;
        }
    }
}

module.exports = new ApplicationRepository();