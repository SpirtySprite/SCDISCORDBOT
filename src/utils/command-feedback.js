
const COMMAND_FEEDBACK = {

    default: '⏳ Traitement en cours...',


    ticket: {
        create: '⏳ Création du ticket...',
        close: '⏳ Fermeture du ticket...',
        delete: '⏳ Suppression du ticket...',
        reopen: '⏳ Réouverture du ticket...',
        transcript: '⏳ Génération du transcript...',
        setup: '⏳ Configuration du système de tickets...',
        setcategory: '⏳ Changement de catégorie...',
        setowner: '⏳ Transfert du ticket...'
    },


    moderation: {
        ban: '⏳ Bannissement en cours...',
        kick: '⏳ Expulsion en cours...',
        mute: '⏳ Mise en sourdine en cours...',
        timeout: '⏳ Timeout en cours...',
        warn: '⏳ Avertissement en cours...',
        unban: '⏳ Débannissement en cours...',
        unmute: '⏳ Retrait de la sourdine en cours...',
        untimeout: '⏳ Retrait du timeout en cours...',
        logs: '⏳ Chargement des logs...',
        deletelog: '⏳ Suppression du log...'
    },


    giveaway: {
        create: '⏳ Création du concours...',
        end: '⏳ Fin du concours...',
        reroll: '⏳ Nouveau tirage au sort...',
        list: '⏳ Chargement des concours...'
    },


    'market-rotate': '⏳ Rotation du marché en cours...',
    'market-publish': '⏳ Publication des notes du marché...',


    config: {
        view: '⏳ Chargement de la configuration...',
        edit: '⏳ Modification de la configuration...',
        reload: '⏳ Rechargement de la configuration...'
    },


    suggestion: '⏳ Envoi de la suggestion...',


    restart: '⏳ Redémarrage en cours...'
};


function getFeedbackMessage(commandName, subcommand = null) {
    const commandFeedback = COMMAND_FEEDBACK[commandName];

    if (!commandFeedback) {
        return COMMAND_FEEDBACK.default;
    }


    if (typeof commandFeedback === 'object' && subcommand) {
        return commandFeedback[subcommand] || COMMAND_FEEDBACK.default;
    }


    if (typeof commandFeedback === 'string') {
        return commandFeedback;
    }

    return COMMAND_FEEDBACK.default;
}



const IMMEDIATE_REPLY_COMMANDS = new Set(['vente', 'soundboard', 'level', 'toplevel']);
const MODAL_COMMANDS = new Set(['config', 'suggestion', 'ping-embed']);

async function sendFeedback(interaction, message = null) {

    if (interaction.replied || interaction.deferred) {
        return;
    }

    const commandName = interaction.commandName;


    if (IMMEDIATE_REPLY_COMMANDS.has(commandName)) {
        return;
    }

    const subcommand = interaction.options?.getSubcommand(false);
    if ((commandName === 'config' && subcommand === 'edit') ||
        commandName === 'suggestion') {
        return;
    }

    const feedbackMessage = message || getFeedbackMessage(commandName, subcommand);

    try {

        const isPublicCommand = ['mod', 'market-publish', 'market-remove', 'market-rotate'].includes(commandName) ||
            (commandName === 'ticket' && (subcommand === 'setcategory' || subcommand === 'setowner'));
        await interaction.deferReply({ ephemeral: !isPublicCommand });

        await interaction.editReply({ content: feedbackMessage });
    } catch (error) {

    }
}

module.exports = {
    getFeedbackMessage,
    sendFeedback,
    COMMAND_FEEDBACK
};