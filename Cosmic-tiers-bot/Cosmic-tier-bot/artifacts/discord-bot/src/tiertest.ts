import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Guild,
  type GuildMember,
  type TextChannel,
  type Client,
} from 'discord.js';
import { getConfig, setConfig } from './config.js';
import { getRegistrationByDiscordId } from './registration.js';

export const TIER_TEST_YELLOW = 0xFFBF00;

// ─── Button / Modal IDs ───────────────────────────────────────────────────────
export const BUTTON_ID           = 'start_tier_test';
export const PANEL_REGISTER_ID   = 'panel_register';
export const MODAL_ID            = 'tier_test_modal';
export const CLOSE_TICKET_ID     = 'close_ticket';
export const DELETE_TICKET_ID    = 'delete_ticket';
export const APPLY_TESTER_ID     = 'apply_tester';

export const INPUT_GAMEMODE = 'game_mode';

// ─── Panel Refresh ────────────────────────────────────────────────────────────
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePanelRefresh(client: Client): void {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    refreshTierTestPanel(client).catch(console.error);
  }, 1500);
}

async function countOnlineTesters(guild: Guild, roleId: string): Promise<{ online: number; total: number }> {
  try {
    if (guild.members.cache.size < 2) await guild.members.fetch();
    const role = guild.roles.cache.get(roleId);
    if (!role) return { online: 0, total: 0 };
    const total = role.members.size;
    const online = role.members.filter(m => {
      const s = m.presence?.status;
      return s === 'online' || s === 'idle' || s === 'dnd';
    }).size;
    return { online, total };
  } catch {
    return { online: 0, total: 0 };
  }
}

async function buildPanelEmbed(guild: Guild): Promise<EmbedBuilder> {
  const config = getConfig();
  let testerLine = '`Not configured — use /set-tier-tester-role`';

  if (config.tierTesterRoleId) {
    const { online, total } = await countOnlineTesters(guild, config.tierTesterRoleId);
    testerLine = `🟢 **${online}** online  ·  👥 **${total}** total`;
  }

  return new EmbedBuilder()
    .setTitle('⚔️ The Cosmic Tier')
    .setColor(TIER_TEST_YELLOW)
    .setDescription(
      '**Minecraft cracked tier list!**\n' +
      'Apply below to have your Minecraft PvP skills tier with good Minecraft PvP tier tester. And it\'s fully **Free** and **Cracked!**\n\u200b'
    )
    .addFields(
      {
        name: '📌 How to Apply',
        value:
          '**1.** First, click **Register** to register your Minecraft account\n' +
          '**2.** Once registered, click **Start Tier Test**\n' +
          '**3.** Select your **Game Mode** in the form\n' +
          '**4.** A private ticket will be created just for you\n' +
          '**5.** A Tier Tester will join and conduct your test\n' +
          '**6.** Your result will be posted in the results channel',
      },
      {
        name: '📊 Tier Rankings (Highest → Lowest)',
        value: '`HT1` › `LT1` › `HT2` › `LT2` › `HT3` › `LT3` › `HT4` › `LT4` › `HT5` › `LT5`',
      },
      { name: '🌍 Supported Regions', value: '`AS` · `AF` · `EU` · `NA` · `SA` · `OC` · `AN`' },
      {
        name: '🎮 Available Game Modes',
        value: 'Sword-PvP · UHC · Pot-PvP · Nethpot · SMP-PvP · Axe-PvP · Mace-PvP · Crystal-PvP',
      },
      { name: '👥 Tier Testers', value: testerLine },
    )
    .setFooter({ text: 'Register first, then click Start Tier Test to open your ticket' })
    .setTimestamp();
}

function buildPanelButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_REGISTER_ID)
      .setLabel('📋 Register')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel('⚔️ Start Tier Test')
      .setStyle(ButtonStyle.Primary),
  );
}

export async function postTierTestPanel(guild: Guild, channelId: string): Promise<void> {
  const config = getConfig();
  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) throw new Error('Tier test channel not found.');

  const embed = await buildPanelEmbed(guild);
  const row = buildPanelButtons();

  if (config.tierTestMessageId) {
    try {
      const existing = await channel.messages.fetch(config.tierTestMessageId);
      await existing.edit({ embeds: [embed], components: [row] });
      return;
    } catch { /* Message gone — post a new one */ }
  }

  const msg = await channel.send({ embeds: [embed], components: [row] });
  setConfig({ tierTestMessageId: msg.id, tierTestChannelId: channelId });
}

export async function refreshTierTestPanel(client: Client): Promise<void> {
  const config = getConfig();
  if (!config.tierTestChannelId || !config.tierTestMessageId) return;
  const guild = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(config.tierTestChannelId) as TextChannel | undefined;
  if (!channel) return;
  try {
    const msg = await channel.messages.fetch(config.tierTestMessageId);
    const embed = await buildPanelEmbed(guild);
    await msg.edit({ embeds: [embed], components: [buildPanelButtons()] });
  } catch {
    setConfig({ tierTestMessageId: undefined });
  }
}

// ─── Ticket Action Buttons ────────────────────────────────────────────────────

function buildTicketActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_TICKET_ID)
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(DELETE_TICKET_ID)
      .setLabel('🗑️ Delete Ticket')
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Permission Check Helper ──────────────────────────────────────────────────

function isStaff(member: GuildMember): boolean {
  const config = getConfig();
  const hasTesterRole = config.tierTesterRoleId
    ? member.roles.cache.has(config.tierTesterRoleId)
    : false;
  const hasPerms = member.permissions.has(PermissionFlagsBits.ManageChannels);
  return hasTesterRole || hasPerms;
}

// ─── Ticket Handlers ──────────────────────────────────────────────────────────

export async function handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: '❌ Only tier testers and staff can close tickets.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;

  // Find the member overwrite (the ticket creator) and deny SendMessages
  const userOverwrite = channel.permissionOverwrites.cache.find(o => o.type === OverwriteType.Member);
  if (userOverwrite) {
    await channel.permissionOverwrites.edit(userOverwrite.id, { SendMessages: false });
  }

  const closeEmbed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setDescription(
      `🔒 **Ticket Closed**\nThis ticket was closed by <@${interaction.user.id}>.\n` +
      `The user can no longer send messages. Staff may still communicate here.`
    )
    .setTimestamp();

  // Replace action row — keep Delete but replace Close with a disabled "Closed" button
  const closedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_closed_noop')
      .setLabel('🔒 Ticket Closed')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(DELETE_TICKET_ID)
      .setLabel('🗑️ Delete Ticket')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ components: [closedRow] });
  await channel.send({ embeds: [closeEmbed] });
}

export async function handleDeleteTicket(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: '❌ Only tier testers and staff can delete tickets.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;

  const deleteEmbed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setDescription(`🗑️ **Deleting ticket…** (closed by <@${interaction.user.id}>)`)
    .setTimestamp();

  await interaction.update({ components: [] });
  await channel.send({ embeds: [deleteEmbed] });

  // Short delay so the message is visible before the channel disappears
  setTimeout(() => {
    channel.delete('Ticket deleted by staff').catch(console.error);
  }, 1500);
}

// ─── Start Tier Test Modal ────────────────────────────────────────────────────

export async function handleStartButton(interaction: ButtonInteraction): Promise<void> {
  const reg = getRegistrationByDiscordId(interaction.user.id);
  if (!reg) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Not Registered')
          .setDescription(
            'You must **register** your Minecraft account before starting a tier test.\n\n' +
            'Click the **📋 Register** button on the panel above, or use `/register`.',
          ),
      ],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Apply for Tier Test');

  const gameModeInput = new TextInputBuilder()
    .setCustomId(INPUT_GAMEMODE)
    .setLabel('Game Mode')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Sword-PvP · UHC · Pot-PvP · Nethpot · SMP-PvP · Axe-PvP')
    .setRequired(true)
    .setMaxLength(16);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameModeInput),
  );

  await interaction.showModal(modal);
}

function sanitizeChannelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 20);
}

export async function handleTierTestModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) { await interaction.editReply('❌ This can only be used inside a server.'); return; }

  const reg = getRegistrationByDiscordId(interaction.user.id);
  if (!reg) {
    await interaction.editReply(
      '❌ You must register first. Click the **📋 Register** button on the tier test panel, or use `/register`.',
    );
    return;
  }

  const { mcUsername, region } = reg;
  const gameMode = interaction.fields.getTextInputValue(INPUT_GAMEMODE).trim();
  const config   = getConfig();

  const existingName = `tt-${sanitizeChannelName(mcUsername)}`;
  const existing = guild.channels.cache.find(c => c.name === existingName);
  if (existing) {
    await interaction.editReply(
      `❌ A ticket already exists for **\`${mcUsername}\`**: <#${existing.id}>. Please use it or wait for it to be closed.`,
    );
    return;
  }

  const overwrites: Parameters<typeof guild.channels.create>[0]['permissionOverwrites'] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (config.tierTesterRoleId) {
    overwrites.push({
      id: config.tierTesterRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  let ticketChannel: TextChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: existingName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      reason: `Tier test ticket for ${interaction.user.username}`,
      topic: `Tier test ticket — ${interaction.user.id} (${mcUsername}) · Region: ${region} · Mode: ${gameMode}`,
    }) as TextChannel;
  } catch (err) {
    console.error('Failed to create ticket channel:', err);
    await interaction.editReply('❌ Failed to create ticket channel. Make sure the bot has **Manage Channels** permission.');
    return;
  }

  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎫 New Tier Test Request')
    .setColor(TIER_TEST_YELLOW)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '👤 Discord',           value: `<@${interaction.user.id}>`, inline: true },
      { name: '🎮 Minecraft Username', value: `\`${mcUsername}\``,        inline: true },
      { name: '🌍 Region',            value: `\`${region}\``,             inline: true },
      { name: '⚔️ Game Mode',         value: `\`${gameMode}\``,           inline: true },
      {
        name: '📋 What Happens Next',
        value:
          '• A Tier Tester will join this ticket shortly\n' +
          '• Please be patient and stay available\n' +
          '• The tester will guide you through the test\n' +
          '• Your result will be posted in the results channel',
      },
    )
    .setFooter({ text: `Ticket created by ${interaction.user.username}` })
    .setTimestamp();

  const testerMention = config.tierTesterRoleId ? `<@&${config.tierTesterRoleId}>` : '**Tier Testers**';

  await ticketChannel.send({
    content: `${testerMention} — a new tier test request has arrived!`,
    embeds: [ticketEmbed],
    components: [buildTicketActionRow()],
  });

  await interaction.editReply(
    `✅ Your tier test ticket has been created: <#${ticketChannel.id}>\nA Tier Tester will be with you shortly!`,
  );
}

// ─── Apply for Tier Tester ────────────────────────────────────────────────────

export async function handleApplyTesterButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) { await interaction.editReply('❌ This can only be used inside a server.'); return; }

  const config = getConfig();
  const channelName = `apply-${sanitizeChannelName(interaction.user.username)}`;

  const existing = guild.channels.cache.find(c => c.name === channelName);
  if (existing) {
    await interaction.editReply(`❌ You already have an open application: <#${existing.id}>.`);
    return;
  }

  const overwrites: Parameters<typeof guild.channels.create>[0]['permissionOverwrites'] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (config.tierTesterRoleId) {
    overwrites.push({
      id: config.tierTesterRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  let applyChannel: TextChannel;
  try {
    applyChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      reason: `Tier Tester application from ${interaction.user.username}`,
      topic: `Tier Tester application — ${interaction.user.id}`,
    }) as TextChannel;
  } catch (err) {
    console.error('Failed to create apply channel:', err);
    await interaction.editReply('❌ Failed to create application ticket. Make sure the bot has **Manage Channels** permission.');
    return;
  }

  const applyEmbed = new EmbedBuilder()
    .setTitle('📋 Tier Tester Application')
    .setColor(TIER_TEST_YELLOW)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '👤 Applicant', value: `<@${interaction.user.id}>`, inline: true },
      { name: '📅 Applied', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      {
        name: '📝 Instructions',
        value:
          'Please answer the following in this channel:\n' +
          '**1.** What game modes can you test? (e.g. Nethpot, Sword-PvP)\n' +
          '**2.** How long have you been playing Minecraft PvP?\n' +
          '**3.** What is your highest tier in each mode you listed?\n' +
          '**4.** Why do you want to be a Tier Tester?',
      },
    )
    .setFooter({ text: 'Staff will review your application shortly' })
    .setTimestamp();

  const testerMention = config.tierTesterRoleId ? `<@&${config.tierTesterRoleId}>` : '**Tier Testers**';

  await applyChannel.send({
    content: `${testerMention} — new Tier Tester application!`,
    embeds: [applyEmbed],
    components: [buildTicketActionRow()],
  });

  await interaction.editReply(`✅ Your application ticket has been created: <#${applyChannel.id}>\nPlease answer the questions in the channel.`);
}
