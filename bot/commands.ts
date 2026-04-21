import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const uploadEmojiCommand = new SlashCommandBuilder()
  .setName('upload')
  .setDescription('Upload all emoji images from the bot\'s emojis/ folder as custom server emojis (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers);

export const registerCommand = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register your Minecraft account to participate in tier tests');

export const registerOtherCommand = new SlashCommandBuilder()
  .setName('register-other')
  .setDescription('Register another Discord user into the system (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option.setName('user').setDescription('The Discord user to register').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('mc_username')
      .setDescription('Their Minecraft username (permanent, 3–16 characters)')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(16)
  )
  .addStringOption(option =>
    option
      .setName('region')
      .setDescription('Their region')
      .setRequired(true)
      .addChoices(
        { name: 'AS — Asia',            value: 'AS' },
        { name: 'EU — Europe',          value: 'EU' },
        { name: 'NA — North America',   value: 'NA' },
        { name: 'SA — South America',   value: 'SA' },
        { name: 'AF — Africa',          value: 'AF' },
        { name: 'OC — Oceania',         value: 'OC' },
        { name: 'AN — Antarctica',      value: 'AN' },
      )
  );

export const setSkinCommand = new SlashCommandBuilder()
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

export const skinChangeOtherCommand = new SlashCommandBuilder()
  .setName('skin-change-other')
  .setDescription('Change the skin for another registered user (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option.setName('user').setDescription('The registered Discord user').setRequired(true)
  )
  .addAttachmentOption(option =>
    option.setName('skin').setDescription('Their Minecraft skin PNG file').setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reset')
      .setDescription('Reset to default Steve skin instead')
      .addChoices({ name: 'Yes — reset to default', value: 'yes' })
      .setRequired(false)
  );

export const resultCommand = new SlashCommandBuilder()
  .setName('result')
  .setDescription('Post a tier test result (staff only)')
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
  )
  .addStringOption(option =>
    option
      .setName('score')
      .setDescription('Match score (e.g. 10/5 or Me 8 - Player 10)')
      .setRequired(false)
  );

export const doneCommand = new SlashCommandBuilder()
  .setName('done')
  .setDescription('Submit a completed tier test match report to staff (tier testers only)')
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player you tested (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
      .setDescription('The game mode that was tested')
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
      .setName('score')
      .setDescription('Match score (e.g. Me 8 - Player 10 — player wins)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('opinion')
      .setDescription('Your opinion on the player\'s tier (optional)')
      .setRequired(false)
  );

export const addTestCommand = new SlashCommandBuilder()
  .setName('add-test')
  .setDescription('Manually add a tier test result for a tester (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option
      .setName('tester')
      .setDescription('The tier tester who ran the test (must be a registered tier tester)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The player who was tested (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
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
      .setName('earned_tier')
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

export const profileCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View a registered player\'s profile')
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player to view (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  );

export const deleteUserCommand = new SlashCommandBuilder()
  .setName('delete-user')
  .setDescription('Fully delete a player from the system (removes all data, roles, and registration) — staff only')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('user').setDescription('The Discord user to delete from the system').setRequired(true)
  );

export const setResultsChannelCommand = new SlashCommandBuilder()
  .setName('set-results-channel')
  .setDescription('Set the channel where tier test results are posted')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The results channel').setRequired(true)
  );

export const setStaffChannelCommand = new SlashCommandBuilder()
  .setName('set-staff-channel')
  .setDescription('Set the channel where /done match reports are posted for staff review')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The staff review channel').setRequired(true)
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
  .setName('clear-tester')
  .setDescription("Reset a tier tester's completed test count to zero (staff only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('tester').setDescription('The tier tester to reset').setRequired(true)
  );

export const clearUserCommand = new SlashCommandBuilder()
  .setName('clear-user')
  .setDescription('Remove all tier roles from a user and give them the Unranked role (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('user').setDescription('The user to clear').setRequired(true)
  );

export const removeTesterCommand = new SlashCommandBuilder()
  .setName('remove-tester')
  .setDescription('Remove a user from being a tier tester — removes tester roles and test history (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('user').setDescription('The tier tester to remove').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
      .setDescription('Remove from a specific game mode only (leave empty to remove from all)')
      .setRequired(false)
      .addChoices(
        { name: 'Sword PvP',   value: 'Sword-PvP'   },
        { name: 'UHC',         value: 'UHC'          },
        { name: 'Pot PvP',     value: 'Pot-PvP'      },
        { name: 'Nethpot',     value: 'Nethpot'      },
        { name: 'SMP PvP',     value: 'SMP-PvP'      },
        { name: 'Axe PvP',     value: 'Axe-PvP'      },
        { name: 'Mace PvP',    value: 'Mace-PvP'     },
        { name: 'Crystal PvP', value: 'Crystal-PvP'  },
        { name: 'Cart PvP',    value: 'cartpvp'      },
      )
  );

export const removeTierCommand = new SlashCommandBuilder()
  .setName('remove-tier')
  .setDescription('Remove a player\'s tier in a specific game mode (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
      .setDescription('The game mode to remove the tier from')
      .setRequired(true)
      .addChoices(
        { name: 'Sword PvP',   value: 'Sword-PvP'   },
        { name: 'UHC',         value: 'UHC'          },
        { name: 'Pot PvP',     value: 'Pot-PvP'      },
        { name: 'Nethpot',     value: 'Nethpot'      },
        { name: 'SMP PvP',     value: 'SMP-PvP'      },
        { name: 'Axe PvP',     value: 'Axe-PvP'      },
        { name: 'Mace PvP',    value: 'Mace-PvP'     },
        { name: 'Crystal PvP', value: 'Crystal-PvP'  },
        { name: 'Cart PvP',    value: 'cartpvp'      },
      )
  );

export const setLeaderboardChannelCommand = new SlashCommandBuilder()
  .setName('set-leaderboard-channel')
  .setDescription('Set the channel where the live points leaderboard is displayed')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel').setDescription('The channel to post the leaderboard in').setRequired(true)
  );

export const setStaffRoleCommand = new SlashCommandBuilder()
  .setName('set-staff-role')
  .setDescription('Set the Staff role that gets mentioned when a ticket is created')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role').setDescription('The Staff role').setRequired(true)
  );

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get information about Cosmic Tiers — how to register, get tested, and use commands');

export const infoCommand = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Get information about Cosmic Tiers — how to register, get tested, and use commands');

export const helpStaffCommand = new SlashCommandBuilder()
  .setName('help-staff')
  .setDescription('Show the staff guide — commands and workflow for staff members')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const infoStaffCommand = new SlashCommandBuilder()
  .setName('info-staff')
  .setDescription('Show the staff guide — commands and workflow for staff members')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const createTitleCommand = new SlashCommandBuilder()
  .setName('create-title')
  .setDescription('Create a special title that can be given to players (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('The display name for this special title (shown on website)')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The Discord role that represents this special title')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('text_color')
      .setDescription('HEX color code for the title text (e.g. #FF4500)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('background_color')
      .setDescription('HEX color code for the title glassy background (e.g. #FF4500)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('outline')
      .setDescription('HEX color code for the title outline/border (e.g. #FF4500)')
      .setRequired(false)
  )
  .addAttachmentOption(option =>
    option
      .setName('icon')
      .setDescription('PNG or GIF icon shown next to the title on the profile card')
      .setRequired(false)
  );

export const giveTitleCommand = new SlashCommandBuilder()
  .setName('give-title')
  .setDescription('Give a special title to a registered player (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('title')
      .setDescription('The special title to give')
      .setRequired(true)
      .setAutocomplete(true)
  );

export const removeTitleCommand = new SlashCommandBuilder()
  .setName('remove-title')
  .setDescription('Remove the special title from a player (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  );

export const addTesterCommand = new SlashCommandBuilder()
  .setName('add-tester')
  .setDescription('Grant the Tier Tester role to a registered player (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option =>
    option.setName('user').setDescription('The registered Discord user to promote').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('game-mode')
      .setDescription('The game mode this tester will test')
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
  );

export const retiredCommand = new SlashCommandBuilder()
  .setName('retired')
  .setDescription('Mark a player\'s tier as retired in a specific game mode (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
      .setDescription('The game mode to retire the player from')
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
  );

export const unretiredCommand = new SlashCommandBuilder()
  .setName('unretired')
  .setDescription('Restore a retired player\'s tier back to normal in a specific game mode (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(option =>
    option
      .setName('player')
      .setDescription('The registered player (Minecraft username)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('game_mode')
      .setDescription('The game mode to unretire the player from')
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
  );

export const setModRoleCommand = new SlashCommandBuilder()
  .setName('set-mod-role')
  .setDescription('Set the Mod role — mods can use /result and all tier tester commands (owner only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role').setDescription('The Mod role').setRequired(true)
  );

export const editProfileCommand = new SlashCommandBuilder()
  .setName('edit-profile')
  .setDescription('Edit your profile — update your Minecraft username, region, or skin (registered players only)')
  .addStringOption(option =>
    option
      .setName('mc_username')
      .setDescription('New Minecraft username (3–16 chars, letters/numbers/underscores only)')
      .setRequired(false)
      .setMinLength(3)
      .setMaxLength(16)
  )
  .addStringOption(option =>
    option
      .setName('region')
      .setDescription('Your region')
      .setRequired(false)
      .addChoices(
        { name: 'AS — Asia',          value: 'AS' },
        { name: 'EU — Europe',        value: 'EU' },
        { name: 'NA — North America', value: 'NA' },
        { name: 'SA — South America', value: 'SA' },
        { name: 'AF — Africa',        value: 'AF' },
        { name: 'OC — Oceania',       value: 'OC' },
        { name: 'AN — Antarctica',    value: 'AN' },
      )
  )
  .addAttachmentOption(option =>
    option
      .setName('skin')
      .setDescription('Your Minecraft skin PNG file')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reset_skin')
      .setDescription('Reset your skin back to the default Steve skin')
      .addChoices({ name: 'Yes — reset to default', value: 'yes' })
      .setRequired(false)
  );

export const editProfileOtherCommand = new SlashCommandBuilder()
  .setName('edit-profile-others')
  .setDescription('Edit another registered player\'s profile (staff only)')
  .addUserOption(option =>
    option.setName('user').setDescription('The registered Discord user to edit').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('mc_username')
      .setDescription('New Minecraft username (3–16 chars, letters/numbers/underscores only)')
      .setRequired(false)
      .setMinLength(3)
      .setMaxLength(16)
  )
  .addStringOption(option =>
    option
      .setName('region')
      .setDescription('Their region')
      .setRequired(false)
      .addChoices(
        { name: 'AS — Asia',          value: 'AS' },
        { name: 'EU — Europe',        value: 'EU' },
        { name: 'NA — North America', value: 'NA' },
        { name: 'SA — South America', value: 'SA' },
        { name: 'AF — Africa',        value: 'AF' },
        { name: 'OC — Oceania',       value: 'OC' },
        { name: 'AN — Antarctica',    value: 'AN' },
      )
  )
  .addAttachmentOption(option =>
    option
      .setName('skin')
      .setDescription('Their Minecraft skin PNG file')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('reset_skin')
      .setDescription('Reset their skin back to the default Steve skin')
      .addChoices({ name: 'Yes — reset to default', value: 'yes' })
      .setRequired(false)
  );
