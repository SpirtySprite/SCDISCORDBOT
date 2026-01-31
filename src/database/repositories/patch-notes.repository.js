const { query } = require('../connection');

class PatchNotesRepository {
    async create(data) {
        const sql = `
            INSERT INTO patch_notes (version, content, created_by)
            VALUES (?, ?, ?)
        `;
        const params = [data.version, data.content, data.createdBy];
        const result = await query(sql, params);
        return result.insertId;
    }

    async findAll() {
        const sql = `
            SELECT id, version, content, created_by, created_at, updated_at
            FROM patch_notes
            ORDER BY created_at DESC
        `;
        return await query(sql);
    }

    async findById(id) {
        const sql = `
            SELECT id, version, content, created_by, created_at, updated_at
            FROM patch_notes
            WHERE id = ?
        `;
        const rows = await query(sql, [id]);
        return rows[0] || null;
    }

    async update(id, data) {
        const sql = `
            UPDATE patch_notes
            SET version = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const params = [data.version, data.content, id];
        await query(sql, params);
        return this.findById(id);
    }

    async delete(id) {
        const sql = `DELETE FROM patch_notes WHERE id = ?`;
        await query(sql, [id]);
        return true;
    }
}

module.exports = new PatchNotesRepository();