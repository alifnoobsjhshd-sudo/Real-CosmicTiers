import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type Client,
  type GuildMember,
  type TextChannel,
  type Role,
} from 'discord.js';
import { getConfig, setConfig } from './config.js';
import { getRegistrationByDiscordId } from './registration.js';
import { getTitleEmoji, formatTierWithEmoji, getEmojiString, sanitizeToEmojiName } from './emojis.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const WEBSITE_LINK = process.env['WEBSITE_LINK'] ?? '';
const API_BASE = (process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000').replace(/\/$/, '');
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

const GAME_MODES = ['Sword-PvP', 'UHC', 'Pot-PvP', 'Nethpot', 'SMP-PvP', 'Axe-PvP', 'Mace-PvP', 'Crystal-PvP', 'cartpvp'];

function displayGameMode(gameMode: string): string {
  return gameMode === 'cartpvp' ? 'Cart-PvP' : gameMode;
}
const PAGE_SIZE = 5;

export const LB_PREV_ID = 'lb_prev';
export const LB_NEXT_ID = 'lb_next';

export const TIER_POINTS: Record<string, number> = {
  LT5: 1,  HT5: 2,
  LT4: 3,  HT4: 4,
  LT3: 6,  HT3: 10,
  LT2: 20, HT2: 30,
  LT1: 45, HT1: 60,
};

export const TITLES: { name: string; minPoints: number; color: number }[] = [
  { name: 'Rookie',             minPoints: 1,   color: 0x99aab5 },
  { name: 'Combat Initiate',    minPoints: 5,   color: 0x3498db },
  { name: 'Combat Novice',      minPoints: 10,  color: 0x2ecc71 },
  { name: 'Combat Cadet',       minPoints: 20,  color: 0x1abc9c },
  { name: 'Combat Specialist',  minPoints: 50,  color: 0xf1c40f },
  { name: 'Combat Ace',         minPoints: 100, color: 0xe67e22 },
  { name: 'Combat Master',      minPoints: 250, color: 0xe74c3c },
  { name: 'Combat Grandmaster', minPoints: 400, color: 0xFFD700 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRolePoints(roleName: string): number {
  for (const mode of GAME_MODES) {
    for (const [tier, pts] of Object.entries(TIER_POINTS)) {
      if (roleName === `${displayGameMode(mode)} ${tier}`) return pts;
      if (roleName === `${displayGameMode(mode)} R${tier}`) return pts;
    }
  }
  return 0;
}

export function isTierRoleName(roleName: string): boolean {
  return getRolePoints(roleName) > 0;
}

export function getMemberPoints(member: GuildMember): number {
  return member.roles.cache.reduce((sum, role) => sum + getRolePoints(role.name), 0);
}

export function getTitleForPoints(points: number): typeof TITLES[number] {
  let result = TITLES[0];
  for (const t of TITLES) {
    if (points >= t.minPoints) result = t;
    else break;
  }
  return result;
}

// ─── Title Role Management ────────────────────────────────────────────────────

async function getOrCreateTitleRole(guild: Guild, title: typeof TITLES[number]): Promise<string> {
  const config = getConfig();
  const titleRoleIds = config.titleRoleIds ?? {};

  if (titleRoleIds[title.name]) {
    const cached = guild.roles.cache.get(titleRoleIds[title.name]);
    if (cached) return cached.id;

    try {
      const fetched = await guild.roles.fetch(titleRoleIds[title.name]);
      if (fetched) return fetched.id;
    } catch {
      // Role was truly deleted — fall through to create a new one
    }
  }

  await guild.roles.fetch();
  const existing = guild.roles.cache.find(r => r.name === title.name);
  if (existing) {
    await sanitizeTitleRole(existing);
    titleRoleIds[title.name] = existing.id;
    setConfig({ titleRoleIds });
    return existing.id;
  }

  const role = await guild.roles.create({
    name: title.name,
    color: title.color,
    permissions: 0n,
    reason: 'Auto-created title role by Tier Test Bot',
  });
  titleRoleIds[title.name] = role.id;
  setConfig({ titleRoleIds });
  console.log(`Auto-created title role "${title.name}": ${role.id}`);
  return role.id;
}

const TITLE_DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ModerateMembers,
] as const;

async function sanitizeTitleRole(role: Role): Promise<void> {
  const hasDangerous = TITLE_DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p));
  if (!hasDangerous) return;
  const safeBits = TITLE_DANGEROUS_PERMISSIONS.reduce(
    (bits, flag) => bits & ~flag,
    role.permissions.bitfield,
  );
  await role.setPermissions(safeBits, 'Removed dangerous permissions from bot-managed title role');
  console.log(`[role-audit] Stripped dangerous permissions from title role "${role.name}"`);
}

export async function assignTitleRole(guild: Guild, member: GuildMember): Promise<string> {
  const points = getMemberPoints(member);

  const config = getConfig();
  const titleRoleIds = config.titleRoleIds ?? {};

  if (points === 0) {
    for (const [, roleId] of Object.entries(titleRoleIds)) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, 'No points — removing title role');
      }
    }
    return 'None';
  }

  const title = getTitleForPoints(points);
  const correctRoleId = await getOrCreateTitleRole(guild, title);

  for (const [, roleId] of Object.entries(titleRoleIds)) {
    if (roleId !== correctRoleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, 'Updating title role');
    }
  }

  if (!member.roles.cache.has(correctRoleId)) {
    await member.roles.add(correctRoleId, `Title: ${title.name} (${points} pts)`);
  }

  return title.name;
}

// ─── Leaderboard Data ─────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id: string;
  points: number;
  pointDelta?: number;
  tierRoles: string[];
  mcUsername?: string;
}

async function getLeaderboardEntries(guild: Guild): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/api/bot/leaderboard`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json() as {
      entries: Array<{
        discordId: string;
        mcUsername: string;
        totalPoints: number;
        pointDelta: number;
        tiers: Record<string, string>;
        retiredTiers: string[];
      }>;
    };
    return (data.entries ?? []).map(e => {
      const tierRoles: string[] = [];
      for (const [gameMode, tier] of Object.entries(e.tiers)) {
        const roleName = e.retiredTiers.includes(gameMode)
          ? `${displayGameMode(gameMode)} R${tier}`
          : `${displayGameMode(gameMode)} ${tier}`;
        tierRoles.push(roleName);
      }
      tierRoles.sort((a, b) => getRolePoints(b) - getRolePoints(a));
      return {
        id: e.discordId,
        points: e.totalPoints,
        pointDelta: e.pointDelta,
        tierRoles,
        mcUsername: e.mcUsername,
      };
    });
  } catch (err) {
    console.error('[leaderboard] API fetch failed, falling back to guild scan:', err);
    if (guild.members.cache.size < 2) await guild.members.fetch();
    return guild.members.cache
      .filter(m => !m.user.bot)
      .map(member => ({
        id: member.id,
        points: getMemberPoints(member),
        tierRoles: member.roles.cache
          .filter(r => getRolePoints(r.name) > 0)
          .map(r => r.name)
          .sort((a, b) => getRolePoints(b) - getRolePoints(a)),
        mcUsername: getRegistrationByDiscordId(member.id)?.mcUsername,
      }))
      .filter(e => e.points > 0)
      .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  }
}

// ─── Embed / Components Builders ──────────────────────────────────────────────

function getTrendEmoji(pointDelta: number): string {
  const config = getConfig();
  const emojiStrings = config.emojiStrings ?? {};
  if (pointDelta >= 6) return emojiStrings['high_up'] ?? '⬆️⬆️';
  if (pointDelta >= 1) return emojiStrings['up'] ?? '⬆️';
  if (pointDelta <= -6) return emojiStrings['high_down'] ?? '⬇️⬇️';
  if (pointDelta <= -1) return emojiStrings['down'] ?? '⬇️';
  return '';
}

function buildLeaderboardEmbed(entries: LeaderboardEntry[], page: number): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = entries.slice(start, start + PAGE_SIZE);

  const footerText = `Page ${page + 1} / ${totalPages} · ${entries.length} ranked player(s)`;

  if (entries.length === 0) {
    return new EmbedBuilder()
      .setTitle('🏆 Cosmic Tiers Leaderboard')
      .setColor(0xFFD700)
      .setDescription('No ranked players yet. Use `/result` to post tier test results!')
      .setTimestamp();
  }

  let description = '';
  slice.forEach((entry, i) => {
    const globalRank = start + i + 1;
    const title = getTitleForPoints(entry.points);
    const titleEmoji = getTitleEmoji(title.name);
    const usernameDisplay = entry.mcUsername ? ` — ${entry.mcUsername}` : '';
    const trendEmoji = getTrendEmoji(entry.pointDelta ?? 0);

    const tiersLine = entry.tierRoles.length > 0
      ? entry.tierRoles.map(t => formatTierWithEmoji(t)).join('  •  ')
      : '*No tier roles*';

    description += `## **${globalRank}.** <@${entry.id}>${usernameDisplay}\n`;
    description += `> ${titleEmoji ? `${titleEmoji} ` : ''}**${title.name}** • ${entry.points} pts${trendEmoji ? ` ${trendEmoji}` : ''}\n`;
    description += `> -# ${tiersLine}\n`;
    if (i < slice.length - 1) description += '\n';
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Cosmic Tiers Leaderboard')
    .setColor(0xFFD700)
    .setDescription(description)
    .setFooter({ text: footerText })
    .setTimestamp();
  if (WEBSITE_LINK) embed.addFields({ name: '🌐 Cosmic Tiers Website', value: `[Visit Website](${WEBSITE_LINK})` });
  return embed;
}

function buildLeaderboardRows(entries: LeaderboardEntry[], page: number): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${LB_PREV_ID}:${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('lb_page_info')
      .setLabel(`Page ${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${LB_NEXT_ID}:${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return [navRow];
}

// ─── Build Full Message ───────────────────────────────────────────────────────

export async function buildLeaderboardMessage(guild: Guild, page: number): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const entries = await getLeaderboardEntries(guild);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  return {
    embeds: [buildLeaderboardEmbed(entries, safePage)],
    components: buildLeaderboardRows(entries, safePage),
  };
}

// ─── Post / Refresh ───────────────────────────────────────────────────────────

export async function postLeaderboardPanel(guild: Guild, channelId: string): Promise<void> {
  const config = getConfig();
  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) throw new Error('Leaderboard channel not found.');

  const message = await buildLeaderboardMessage(guild, 0);

  if (config.leaderboardMessageId) {
    try {
      const existing = await channel.messages.fetch(config.leaderboardMessageId);
      await existing.edit(message);
      return;
    } catch { /* Message gone */ }
  }

  const msg = await channel.send(message);
  setConfig({ leaderboardMessageId: msg.id, leaderboardChannelId: channelId });
}

let _lbTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleLeaderboardRefresh(client: Client): void {
  if (_lbTimer) clearTimeout(_lbTimer);
  _lbTimer = setTimeout(() => {
    _lbTimer = null;
    refreshLeaderboardPanel(client).catch(console.error);
  }, 1500);
}

export async function refreshLeaderboardPanel(client: Client): Promise<void> {
  const config = getConfig();
  if (!config.leaderboardChannelId || !config.leaderboardMessageId) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.leaderboardChannelId) as TextChannel | undefined;
  if (!channel) return;

  try {
    const msg = await channel.messages.fetch(config.leaderboardMessageId);
    const message = await buildLeaderboardMessage(guild, 0);
    await msg.edit(message);
  } catch {
    setConfig({ leaderboardMessageId: undefined });
  }
}
