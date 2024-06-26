// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const { token, clientId, clientSecret } = require('./config.json');
const commands = require('./commands.js');
const {reply} = require('./helpers.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	client.guilds.cache.forEach(guild => {
		// client.guilds.cache.get(guild.id).emojis.cache.map((em) => ({id: em.id, name: em.name, animated: em.animated, serverId: null}));
		registerCommands(guild.id);
	});
	console.log("finished refreshing commands!");
});

client.on("guildCreate", async (guildObj) => {
	try {
		const owner = await guildObj.fetchOwner();
		owner.send("Thank you for inviting ION Emote Bot!\nPlease use the `/add` command to add emotes or `/remove` to remove them\nTo learn how to use the plugin, you can visit https://streamelements.ion606.com/howto.html");
	}
	catch(err) {
		console.error(err);
	}
});

const rest = new REST().setToken(token);
async function registerCommands(guildId) {
	try {
		// console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands.map(c => c.data.toJSON()) },
		);

		// console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
}

client.commands = new Collection();
commands.map(c => client.commands.set(c.data.name, c.execute));
// console.log(client.commands);

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	try {
		await interaction.deferReply({ ephemeral: true });
		
		const command = client.commands.get(interaction.commandName);
		if (!command) reply(interaction, { content: "unknown command!", ephemeral: true });
		else client.commands.get(interaction.commandName)(client, interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await reply(interaction, { content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await reply(interaction, { content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});


// Log in to Discord with your client's token
client.login(token);

