const { Client, GatewayIntentBits } = require('discord.js');
const { Erebus, Connectors } = require('erebus');

const nodes = [
	{ name: 'local', url: '0.0.0.0:2333', auth: 'catgirls' }
];

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates ] });
const erebus = new Erebus(new Connectors.DiscordJS(client), nodes);

erebus.on('ready', name => console.log('[Lavalink]', `Node ${name} ready`));
erebus.on('error', (name, error) => console.warn('[Lavalink]', `Node ${name} throw an error`, error));
erebus.on('close', (name, code, reason) => console.error('[Lavalink]', `Node ${name} closed with code ${code}. Reason: ${reason || '-'}`));
erebus.on('disconnected', (name, reason) => console.error('[Lavalink]', `Node ${name} disconnected. Reason: ${reason || '-'}`));

client.on('ready', () => console.log(`${client.user.tag} ready`));
client.login(process.env.erebus_token);