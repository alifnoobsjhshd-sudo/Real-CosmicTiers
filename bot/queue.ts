import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type TextChannel,
  type Client,
  type OverwriteResolvable,
} from 'discord.js';
import { getConfig } from './config.js';
import { getGameModeEmoji } from './emojis.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUEUE_LEAVE_ID     = 'queue_leave';
export const QUEUE_NEXT_ID      = 'queue_next';
export const QUEUE_END_ID       = 'queue_end';
export const TIER_SELECT_PREFIX = 'tier_select';
export const TT_CLOSE_ID        = 'tt_close';

const QUEUE_YELLOW   = 0xFFBF00;
const WEBSITE_API_URL = (process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000').replace(/\/$/, '');

// Tiers in order: highest → lowest
const TIERS_HIGHEST_TO_LOWEST = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueInfo {
  channelId: string;
  messageId: string;
  playerId: string;
  mcUsername: string;
  region: string;
  gameMode: string;
  aimingTier?: string;
}

export interface TierTestInfo {
  channelId: string;
  messageId: string;
  playerId: string;
  testerId: string;
  mcUsername: string;
  region: string;
  gameMode: string;
  aimingTier?: string;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const _activeQueues    = new Map<string, QueueInfo>();
const _activeTierTests = new Map<string, TierTestInfo>();

export function getActiveQueue(channelId: string): QueueInfo | undefined {
  return _activeQueues.get(channelId);
}

export function getActiveTierTest(channelId: string): TierTestInfo | undefined {
  return _activeTierTests.get(channelId);
}

export function removeTierTestEntry(channelId: string): void {
  _activeTierTests.delete(channelId);
}

// ─── Topic parsing (for bot-restart resilience) ───────────────────────────────

export function parseQueueTopic(topic: string): { playerId: string; mcUsername: string; region: string; gameMode: string; aimingTier?: string } | null {
  const parts = topic.split('|');
  if (parts.length < 5 || parts[0] !== 'QUEUE') return null;
  return {
    playerId: parts[1],
    mcUsername: parts[2],
    region: parts[3],
    gameMode: parts[4],
    aimingTier: parts[5] ?? undefined,
  };
}

export function parseTierTestTopic(topic: string): { playerId: string; testerId: string; mcUsername: string; region: string; gameMode: string; aimingTier?: string } | null {
  const parts = topic.split('|');
  if (parts.length < 6 || parts[0] !== 'TIERTEST') return null;
  return {
    playerId: parts[1],
    testerId: parts[2],
    mcUsername: parts[3],
    region: parts[4],
    gameMode: parts[5],
    aimingTier: parts[6] ?? undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 20);
}

function displayGameMode(gm: string): string {
  return gm === 'cartpvp' ? 'Cart-PvP' : gm;
}

function isTester(member: GuildMember): boolean {
  const config = getConfig();
  return config.tierTesterRoleId ? member.roles.cache.has(config.tierTesterRoleId) : false;
}

function isStaffOrAdmin(member: GuildMember): boolean {
  const config = getConfig();
  const hasStaff = config.staffRoleId ? member.roles.cache.has(config.staffRoleId) : false;
  const hasMod   = config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false;
  return hasStaff || hasMod || member.permissions.has(PermissionFlagsBits.Administrator);
}

async function countOnlineTestersByRole(guild: Guild, roleId: string): Promise<{ online: number; total: number }> {
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

function getMemberOnlineStatus(guild: Guild, userId: string): string {
  const member = guild.members.cache.get(userId);
  if (!member) return '🔴 Offline';
  const s = member.presence?.status;
  return (s === 'online' || s === 'idle' || s === 'dnd') ? '🟢 Online' : '🔴 Offline';
}

// ─── Embed builders ───────────────────────────────────────────────────────────

async function buildQueueEmbed(guild: Guild, info: QueueInfo): Promise<EmbedBuilder> {
  const config = getConfig();
  const modeDisplay = displayGameMode(info.gameMode);
  const modeEmoji   = getGameModeEmoji(info.gameMode);
  const modeLabel   = modeEmoji ? `${modeEmoji} ${modeDisplay}` : modeDisplay;

  // Prefer game-mode-specific role for tester count, fall back to general tester role
  let testerLine = '`Not configured`';
  const gmRoleName = `${modeDisplay} Tester`;
  const gmRole = guild.roles.cache.find(r => r.name === gmRoleName);
  const roleForCount = gmRole?.id ?? config.tierTesterRoleId;
  if (roleForCount) {
    const { online, total } = await countOnlineTestersByRole(guild, roleForCount);
    testerLine = `🟢 **${online}** online  ·  👥 **${total}** total`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Queue Open <@${info.playerId}> You are on queue.`)
    .setColor(QUEUE_YELLOW)
    .setThumbnail(`${WEBSITE_API_URL}/api/skin/${info.playerId}`)
    .addFields(
      { name: '👤 Player',    value: `<@${info.playerId}>`,    inline: true },
      { name: '🎮 IGN',       value: `\`${info.mcUsername}\``, inline: true },
      { name: '🌍 Region',    value: `\`${info.region}\``,     inline: true },
      { name: '⚔️ Game Mode', value: modeLabel,                inline: true },
    );

  if (info.aimingTier) {
    embed.addFields({ name: '🎯 Aiming Tier', value: `\`${info.aimingTier}\``, inline: true });
  }

  embed.addFields({ name: `👥 ${modeDisplay} Testers Online`, value: testerLine, inline: false });

  embed.setFooter({ text: 'Queue System — Cosmic Tiers' }).setTimestamp();

  return embed;
}

async function buildTierTestEmbed(guild: Guild, info: TierTestInfo): Promise<EmbedBuilder> {
  const modeDisplay = displayGameMode(info.gameMode);
  const modeEmoji   = getGameModeEmoji(info.gameMode);
  const modeLabel   = modeEmoji ? `${modeEmoji} ${modeDisplay}` : modeDisplay;

  if (guild.members.cache.size < 2) {
    try { await guild.members.fetch(); } catch { /* ignore */ }
  }

  const playerStatus = getMemberOnlineStatus(guild, info.playerId);
  const testerStatus = getMemberOnlineStatus(guild, info.testerId);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Tier Test — ${modeLabel}`)
    .setColor(QUEUE_YELLOW)
    .setThumbnail(`${WEBSITE_API_URL}/api/skin/${info.playerId}`)
    .setDescription(
      `The tier test is about to begin. **Wait for the tester** to guide you.\n\n` +
      `*Once done, the tester will click the tier button below to post the result.*`,
    )
    .addFields(
      { name: '👤 Player',        value: `<@${info.playerId}>`,   inline: true },
      { name: '🎮 IGN',           value: `\`${info.mcUsername}\``, inline: true },
      { name: '🌍 Region',        value: `\`${info.region}\``,     inline: true },
      { name: '⚔️ Game Mode',     value: modeLabel,                inline: true },
      { name: '📶 Player Status', value: playerStatus,             inline: true },
      { name: '📶 Tester Status', value: testerStatus,             inline: true },
    );

  if (info.aimingTier) {
    embed.addFields({ name: '🎯 Aiming Tier', value: `\`${info.aimingTier}\``, inline: true });
  }

  embed.setFooter({ text: 'Tier Test System — Cosmic Tiers' }).setTimestamp();

  return embed;
}

// ─── Button row builders (exported for index.ts) ──────────────────────────────

function buildQueueButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(QUEUE_LEAVE_ID).setLabel('🚪 Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(QUEUE_NEXT_ID).setLabel('▶️ Start').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(QUEUE_END_ID).setLabel('⏹️ End').setStyle(ButtonStyle.Secondary),
  );
}

function buildCloseRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TT_CLOSE_ID).setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
  );
}

export function buildTierButtonRows(gameMode: string): ActionRowBuilder<ButtonBuilder>[] {
  const modeDisplay = displayGameMode(gameMode);
  const buttons = TIERS_HIGHEST_TO_LOWEST.map(tier =>
    new ButtonBuilder()
      .setCustomId(`${TIER_SELECT_PREFIX}:${gameMode}:${tier}`)
      .setLabel(`${modeDisplay} ${tier}`)
      .setStyle(ButtonStyle.Secondary),
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

// ─── Create Queue Channel ─────────────────────────────────────────────────────

export async function createQueueChannel(
  interaction: ButtonInteraction,
  guild: Guild,
  gameMode: string,
  playerId: string,
  mcUsername: string,
  region: string,
  aimingTier?: string,
): Promise<void> {
  const config = getConfig();
  const modeDisplay  = displayGameMode(gameMode);
  const gmRoleName   = `${modeDisplay} Tester`;
  const gameModeRole = guild.roles.cache.find(r => r.name === gmRoleName);

  // Duplicate guards
  const queueName = `queue-${sanitize(mcUsername)}`;
  const ttName    = `tt-${sanitize(mcUsername)}`;
  const existingQ = guild.channels.cache.find(c => c.name === queueName);
  if (existingQ) {
    await interaction.editReply({ content: `❌ You already have a queue: <#${existingQ.id}>. Please leave it first.`, components: [], embeds: [] });
    return;
  }
  const existingTt = guild.channels.cache.find(c => c.name === ttName);
  if (existingTt) {
    await interaction.editReply({ content: `❌ You already have an active tier test: <#${existingTt.id}>. Please wait for it to close.`, components: [], embeds: [] });
    return;
  }

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: playerId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
  ];
  if (config.tierTesterRoleId) overwrites.push({
    id: config.tierTesterRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (gameModeRole && gameModeRole.id !== config.tierTesterRoleId) overwrites.push({
    id: gameModeRole.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (config.staffRoleId) overwrites.push({
    id: config.staffRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (config.modRoleId && config.modRoleId !== config.staffRoleId) overwrites.push({
    id: config.modRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });

  let queueChannel: TextChannel;
  try {
    queueChannel = await guild.channels.create({
      name: queueName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      topic: aimingTier
        ? `QUEUE|${playerId}|${mcUsername}|${region}|${gameMode}|${aimingTier}`
        : `QUEUE|${playerId}|${mcUsername}|${region}|${gameMode}`,
      reason: `Queue for ${mcUsername} (${modeDisplay})`,
    }) as TextChannel;
  } catch (err) {
    console.error('[queue] Failed to create queue channel:', err);
    await interaction.editReply({ content: '❌ Failed to create queue channel. Make sure the bot has **Manage Channels** permission.', components: [], embeds: [] });
    return;
  }

  const tmpInfo: QueueInfo = { channelId: queueChannel.id, messageId: '', playerId, mcUsername, region, gameMode, aimingTier };
  const embed = await buildQueueEmbed(guild, tmpInfo);

  const testerMention = config.tierTesterRoleId ? `<@&${config.tierTesterRoleId}>` : '';
  const gmMention     = gameModeRole && gameModeRole.id !== config.tierTesterRoleId ? ` <@&${gameModeRole.id}>` : '';
  const staffMention  = config.staffRoleId ? ` <@&${config.staffRoleId}>` : '';
  const modMention    = config.modRoleId   ? ` <@&${config.modRoleId}>` : '';
  const notifyContent = `${testerMention}${gmMention}${staffMention}${modMention}`.trim();

  const msg = await queueChannel.send({
    content: notifyContent ? `${notifyContent} — **${mcUsername}** is waiting for a **${modeDisplay}** tier test!` : undefined,
    embeds: [embed],
    components: [buildQueueButtons()],
  });

  // Hint message for testers after the embed
  await queueChannel.send('🧪 if you are a tester click **start** button to start the tier test');

  _activeQueues.set(queueChannel.id, { ...tmpInfo, messageId: msg.id });

  await interaction.editReply({
    content: `✅ You're now in the queue! Head to <#${queueChannel.id}> and wait for a Tier Tester.`,
    components: [],
    embeds: [],
  });
}

// ─── Queue Button Handlers ────────────────────────────────────────────────────

export async function handleQueueLeave(interaction: ButtonInteraction): Promise<void> {
  const member  = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const info    = parseQueueTopic(channel.topic ?? '') ?? getActiveQueue(channel.id);

  const isPlayer = info?.playerId === interaction.user.id;
  if (!isPlayer && !isStaffOrAdmin(member)) {
    await interaction.reply({ content: '❌ Only the player who started this queue or staff can use **Leave**.', ephemeral: true });
    return;
  }

  _activeQueues.delete(channel.id);

  await interaction.update({ components: [] });
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription(`🚪 **Queue ended** — Left by <@${interaction.user.id}>.`).setTimestamp()] });
  setTimeout(() => channel.delete('Queue left').catch(console.error), 1500);
}

export async function handleQueueEnd(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!isTester(member)) {
    await interaction.reply({ content: '⛔ You are not a tester.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  _activeQueues.delete(channel.id);

  await interaction.update({ components: [] });
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription(`⏹️ **Queue ended** — Ended by <@${interaction.user.id}>.`).setTimestamp()] });
  setTimeout(() => channel.delete('Queue ended by tester').catch(console.error), 1500);
}

export async function handleQueueNext(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!isTester(member)) {
    await interaction.reply({ content: '⛔ You are not a tester.', ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  if (!guild) { await interaction.reply({ content: '❌ Must be used inside a server.', ephemeral: true }); return; }

  const channel = interaction.channel as TextChannel;
  const info    = parseQueueTopic(channel.topic ?? '') ?? getActiveQueue(channel.id);

  if (!info) {
    await interaction.reply({ content: '❌ Could not read queue information. Please contact an admin.', ephemeral: true });
    return;
  }

  // Prevent the player who opened the queue from starting their own test
  if (interaction.user.id === info.playerId) {
    await interaction.reply({ content: '⛔ You cannot start your own tier test. A different tester must click **Start**.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  await _createTierTestChannel(guild, interaction.user.id, info, channel.id);
}

// ─── Create Tier Test Channel (called by handleQueueNext) ────────────────────

async function _createTierTestChannel(
  guild: Guild,
  testerId: string,
  queueInfo: { playerId: string; mcUsername: string; region: string; gameMode: string; aimingTier?: string },
  queueChannelId: string,
): Promise<void> {
  const config = getConfig();
  const { playerId, mcUsername, region, gameMode, aimingTier } = queueInfo;
  const modeDisplay  = displayGameMode(gameMode);
  const gmRoleName   = `${modeDisplay} Tester`;
  const gameModeRole = guild.roles.cache.find(r => r.name === gmRoleName);
  const ttName       = `tt-${sanitize(mcUsername)}`;

  const existing = guild.channels.cache.find(c => c.name === ttName);
  if (existing) {
    const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
    await queueCh?.send(`❌ A tier test channel already exists: <#${existing.id}>. Close it first.`).catch(() => null);
    return;
  }

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: playerId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
    {
      id: testerId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (config.tierTesterRoleId) overwrites.push({
    id: config.tierTesterRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (gameModeRole && gameModeRole.id !== config.tierTesterRoleId) overwrites.push({
    id: gameModeRole.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (config.staffRoleId) overwrites.push({
    id: config.staffRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });
  if (config.modRoleId && config.modRoleId !== config.staffRoleId) overwrites.push({
    id: config.modRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });

  let ttChannel: TextChannel;
  try {
    ttChannel = await guild.channels.create({
      name: ttName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      topic: aimingTier
        ? `TIERTEST|${playerId}|${testerId}|${mcUsername}|${region}|${gameMode}|${aimingTier}`
        : `TIERTEST|${playerId}|${testerId}|${mcUsername}|${region}|${gameMode}`,
      reason: `Tier test — ${mcUsername} tested by ${testerId}`,
    }) as TextChannel;
  } catch (err) {
    console.error('[queue] Failed to create tier test channel:', err);
    const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
    await queueCh?.send('❌ Failed to create tier test channel. Check bot **Manage Channels** permission.').catch(() => null);
    return;
  }

  const info: TierTestInfo = { channelId: ttChannel.id, messageId: '', playerId, testerId, mcUsername, region, gameMode, aimingTier };

  // Message 1: status embed + Close button
  const embed    = await buildTierTestEmbed(guild, info);
  const statusMsg = await ttChannel.send({ embeds: [embed], components: [buildCloseRow()] });

  info.messageId = statusMsg.id;
  _activeTierTests.set(ttChannel.id, info);

  // Message 2: player → tester
  await ttChannel.send(`<@${playerId}> → <@${testerId}>`);

  // Message 3: tier select buttons
  await ttChannel.send({ content: '**Select the tested tier:** 🎯', components: buildTierButtonRows(gameMode) });

  // Delete the queue channel
  _activeQueues.delete(queueChannelId);
  const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
  if (queueCh) setTimeout(() => queueCh.delete('Tier test started').catch(console.error), 1000);
}

// ─── Tier Test Close Button ───────────────────────────────────────────────────

export async function handleTtClose(interaction: ButtonInteraction): Promise<void> {
  const member  = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const info    = parseTierTestTopic(channel.topic ?? '') ?? getActiveTierTest(channel.id);

  const isPlayer          = info?.playerId  === interaction.user.id;
  const isAcceptingTester = info?.testerId  === interaction.user.id;
  const canClose          = isPlayer || isAcceptingTester || isStaffOrAdmin(member);

  if (!canClose) {
    await interaction.reply({ content: '❌ Only the player, the tester, or staff can close this ticket.', ephemeral: true });
    return;
  }

  _activeTierTests.delete(channel.id);

  await interaction.update({ components: [] });
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription(`🔒 **Ticket closed** — Closed by <@${interaction.user.id}>.`).setTimestamp()] });
  setTimeout(() => channel.delete('Ticket closed').catch(console.error), 1500);
}

// ─── Live Refresh (presence-driven) ──────────────────────────────────────────

let _queueRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleQueueRefresh(client: Client): void {
  if (_queueRefreshTimer) clearTimeout(_queueRefreshTimer);
  _queueRefreshTimer = setTimeout(() => {
    _queueRefreshTimer = null;
    _refreshAll(client).catch(console.error);
  }, 2000);
}

async function _refreshAll(client: Client): Promise<void> {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  for (const [channelId, info] of _activeQueues) {
    try {
      const ch = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!ch) { _activeQueues.delete(channelId); continue; }
      const msg = await ch.messages.fetch(info.messageId).catch(() => null);
      if (!msg) { _activeQueues.delete(channelId); continue; }
      const embed = await buildQueueEmbed(guild, info);
      await msg.edit({ embeds: [embed], components: [buildQueueButtons()] });
    } catch { /* ignore */ }
  }

  for (const [channelId, info] of _activeTierTests) {
    try {
      const ch = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!ch) { _activeTierTests.delete(channelId); continue; }
      const msg = await ch.messages.fetch(info.messageId).catch(() => null);
      if (!msg) { _activeTierTests.delete(channelId); continue; }
      const embed = await buildTierTestEmbed(guild, info);
      await msg.edit({ embeds: [embed], components: [buildCloseRow()] });
    } catch { /* ignore */ }
  }
}
