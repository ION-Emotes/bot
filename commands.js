const { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } = require('discord.js');
const { add, rem, getBranch } = require('./ghpload.js');
const {reply} = require('./helpers.js');


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
					.setDescription('The emoji to add (or "all" to add all emojis)')
					.setRequired(true)),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(client, interaction) {
			// <a:pink_Nodders:937079880473014362>
			const reason = interaction.options.getString('emote') || null;
			if (!reason || (reason.split(":").length < 2 && reason !== "all")) return reply(interaction, {content: `"${reason}" is not a valid emoji!`, ephemeral: true});
			
			const emotes = (reason === "all") ? Array.from((await interaction.guild.emojis.fetch()).values()) : [(await interaction.guild.emojis.fetch()).get(reason.split(":")[2].replace(">", ""))];

			if (!emotes[0]) return reply(interaction, { content: "Not Found!", ephemeral: true });
			const formatted = emotes.map((em) => ({ id: em.id, name: em.name, animated: em.animated, serverId: interaction.guild.id }));

			const rRaw = await add(formatted, interaction.guildId);
			let r;
			if (rRaw) {
				const passed = rRaw.succeeded.filter(e => e[1].added).map(e => formatted.findIndex(e2 => e2.name === e.key));
				const failed = rRaw.succeeded.filter(e => !e[1].added).concat(rRaw.failed).map(e => formatted.findIndex(e2 => e2.name === e[0].name));
				r = failed.map((i) => {
					return `❌ ${emotes[i].name} (${emotes[i].id})\n`;
				});
				
				r = r.concat(passed.map((i) => {
					return `✅ ${emotes[i].name} (${emotes[i].id})\n`;
				}));
			}
			else r = (new Array(formatted.length)).fill(null);

			reply(interaction, {
				content: `Added: \`\`\`\n${r}\n\`\`\``, ephemeral: true
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
					.setDescription('The emoji to remove (or "all" to add all emojis)')
					.setRequired(true)),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(client, interaction) {
			const reason = interaction.options.getString('emote') || null;
			if (!reason || (reason.split(":").length < 2 && reason !== "all")) return reply(interaction, {content: `"${reason}" is not a valid emoji!`, ephemeral: true});

			const emotes = (reason === "all") ? Array.from((await interaction.guild.emojis.fetch()).values()) : [(await interaction.guild.emojis.fetch()).get(reason.split(":")[2].replace(">", ""))];

			if (!emotes[0]) return reply(interaction, { content: "Not Found!", ephemeral: true });
			const formatted = emotes.map((em) => ({ id: em.id, name: em.name, serverId: interaction.guild.id }));

			const rRaw = await rem(formatted, interaction.guildId);
			const r = (rRaw) ? rRaw.map(em => em.deleted) : (new Array(formatted.length)).fill(null)

			reply(interaction, {
				content: `Removed: \`\`\`\n${r.map((emote, i) => {
					return `${(emote) ? '✅' : '❌'} ${emotes[i].name} (${emotes[i].id})`;
				}).join("\n")}\`\`\``, ephemeral: true
			});
		}
	},

	{
		data: new SlashCommandBuilder()
			.setName("getpr")
			.setDescription("find your server's current PR (if it exists)")
			.setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

		/**
		 * @param {ChatInputCommandInteraction} interaction 
		 */
		async execute(client, interaction) {
			const baseURL = 'https://api.github.com/repos/ION-Emotes/data/pulls';
			const r = await getBranch(baseURL, interaction.guildId, true);
			if (!r) reply(interaction, "No branch or PR found!");
			else reply(interaction, `PR found at ${r}`);
		}
	}
]
