const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { setServerFooter } = require('../../utils/embed-helper');

const command = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche toutes les commandes utilisateur disponibles');

module.exports = {
    data: command,
    async execute(interaction) {
        try {

            const commands = interaction.client.commands || new Map();


            const userCommands = [];


            const excludedCommands = ['soundboard'];

            for (const [name, command] of commands) {

                if (excludedCommands.includes(name)) {
                    continue;
                }


                let commandData = command.data;


                if (typeof commandData === 'function') {
                    commandData = commandData();
                } else if (commandData && typeof commandData.get === 'function') {
                    commandData = commandData.get();
                }


                const commandJson = commandData.toJSON ? commandData.toJSON() : commandData;



                if (commandJson.default_member_permissions) {
                    continue;
                }


                const description = commandJson.description || 'Aucune description';

                userCommands.push({
                    name: `/${name}`,
                    description: description
                });
            }


            userCommands.sort((a, b) => a.name.localeCompare(b.name));

            if (userCommands.length === 0) {

                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ Aucune commande utilisateur trouvée.'
                    });
                } else {
                    return interaction.reply({
                        content: '❌ Aucune commande utilisateur trouvée.',
                        ephemeral: false
                    });
                }
            }


            const embed = new EmbedBuilder()
                .setTitle('📚 Commandes Utilisateur Disponibles')
                .setDescription('Voici toutes les commandes que vous pouvez utiliser :')
                .setColor(0x5865F2)
                .setTimestamp();



            const maxFields = 25;
            if (userCommands.length <= maxFields) {

                userCommands.forEach(cmd => {
                    embed.addFields({
                        name: cmd.name,
                        value: cmd.description,
                        inline: true
                    });
                });
            } else {


                userCommands.slice(0, maxFields).forEach(cmd => {
                    embed.addFields({
                        name: cmd.name,
                        value: cmd.description,
                        inline: true
                    });
                });
                embed.setFooter({
                    text: `Et ${userCommands.length - maxFields} autres commandes...`
                });
            }

            setServerFooter(embed, interaction.guild);


            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: false });
            }

        } catch (error) {
            const { handleError } = require('../../utils/error-handler');
            await handleError(interaction, error, 'help');
        }
    }
};