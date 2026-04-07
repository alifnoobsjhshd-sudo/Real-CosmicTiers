import { REST, Routes } from 'discord.js';
import { resultCommand } from './commands.js';

const TOKEN = process.env['DISCORD_BOT_TOKEN'];
const GUILD_ID = process.env['DISCORD_GUILD_ID'] || '1470462150081253429';
const CLIENT_ID = process.env['DISCORD_CLIENT_ID'];

if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set');
if (!CLIENT_ID) throw new Error('DISCORD_CLIENT_ID is not set. Set it to your bot\'s application ID.');

const commands = [resultCommand.toJSON()];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
