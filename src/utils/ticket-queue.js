const logger = require('./logger');


class TicketCreationQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.rateLimitWindow = 10 * 60 * 1000;
        this.maxChannelsPerWindow = 45;
        this.channelCreations = [];
        this.currentGuildQueues = new Map();
    }


    async enqueue(task, guildId) {
        return new Promise((resolve, reject) => {
            if (!this.currentGuildQueues.has(guildId)) {
                this.currentGuildQueues.set(guildId, []);
            }

            const queueItem = {
                task,
                guildId,
                resolve,
                reject,
                timestamp: Date.now()
            };

            this.currentGuildQueues.get(guildId).push(queueItem);
            logger.debug(`Ticket creation queued for guild ${guildId}. Queue length: ${this.currentGuildQueues.get(guildId).length}`);


            if (!this.processing) {
                this.processQueue();
            }
        });
    }


    cleanOldTimestamps() {
        const now = Date.now();
        this.channelCreations = this.channelCreations.filter(
            item => now - item.timestamp < this.rateLimitWindow
        );
    }


    canCreateChannel(guildId) {
        this.cleanOldTimestamps();


        const now = Date.now();
        const guildCreations = this.channelCreations.filter(
            (item) => item.guildId === guildId &&
            (now - item.timestamp) < this.rateLimitWindow
        );

        return guildCreations.length < this.maxChannelsPerWindow;
    }


    getDelayUntilNextSlot(guildId) {
        this.cleanOldTimestamps();

        const now = Date.now();
        const guildCreations = this.channelCreations
            .filter((item) => item.guildId === guildId && (now - item.timestamp) < this.rateLimitWindow)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (guildCreations.length === 0) {
            return 0;
        }


        if (guildCreations.length < this.maxChannelsPerWindow) {
            return 0;
        }


        const oldestCreation = guildCreations[0];
        const timeUntilOldestExpires = this.rateLimitWindow - (now - oldestCreation.timestamp);


        return Math.max(0, timeUntilOldestExpires + 1000);
    }


    async processQueue() {
        if (this.processing) {
            return;
        }

        this.processing = true;

        while (this.hasPendingTasks()) {

            let processedAny = false;

            for (const [guildId, queue] of this.currentGuildQueues.entries()) {
                if (queue.length === 0) {
                    continue;
                }

                const queueItem = queue.shift();
                processedAny = true;

                try {

                    if (!this.canCreateChannel(guildId)) {
                        const delay = this.getDelayUntilNextSlot(guildId);
                        logger.info(`Rate limit reached for guild ${guildId}. Waiting ${Math.ceil(delay / 1000)}s before next channel creation.`);


                        await new Promise(resolve => setTimeout(resolve, delay));
                    }


                    this.channelCreations.push({
                        guildId,
                        timestamp: Date.now()
                    });


                    logger.debug(`Processing ticket creation for guild ${guildId}`);
                    const result = await queueItem.task();
                    queueItem.resolve(result);
                } catch (error) {
                    logger.error(`Error processing ticket creation for guild ${guildId}`, error);
                    queueItem.reject(error);
                }
            }


            if (!processedAny) {
                break;
            }


            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.processing = false;


        for (const [guildId, queue] of this.currentGuildQueues.entries()) {
            if (queue.length === 0) {
                this.currentGuildQueues.delete(guildId);
            }
        }
    }


    hasPendingTasks() {
        for (const queue of this.currentGuildQueues.values()) {
            if (queue.length > 0) {
                return true;
            }
        }
        return false;
    }


    getQueueStatus(guildId) {
        const queue = this.currentGuildQueues.get(guildId) || [];
        const guildCreations = this.channelCreations.filter(
            (item) => item.guildId === guildId &&
            (Date.now() - item.timestamp) < this.rateLimitWindow
        );

        return {
            queueLength: queue.length,
            channelsCreatedInWindow: guildCreations.length,
            maxChannelsPerWindow: this.maxChannelsPerWindow,
            canCreateNow: this.canCreateChannel(guildId)
        };
    }
}


const ticketQueue = new TicketCreationQueue();

module.exports = ticketQueue;