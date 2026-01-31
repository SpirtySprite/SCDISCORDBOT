const { query } = require('../../../src/database/connection');
const logger = require('../../../src/utils/logger');
const config = require('../../../src/config');

class RatingsService {
    async getCategoryRatings() {
        try {
            const sql = `
                SELECT
                    category,
                    COUNT(*) as total_tickets,
                    SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) as rated_tickets,
                    AVG(rating) as average_rating,
                    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as stars_5,
                    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as stars_4,
                    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as stars_3,
                    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as stars_2,
                    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as stars_1
                FROM tickets
                WHERE guild_id = ? AND status != 'deleted'
                GROUP BY category
                ORDER BY average_rating DESC, total_tickets DESC
            `;

            const rows = await query(sql, [config.bot.guildId]);

            return rows.map(row => ({
                category: row.category,
                totalTickets: parseInt(row.total_tickets),
                ratedTickets: parseInt(row.rated_tickets),
                averageRating: row.average_rating ? parseFloat(parseFloat(row.average_rating).toFixed(2)) : 0,
                distribution: {
                    5: parseInt(row.stars_5),
                    4: parseInt(row.stars_4),
                    3: parseInt(row.stars_3),
                    2: parseInt(row.stars_2),
                    1: parseInt(row.stars_1)
                }
            }));
        } catch (error) {
            logger.error('[RATINGS-SERVICE] Failed to get category ratings:', error);
            throw error;
        }
    }
}

module.exports = new RatingsService();