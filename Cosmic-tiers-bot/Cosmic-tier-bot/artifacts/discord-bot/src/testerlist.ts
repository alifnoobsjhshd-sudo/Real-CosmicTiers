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
import { formatTierWithEmoji } from './emojis.js';

const GAME_MODES = ['Sword-PvP', 'UHC', 'Pot-PvP', 'Nethpot', 'SMP-PvP', 'Axe-PvP', 'Mace-PvP', 'Crystal-PvP'];
const TIERS = ['LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3', 'LT2', 'HT2', 'LT1', 'HT1'];
const PAGE_SIZE = 5;

export const TL_PREV_ID = 'tl_prev';
export const TL_NEXT_ID = 'tl_next';

export function isTierRoleName(name: string): boolean {
  return GAME_MODES.some(mode => TIERS.some(tier => name === `${mode} ${tier}`));
}

// ─── Data ─────────────────────────────────────────────────────────────────────

interface TesterEntry {
  id: string;
  testCount: number;
  tierRoles: string[];
}

async function getTesterList(guild: Guild): Promise<TesterEntry[]> {
  const config = getConfig();
  const stats = config.testerStats ?? {};

  if (!config.tierTesterRoleId) return [];
  if (guild.members.cache.size < 2) await guild.members.fetch();

  const role = guild.roles.cache.get(config.tierTesterRoleId);
  if (!role || role.members.size === 0) return [];

  return role.members
    .map(member => ({
      id: member.id,
      testCount: stats[member.id] ?? 0,
      tierRoles: member.roles.cache
        .filter(r => isTierRoleName(r.name))
        .map(r => r.name)
        .sort(),
    }))
    .sort((a, b) => b.testCount - a.testCount || a.id.localeCompare(b.id));
}

// ─── Embed Builder ────────────────────────────────────────────────────────────

function buildTesterEmbed(testers: TesterEntry[], page: number): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = testers.slice(start, start + PAGE_SIZE);

  if (testers.length === 0) {
    return new EmbedBuilder()
      .setColor(0xFFBF00)
      .setDescription(
        '**🏅 Current Tier Testers:**\n\n' +
        '*No tier testers found. Configure the role with `/set-tier-tester-role`.*'
      )
      .setTimestamp();
  }

  let description = '**🏅 Current Tier Testers:**\n\n';
  slice.forEach((tester, i) => {
    const globalRank = start + i + 1;
    const tiersText = tester.tierRoles.length > 0
      ? tester.tierRoles.map(t => formatTierWithEmoji(t)).join('  •  ')
      : '*No tier roles yet*';

    description += `**${globalRank}.** <@${tester.id}> — **${tester.testCount}** tests\n`;
    description += `> -# ${tiersText}\n`;
    if (i < slice.length - 1) description += '\n';
  });

  return new EmbedBuilder()
    .setColor(0xFFBF00)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1} / ${totalPages} · ${testers.length} tier tester(s) · Sorted by tests completed` })
    .setTimestamp();
}

function buildTesterRows(testers: TesterEntry[], page: number): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));

  // Row 1: navigation (always present, disabled when not applicable)
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TL_PREV_ID}:${page}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('tl_page_info')
      .setLabel(`Page ${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${TL_NEXT_ID}:${page}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  // Row 2: Apply for Tier Tester button
  const applyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(APPLY_TESTER_ID)
      .setLabel('📋 Apply for Tier Tester')
      .setStyle(ButtonStyle.Success),
  );

  return [navRow, applyRow];
}

// ─── Build Full Message ───────────────────────────────────────────────────────

export async function buildTesterMessage(guild: Guild, page: number): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const testers = await getTesterList(guild);
  const totalPages = Math.max(1, Math.ceil(testers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  return {
    embeds: [buildTesterEmbed(testers, safePage)],
    components: buildTesterRows(testers, safePage),
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
