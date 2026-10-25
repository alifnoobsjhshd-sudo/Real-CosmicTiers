import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
  type Client,
  type TextChannel,
} from 'discord.js';
import { getConfig, setConfig } from './config.js';
import { APPLY_TESTER_ID } from './tiertest.js';
import { formatTierWithEmoji, getGameModeEmoji } from './emojis.js';

const WEBSITE_LINK = process.env['WEBSITE_LINK'] ?? '';
const WEBSITE_API_URL = process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000';

const GAME_MODES = ['Sword-PvP', 'UHC', 'Pot-PvP', 'Nethpot', 'SMP-PvP', 'Axe-PvP', 'Mace-PvP', 'Crystal-PvP', 'cartpvp'];

function displayGameMode(gameMode: string): string {
  return gameMode === 'cartpvp' ? 'Cart-PvP' : gameMode;
}
const TIERS = ['LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3', 'LT2', 'HT2', 'LT1', 'HT1'];
const PAGE_SIZE = 5;

export const TL_PREV_ID = 'tl_prev';
export const TL_NEXT_ID = 'tl_next';
export const TL_PERIOD_ID = 'tl_period';

const PERIOD_LABELS: Record<string, string> = {
  month:   'This Month',
  year:    'This Year',
  alltime: 'All Time',
};

export function isTierRoleName(name: string): boolean {
  return GAME_MODES.some(mode =>
    TIERS.some(tier => name === `${displayGameMode(mode)} ${tier}` || name === `${displayGameMode(mode)} R${tier}`)
  );
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

// ─── Data ─────────────────────────────────────────────────────────────────────

interface TesterEntry {
  id: string;
  mcUsername: string;
  testCount: number;
  tierRoles: string[];
  gameModes: string[];
}

async function getTesterList(period: string): Promise<TesterEntry[]> {
  const response = await fetch(
    `${WEBSITE_API_URL.replace(/\/$/, '')}/api/testers?period=${encodeURIComponent(period)}&activeOnly=true`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Tester database request failed: HTTP ${response.status}`);
  const data = await response.json() as {
    testers?: Array<{
      discordId: string;
      mcUsername: string | null;
      testCount?: number;
      tiers?: Record<string, string>;
      retiredTiers?: string[];
      gameModes?: string[];
    }>;
  };

  return (data.testers ?? [])
    .map(tester => {
      const retired = new Set(tester.retiredTiers ?? []);
      const tierRoles = Object.entries(tester.tiers ?? {}).map(([mode, tier]) =>
        `${displayGameMode(mode)} ${retired.has(mode) ? 'R' : ''}${tier}`,
      );
      return {
        id: tester.discordId,
        mcUsername: tester.mcUsername ?? '',
        testCount: tester.testCount ?? 0,
        tierRoles: tierRoles.sort(),
        gameModes: tester.gameModes ?? [],
      };
    })
    .filter(tester => tester.mcUsername.trim().length > 0)
    .sort((a, b) => b.testCount - a.testCount || a.mcUsername.localeCompare(b.mcUsername));
}

// ─── Embed Builder ────────────────────────────────────────────────────────────

function buildTesterEmbed(testers: TesterEntry[], page: number, period: string): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = testers.slice(start, start + PAGE_SIZE);

  if (testers.length === 0) {
    return new EmbedBuilder()
      .setColor(0xFFBF00)
      .setDescription(
        '**🏅 Current Tier Testers:**\n\n' +
        '*No active tier testers are registered in the database.*'
      )
      .setTimestamp();
  }

  let description = '**🏅 Current Tier Testers:**\n\n';
  slice.forEach((tester, i) => {
    const globalRank = start + i + 1;
    const tiersText = tester.tierRoles.length > 0
      ? tester.tierRoles.map(t => formatTierWithEmoji(t)).join('  •  ')
      : '*No tier roles yet*';

    const gameModeEmojis = tester.gameModes
      .map(gm => getGameModeEmoji(gm))
      .filter(e => e.length > 0)
      .join(' ');

    description += `**${globalRank}.** **${tester.mcUsername}** — **${tester.testCount}** tests\n`;
    description += `> -# ${tiersText}\n`;
    description += `### Tester For:\n`;
    description += `- ${gameModeEmojis.length > 0 ? gameModeEmojis : '*Not configured*'}\n`;
    if (i < slice.length - 1) description += '\n';
  });

  const periodLabel = PERIOD_LABELS[period] ?? 'All Time';
  const footerText = `Page ${page + 1} / ${totalPages} · ${testers.length} tester(s) · Tests: ${periodLabel}`;

  const embed = new EmbedBuilder()
    .setColor(0xFFBF00)
    .setDescription(description)
    .setFooter({ text: footerText })
    .setTimestamp();
  if (WEBSITE_LINK) embed.addFields({ name: '🌐 Cosmic Tiers Website', value: `[Visit Website](${WEBSITE_LINK})` });
  return embed;
}

function buildTesterRows(testers: TesterEntry[], page: number, period: string): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TL_PREV_ID}:${page}:${period}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('tl_page_info')
      .setLabel(`Page ${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${TL_NEXT_ID}:${page}:${period}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  const periodRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TL_PERIOD_ID}:month`)
      .setLabel('This Month')
      .setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TL_PERIOD_ID}:year`)
      .setLabel('This Year')
      .setStyle(period === 'year' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${TL_PERIOD_ID}:alltime`)
      .setLabel('All Time')
      .setStyle(period === 'alltime' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const applyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(APPLY_TESTER_ID)
      .setLabel('📋 Apply for Tier Tester')
      .setStyle(ButtonStyle.Success),
  );

  return [navRow, periodRow, applyRow];
}

// ─── Build Full Message ───────────────────────────────────────────────────────

export async function buildTesterMessage(guild: Guild, page: number, period: string = 'alltime'): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const testers = await getTesterList(period);
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  return {
    embeds: [buildTesterEmbed(testers, safePage, period)],
    components: buildTesterRows(testers, safePage, period),
  };
}

// ─── Post / Refresh ───────────────────────────────────────────────────────────

export async function postTesterListPanel(guild: Guild, channelId: string): Promise<void> {
  const config = getConfig();
  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) throw new Error('Tester list channel not found.');

  const message = await buildTesterMessage(guild, 0);

  if (config.currentTesterMessageId) {
    try {
      const existing = await channel.messages.fetch(config.currentTesterMessageId);
      await existing.edit(message);
      return;
    } catch { /* Message gone */ }
  }

  const msg = await channel.send(message);
  setConfig({ currentTesterMessageId: msg.id, currentTesterChannelId: channelId });
}

let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTesterListRefresh(client: Client): void {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    refreshTesterListPanel(client).catch(console.error);
  }, 1500);
}

export async function refreshTesterListPanel(client: Client): Promise<void> {
  const config = getConfig();
  if (!config.currentTesterChannelId || !config.currentTesterMessageId) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.currentTesterChannelId) as TextChannel | undefined;
  if (!channel) return;

  try {
    const msg = await channel.messages.fetch(config.currentTesterMessageId);
    const message = await buildTesterMessage(guild, 0);
    await msg.edit(message);
  } catch {
    setConfig({ currentTesterMessageId: undefined });
  }
}
