const { Client, GatewayIntentBits } = require('discord.js');
const { Erebus, Connectors } = require('erebus');

const nodes = [
	{ name: 'local', url: 'localhost:2333', auth: 'catgirls' }
];

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates ] });
const erebus = new Erebus(new Connectors.DiscordJS(client), nodes);

client.on('ready', () => console.log(`${client.user.tag} ready`));
client.login(process.env.erebus_token);