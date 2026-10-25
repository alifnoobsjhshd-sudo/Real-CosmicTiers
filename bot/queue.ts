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
import { getCountryOption } from './countryZones.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUEUE_LEAVE_ID     = 'queue_leave';
export const QUEUE_NEXT_ID      = 'queue_next';
export const QUEUE_END_ID       = 'queue_end';
export const TIER_SELECT_PREFIX = 'tier_select';
export const TT_CLOSE_ID        = 'tt_close';
export const TICKET_LEAVE_ID    = 'ticket_leave';
export const TICKET_CLOSE_ID    = 'ticket_close';

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
  preferredAt?: number;
  preferredCountry?: string;
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
  preferredAt?: number;
  preferredCountry?: string;
  scheduledAt?: number;
  scheduledCountry?: string;
  scheduledBy?: string;
  notified?: boolean;
}

export interface TicketInfo {
  channelId:  string;
  messageId:  string;
  playerId:   string;
  mcUsername: string;
  region:     string;
  gameMode:   string;
  aimingTier?: string;
  preferredAt?: number;
  preferredCountry?: string;
  testerId?: string;
  scheduledAt?: number;
  scheduledCountry?: string;
  scheduledBy?: string;
  notified?: boolean;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const _activeQueues    = new Map<string, QueueInfo>();
const _activeQueueMessages = new Map<string, QueueInfo>();
const _activeTierTests = new Map<string, TierTestInfo>();
const _activeTickets   = new Map<string, TicketInfo>();

export function getActiveQueue(channelId: string): QueueInfo | undefined {
  return _activeQueues.get(channelId);
}

export async function restoreSharedQueueMessages(client: Client): Promise<void> {
  const guild = client.guilds.cache.first();
  const queueChannelId = getConfig().queueChannelId;
  if (!guild || !queueChannelId) return;
  const channel = await guild.channels.fetch(queueChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const messages = await channel.messages.fetch({ limit: 100 }).catch((error) => {
    console.error('[queue] Could not restore shared queue messages:', error);
    return null;
  });
  if (!messages) return;

  for (const message of messages.values()) {
    const info = (message.components as unknown as Array<{ components?: Array<{ customId?: string }> }>)
      .flatMap(row => row.components ?? [])
      .map(component => typeof component.customId === 'string' ? parseSharedQueueButton(component.customId) : null)
      .find((item): item is QueueInfo => item !== null);
    if (info) {
      _activeQueueMessages.set(message.id, { ...info, channelId: channel.id, messageId: message.id });
    }
  }
  console.log(`[queue] Restored ${_activeQueueMessages.size} active shared queue message(s).`);
}

export function getActiveTierTest(channelId: string): TierTestInfo | undefined {
  return _activeTierTests.get(channelId);
}

export function removeTierTestEntry(channelId: string): void {
  _activeTierTests.delete(channelId);
}

export function getActiveTicket(channelId: string): TicketInfo | undefined {
  return _activeTickets.get(channelId);
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

export function parseSharedQueueButton(customId: string): QueueInfo | null {
  const parts = customId.split(':');
  if (![QUEUE_LEAVE_ID, QUEUE_NEXT_ID, QUEUE_END_ID].includes(parts[0]) || parts.length !== 8) return null;
  const [playerId, mcUsername, region, gameMode, tier, preferredAt, preferredCountry] = parts.slice(1);
  if (!playerId || !mcUsername || !region || !gameMode) return null;
  const parsedTime = Number(preferredAt);
  return {
    channelId: '',
    messageId: '',
    playerId,
    mcUsername,
    region,
    gameMode,
    aimingTier: tier && tier !== '-' ? tier : undefined,
    preferredAt: Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : undefined,
    preferredCountry: preferredCountry && preferredCountry !== 'XX' ? preferredCountry : undefined,
  };
}

export function parseTierTestTopic(topic: string): ({
  playerId: string;
  testerId: string;
  mcUsername: string;
  region: string;
  gameMode: string;
  aimingTier?: string;
} & TestScheduleMetadata) | null {
  const parts = topic.split('|');
  if (parts.length < 6 || parts[0] !== 'TIERTEST') return null;
  const optionalTier = parts[6];
  return {
    playerId: parts[1],
    testerId: parts[2],
    mcUsername: parts[3],
    region: parts[4],
    gameMode: parts[5],
    aimingTier: optionalTier && optionalTier !== '-' && !optionalTier.startsWith('P=') ? optionalTier : undefined,
    ...parseScheduleMetadata(parts),
  };
}

export function parseTicketTopic(topic: string): Omit<TicketInfo, 'channelId' | 'messageId'> | null {
  const parts = topic.split('|');
  if (parts.length < 5 || parts[0] !== 'TICKET') return null;
  const optionalTier = parts[5];
  return {
    playerId:   parts[1],
    mcUsername: parts[2],
    region:     parts[3],
    gameMode:   parts[4],
    aimingTier: optionalTier && optionalTier !== '-' && !optionalTier.startsWith('P=') ? optionalTier : undefined,
    ...parseScheduleMetadata(parts),
  };
}

export interface TestScheduleMetadata {
  preferredAt?: number;
  preferredCountry?: string;
  scheduledAt?: number;
  scheduledCountry?: string;
  scheduledBy?: string;
  notified?: boolean;
}

function parseScheduleMetadata(parts: string[]): TestScheduleMetadata {
  const metadata: TestScheduleMetadata = {};
  for (const part of parts) {
    if (part.startsWith('P=')) {
      const [timestamp, country] = part.slice(2).split(':');
      const value = Number(timestamp);
      if (Number.isFinite(value) && value > 0) {
        metadata.preferredAt = value;
        metadata.preferredCountry = country;
      }
    } else if (part.startsWith('S=')) {
      const [timestamp, country] = part.slice(2).split(':');
      const value = Number(timestamp);
      if (Number.isFinite(value) && value > 0) {
        metadata.scheduledAt = value;
        metadata.scheduledCountry = country;
      }
    } else if (part.startsWith('A=')) {
      metadata.scheduledBy = part.slice(2) || undefined;
    } else if (part === 'N=1') {
      metadata.notified = true;
    }
  }
  return metadata;
}

export function setTestSchedule(
  channel: TextChannel,
  scheduledAt: number,
  countryCode: string,
  testerId: string,
): Promise<TextChannel> {
  const keptParts = (channel.topic ?? '').split('|').filter((part) =>
    !part.startsWith('S=') && !part.startsWith('A=') && part !== 'N=1' && part !== 'N=0',
  );
  keptParts.push(`S=${scheduledAt}:${countryCode}`, `A=${testerId}`, 'N=0');
  return channel.setTopic(keptParts.join('|'));
}

export function markTestScheduleNotified(channel: TextChannel): Promise<TextChannel> {
  const keptParts = (channel.topic ?? '').split('|').filter((part) => part !== 'N=1' && part !== 'N=0');
  keptParts.push('N=1');
  return channel.setTopic(keptParts.join('|'));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 20);
}

function displayGameMode(gm: string): string {
  return gm === 'cartpvp' ? 'Cart-PvP' : gm;
}

export function isTester(member: GuildMember): boolean {
  const config = getConfig();
  return config.tierTesterRoleId ? member.roles.cache.has(config.tierTesterRoleId) : false;
}

export function isStaffOrAdmin(member: GuildMember): boolean {
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
  if (info.preferredAt && info.preferredCountry) {
    const country = getCountryOption(info.preferredCountry);
    embed.addFields({
      name: '🕒 Preferred Test Time',
      value: `<t:${info.preferredAt}:D> · <t:${info.preferredAt}:t> (${country?.name ?? info.preferredCountry})`,
      inline: false,
    });
  }

  embed.addFields({ name: `👥 ${modeDisplay} Testers Online`, value: testerLine, inline: false });

  // Show the tier tester role mention so it's visible in the embed
  if (config.tierTesterRoleId) {
    embed.addFields({ name: '📢 Tier Testers', value: `<@&${config.tierTesterRoleId}>`, inline: false });
  }

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
  if (info.preferredAt && info.preferredCountry) {
    const country = getCountryOption(info.preferredCountry);
    embed.addFields({
      name: '🕒 Player Preferred Test Time',
      value: `<t:${info.preferredAt}:D> · <t:${info.preferredAt}:t> (${country?.name ?? info.preferredCountry})`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Tier Test System — Cosmic Tiers' }).setTimestamp();

  return embed;
}

// ─── Button row builders (exported for index.ts) ──────────────────────────────

function buildQueueButtons(info: QueueInfo): ActionRowBuilder<ButtonBuilder> {
  const payload = [
    info.playerId,
    info.mcUsername,
    info.region,
    info.gameMode,
    info.aimingTier ?? '-',
    info.preferredAt ?? 0,
    info.preferredCountry ?? 'XX',
  ].join(':');
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${QUEUE_LEAVE_ID}:${payload}`).setLabel('🚪 Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${QUEUE_NEXT_ID}:${payload}`).setLabel('▶️ Start').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${QUEUE_END_ID}:${payload}`).setLabel('⏹️ End').setStyle(ButtonStyle.Secondary),
  );
}

export function buildTestTimeButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('testtime_now').setLabel('Now').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('testtime_preferred').setLabel('Player preferred time').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('testtime_select').setLabel('Select time').setStyle(ButtonStyle.Primary),
  );
}

function buildCloseRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TT_CLOSE_ID).setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
  );
}

async function buildTicketEmbed(guild: Guild, info: TicketInfo): Promise<EmbedBuilder> {
  const config      = getConfig();
  const modeDisplay = displayGameMode(info.gameMode);
  const modeEmoji   = getGameModeEmoji(info.gameMode);
  const modeLabel   = modeEmoji ? `${modeEmoji} ${modeDisplay}` : modeDisplay;

  if (guild.members.cache.size < 2) {
    try { await guild.members.fetch(); } catch { /* ignore */ }
  }

  const playerStatus = getMemberOnlineStatus(guild, info.playerId);

  let testerLine = '`Not configured`';
  const gmRoleName = `${modeDisplay} Tester`;
  const gmRole     = guild.roles.cache.find(r => r.name === gmRoleName);
  const roleForCount = gmRole?.id ?? config.tierTesterRoleId;
  if (roleForCount) {
    const { online, total } = await countOnlineTestersByRole(guild, roleForCount);
    testerLine = `🟢 **${online}** online  ·  👥 **${total}** total`;
  }

  const baseFields = [
    { name: '👤 Player',    value: `<@${info.playerId}>`,    inline: true },
    { name: '🎮 IGN',       value: `\`${info.mcUsername}\``, inline: true },
    { name: '🌍 Region',    value: `\`${info.region}\``,     inline: true },
    { name: '⚔️ Game Mode', value: modeLabel,                inline: true },
    ...(info.aimingTier ? [{ name: '🎯 Aiming Tier', value: `\`${info.aimingTier}\``, inline: true }] : []),
    { name: '📶 Status',    value: playerStatus,             inline: true },
  ];
  if (info.preferredAt && info.preferredCountry) {
    const country = getCountryOption(info.preferredCountry);
    baseFields.push({
      name: '🕒 Player Preferred Test Time',
      value: `<t:${info.preferredAt}:D> · <t:${info.preferredAt}:t> (${country?.name ?? info.preferredCountry})`,
      inline: false,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ Tier Test Ticket — ${modeLabel}`)
    .setColor(QUEUE_YELLOW)
    .setThumbnail(`${WEBSITE_API_URL}/api/skin/${info.playerId}`)
    .setDescription(
      `<@${info.playerId}> is waiting for a tier tester.\n` +
      `A tester will claim this ticket shortly. Please **stay online** and be patient.`,
    )
    .addFields(...baseFields);

  embed.addFields({ name: `👥 ${modeDisplay} Testers Online`, value: testerLine, inline: false });

  embed.setFooter({ text: 'Direct Ticket System — Cosmic Tiers' }).setTimestamp();
  return embed;
}

function buildTicketButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TICKET_LEAVE_ID).setLabel('🚪 Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(TICKET_CLOSE_ID).setLabel('🔒 Close').setStyle(ButtonStyle.Secondary),
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
  preferredAt?: number,
  preferredCountry?: string,
): Promise<void> {
  const config = getConfig();
  const modeDisplay  = displayGameMode(gameMode);
  const gmRoleName   = `${modeDisplay} Tester`;
  const gameModeRole = guild.roles.cache.find(r => r.name === gmRoleName);

  if (!config.queueChannelId) {
    await interaction.editReply({
      content: '❌ The shared queue channel is not configured. Ask a manager to run `/set-queue-channel`.',
      components: [],
      embeds: [],
    });
    return;
  }

  let queueChannel: TextChannel;
  try {
    const channel = await guild.channels.fetch(config.queueChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Configured queue channel is not a text channel.');
    queueChannel = channel;
  } catch (err) {
    console.error('[queue] Could not access configured queue channel:', err);
    await interaction.editReply({
      content: '❌ I cannot access the configured queue channel. Ask a manager to check `/set-queue-channel` and the bot permissions.',
      components: [],
      embeds: [],
    });
    return;
  }

  const recentMessages = await queueChannel.messages.fetch({ limit: 100 }).catch(() => null);
  const existingQueue = Array.from(_activeQueueMessages.values()).find(entry => entry.playerId === playerId)
    ?? (recentMessages
      ? Array.from(recentMessages.values())
        .map(message => ({
          message,
          info: (message.components as unknown as Array<{ components?: Array<{ customId?: string }> }>)
            .flatMap(row => row.components ?? [])
            .map(component => typeof component.customId === 'string' ? parseSharedQueueButton(component.customId) : null)
            .find((info): info is QueueInfo => info !== null),
        }))
        .find(entry => entry.info?.playerId === playerId)?.info
      : undefined);
  if (existingQueue) {
    await interaction.editReply({
      content: `❌ You already have an active queue message in <#${queueChannel.id}>. Leave it before opening another.`,
      components: [],
      embeds: [],
    });
    return;
  }

  const ttName = `tt-${sanitize(mcUsername)}`;
  const existingTt = guild.channels.cache.find(c => c.name === ttName);
  if (existingTt) {
    await interaction.editReply({ content: `❌ You already have an active tier test: <#${existingTt.id}>. Please wait for it to close.`, components: [], embeds: [] });
    return;
  }

  const tmpInfo: QueueInfo = {
    channelId: queueChannel.id,
    messageId: '',
    playerId,
    mcUsername,
    region,
    gameMode,
    aimingTier,
    preferredAt,
    preferredCountry,
  };
  const embed = await buildQueueEmbed(guild, tmpInfo);

  const testerMention = config.tierTesterRoleId ? `<@&${config.tierTesterRoleId}>` : '';
  const gmMention     = gameModeRole && gameModeRole.id !== config.tierTesterRoleId ? ` <@&${gameModeRole.id}>` : '';
  const staffMention  = config.staffRoleId ? ` <@&${config.staffRoleId}>` : '';
  const modMention    = config.modRoleId   ? ` <@&${config.modRoleId}>` : '';
  const notifyContent = `${testerMention}${gmMention}${staffMention}${modMention}`.trim();

  const msg = await queueChannel.send({
    content: notifyContent ? `${notifyContent} — **${mcUsername}** is waiting for a **${modeDisplay}** tier test!` : undefined,
    embeds: [embed],
    components: [buildQueueButtons(tmpInfo)],
  });

  _activeQueueMessages.set(msg.id, { ...tmpInfo, messageId: msg.id });

  await interaction.editReply({
    content: `✅ You're now in the queue! Your request is posted in <#${queueChannel.id}>. A Tier Tester will contact you.`,
    components: [],
    embeds: [],
  });
}

// ─── Create Direct Ticket Channel (queue disabled mode) ──────────────────────

export async function createDirectTicketChannel(
  interaction: ButtonInteraction,
  guild: Guild,
  gameMode: string,
  playerId: string,
  mcUsername: string,
  region: string,
  aimingTier?: string,
  preferredAt?: number,
  preferredCountry?: string,
): Promise<void> {
  const config      = getConfig();
  const modeDisplay = displayGameMode(gameMode);
  const gmRoleName  = `${modeDisplay} Tester`;
  const gameModeRole = guild.roles.cache.find(r => r.name === gmRoleName);

  const ticketName = `${sanitize(gameMode)}-test`;
  const existing   = guild.channels.cache.find(c =>
    c.type === ChannelType.GuildText &&
    (c as TextChannel).topic?.startsWith(`TICKET|${playerId}|`),
  );
  if (existing) {
    await interaction.editReply({ content: `❌ You already have an active ticket: <#${existing.id}>. Please leave it first.`, components: [], embeds: [] });
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

  let ticketChannel: TextChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      topic: [
        'TICKET',
        playerId,
        mcUsername,
        region,
        gameMode,
        aimingTier ?? '-',
        ...(preferredAt && preferredCountry ? [`P=${preferredAt}:${preferredCountry}`] : []),
      ].join('|'),
      reason: `Tier test ticket for ${mcUsername} (${modeDisplay})`,
    }) as TextChannel;
  } catch (err) {
    console.error('[ticket] Failed to create ticket channel:', err);
    await interaction.editReply({ content: '❌ Failed to create ticket channel. Make sure the bot has **Manage Channels** permission.', components: [], embeds: [] });
    return;
  }

  const tmpInfo: TicketInfo = {
    channelId: ticketChannel.id,
    messageId: '',
    playerId,
    mcUsername,
    region,
    gameMode,
    aimingTier,
    preferredAt,
    preferredCountry,
  };
  const embed = await buildTicketEmbed(guild, tmpInfo);

  const gameMentionId = gameModeRole?.id ?? config.tierTesterRoleId;
  const gmMention     = gameMentionId ? `<@&${gameMentionId}>` : '';
  const staffMention  = config.staffRoleId ? ` <@&${config.staffRoleId}>` : '';
  const modMention    = config.modRoleId   ? ` <@&${config.modRoleId}>` : '';
  const notifyContent = `${gmMention}${staffMention}${modMention}`.trim();

  const msg = await ticketChannel.send({
    content: notifyContent ? `${notifyContent} — **${mcUsername}** needs a **${modeDisplay}** tier test!` : undefined,
    embeds: [embed],
    components: [buildTicketButtons()],
  });

  _activeTickets.set(ticketChannel.id, { ...tmpInfo, messageId: msg.id });
  await ticketChannel.send({ content: '**Choose your tier test time**', components: [buildTestTimeButtons()] });

  await interaction.editReply({
    content: `✅ Your tier test ticket has been created! Head to <#${ticketChannel.id}> and wait for a Tier Tester.`,
    components: [],
    embeds: [],
  });
}

// ─── Ticket Button Handlers ───────────────────────────────────────────────────

export async function handleTicketLeave(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const info    = parseTicketTopic(channel.topic ?? '') ?? getActiveTicket(channel.id);

  if (!info) {
    await interaction.reply({ content: '❌ Could not identify this ticket. Contact an admin.', ephemeral: true });
    return;
  }

  const isPlayer = info.playerId === interaction.user.id;
  if (!isPlayer) {
    await interaction.reply({ content: '⛔ Only the player who opened this ticket can use **Leave**.', ephemeral: true });
    return;
  }

  _activeTickets.delete(channel.id);
  await interaction.update({ components: [] });
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription(`🚪 **Ticket closed** — <@${interaction.user.id}> left the queue.`).setTimestamp()] });
  setTimeout(() => channel.delete('Player left ticket').catch(console.error), 1500);
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const member  = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;

  const canClose = isTester(member) || isStaffOrAdmin(member);
  if (!canClose) {
    await interaction.reply({ content: '⛔ Only tier testers or staff can close this ticket.', ephemeral: true });
    return;
  }

  _activeTickets.delete(channel.id);
  await interaction.update({ components: [] });
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription(`🔒 **Ticket closed** — Closed by <@${interaction.user.id}>.`).setTimestamp()] });
  setTimeout(() => channel.delete('Ticket closed by staff').catch(console.error), 1500);
}

// ─── Queue Button Handlers ────────────────────────────────────────────────────

export async function handleQueueLeave(interaction: ButtonInteraction): Promise<void> {
  const member  = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const sharedInfo = parseSharedQueueButton(interaction.customId);
  const info = sharedInfo
    ? { ...sharedInfo, channelId: channel.id, messageId: interaction.message.id }
    : parseQueueTopic(channel.topic ?? '') ?? getActiveQueue(channel.id);

  const isPlayer = info?.playerId === interaction.user.id;
  if (!isPlayer && !isStaffOrAdmin(member)) {
    await interaction.reply({ content: '❌ Only the player who started this queue or staff can use **Leave**.', ephemeral: true });
    return;
  }

  if (sharedInfo) {
    _activeQueueMessages.delete(interaction.message.id);
    await interaction.deferUpdate();
    await interaction.message.delete().catch((err) => console.error('[queue] Failed to delete queue message:', err));
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
  const sharedInfo = parseSharedQueueButton(interaction.customId);
  if (sharedInfo) {
    _activeQueueMessages.delete(interaction.message.id);
    await interaction.deferUpdate();
    await interaction.message.delete().catch((err) => console.error('[queue] Failed to delete queue message:', err));
    return;
  }

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
  const sharedInfo = parseSharedQueueButton(interaction.customId);
  const info = sharedInfo
    ? { ...sharedInfo, channelId: channel.id, messageId: interaction.message.id }
    : parseQueueTopic(channel.topic ?? '') ?? getActiveQueue(channel.id);

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
  const created = await _createTierTestChannel(guild, interaction.user.id, info, channel.id);
  if (created && sharedInfo) {
    _activeQueueMessages.delete(interaction.message.id);
    await interaction.message.delete().catch((err) => console.error('[queue] Failed to delete started queue message:', err));
  }
}

// ─── Create Tier Test Channel (called by handleQueueNext) ────────────────────

async function _createTierTestChannel(
  guild: Guild,
  testerId: string,
  queueInfo: Pick<QueueInfo, 'playerId' | 'mcUsername' | 'region' | 'gameMode' | 'aimingTier'> &
    Partial<Pick<QueueInfo, 'preferredAt' | 'preferredCountry'>>,
  queueChannelId: string,
): Promise<boolean> {
  const config = getConfig();
  const { playerId, mcUsername, region, gameMode, aimingTier, preferredAt, preferredCountry } = queueInfo;
  const modeDisplay  = displayGameMode(gameMode);
  const gmRoleName   = `${modeDisplay} Tester`;
  const gameModeRole = guild.roles.cache.find(r => r.name === gmRoleName);
  const ttName       = `tt-${sanitize(mcUsername)}`;

  const existing = guild.channels.cache.find(c => c.name === ttName);
  if (existing) {
    const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
    await queueCh?.send(`❌ A tier test channel already exists: <#${existing.id}>. Close it first.`).catch(() => null);
    return false;
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
      topic: [
        'TIERTEST',
        playerId,
        testerId,
        mcUsername,
        region,
        gameMode,
        aimingTier ?? '-',
        ...(preferredAt && preferredCountry ? [`P=${preferredAt}:${preferredCountry}`] : []),
      ].join('|'),
      reason: `Tier test — ${mcUsername} tested by ${testerId}`,
    }) as TextChannel;
  } catch (err) {
    console.error('[queue] Failed to create tier test channel:', err);
    const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
    await queueCh?.send('❌ Failed to create tier test channel. Check bot **Manage Channels** permission.').catch(() => null);
    return false;
  }

  const info: TierTestInfo = {
    channelId: ttChannel.id,
    messageId: '',
    playerId,
    testerId,
    mcUsername,
    region,
    gameMode,
    aimingTier,
    preferredAt,
    preferredCountry,
  };

  // Message 1: status embed + Close button
  const embed    = await buildTierTestEmbed(guild, info);
  const statusMsg = await ttChannel.send({ embeds: [embed], components: [buildCloseRow()] });

  info.messageId = statusMsg.id;
  _activeTierTests.set(ttChannel.id, info);

  // Message 2: player → tester
  await ttChannel.send(`<@${playerId}> → <@${testerId}>`);

  // Message 3: tier select buttons
  await ttChannel.send({ content: '**Select the tested tier:** 🎯', components: buildTierButtonRows(gameMode) });
  // Message 4: scheduling controls shown to the player and all visible testers
  await ttChannel.send({ content: '**Choose your tier test time**', components: [buildTestTimeButtons()] });

  // Legacy per-player queue channels are still removed; the shared channel stays.
  _activeQueues.delete(queueChannelId);
  const queueCh = guild.channels.cache.get(queueChannelId) as TextChannel | undefined;
  if (queueCh?.topic?.startsWith('QUEUE|')) {
    setTimeout(() => queueCh.delete('Tier test started').catch(console.error), 1000);
  }
  return true;
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
      await msg.edit({ embeds: [embed], components: [buildQueueButtons(info)] });
    } catch { /* ignore */ }
  }

  for (const [messageId, info] of _activeQueueMessages) {
    try {
      const ch = guild.channels.cache.get(info.channelId) as TextChannel | undefined;
      if (!ch) { _activeQueueMessages.delete(messageId); continue; }
      const msg = await ch.messages.fetch(messageId).catch(() => null);
      if (!msg) { _activeQueueMessages.delete(messageId); continue; }
      const embed = await buildQueueEmbed(guild, info);
      await msg.edit({ embeds: [embed], components: [buildQueueButtons(info)] });
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

  for (const [channelId, info] of _activeTickets) {
    try {
      const ch = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (!ch) { _activeTickets.delete(channelId); continue; }
      const msg = await ch.messages.fetch(info.messageId).catch(() => null);
      if (!msg) { _activeTickets.delete(channelId); continue; }
      const embed = await buildTicketEmbed(guild, info);
      await msg.edit({ embeds: [embed], components: [buildTicketButtons()] });
    } catch { /* ignore */ }
  }
}
