const { query } = require('../connection');

class TodoRepository {
    async create(data) {
        const sql = `
            INSERT INTO todos (title, description, category, color, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        const params = [
            data.title || '',
            data.description || '',
            data.category || 'General',
            data.color || '#3498db',
            data.createdBy || 'admin'
        ];
        const result = await query(sql, params);
        return result.insertId;
    }

    async findAll() {
        const sql = `
            SELECT id, title, description, category, color, status, created_by, created_at, updated_at
            FROM todos
            ORDER BY created_at DESC
        `;
        return await query(sql);
    }

    async findById(id) {
        const sql = `
            SELECT id, title, description, category, color, status, created_by, created_at, updated_at
            FROM todos
            WHERE id = ?
        `;
        const rows = await query(sql, [id]);
        return rows[0] || null;
    }

    async update(id, data) {
        const sql = `
            UPDATE todos
            SET title = ?, description = ?, category = ?, color = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const params = [data.title, data.description, data.category, data.color, data.status, id];
        await query(sql, params);
        return this.findById(id);
    }

    async delete(id) {
        const sql = `DELETE FROM todos WHERE id = ?`;
        await query(sql, [id]);
        return true;
    }

    async toggleStatus(id) {
        const sql = `
            UPDATE todos
            SET status = IF(status = 'pending', 'completed', 'pending'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await query(sql, [id]);
        return this.findById(id);
    }
}

module.exports = new TodoRepository();