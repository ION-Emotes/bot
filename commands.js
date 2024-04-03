const { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } = require('discord.js');
const { add, rem } = require('./ghpload.js');

const reply = (interaction, toSend) => interaction.reply(toSend).catch(err => interaction.channel.send);


module.exports = [
	{
		data: new SlashCommandBuilder()
			.setName('ping')
			.setDescription('Replies with Pong!'),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(_, interaction) {
			if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
				await reply(interaction, { content: 'Pong!', ephemeral: true });
			}
			else await reply(interaction, { content: 'Only admins can run this command!', ephemeral: true });
		},
	},
	{
		data: new SlashCommandBuilder()
			.setName("add")
			.setDescription("Add an emote")
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.addStringOption(option =>
				option
					.setName('emote')
					.setDescription('The emoji to add')
					.setRequired(true)),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(client, interaction) {
			// <a:pink_Nodders:937079880473014362>
			const reason = interaction.options.getString('emote') || null;
			const emotes = (reason === "all") ? Array.from((await interaction.guild.emojis.fetch()).values()) : [(await interaction.guild.emojis.fetch()).get(reason.split(":")[2].replace(">", ""))];

			if (!emotes[0]) return reply(interaction, { content: "Not Found!", ephemeral: true });
			const formatted = emotes.map((em) => ({ id: em.id, name: em.name, animated: em.animated, serverId: interaction.guild.id }));

			const r = await add(formatted);
			reply(interaction, {
				content: `Added: \`\`\`\n${r.map((emote, i) => {
					return `${(emote) ? '✅' : '❌'} ${emotes[i].name} (${emotes[i].id})\n`;
				})}\n\`\`\``, ephemeral: true
			});
		}
	},

	{
		data: new SlashCommandBuilder()
			.setName("remove")
			.setDescription("Remove an emote")
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.addStringOption(option =>
				option
					.setName('emote')
					.setDescription('The emoji to add')
					.setRequired(true)),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(client, interaction) {
			const reason = interaction.options.getString('emote') || null;
			const emotes = (reason === "all") ? Array.from((await interaction.guild.emojis.fetch()).values()) : [(await interaction.guild.emojis.fetch()).get(reason.split(":")[2].replace(">", ""))];

			if (!emotes[0]) return reply(interaction, { content: "Not Found!", ephemeral: true });
			const formatted = emotes.map((em) => ({ key: em.name, serverId: interaction.guild.id }));

			const r = await rem(formatted);
			reply(interaction, {
				content: `Removed: \`\`\`\n${r.map((emote, i) => {
					return `${(emote) ? '✅' : '❌'} ${emotes[i].name} (${emotes[i].id})\n`;
				})}\n\`\`\``, ephemeral: true
			});
		}
	}
]
