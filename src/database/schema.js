const { query, transaction, testConnection } = require('./connection');
const logger = require('../utils/logger');
const config = require('../config');
const dbFallback = require('../utils/db-fallback');

const TICKET_TRANSCRIPTS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS ticket_transcripts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id VARCHAR(255) NOT NULL UNIQUE,
        channel_name VARCHAR(255) NOT NULL,
        closed_by VARCHAR(255) NOT NULL,
        messages LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const GIVEAWAY_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS giveaways (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        channel_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        prize TEXT NOT NULL,
        winners INT NOT NULL DEFAULT 1,
        end_time DATETIME NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        requirements TEXT,
        status ENUM('active', 'ended') DEFAULT 'active',
        winner_ids TEXT,
        participant_ids TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_status (guild_id, status),
        INDEX idx_end_time (end_time),
        INDEX idx_message_id (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const MOD_LOGS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS mod_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        action ENUM('ban', 'kick', 'mute', 'timeout', 'warn', 'unban', 'unmute', 'untimeout', 'purge', 'move') NOT NULL,
        reason TEXT,
        duration INT,
        deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_user (guild_id, user_id),
        INDEX idx_guild_user_action (guild_id, user_id, action),
        INDEX idx_user_action (user_id, action),
        INDEX idx_deleted (deleted),
        INDEX idx_guild_deleted (guild_id, deleted)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;


const MOD_LOGS_ADD_PURGE_MIGRATION = `
    ALTER TABLE mod_logs
    MODIFY COLUMN action ENUM('ban', 'kick', 'mute', 'timeout', 'warn', 'unban', 'unmute', 'untimeout', 'purge') NOT NULL
`;


const MOD_LOGS_ADD_MOVE_MIGRATION = `
    ALTER TABLE mod_logs
    MODIFY COLUMN action ENUM('ban', 'kick', 'mute', 'timeout', 'warn', 'unban', 'unmute', 'untimeout', 'purge', 'move') NOT NULL
`;

const TICKETS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id VARCHAR(255) NOT NULL UNIQUE,
        channel_id VARCHAR(255) NOT NULL UNIQUE,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        status ENUM('open', 'closed', 'deleted') DEFAULT 'open',
        closed_by VARCHAR(255),
        closed_at DATETIME,
        rating INT DEFAULT NULL,
        welcome_message_id VARCHAR(255),
        category VARCHAR(50) DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_status (guild_id, status),
        INDEX idx_guild_user_status (guild_id, user_id, status),
        INDEX idx_user_id (user_id),
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_channel_id (channel_id),
        INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TICKET_PANELS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS ticket_panels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        category_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_id (guild_id),
        INDEX idx_message_id (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const PATCH_NOTES_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS patch_notes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        version VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_version (version),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TODOS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS todos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'General',
        color VARCHAR(20) DEFAULT '#3498db',
        status ENUM('pending', 'completed') DEFAULT 'pending',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const DISCORD_USERS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS discord_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        discord_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NOT NULL,
        discriminator VARCHAR(10),
        avatar VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        expires_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_discord_id (discord_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const USER_SESSIONS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        data TEXT NOT NULL,
        expires DATETIME NOT NULL,
        discord_user_id VARCHAR(255) NULL,
        guild_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_session_id (session_id),
        INDEX idx_expires (expires),
        INDEX idx_discord_user_id (discord_user_id),
        INDEX idx_guild_id (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const APPLICATIONS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS applications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(255) NOT NULL,
        user_tag VARCHAR(255) NOT NULL,
        user_avatar VARCHAR(255),
        guild_id VARCHAR(255) NOT NULL,
        answers JSON NOT NULL,
        status ENUM('pending', 'reviewed', 'accepted', 'rejected') DEFAULT 'pending',
        reviewed_by VARCHAR(255),
        reviewed_at DATETIME,
        notes TEXT,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_guild_id (guild_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const USER_LEVELS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS user_levels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        total_xp INT NOT NULL DEFAULT 0,
        level INT NOT NULL DEFAULT 0,
        current_xp INT DEFAULT 0,
        next_xp INT DEFAULT 0,
        user_rank INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_guild (user_id, guild_id),
        INDEX idx_user_id (user_id),
        INDEX idx_guild_id (guild_id),
        INDEX idx_guild_user (guild_id, user_id),
        INDEX idx_total_xp (total_xp),
        INDEX idx_total_xp_desc (total_xp DESC),
        INDEX idx_guild_total_xp (guild_id, total_xp DESC),
        INDEX idx_user_rank (user_rank),
        INDEX idx_guild_rank (guild_id, user_rank)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const LEVEL_ROLES_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS level_roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        level INT NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_guild_level (guild_id, level),
        INDEX idx_guild_id (guild_id),
        INDEX idx_level (level),
        INDEX idx_guild_level (guild_id, level),
        INDEX idx_role_id (role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const SUGGESTIONS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS suggestions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        channel_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        upvote_count INT DEFAULT 0,
        downvote_count INT DEFAULT 0,
        embed_color INT DEFAULT 0x5865F2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_message_id (message_id),
        INDEX idx_channel_id (channel_id),
        INDEX idx_guild_id (guild_id),
        INDEX idx_user_id (user_id),
        INDEX idx_guild_channel (guild_id, channel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TOURNAMENTS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS tournaments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        participant_list_message_id VARCHAR(255),
        max_entries INT NOT NULL,
        entry_duration_ms BIGINT NOT NULL,
        entry_end_time DATETIME NOT NULL,
        status ENUM('registration', 'brackets_generated', 'in_progress', 'completed', 'cancelled') DEFAULT 'registration',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_guild_id (guild_id),
        INDEX idx_status (status),
        INDEX idx_message_id (message_id),
        INDEX idx_entry_end_time (entry_end_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TOURNAMENT_PARTICIPANTS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS tournament_participants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        user_tag VARCHAR(255) NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tournament_user (tournament_id, user_id),
        INDEX idx_tournament_id (tournament_id),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TOURNAMENT_MATCHES_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS tournament_matches (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tournament_id INT NOT NULL,
        round INT NOT NULL,
        match_number INT NOT NULL,
        player1_id VARCHAR(255),
        player2_id VARCHAR(255),
        winner_id VARCHAR(255),
        status ENUM('pending', 'in_progress', 'completed', 'bye') DEFAULT 'pending',
        match_message_id VARCHAR(255),
        next_match_id INT,
        next_match_slot ENUM('player1', 'player2'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tournament_id (tournament_id),
        INDEX idx_tournament_round (tournament_id, round),
        INDEX idx_status (status),
        INDEX idx_next_match_id (next_match_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (next_match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const VOICE_BLACKLIST_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS voice_blacklist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_guild_channel_user (guild_id, channel_id, user_id),
        INDEX idx_guild_channel (guild_id, channel_id),
        INDEX idx_guild_user (guild_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const TICKET_BLACKLIST_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS ticket_blacklist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_guild_user (guild_id, user_id),
        INDEX idx_guild_user (guild_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const MINECRAFT_COMMANDS_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS minecraft_commands (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_uuid VARCHAR(36) NOT NULL,
        username VARCHAR(64) NOT NULL,
        command VARCHAR(255) NOT NULL,
        args TEXT,
        success BOOLEAN DEFAULT TRUE,
        world VARCHAR(64),
        x DECIMAL(10, 1),
        y DECIMAL(10, 1),
        z DECIMAL(10, 1),
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_user_uuid (user_uuid),
        INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const initialize = async () => {
    try {

        logger.info('Test de la connexion à la base de données...');
        const connected = await dbFallback.executeWithFallback(
            async () => {
                const result = await testConnection();
                if (!result) {
                    throw new Error('Échec du test de connexion à la base de données');
                }
                return result;
            },
            null,
            'initialisation du schéma'
        );

        if (!connected) {
            throw new Error('Échec du test de connexion à la base de données. Impossible d\'initialiser le schéma.');
        }


        logger.info(`Vérification de l'existence de la base de données '${config.database.database}'...`);
        try {

            await query(`CREATE DATABASE IF NOT EXISTS \`${config.database.database}\``).catch(() => { });

            await query(`USE \`${config.database.database}\``);
            logger.info(`Base de données '${config.database.database}' sélectionnée`);
        } catch (dbError) {
            logger.warn(`Impossible de garantir la sélection de la base de données: ${dbError.message}`);
        }


        logger.info('Création des tables de la base de données...');
        const tableResults = await Promise.allSettled([
            query(GIVEAWAY_TABLE_SCHEMA).then(() => {
                logger.info('Table giveaways créée/vérifiée');
                return 'giveaways';
            }),
            query(MOD_LOGS_TABLE_SCHEMA).then(async () => {
                logger.info('Table mod_logs créée/vérifiée');

                try {
                    await query(MOD_LOGS_ADD_PURGE_MIGRATION);
                    logger.info('Migration: ajout de \'purge\' à l\'ENUM action de mod_logs');
                } catch (migrationError) {

                    if (!migrationError.message.includes('Duplicate') && !migrationError.message.includes('Unknown column')) {
                        logger.warn('Échec de la migration mod_logs purge (peut être normal si la table vient d\'être créée):', migrationError.message);
                    }
                }

                try {
                    await query(MOD_LOGS_ADD_MOVE_MIGRATION);
                    logger.info('Migration: ajout de \'move\' à l\'ENUM action de mod_logs');
                } catch (migrationError) {

                    if (!migrationError.message.includes('Duplicate') && !migrationError.message.includes('Unknown column')) {
                        logger.warn('Échec de la migration mod_logs move (peut être normal si la table vient d\'être créée):', migrationError.message);
                    }
                }
                return 'mod_logs';
            }),
            query(TICKETS_TABLE_SCHEMA).then(() => {
                logger.info('Table tickets créée/vérifiée');
                return 'tickets';
            }),
            query(TICKET_PANELS_TABLE_SCHEMA).then(() => {
                logger.info('Table ticket_panels créée/vérifiée');
                return 'ticket_panels';
            }),
            query(PATCH_NOTES_TABLE_SCHEMA).then(() => {
                logger.info('Table patch_notes créée/vérifiée');
                return 'patch_notes';
            }),
            query(TODOS_TABLE_SCHEMA).then(() => {
                logger.info('Table todos créée/vérifiée');
                return 'todos';
            }),
            query(DISCORD_USERS_TABLE_SCHEMA).then(() => {
                logger.info('Table discord_users créée/vérifiée');
                return 'discord_users';
            }),
            query(USER_SESSIONS_TABLE_SCHEMA).then(async () => {
                logger.info('Table user_sessions créée/vérifiée');


                try {

                    const [columns] = await query(`
                        SELECT COLUMN_NAME
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'user_sessions'
                        AND COLUMN_NAME = 'data'
                    `);

                    if (columns.length === 0) {
                        logger.info('Migration: Adding session storage columns to user_sessions table...');


                        try {
                            await query(`ALTER TABLE user_sessions ADD COLUMN data TEXT`);
                        } catch (e) {
                            if (!e.message.includes('Duplicate column name')) throw e;
                        }

                        try {
                            await query(`ALTER TABLE user_sessions ADD COLUMN expires DATETIME`);
                        } catch (e) {
                            if (!e.message.includes('Duplicate column name')) throw e;
                        }

                        try {
                            await query(`ALTER TABLE user_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
                        } catch (e) {
                            if (!e.message.includes('Duplicate column name')) throw e;
                        }


                        try {

                            const [colCheck] = await query(`
                                SELECT COLUMN_NAME
                                FROM INFORMATION_SCHEMA.COLUMNS
                                WHERE TABLE_SCHEMA = DATABASE()
                                AND TABLE_NAME = 'user_sessions'
                                AND COLUMN_NAME = 'discord_user_id'
                            `);
                            if (colCheck && colCheck.length > 0) {
                                await query(`ALTER TABLE user_sessions MODIFY COLUMN discord_user_id VARCHAR(255) NULL`);
                            }
                        } catch (e) {

                        }


                        try {
                            await query(`ALTER TABLE user_sessions MODIFY COLUMN session_id VARCHAR(255) UNIQUE`);
                        } catch (e) {

                        }

                        logger.info('Migration: user_sessions table updated successfully');
                    }
                } catch (migrationError) {
                    logger.warn('Migration check failed (table might already be up to date):', migrationError.message);
                }

                return 'user_sessions';
            }),
            query(USER_LEVELS_TABLE_SCHEMA).then(() => {
                logger.info('Table user_levels créée/vérifiée');
                return 'user_levels';
            }),
            query(APPLICATIONS_TABLE_SCHEMA).then(() => {
                logger.info('Table applications créée/vérifiée');
                return 'applications';
            }),
            query(SUGGESTIONS_TABLE_SCHEMA).then(() => {
                logger.info('Table suggestions créée/vérifiée');
                return 'suggestions';
            }),
            query(TICKET_TRANSCRIPTS_TABLE_SCHEMA).then(() => {
                logger.info('Table ticket_transcripts créée/vérifiée');
                return 'ticket_transcripts';
            }),
            query(LEVEL_ROLES_TABLE_SCHEMA).then(() => {
                logger.info('Table level_roles créée/vérifiée');
                return 'level_roles';
            }),

            query(TOURNAMENTS_TABLE_SCHEMA).then(() => {
                logger.info('Table tournaments créée/vérifiée');
                return 'tournaments';
            }),
            query(MINECRAFT_COMMANDS_TABLE_SCHEMA).then(() => {
                logger.info('Table minecraft_commands créée/vérifiée');
                return 'minecraft_commands';
            }),
            query(TICKET_BLACKLIST_TABLE_SCHEMA).then(() => {
                logger.info('Table ticket_blacklist créée/vérifiée');
                return 'ticket_blacklist';
            }),
            query(VOICE_BLACKLIST_TABLE_SCHEMA).then(() => {
                logger.info('Table voice_blacklist créée/vérifiée');
                return 'voice_blacklist';
            })
        ]);


        const tournamentsResult = tableResults.find(r => r.status === 'fulfilled' && r.value === 'tournaments');
        if (!tournamentsResult || tournamentsResult.status !== 'fulfilled') {
            throw new Error('Failed to create tournaments table - cannot create dependent tables');
        }


        const dependentTableResults = await Promise.allSettled([
            query(TOURNAMENT_PARTICIPANTS_TABLE_SCHEMA).then(() => {
                logger.info('Table tournament_participants créée/vérifiée');
                return 'tournament_participants';
            }),
            query(TOURNAMENT_MATCHES_TABLE_SCHEMA).then(() => {
                logger.info('Table tournament_matches créée/vérifiée');
                return 'tournament_matches';
            })
        ]);


        const failures = tableResults.filter(r => r.status === 'rejected');
        const dependentFailures = dependentTableResults ? dependentTableResults.filter(r => r.status === 'rejected') : [];
        const allFailures = [...failures, ...dependentFailures];

        if (allFailures.length > 0) {
            allFailures.forEach(failure => {
                logger.error('Échec de la création de la table:', failure.reason);
            });
            throw new Error(`Échec de la création de ${allFailures.length} table(s)`);
        }


        try {

            const giveawayColumns = await query(`
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'giveaways'
                AND COLUMN_NAME = 'participant_ids'
            `, [config.database.database]);

            const ticketWelcomeColumn = await query(`
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'tickets'
                AND COLUMN_NAME = 'welcome_message_id'
            `, [config.database.database]);

            const ticketRatingColumn = await query(`
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'tickets'
                AND COLUMN_NAME = 'rating'
            `, [config.database.database]);


            await Promise.all([
                giveawayColumns.length === 0
                    ? query(`ALTER TABLE giveaways ADD COLUMN participant_ids TEXT`).catch(() => { })
                    : Promise.resolve(),
                ticketWelcomeColumn.length === 0
                    ? query(`ALTER TABLE tickets ADD COLUMN welcome_message_id VARCHAR(255)`).catch(() => { })
                    : Promise.resolve(),
                ticketRatingColumn.length === 0
                    ? query(`ALTER TABLE tickets ADD COLUMN rating INT DEFAULT NULL`).catch(() => { })
                    : Promise.resolve(),
                (await query(`
                    SELECT COLUMN_NAME
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = 'tickets'
                    AND COLUMN_NAME = 'category'
                `, [config.database.database])).length === 0
                    ? query(`ALTER TABLE tickets ADD COLUMN category VARCHAR(50) DEFAULT 'unknown'`).then(async () => {
                        logger.info('Migration: added category column to tickets table, backfilling...');

                        await query(`
                            UPDATE tickets
                            SET category = SUBSTRING_INDEX(ticket_id, '-', 1)
                            WHERE category = 'unknown' AND ticket_id LIKE '%-%'
                        `);
                    }).catch((e) => { logger.warn('Migration category backfill failed:', e.message); })
                    : Promise.resolve()
            ]);
        } catch (alterError) {

            logger.debug('Vérification de l\'ajout de colonnes échouée (c\'est généralement normal):', alterError.message);
        }


        logger.info('Vérification de l\'existence des tables...');
        try {

            const [dbCheck] = await query('SELECT DATABASE() as current_db');
            const currentDb = dbCheck?.current_db || 'unknown';
            logger.info(`Vérification des tables dans la base de données: ${currentDb}`);

            if (currentDb !== config.database.database) {
                logger.warn(`ATTENTION: Utilisation de la base de données '${currentDb}' mais la config spécifie '${config.database.database}'`);
            }

            const tables = await query(`
                SELECT TABLE_NAME
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME IN ('giveaways', 'mod_logs', 'tickets', 'ticket_panels', 'patch_notes', 'todos', 'discord_users', 'user_sessions', 'user_levels', 'suggestions', 'level_roles', 'tournaments', 'tournament_participants', 'tournament_matches', 'minecraft_commands', 'ticket_blacklist', 'voice_blacklist')
            `, [currentDb || config.database.database]);

            const tableNames = tables.map(t => t.TABLE_NAME);
            const expectedTables = ['giveaways', 'mod_logs', 'tickets', 'ticket_panels', 'patch_notes', 'todos', 'discord_users', 'user_sessions', 'user_levels', 'suggestions', 'level_roles', 'tournaments', 'tournament_participants', 'tournament_matches', 'minecraft_commands', 'ticket_blacklist', 'voice_blacklist'];
            const missingTables = expectedTables.filter(t => !tableNames.includes(t));

            if (missingTables.length > 0) {
                logger.warn(`Tables manquantes: ${missingTables.join(', ')}`);
                logger.warn(`Tables trouvées: ${tableNames.join(', ') || 'aucune'}`);
            } else {
                logger.success(`Toutes les ${tableNames.length} tables vérifiées: ${tableNames.join(', ')}`);
            }
        } catch (verifyError) {
            logger.warn('Impossible de vérifier les tables (ce n\'est pas critique):', verifyError.message);
        }

        logger.success('Schéma de la base de données initialisé');
    } catch (error) {
        logger.error('Échec de l\'initialisation du schéma de la base de données', error);
        throw error;
    }
};

module.exports = {
    initialize
};