const patchNotesRepository = require('../../../src/database/repositories/patch-notes.repository');
const logger = require('../../../src/utils/logger');

class PatchNotesService {
    async getAll() {
        try {
            return await patchNotesRepository.findAll();
        } catch (error) {
            logger.error('[PATCH NOTES] Failed to get all patch notes:', error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const note = await patchNotesRepository.findById(id);
            if (!note) {
                throw new Error('Patch note not found');
            }
            return note;
        } catch (error) {
            logger.error(`[PATCH NOTES] Failed to get patch note ${id}:`, error);
            throw error;
        }
    }

    async create(data) {
        try {
            const id = await patchNotesRepository.create({
                version: data.version,
                content: data.content,
                createdBy: data.createdBy
            });
            return await patchNotesRepository.findById(id);
        } catch (error) {
            logger.error('[PATCH NOTES] Failed to create patch note:', error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            return await patchNotesRepository.update(id, {
                version: data.version,
                content: data.content
            });
        } catch (error) {
            logger.error(`[PATCH NOTES] Failed to update patch note ${id}:`, error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await patchNotesRepository.delete(id);
            return true;
        } catch (error) {
            logger.error(`[PATCH NOTES] Failed to delete patch note ${id}:`, error);
            throw error;
        }
    }
}

module.exports = new PatchNotesService();