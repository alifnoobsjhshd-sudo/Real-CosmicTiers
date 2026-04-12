import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const uploadEmojiCommand = new SlashCommandBuilder()
  .setName('upload')
  .setDescription('Upload all emoji images from the bot\'s emojis/ folder as custom server emojis (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers);

export const registerCommand = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register your Minecraft account to participate in tier tests');

export const skinChangeCommand = new SlashCommandBuilder()
  .setName('skin-change')
  .setDescription('Update your registered Minecraft skin')
  .addAttachmentOption(option =>
    option
      .setName('skin')
      .setDescription('Your Minecraft skin PNG file')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reset')
      .setDescription('Reset to default Steve skin instead of uploading')
      .addChoices({ name: 'Yes — reset to default', value: 'yes' })
      .setRequired(false)
  );

export const resultCommand = new SlashCommandBuilder()
  .setName('result')
  .setDescription('Post a tier test result')
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username) who was tested')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addUserOption(option =>
    option.setName('tester').setDescription('The tester who ran the test').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('game-mode')
      .setDescription('Game mode tested')
      .setRequired(true)
      .addChoices(
        { name: 'Sword PvP',    value: 'Sword-PvP' },
        { name: 'UHC',          value: 'UHC' },
        { name: 'Pot PvP',      value: 'Pot-PvP' },
        { name: 'Nethpot',      value: 'Nethpot' },
        { name: 'SMP PvP',      value: 'SMP-PvP' },
        { name: 'Axe PvP',      value: 'Axe-PvP' },
        { name: 'Mace PvP',     value: 'Mace-PvP' },
        { name: 'Crystal PvP',  value: 'Crystal-PvP' },
        { name: 'Cart-PvP',     value: 'cartpvp' },
      )
  )
  .addStringOption(option =>
    option
      .setName('previous-tier')
      .setDescription("The player's previous tier")
      .setRequired(true)
      .addChoices(
        { name: 'Unranked', value: 'Unranked' },
        { name: 'LT5', value: 'LT5' }, { name: 'HT5', value: 'HT5' },
        { name: 'LT4', value: 'LT4' }, { name: 'HT4', value: 'HT4' },
        { name: 'LT3', value: 'LT3' }, { name: 'HT3', value: 'HT3' },
        { name: 'LT2', value: 'LT2' }, { name: 'HT2', value: 'HT2' },
        { name: 'LT1', value: 'LT1' }, { name: 'HT1', value: 'HT1' },
      )
  )
  .addStringOption(option =>
    option
      .setName('earned-tier')
      .setDescription('The tier the player earned')
      .setRequired(true)
      .addChoices(
        { name: 'LT5', value: 'LT5' }, { name: 'HT5', value: 'HT5' },
        { name: 'LT4', value: 'LT4' }, { name: 'HT4', value: 'HT4' },
        { name: 'LT3', value: 'LT3' }, { name: 'HT3', value: 'HT3' },
        { name: 'LT2', value: 'LT2' }, { name: 'HT2', value: 'HT2' },
        { name: 'LT1', value: 'LT1' }, { name: 'HT1', value: 'HT1' },
      )
  );

export const setResultsChannelCommand = new SlashCommandBuilder()
  .setName('set-results-channel')
  .setDescription('Set the channel where tier test results are posted')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The results channel').setRequired(true)
  );

export const setTierTesterRoleCommand = new SlashCommandBuilder()
  .setName('set-tier-tester-role')
  .setDescription('Set the Tier Tester role used for tickets and online count')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role').setDescription('The Tier Tester role').setRequired(true)
  );

export const setTierTestChannelCommand = new SlashCommandBuilder()
  .setName('set-tiertest-channel')
  .setDescription('Set the tier test channel and post the tier test panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The tier test channel').setRequired(true)
  );

export const setCurrentTesterChannelCommand = new SlashCommandBuilder()
  .setName('set-current-tester-channel')
  .setDescription('Set the channel where the live tier tester list is displayed')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The channel to post the tester list in').setRequired(true)
  );

export const setUnrankedRoleCommand = new SlashCommandBuilder()
  .setName('set-unranked-role')
  .setDescription('Set the Unranked role given to members with no tier (auto-created if not set)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role').setDescription('The Unranked role').setRequired(true)
  );

export const clearTierTestCommand = new SlashCommandBuilder()
  .setName('clear-tier-test')
  .setDescription("Reset a tier tester's completed test count to zero")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option.setName('tester').setDescription('The tier tester to reset').setRequired(true)
  );

export const clearUserCommand = new SlashCommandBuilder()
  .setName('clear-user')
  .setDescription('Remove all tier roles from a user and give them the Unranked role')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('user').setDescription('The user to clear').setRequired(true)
  );

export const setLeaderboardChannelCommand = new SlashCommandBuilder()
  .setName('set-leaderboard-channel')
  .setDescription('Set the channel where the live points leaderboard is displayed')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The channel to post the leaderboard in').setRequired(true)
  );
