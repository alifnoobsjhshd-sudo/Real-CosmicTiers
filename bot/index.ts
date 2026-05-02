import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type AutocompleteInteraction,
  type ModalSubmitInteraction,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
  type Message,
} from 'discord.js';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  uploadEmojiCommand,
  registerCommand,
  registerOtherCommand,
  setSkinCommand,
  skinChangeOtherCommand,
  resultCommand,
  doneCommand,
  addTestCommand,
  profileCommand,
  deleteUserCommand,
  setResultsChannelCommand,
  setStaffChannelCommand,
  setTierTesterRoleCommand,
  setTierTestChannelCommand,
  setCurrentTesterChannelCommand,
  setUnrankedRoleCommand,
  clearTierTestCommand,
  clearUserCommand,
  removeTierCommand,
  removeTesterCommand,
  setLeaderboardChannelCommand,
  setStaffRoleCommand,
  addTesterCommand,
  helpCommand,
  infoCommand,
  helpStaffCommand,
  infoStaffCommand,
  createTitleCommand,
  giveTitleCommand,
  removeTitleCommand,
  retiredCommand,
  unretiredCommand,
  setModRoleCommand,
  editProfileCommand,
  editProfileOtherCommand,
} from './commands.js';
import { getConfig, setConfig, incrementTesterStat, clearTesterStat, loadConfigFromApi } from './config.js';
import {
  BUTTON_ID,
  PANEL_REGISTER_ID,
  MODAL_ID,
  CLOSE_TICKET_ID,
  DELETE_TICKET_ID,
  APPLY_TESTER_ID,
  SELECT_GM_PREFIX,
  TIER_TEST_YELLOW,
  handleStartButton,
  handleGameModeSelect,
  handleTierTestModal,
  handleCloseTicket,
  handleDeleteTicket,
  handleApplyTesterButton,
  postTierTestPanel,
  refreshTierTestPanel,
  schedulePanelRefresh,
} from './tiertest.js';
import {
  QUEUE_LEAVE_ID,
  QUEUE_NEXT_ID,
  QUEUE_END_ID,
  TIER_SELECT_PREFIX,
  TT_CLOSE_ID,
  handleQueueLeave,
  handleQueueNext,
  handleQueueEnd,
  handleTtClose,
  scheduleQueueRefresh,
  getActiveTierTest,
  parseTierTestTopic,
  removeTierTestEntry,
} from './queue.js';
import {
  isTierRoleName as isTierRoleNameForTesterList,
  TL_PREV_ID,
  TL_NEXT_ID,
  buildTesterMessage,
  postTesterListPanel,
  refreshTesterListPanel,
  scheduleTesterListRefresh,
} from './testerlist.js';
import {
  isTierRoleName,
  LB_PREV_ID,
  LB_NEXT_ID,
  getMemberPoints,
  assignTitleRole,
  getTitleForPoints,
  TITLES,
  buildLeaderboardMessage,
  postLeaderboardPanel,
  refreshLeaderboardPanel,
  scheduleLeaderboardRefresh,
} from './leaderboard.js';
import {
  getRegistrationByDiscordId,
  getRegistrationByMcUsername,
  saveRegistration,
  updateSkin,
  updateMcUsername,
  updateRegion,
  getAllRegistrations,
  deleteRegistration,
  loadRegistrationsFromApi,
} from './registration.js';
import { sanitizeToEmojiName, getGameModeEmoji, getEmojiString } from './emojis.js';
import { renderMinecraftSkin } from './skinrender.js';

const __dir = dirname(fileURLToPath(import.meta.url));

const TOKEN    = process.env['DISCORD_BOT_TOKEN'];
const GUILD_ID = process.env['SERVER_ID'] ?? '';
const WEBSITE_API_URL = process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000';
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';
const WEBSITE_LINK = process.env['WEBSITE_LINK'] ?? '';

function getBackendSkinUrl(discordId: string): string {
  return `${WEBSITE_API_URL.replace(/\/$/, '')}/api/skin/${encodeURIComponent(discordId)}`;
}

const RESULTS_RED = 0xED4245;

async function postRedResultEmbed(opts: {
  title: string;
  discordId: string;
  mcUsername: string;
  fields: { name: string; value: string; inline?: boolean }[];
  managerId: string;
  reason?: string | null;
}): Promise<void> {
  const config = getConfig();
  if (!config.resultsChannelId) return;
  try {
    const ch = await client.channels.fetch(config.resultsChannelId);
    if (!ch || !ch.isTextBased()) return;
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: '👤 Player', value: `<@${opts.discordId}>`, inline: true },
      { name: '🎮 IGN',    value: `\`${opts.mcUsername}\``, inline: true },
      ...opts.fields,
      { name: '🛡️ Manager', value: `<@${opts.managerId}>`, inline: true },
    ];
    if (opts.reason) fields.push({ name: '📝 Reason', value: opts.reason, inline: false });
    const embed = new EmbedBuilder()
      .setColor(RESULTS_RED)
      .setTitle(opts.title)
      .setThumbnail(getBackendSkinUrl(opts.discordId))
      .addFields(fields)
      .setTimestamp();
    await (ch as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    console.error('[results-channel] Failed to post red embed:', err);
  }
}

if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set');

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const _cooldowns = new Map<string, number>();
const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function checkCooldown(userId: string, cmd: string, ms: number): number {
  const key = `${userId}:${cmd}`;
  const last = _cooldowns.get(key) ?? 0;
  const remaining = last + ms - Date.now();
  if (remaining > 0) return Math.ceil(remaining / 1000);
  _cooldowns.set(key, Date.now());
  return 0;
}

function getUsernameChangeRemainingMs(discordId: string): number {
  const lastChangedAt = getConfig().usernameChangeTimestamps?.[discordId] ?? 0;
  return Math.max(0, lastChangedAt + USERNAME_CHANGE_COOLDOWN_MS - Date.now());
}

function markUsernameChanged(discordId: string): void {
  const config = getConfig();
  setConfig({
    usernameChangeTimestamps: {
      ...(config.usernameChangeTimestamps ?? {}),
      [discordId]: Date.now(),
    },
  });
}

function formatDuration(ms: number): string {
  const totalHours = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`;
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ─── Website API Helpers ──────────────────────────────────────────────────────

async function callApi(path: string, body: unknown): Promise<any> {
  try {
    const res = await fetch(`${WEBSITE_API_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[API] ${path} returned ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(`[API] Failed to call ${path}:`, err);
    return null;
  }
}

// ─── Website Link Helper ──────────────────────────────────────────────────────

function getWebsiteLinkField(): { name: string; value: string } | null {
  if (!WEBSITE_LINK) return null;
  return { name: '🌐 Cosmic Tiers Website', value: `[Visit Website](${WEBSITE_LINK})` };
}

export const REGISTER_MODAL_ID = 'register_modal';
export const REG_INPUT_MC      = 'reg_mc_username';
export const REG_INPUT_REGION  = 'reg_region';

// ─── Tier / Role Constants ────────────────────────────────────────────────────

const ALL_TIERS  = ['LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'];
const GAME_MODES = ['Sword-PvP','UHC','Pot-PvP','Nethpot','SMP-PvP','Axe-PvP','Mace-PvP','Crystal-PvP','cartpvp'];

function displayGameMode(gameMode: string): string {
  return gameMode === 'cartpvp' ? 'Cart-PvP' : gameMode;
}

function getTierColor(tier: string): number {
  if (tier.includes('1')) return 0xFFD700;
  if (tier.includes('2')) return 0xC0C0C0;
  if (tier.includes('3')) return 0xFF6B35;
  if (tier.includes('4')) return 0x4CAF50;
  return 0x2196F3;
}

function getRankChange(previous: string, earned: string): { emoji: string; label: string } {
  if (previous === 'Unranked') return { emoji: '🌟', label: 'First Rank!' };
  const prevIdx   = ALL_TIERS.indexOf(previous);
  const earnedIdx = ALL_TIERS.indexOf(earned);
  if (earnedIdx > prevIdx) return { emoji: '📈', label: 'Promoted' };
  if (earnedIdx < prevIdx) return { emoji: '📉', label: 'Demoted' };
  return { emoji: '➡️', label: 'Maintained' };
}

function buildRoleName(mode: string, tier: string): string {
  return `${displayGameMode(mode)} ${tier}`;
}

// ─── Trend Arrow Helpers ─────────────────────────────────────────────────────

function getTrendEmojiString(pointDelta: number): string {
  const config = getConfig();
  const emojiStrings = config.emojiStrings ?? {};
  if (pointDelta >= 6) return emojiStrings['high_up'] ?? '⬆️⬆️';
  if (pointDelta >= 1) return emojiStrings['up'] ?? '⬆️';
  if (pointDelta <= -6) return emojiStrings['high_down'] ?? '⬇️⬇️';
  if (pointDelta <= -1) return emojiStrings['down'] ?? '⬇️';
  return '➡️';
}

// ─── Role Safety ──────────────────────────────────────────────────────────────

/**
 * Permissions that bot-managed roles must never hold.
 * Any of these found on a bot role will be stripped automatically.
 */
const DANGEROUS_PERMISSIONS = [
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

/** Remove any dangerous permissions from a bot-managed role. */
async function sanitizeBotRole(role: Role): Promise<void> {
  const hasDangerous = DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p));
  if (!hasDangerous) return;
  // Build a safe bitfield by clearing each dangerous permission bit
  const safeBits = DANGEROUS_PERMISSIONS.reduce(
    (bits, flag) => bits & ~flag,
    role.permissions.bitfield,
  );
  await role.setPermissions(safeBits, 'Removed dangerous permissions from bot-managed role');
  console.log(`[role-audit] Stripped dangerous permissions from "${role.name}"`);
}

/**
 * Audit every bot-managed role in the guild and strip dangerous permissions.
 * Runs on startup and can be triggered at any time.
 */
async function auditBotRoles(guild: Guild): Promise<void> {
  try {
    await guild.roles.fetch();
    const config = getConfig();
    const managedIds = new Set<string>(
      [
        config.unrankedRoleId,
        config.registeredRoleId,
        config.tierTesterRoleId,
        ...Object.values(config.titleRoleIds ?? {}),
      ].filter((id): id is string => Boolean(id)),
    );
    for (const [, role] of guild.roles.cache) {
      if (managedIds.has(role.id) || isTierRoleName(role.name)) {
        await sanitizeBotRole(role).catch(err =>
          console.error(`[role-audit] Failed to sanitize "${role.name}":`, err),
        );
      }
    }
    console.log('[role-audit] Role audit complete.');
  } catch (err) {
    console.error('[role-audit] Audit failed:', err);
  }
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────

async function findOrCreateRole(guild: Guild, roleName: string, color: number): Promise<Role> {
  const existing = guild.roles.cache.find(r => r.name === roleName);
  if (existing) {
    await sanitizeBotRole(existing);
    return existing;
  }
  const role = await guild.roles.create({
    name: roleName,
    color,
    permissions: 0n,
    reason: 'Auto-created by Tier Test Bot',
  });
  return role;
}

async function getOrCreateUnrankedRole(guild: Guild): Promise<Role> {
  const config = getConfig();
  if (config.unrankedRoleId) {
    const existing = guild.roles.cache.get(config.unrankedRoleId);
    if (existing) {
      await sanitizeBotRole(existing);
      return existing;
    }
  }
  const role = await guild.roles.create({
    name: 'Unranked',
    color: 0x99aab5,
    permissions: 0n,
    reason: 'Auto-created by Tier Test Bot (Unranked role)',
  });
  setConfig({ unrankedRoleId: role.id });
  return role;
}

async function getOrCreateRegisteredRole(guild: Guild): Promise<Role> {
  const config = getConfig();
  if (config.registeredRoleId) {
    const existing = guild.roles.cache.get(config.registeredRoleId);
    if (existing) {
      await sanitizeBotRole(existing);
      return existing;
    }
    try {
      const fetched = await guild.roles.fetch(config.registeredRoleId);
      if (fetched) {
        await sanitizeBotRole(fetched);
        return fetched;
      }
    } catch { /* fall through */ }
  }
  await guild.roles.fetch();
  const existingByName = guild.roles.cache.find(r => r.name === 'Registered');
  if (existingByName) {
    await sanitizeBotRole(existingByName);
    setConfig({ registeredRoleId: existingByName.id });
    return existingByName;
  }
  const role = await guild.roles.create({
    name: 'Registered',
    color: 0x57F287,
    permissions: 0n,
    reason: 'Auto-created by Tier Test Bot (Registered role)',
  });
  setConfig({ registeredRoleId: role.id });
  return role;
}

async function removeOldTierRoles(member: GuildMember, mode: string): Promise<string[]> {
  const removed: string[] = [];
  for (const tier of ALL_TIERS) {
    const roleName = buildRoleName(mode, tier);
    const role = member.guild.roles.cache.find(r => r.name === roleName);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Replacing old tier role');
      removed.push(roleName);
    }
    const retiredRoleName = `${displayGameMode(mode)} R${tier}`;
    const retiredRole = member.guild.roles.cache.find(r => r.name === retiredRoleName);
    if (retiredRole && member.roles.cache.has(retiredRole.id)) {
      await member.roles.remove(retiredRole, 'Replacing retired tier role');
      removed.push(retiredRoleName);
    }
  }
  return removed;
}

async function removeAllTierRoles(member: GuildMember): Promise<string[]> {
  const removed: string[] = [];
  for (const mode of GAME_MODES) {
    for (const tier of ALL_TIERS) {
      const roleName = buildRoleName(mode, tier);
      const role = member.guild.roles.cache.find(r => r.name === roleName);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role, 'Cleared by /clear-user');
        removed.push(roleName);
      }
      const retiredRoleName = `${displayGameMode(mode)} R${tier}`;
      const retiredRole = member.guild.roles.cache.find(r => r.name === retiredRoleName);
      if (retiredRole && member.roles.cache.has(retiredRole.id)) {
        await member.roles.remove(retiredRole, 'Cleared by /clear-user');
        removed.push(retiredRoleName);
      }
    }
  }
  return removed;
}

async function removeAllTierRolesFromMember(member: GuildMember): Promise<string[]> {
  return removeAllTierRoles(member);
}

async function getMemberCurrentTier(member: GuildMember, mode: string): Promise<string> {
  for (const tier of ALL_TIERS) {
    const roleName = buildRoleName(mode, tier);
    const role = member.guild.roles.cache.find(r => r.name === roleName);
    if (role && member.roles.cache.has(role.id)) return tier;
  }
  for (const tier of ALL_TIERS) {
    const retiredRoleName = `${displayGameMode(mode)} R${tier}`;
    const retiredRole = member.guild.roles.cache.find(r => r.name === retiredRoleName);
    if (retiredRole && member.roles.cache.has(retiredRole.id)) return `R${tier}`;
  }
  return 'Unranked';
}

async function assignTierRole(
  guild: Guild,
  playerId: string,
  mode: string,
  earned: string,
  color: number,
): Promise<{ member: GuildMember; assigned: string; removed: string[] } | { error: string }> {
  let member: GuildMember;
  try {
    member = await guild.members.fetch(playerId);
  } catch {
    return { error: `Could not fetch member <@${playerId}> from the server.` };
  }
  const removed = await removeOldTierRoles(member, mode);

  const unrankedRole = await getOrCreateUnrankedRole(guild);
  if (member.roles.cache.has(unrankedRole.id)) {
    await member.roles.remove(unrankedRole, 'Player earned a tier');
  }

  const newRoleName = buildRoleName(mode, earned);
  const role = await findOrCreateRole(guild, newRoleName, color);
  await member.roles.add(role, `Tier test result: ${mode} ${earned}`);

  member = await guild.members.fetch(playerId);
  return { member, assigned: newRoleName, removed };
}

// ─── Registration Helpers ─────────────────────────────────────────────────────

async function renderAndUploadSkin(discordId: string, skinUrl: string | null): Promise<Buffer | null> {
  try {
    let skinBuffer: Buffer | null = null;
    if (skinUrl) {
      try {
        const resp = await fetch(skinUrl, { signal: AbortSignal.timeout(12_000) });
        if (resp.ok) skinBuffer = Buffer.from(await resp.arrayBuffer());
      } catch { /* fall through to default */ }
    }
    const rendered = await renderMinecraftSkin(skinBuffer, 'bust');
    await callApi('/api/bot/upload-skin', {
      discordId,
      data: rendered.toString('base64'),
    });
    console.log(`[skin] Rendered and uploaded for ${discordId}`);
    return rendered;
  } catch (err) {
    console.error(`[skin] Render/upload failed for ${discordId}:`, err);
    return null;
  }
}

async function completeRegistration(
  guild: Guild,
  discordId: string,
  mcUsername: string,
  region: string,
  skinUrl: string | null,
): Promise<void> {
  saveRegistration({ discordId, mcUsername, region, skinUrl, registeredAt: Date.now() });

  // Register in DB first so the skin update below finds the player record
  await callApi('/api/bot/register', { discordId, mcUsername, region, skinUrl });

  // Render skin synchronously so the file is ready before registration is confirmed
  try {
    await renderAndUploadSkin(discordId, skinUrl);
  } catch (err) {
    console.error('[skin] Registration render error:', err);
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    console.error(`Could not fetch member ${discordId} during registration completion`);
    return;
  }

  const registeredRole = await getOrCreateRegisteredRole(guild);

  if (!member.roles.cache.has(registeredRole.id)) {
    await member.roles.add(registeredRole, 'Player registered');
  }
}

// ─── /register Command ────────────────────────────────────────────────────────

async function handleRegisterCommand(interaction: ChatInputCommandInteraction) {
  const existing = getRegistrationByDiscordId(interaction.user.id);
  if (existing) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Already Registered')
          .setDescription(
            `You are already registered as **\`${existing.mcUsername}\`** (${existing.region}).\n` +
            `Your Minecraft username **cannot be changed**.\n` +
            `Use \`/skin-change\` to update your skin.`,
          ),
      ],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(REGISTER_MODAL_ID)
    .setTitle('Register Your Minecraft Account');

  const mcInput = new TextInputBuilder()
    .setCustomId(REG_INPUT_MC)
    .setLabel('MC Username — permanent, cannot change!')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Steve123')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(16);

  const regionInput = new TextInputBuilder()
    .setCustomId(REG_INPUT_REGION)
    .setLabel('Your Region')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('AS · AF · EU · NA · SA · OC · AN')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(2);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(mcInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(regionInput),
  );

  await interaction.showModal(modal);
}

// ─── /register Modal Submit ───────────────────────────────────────────────────

async function handleRegisterModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const wait = checkCooldown(interaction.user.id, 'register', 10_000);
  if (wait > 0) {
    await interaction.editReply(`⏳ Please wait **${wait}s** before trying to register again.`);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This can only be used inside a server.');
    return;
  }

  const existing = getRegistrationByDiscordId(interaction.user.id);
  if (existing) {
    await interaction.editReply(
      `❌ You are already registered as **\`${existing.mcUsername}\`**. Username cannot be changed.`,
    );
    return;
  }

  const mcUsername = interaction.fields.getTextInputValue(REG_INPUT_MC).trim();
  const region     = interaction.fields.getTextInputValue(REG_INPUT_REGION).trim().toUpperCase();

  const VALID_REGIONS = ['AS', 'AF', 'EU', 'NA', 'SA', 'OC', 'AN'];
  if (!VALID_REGIONS.includes(region)) {
    await interaction.editReply(
      `❌ Invalid region **\`${region}\`**. Valid options: ${VALID_REGIONS.join(' · ')}`,
    );
    return;
  }

  const mcUsernameRx = /^[a-zA-Z0-9_]{3,16}$/;
  if (!mcUsernameRx.test(mcUsername)) {
    await interaction.editReply(
      '❌ Invalid Minecraft username. Must be 3–16 characters, letters/numbers/underscores only.',
    );
    return;
  }

  const takenByOther = getRegistrationByMcUsername(mcUsername);
  if (takenByOther) {
    await interaction.editReply(
      `❌ The Minecraft username **\`${mcUsername}\`** is already registered by another user.`,
    );
    return;
  }

  await completeRegistration(guild, interaction.user.id, mcUsername, region, null);

  await interaction.editReply(
    `✅ **Registration complete!**\n` +
    `**Minecraft Username:** \`${mcUsername}\`\n` +
    `**Region:** \`${region}\`\n\n` +
    `You've been given the **Registered** role.\n\n` +
    `📸 **Change your skin:**\n` +
    `Use \`/skin-change\` in <#1487116864562925578> and attach your Minecraft skin PNG file to set a custom skin.\n` +
    `You're currently using the default Steve skin.\n\n` +
    `✏️ **Edit your profile:**\n` +
    `Use \`/edit-profile\` in <#1487116864562925578> to update your region or skin at any time. Minecraft username changes are limited to once every 7 days.`,
  );
}

// ─── /skin-change Command ─────────────────────────────────────────────────────

async function handleSkinChange(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const wait = checkCooldown(interaction.user.id, 'skin-change', 10_000);
  if (wait > 0) {
    await interaction.editReply(`⏳ Please wait **${wait}s** before changing your skin again.`);
    return;
  }

  const reg = getRegistrationByDiscordId(interaction.user.id);
  if (!reg) {
    await interaction.editReply('❌ You must be registered first. Use `/register` to register.');
    return;
  }

  const reset      = interaction.options.getString('reset');
  const attachment = interaction.options.getAttachment('skin');

  if (reset === 'yes') {
    updateSkin(interaction.user.id, null);
    void renderAndUploadSkin(interaction.user.id, null);
    await interaction.editReply(
      `✅ Your skin has been reset to the **default Steve skin** for \`${reg.mcUsername}\`.`,
    );
    return;
  }

  if (!attachment) {
    await interaction.editReply(
      '❌ Please attach a **PNG skin file** or choose `reset: Yes` to revert to the default skin.',
    );
    return;
  }

  if (attachment.contentType !== 'image/png') {
    await interaction.editReply('❌ The skin file must be a **PNG** image. Please try again with a `.png` file.');
    return;
  }

  if (attachment.size > 20 * 1024) {
    await interaction.editReply('❌ Skin file is too large. Please upload a PNG under **20 KB**.');
    return;
  }

  updateSkin(interaction.user.id, attachment.url);
  void renderAndUploadSkin(interaction.user.id, attachment.url).catch(err => console.error('[skin] /skin-change render error:', err));

  await interaction.editReply(
    `✅ Skin updated for **\`${reg.mcUsername}\`**!\n` +
    `Your new skin will appear in future result embeds.`,
  );
}

// ─── /result Autocomplete ──────────────────────────────────────────────────────

async function handleResultAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const all = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().startsWith(focusedValue))
    .slice(0, 25)
    .map(r => ({ name: `${r.mcUsername} (${r.region})`, value: r.mcUsername }));
  await interaction.respond(choices);
}

// ─── /profile Autocomplete ──────────────────────────────────────────────────────

async function handleProfileAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const all = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().startsWith(focusedValue))
    .slice(0, 25)
    .map(r => ({ name: `${r.mcUsername} (${r.region})`, value: r.mcUsername }));
  await interaction.respond(choices);
}

// ─── /result Command ──────────────────────────────────────────────────────────

const TIER_POINTS_MAP: Record<string, number> = {
  LT5: 1,  HT5: 2,
  LT4: 3,  HT4: 4,
  LT3: 6,  HT3: 10,
  LT2: 20, HT2: 30,
  LT1: 45, HT1: 60,
};

const RESULT_REACTION_EMOJIS = ['👑', '🥳', '😱', '😭', '😂', '💀'];

async function handleResult(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();

  const member = interaction.member as GuildMember;
  const hasStaffRole        = config.staffRoleId      ? member.roles.cache.has(config.staffRoleId)      : true;
  const hasModRoleForResult = config.modRoleId        ? member.roles.cache.has(config.modRoleId)        : false;
  const hasTesterRoleResult = config.tierTesterRoleId ? member.roles.cache.has(config.tierTesterRoleId) : false;
  if (config.staffRoleId && !hasStaffRole && !hasModRoleForResult && !hasTesterRoleResult) {
    await interaction.editReply('❌ Only staff, mod, or tier tester members can use `/result`.');
    return;
  }

  const wait = checkCooldown(interaction.user.id, 'result', 5_000);
  if (wait > 0) {
    await interaction.editReply(`⏳ Please wait **${wait}s** before using \`/result\` again.`);
    return;
  }

  const resultsChannelId = config.resultsChannelId;

  const mcUsername = interaction.options.getString('player', true).trim();
  const tester     = interaction.options.getUser('tester', true);
  const mode       = interaction.options.getString('game-mode', true);
  const earned     = interaction.options.getString('earned-tier', true);
  const score      = interaction.options.getString('score', false)?.trim() ?? null;

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(
      `❌ No registered player found with Minecraft username **\`${mcUsername}\`**.\n` +
      `Only registered players can receive results. Ask them to use \`/register\` first.`,
    );
    return;
  }

  // Tier testers cannot submit a result where they are the player (no self-tiering)
  if (hasTesterRoleResult && !hasStaffRole && !hasModRoleForResult) {
    const callerReg = getRegistrationByDiscordId(interaction.user.id);
    if (callerReg && callerReg.mcUsername.toLowerCase() === mcUsername.toLowerCase()) {
      await interaction.editReply('❌ Tier testers cannot use `/result` to give themselves a tier.');
      return;
    }
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(
      `❌ Could not find the Discord member for **\`${mcUsername}\`** in this server.`,
    );
    return;
  }

  // Auto-detect previous tier from the player's current roles
  const previous = await getMemberCurrentTier(playerMember, mode);

  const { emoji, label } = getRankChange(previous, earned);
  const color            = getTierColor(earned);

  // Calculate points before and after the role change
  const previousPoints = getMemberPoints(playerMember);
  const previousTierMap: Record<string, number> = {};
  playerMember.roles.cache.forEach(role => {
    if (TIER_POINTS_MAP[role.name.split(' ').pop() ?? ''] !== undefined) {
      // This is a simplified version - the actual points are calculated by leaderboard
    }
  });

  const testerReg = getRegistrationByDiscordId(tester.id);

  const embedFields: { name: string; value: string; inline?: boolean }[] = [
    { name: '👤 Tested Player', value: `<@${reg.discordId}>`, inline: true },
    { name: '🎮 IGN',           value: `\`${mcUsername}\``,   inline: true },
    { name: '🌍 Region',        value: reg.region,            inline: true },
    { name: '🧪 Tester',        value: `<@${tester.id}>`,    inline: true },
    { name: '⚔️ Game Mode',     value: (() => { const e = getGameModeEmoji(mode); return e ? `${e} ${mode}` : mode; })(), inline: true },
    { name: '📋 Previous Tier', value: `**${previous}**`,    inline: true },
    { name: '🏆 Earned Tier',   value: `**${earned}**`,      inline: true },
  ];

  if (score) {
    embedFields.push({ name: '📊 Score', value: score, inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Tier Test Result — ${label}`)
    .setColor(color)
    .setAuthor({ name: `Tested by ${tester.username}`, iconURL: tester.displayAvatarURL({ size: 256 }) })
    .setThumbnail(getBackendSkinUrl(reg.discordId))
    .addFields(...embedFields)
    .setFooter({ text: 'Tier Test System' })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  // Assign the tier role and update before sending so we get accurate point data
  const roleResult = await assignTierRole(guild, reg.discordId, mode, earned, color);

  let updatedMember: GuildMember | null = null;
  let titleName = 'None';
  let totalPoints = 0;
  let pointDelta = 0;

  if (!('error' in roleResult)) {
    updatedMember = roleResult.member;
    titleName   = await assignTitleRole(guild, updatedMember);
    totalPoints = getMemberPoints(updatedMember);
    pointDelta  = totalPoints - previousPoints;
    scheduleLeaderboardRefresh(client);
  }

  // Add points and title to result embed
  const titleEmoji = getEmojiString(sanitizeToEmojiName(titleName));
  const trendEmoji = getTrendEmojiString(pointDelta);
  const titleDisplay = titleEmoji ? `${titleEmoji} **${titleName}**` : `**${titleName}**`;

  embed.addFields(
    { name: '💎 Points', value: `${totalPoints} pts ${trendEmoji}`, inline: true },
  );

  const websiteRow = WEBSITE_LINK
    ? new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('View on Cosmic Tiers')
          .setStyle(ButtonStyle.Link)
          .setURL(WEBSITE_LINK),
      )
    : null;

  let resultMessage: Message | null = null;
  if (resultsChannelId) {
    try {
      const channel = await client.channels.fetch(resultsChannelId);
      if (channel && channel.isTextBased()) {
        resultMessage = await (channel as TextChannel).send({
          embeds: [embed],
          files,
          ...(websiteRow ? { components: [websiteRow] } : {}),
        });
        // Add reaction emojis
        for (const reactionEmoji of RESULT_REACTION_EMOJIS) {
          try { await resultMessage.react(reactionEmoji); } catch { /* ignore if no permission */ }
        }
      }
    } catch (err) {
      console.error('Failed to post result embed:', err);
    }
  }

  console.log(`[result] ${interaction.user.username} → ${mcUsername} | ${mode} ${earned} (prev: ${previous})`);

  incrementTesterStat(tester.id);
  scheduleTesterListRefresh(client);

  // Notify the website API
  const apiResult = await callApi('/api/bot/result', {
    discordId: reg.discordId,
    mcUsername,
    gameMode: mode,
    tier: earned,
    previousTier: previous,
    testerDiscordId: tester.id,
    testerMcUsername: testerReg?.mcUsername ?? null,
  });
  await callApi('/api/bot/tester-stat', { discordId: tester.id, action: 'increment' });

  if ('error' in roleResult) {
    await interaction.editReply(`✅ Result posted! ⚠️ Role assignment failed: ${roleResult.error}`);
    return;
  }

  const { assigned, removed } = roleResult;
  let msg = `✅ Result posted! Assigned **${assigned}** to \`${mcUsername}\` (<@${reg.discordId}>).\n`;
  msg    += `⭐ Title: **${titleName}** ${titleDisplay} — **${totalPoints} pts** ${trendEmoji}`;
  if (pointDelta > 0) msg += ` *(+${pointDelta})*`;
  else if (pointDelta < 0) msg += ` *(${pointDelta})*`;
  if (removed.length > 0) msg += `\nRemoved: ${removed.map(r => `**${r}**`).join(', ')}.`;
  await interaction.editReply(msg);
}

// ─── /profile Command ─────────────────────────────────────────────────────────

async function handleProfile(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const mcUsername = interaction.options.getString('player', true).trim();
  const reg = getRegistrationByMcUsername(mcUsername);

  if (!reg) {
    await interaction.editReply(`❌ No registered player found with Minecraft username **\`${mcUsername}\`**.`);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(`❌ Could not find <@${reg.discordId}> in this server.`);
    return;
  }

  const totalPoints = getMemberPoints(member);
  const tierRoles = member.roles.cache
    .filter(r => {
      const parts = r.name.split(' ');
      if (parts.length < 2) return false;
      const tier = parts[parts.length - 1];
      const mode = parts.slice(0, -1).join(' ');
      const isRetired = tier.startsWith('R') && ALL_TIERS.includes(tier.slice(1));
      return GAME_MODES.map(displayGameMode).includes(mode) && (ALL_TIERS.includes(tier) || isRetired);
    })
    .map(r => r.name)
    .sort();

  const title = getTitleForPoints(totalPoints);

  const titleEmoji = getEmojiString(sanitizeToEmojiName(title.name));
  const titleDisplay = titleEmoji ? `${titleEmoji} ${title.name}` : title.name;

  const registeredDate = new Date(reg.registeredAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const tiersDisplay = tierRoles.length > 0
    ? tierRoles.map(roleName => {
        const parts = roleName.split(' ');
        const tier = parts[parts.length - 1];
        const mode = parts.slice(0, -1).join(' ');
        const modeEmoji = getGameModeEmoji(mode);
        return modeEmoji ? `${modeEmoji} **${tier}** (${mode})` : `**${tier}** (${mode})`;
      }).join('\n')
    : '*No tiers yet*';

  const websiteLinkField = getWebsiteLinkField();

  const embedFields: { name: string; value: string; inline?: boolean }[] = [
    { name: '🎮 IGN',        value: `\`${reg.mcUsername}\``, inline: true },
    { name: '🌍 Region',     value: reg.region,              inline: true },
    { name: '💎 Points',     value: `${totalPoints} pts`,    inline: true },
    { name: '⭐ Title',      value: titleDisplay,            inline: true },
    { name: '📅 Registered', value: registeredDate,         inline: true },
    { name: '🏆 Tiers',      value: tiersDisplay,           inline: false },
  ];

  if (websiteLinkField) {
    embedFields.push({ name: websiteLinkField.name, value: websiteLinkField.value, inline: false });
  }

  const embed = new EmbedBuilder()
    .setTitle(`👤 Profile — ${mcUsername}`)
    .setColor(title.color)
    .setDescription(`<@${reg.discordId}>`)
    .setThumbnail(getBackendSkinUrl(reg.discordId))
    .addFields(...embedFields)
    .setFooter({ text: 'Cosmic Tiers System' })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  await interaction.editReply({ embeds: [embed], files });
}

// ─── /delete-user Command ─────────────────────────────────────────────────────

async function handleDeleteUser(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const hasManageRoles = (interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageRoles);
  if (!hasManageRoles) {
    await interaction.editReply('❌ You need the **Manage Roles** permission to use this command.');
    return;
  }

  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', false)?.trim() || null;
  const guild  = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  const reg = getRegistrationByDiscordId(target.id);
  if (!reg) {
    await interaction.editReply(`❌ <@${target.id}> is not registered in the system.`);
    return;
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(target.id);
  } catch {
    // Member might have left the server, still delete from system
    member = null as any;
  }

  // Remove from local registration store
  deleteRegistration(target.id);

  // Remove from website database
  await callApi('/api/bot/delete-player', { discordId: target.id });
  await callApi('/api/bot/clear-user', { discordId: target.id });

  if (member) {
    // Remove all tier roles
    await removeAllTierRolesFromMember(member);

    // Remove Registered role
    const config = getConfig();
    if (config.registeredRoleId && member.roles.cache.has(config.registeredRoleId)) {
      try {
        await member.roles.remove(config.registeredRoleId, 'Deleted by admin /delete-user');
      } catch { /* ignored */ }
    }

    // Remove MC username role
    const mcUsernameRole = guild.roles.cache.find(r => r.name === reg.mcUsername);
    if (mcUsernameRole && member.roles.cache.has(mcUsernameRole.id)) {
      try {
        await member.roles.remove(mcUsernameRole, 'Deleted by admin /delete-user');
      } catch { /* ignored */ }
    }

    // Remove tier tester role
    if (config.tierTesterRoleId && member.roles.cache.has(config.tierTesterRoleId)) {
      try {
        await member.roles.remove(config.tierTesterRoleId, 'Deleted by admin /delete-user');
      } catch { /* ignored */ }
    }

    // Remove all game-mode-specific tester roles (e.g. "Sword-PvP Tester", "Nethpot Tester")
    for (const mode of GAME_MODES) {
      const gmRoleName = `${displayGameMode(mode)} Tester`;
      const gmRole = guild.roles.cache.find(r => r.name === gmRoleName);
      if (gmRole && member.roles.cache.has(gmRole.id)) {
        try {
          await member.roles.remove(gmRole, 'Deleted by admin /delete-user');
        } catch { /* ignored */ }
      }
    }

    // Remove all title roles
    const titleRoleIds = config.titleRoleIds ?? {};
    for (const [, roleId] of Object.entries(titleRoleIds)) {
      if (member.roles.cache.has(roleId)) {
        try { await member.roles.remove(roleId, 'Deleted by admin /delete-user'); } catch { /* ignored */ }
      }
    }

    // Assign unranked role
    try {
      const unrankedRole = await getOrCreateUnrankedRole(guild);
      if (!member.roles.cache.has(unrankedRole.id)) {
        await member.roles.add(unrankedRole, 'Reset after deletion');
      }
    } catch { /* ignored */ }
  }

  clearTesterStat(target.id);
  scheduleTesterListRefresh(client);
  scheduleLeaderboardRefresh(client);

  console.log(`[delete-user] ${interaction.user.username} deleted player ${reg.mcUsername} (${target.id})`);

  await postRedResultEmbed({
    title: '🗑️ Player Deleted',
    discordId: target.id,
    mcUsername: reg.mcUsername,
    fields: [
      { name: '⚠️ Action', value: 'Fully removed from the system', inline: false },
    ],
    managerId: interaction.user.id,
    reason,
  });

  let deletedDesc =
    `**${reg.mcUsername}** (<@${target.id}>) has been fully removed from the system.\n\n` +
    `• All tier roles removed\n` +
    `• Registered role removed\n` +
    `• All data deleted from database\n` +
    `• They must use \`/register\` again to participate`;
  if (reason) deletedDesc += `\n\n**Reason:** ${reason}`;

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(RESULTS_RED)
        .setTitle('🗑️ Player Deleted')
        .setDescription(deletedDesc)
        .setTimestamp(),
    ],
  });
}

// ─── Admin Command Handlers ───────────────────────────────────────────────────

async function handleSetResultsChannel(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);
  setConfig({ resultsChannelId: channel.id });
  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('✅ Results Channel Set')
    .setDescription(`Tier test results will now be posted in <#${channel.id}>.`);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetTierTesterRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  setConfig({ tierTesterRoleId: role.id });
  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('✅ Tier Tester Role Set')
    .setDescription(`<@&${role.id}> is now the Tier Tester role.`);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.reply({ embeds: [embed], ephemeral: true });

  const config = getConfig();
  if (config.tierTestChannelId) await postTierTestPanel(interaction.guild!, config.tierTestChannelId);
  if (config.currentTesterChannelId) await postTesterListPanel(interaction.guild!, config.currentTesterChannelId);

  // Sync existing members with the tier tester role to the website
  const guild = interaction.guild!;
  try {
    await guild.members.fetch();
    const testerRole = guild.roles.cache.get(role.id);
    if (testerRole) {
      for (const [memberId] of testerRole.members) {
        const memberReg = getRegistrationByDiscordId(memberId);
        if (memberReg) {
          await callApi('/api/bot/tester-role', { discordId: memberId, action: 'add' });
        }
      }
    }
  } catch (err) {
    console.error('[tester-role-sync]', err);
  }
}

async function handleSetTierTestChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  const prevConfig = getConfig();

  // Delete old panel from the previous channel (if channel changed)
  if (prevConfig.tierTestChannelId && prevConfig.tierTestChannelId !== channel.id && prevConfig.tierTestMessageId) {
    try {
      const oldCh = await client.channels.fetch(prevConfig.tierTestChannelId);
      if (oldCh && oldCh.isTextBased()) {
        const oldMsg = await (oldCh as TextChannel).messages.fetch(prevConfig.tierTestMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete();
      }
    } catch { /* ignored */ }
    setConfig({ tierTestMessageId: undefined });
  }

  setConfig({ tierTestChannelId: channel.id });
  try {
    await postTierTestPanel(interaction.guild!, channel.id);
    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(TIER_TEST_YELLOW)
      .setTitle('✅ Tier Test Channel Set')
      .setDescription(`The tier test panel has been posted in <#${channel.id}>.`);
    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post panel: ${err.message}`);
  }
}

async function handleSetCurrentTesterChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  const prevConfig = getConfig();

  // Delete old tester list from the previous channel (if channel changed)
  if (prevConfig.currentTesterChannelId && prevConfig.currentTesterChannelId !== channel.id && prevConfig.currentTesterMessageId) {
    try {
      const oldCh = await client.channels.fetch(prevConfig.currentTesterChannelId);
      if (oldCh && oldCh.isTextBased()) {
        const oldMsg = await (oldCh as TextChannel).messages.fetch(prevConfig.currentTesterMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete();
      }
    } catch { /* ignored */ }
    setConfig({ currentTesterMessageId: undefined });
  }

  setConfig({ currentTesterChannelId: channel.id });
  try {
    await postTesterListPanel(interaction.guild!, channel.id);
    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(TIER_TEST_YELLOW)
      .setTitle('✅ Current Tester Channel Set')
      .setDescription(`The tier tester list has been posted in <#${channel.id}>.`);
    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post tester list: ${err.message}`);
  }
}

async function handleSetUnrankedRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  setConfig({ unrankedRoleId: role.id });
  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('✅ Unranked Role Set')
    .setDescription(`<@&${role.id}> is now the Unranked role.`);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetLeaderboardChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  const prevConfig = getConfig();

  // Delete old leaderboard from the previous channel (if channel changed)
  if (prevConfig.leaderboardChannelId && prevConfig.leaderboardChannelId !== channel.id && prevConfig.leaderboardMessageId) {
    try {
      const oldCh = await client.channels.fetch(prevConfig.leaderboardChannelId);
      if (oldCh && oldCh.isTextBased()) {
        const oldMsg = await (oldCh as TextChannel).messages.fetch(prevConfig.leaderboardMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete();
      }
    } catch { /* ignored */ }
    setConfig({ leaderboardMessageId: undefined });
  }

  setConfig({ leaderboardChannelId: channel.id });
  try {
    await postLeaderboardPanel(interaction.guild!, channel.id);
    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(TIER_TEST_YELLOW)
      .setTitle('✅ Leaderboard Channel Set')
      .setDescription(`The leaderboard has been posted in <#${channel.id}>.`);
    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post leaderboard: ${err.message}`);
  }
}

async function handleSetStaffRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  setConfig({ staffRoleId: role.id });
  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('✅ Staff Role Set')
    .setDescription(`<@&${role.id}> is now the Staff role.`);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddTester(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild    = interaction.guild!;
  const target   = interaction.options.getUser('user', true);
  const gameMode = interaction.options.getString('game-mode', true);
  const config   = getConfig();

  // ── Admin-only guard ────────────────────────────────────────────────────────
  const caller = interaction.member as GuildMember;
  if (!caller.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply('❌ You need the **Manage Roles** permission to use `/add-tester`.');
    return;
  }

  if (!config.tierTesterRoleId) {
    await interaction.editReply('❌ No Tier Tester role is configured. Use `/set-tier-tester-role` first.');
    return;
  }

  const reg = getRegistrationByDiscordId(target.id);
  if (!reg) {
    await interaction.editReply(
      `❌ <@${target.id}> is not registered. Only registered players can be granted the Tier Tester role.\n` +
      `Ask them to use \`/register\` first.`,
    );
    return;
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(target.id);
  } catch {
    await interaction.editReply(`❌ Could not find <@${target.id}> in this server.`);
    return;
  }

  try {
    // ── Assign general Tier Tester role ───────────────────────────────────────
    if (!member.roles.cache.has(config.tierTesterRoleId)) {
      await member.roles.add(config.tierTesterRoleId, `Granted Tier Tester role by ${interaction.user.username}`);
    }

    // ── Find or create game-mode-specific tester role ─────────────────────────
    const gmRoleName = `${displayGameMode(gameMode)} Tester`;
    let gmRole = guild.roles.cache.find(r => r.name === gmRoleName);
    if (!gmRole) {
      gmRole = await guild.roles.create({
        name: gmRoleName,
        color: 0xFFBF00,
        permissions: 0n,
        reason: `Auto-created: ${gmRoleName} role for Tier Tester system`,
      });
    }
    await sanitizeBotRole(gmRole);
    if (!member.roles.cache.has(gmRole.id)) {
      await member.roles.add(gmRole.id, `Assigned ${gmRoleName} role by ${interaction.user.username}`);
    }

    // ── Update game modes in DB (append if already a tester) ─────────────────
    await callApi('/api/bot/tester-role', { discordId: target.id, action: 'add' });

    // Determine current game modes stored in DB by fetching leaderboard/testers
    // We accumulate game modes from each /add-tester call
    const existingRes = await fetch(`${WEBSITE_API_URL}/api/testers`, { signal: AbortSignal.timeout(8_000) });
    let existingModes: string[] = [];
    if (existingRes.ok) {
      const data = await existingRes.json() as { testers: Array<{ discordId: string; gameModes?: string[] }> };
      const tester = data.testers.find((t) => t.discordId === target.id);
      existingModes = tester?.gameModes ?? [];
    }
    const updatedModes = existingModes.includes(gameMode) ? existingModes : [...existingModes, gameMode];
    await callApi('/api/bot/tester-game-modes', { discordId: target.id, gameModes: updatedModes });

    scheduleTesterListRefresh(client);

    const embed = new EmbedBuilder()
      .setColor(TIER_TEST_YELLOW)
      .setTitle('✅ Tier Tester Roles Granted')
      .setDescription(
        `<@${target.id}> (\`${reg.mcUsername}\`) has been granted:\n` +
        `• <@&${config.tierTesterRoleId}> (general Tier Tester)\n` +
        `• <@&${gmRole.id}> (\`${gmRoleName}\`)\n\n` +
        `**Game modes they now test:** ${updatedModes.join(', ')}`,
      );
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to assign role: ${err?.message ?? String(err)}`);
  }
}

// ─── /register-other Command (admin only) ─────────────────────────────────────

async function handleRegisterOther(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  const caller = interaction.member as GuildMember;
  if (!caller.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply('❌ Only administrators can use `/register-other`.');
    return;
  }

  const target     = interaction.options.getUser('user', true);
  const mcUsername = interaction.options.getString('mc_username', true).trim();
  const region     = interaction.options.getString('region', true).trim().toUpperCase();

  if (getRegistrationByDiscordId(target.id)) {
    await interaction.editReply(`❌ <@${target.id}> is already registered in the system.`);
    return;
  }

  const takenByOther = getRegistrationByMcUsername(mcUsername);
  if (takenByOther) {
    await interaction.editReply(
      `❌ The Minecraft username \`${mcUsername}\` is already registered to another player.`,
    );
    return;
  }

  const mcUsernameRx = /^[a-zA-Z0-9_]{3,16}$/;
  if (!mcUsernameRx.test(mcUsername)) {
    await interaction.editReply(
      '❌ Invalid Minecraft username. Must be 3–16 characters, letters/numbers/underscores only.',
    );
    return;
  }

  await completeRegistration(guild, target.id, mcUsername, region, null);

  await interaction.editReply(
    `✅ Registered <@${target.id}> as **\`${mcUsername}\`** (${region}).\n` +
    `They are using the default Steve skin. Use \`/skin-change-other\` to set their skin.`,
  );
}

// ─── /skin-change-other Command (admin only) ──────────────────────────────────

async function handleSkinChangeOther(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const caller = interaction.member as GuildMember;
  if (!caller.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply('❌ Only administrators can use `/skin-change-other`.');
    return;
  }

  const target = interaction.options.getUser('user', true);
  const reg    = getRegistrationByDiscordId(target.id);
  if (!reg) {
    await interaction.editReply(`❌ <@${target.id}> is not registered in the system.`);
    return;
  }

  const attachment = interaction.options.getAttachment('skin');
  const reset      = interaction.options.getString('reset');

  if (!attachment && !reset) {
    await interaction.editReply(
      '❌ Please provide a skin PNG file or choose **Yes** for the reset option.',
    );
    return;
  }

  if (attachment) {
    if (attachment.contentType !== 'image/png') {
      await interaction.editReply('❌ The skin file must be a **PNG** image. Please try again with a `.png` file.');
      return;
    }
    if (attachment.size > 20 * 1024) {
      await interaction.editReply('❌ Skin file is too large. Please upload a PNG under **20 KB**.');
      return;
    }
  }

  let skinUrl: string | null = null;
  if (reset === 'yes') {
    skinUrl = null;
  } else if (attachment) {
    skinUrl = attachment.proxyURL || attachment.url;
  }

  updateSkin(target.id, skinUrl);
  await renderAndUploadSkin(target.id, skinUrl);

  const label = reset === 'yes' ? 'reset to the default Steve skin' : 'updated to the uploaded skin';
  await interaction.editReply(`✅ Skin for <@${target.id}> (\`${reg.mcUsername}\`) has been **${label}**.`);
}

// ─── Minecraft username validation ────────────────────────────────────────────

const MC_USERNAME_RX = /^[a-zA-Z0-9_]{3,16}$/;

// ─── Shared edit-profile logic ────────────────────────────────────────────────

async function applyProfileEdits(
  interaction: ChatInputCommandInteraction,
  guild: ReturnType<typeof interaction['guild']>,
  discordId: string,
  reg: { mcUsername: string; region: string },
  newMcUsername: string | null,
  newRegion: string | null,
  skinAttachment: ReturnType<typeof interaction.options.getAttachment> | null,
  resetSkin: boolean,
  enforceUsernameCooldown: boolean,
): Promise<string> {
  const changes: string[] = [];

  // ── MC Username change ───────────────────────────────────────────────────
  if (newMcUsername) {
    if (!MC_USERNAME_RX.test(newMcUsername)) {
      return '❌ Invalid Minecraft username. Must be 3–16 characters, letters/numbers/underscores only, no spaces.';
    }
    if (newMcUsername.toLowerCase() !== reg.mcUsername.toLowerCase()) {
      if (enforceUsernameCooldown) {
        const remaining = getUsernameChangeRemainingMs(discordId);
        if (remaining > 0) {
          return `❌ You can change your Minecraft username again in **${formatDuration(remaining)}**. Username changes are limited to once every 7 days.`;
        }
      }
      const taken = getRegistrationByMcUsername(newMcUsername);
      if (taken && taken.discordId !== discordId) {
        return `❌ The Minecraft username **\`${newMcUsername}\`** is already taken by another registered player.`;
      }
      const oldUsername = updateMcUsername(discordId, newMcUsername);
      if (!oldUsername) {
        return '❌ Could not update Minecraft username — registration not found.';
      }
      // Clean up any legacy MC username role from the old username-role system
      if (guild) {
        try {
          const member = await guild.members.fetch(discordId);
          const oldRole = guild.roles.cache.find(r => r.name === oldUsername.oldUsername);
          if (oldRole && member.roles.cache.has(oldRole.id)) {
            await member.roles.remove(oldRole, `MC username changed from ${oldUsername.oldUsername} to ${newMcUsername}`);
          }
        } catch (err) {
          console.error('[edit-profile] Role update error:', err);
        }
      }
      // Sync to website DB
      await callApi('/api/bot/update-profile', { discordId, mcUsername: newMcUsername });
      if (enforceUsernameCooldown) markUsernameChanged(discordId);
      changes.push(`**Minecraft Username:** \`${oldUsername.oldUsername}\` → \`${newMcUsername}\``);
    }
  }

  // ── Region change ────────────────────────────────────────────────────────
  if (newRegion) {
    if (newRegion !== reg.region) {
      updateRegion(discordId, newRegion);
      await callApi('/api/bot/update-profile', { discordId, region: newRegion });
      changes.push(`**Region:** \`${reg.region}\` → \`${newRegion}\``);
    }
  }

  // ── Skin change ──────────────────────────────────────────────────────────
  if (skinAttachment && resetSkin) {
    return '❌ Please choose either a skin upload or `reset_skin`, not both.';
  }

  if (resetSkin) {
    updateSkin(discordId, null);
    await renderAndUploadSkin(discordId, null);
    changes.push('**Skin:** Reset to default Steve skin');
  }

  if (skinAttachment) {
    if (skinAttachment.contentType !== 'image/png') {
      return '❌ The attached skin file must be a **PNG** image. Please try again with a `.png` file.';
    }
    if (skinAttachment.size > 20 * 1024) {
      return '❌ Skin file is too large. Please upload a PNG under **20 KB**.';
    }
    const skinUrl = skinAttachment.proxyURL || skinAttachment.url;
    updateSkin(discordId, skinUrl);
    await renderAndUploadSkin(discordId, skinUrl);
    changes.push('**Skin:** Updated to uploaded image');
  }

  if (changes.length === 0) {
    return '⚠️ No changes were made — you provided the same values or no options.';
  }

  return `✅ **Profile updated!**\n${changes.join('\n')}`;
}

// ─── /edit-profile Command ────────────────────────────────────────────────────

async function handleEditProfile(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const reg = getRegistrationByDiscordId(interaction.user.id);
  if (!reg) {
    await interaction.editReply(
      '❌ You are not registered. Use `/register` to register first before editing your profile.',
    );
    return;
  }

  const newMcUsername  = interaction.options.getString('mc_username', false)?.trim() ?? null;
  const newRegion      = interaction.options.getString('region', false)?.trim().toUpperCase() ?? null;
  const skinAttachment = interaction.options.getAttachment('skin', false);
  const resetSkin      = interaction.options.getString('reset_skin', false) === 'yes';

  if (!newMcUsername && !newRegion && !skinAttachment && !resetSkin) {
    await interaction.editReply(
      '❌ Please provide at least one option to change: `mc_username`, `region`, `skin`, or `reset_skin`.',
    );
    return;
  }

  const result = await applyProfileEdits(
    interaction,
    interaction.guild,
    interaction.user.id,
    reg,
    newMcUsername,
    newRegion,
    skinAttachment,
    resetSkin,
    true,
  );

  await interaction.editReply(result);
}

// ─── /edit-profile-others Command (staff only) ───────────────────────────────

async function handleEditProfileOther(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const caller = interaction.member as GuildMember;

  if (!config.staffRoleId) {
    await interaction.editReply('❌ No staff role is configured. Ask an admin to use `/set-staff-role` first.');
    return;
  }

  const hasStaff = caller.roles.cache.has(config.staffRoleId);
  if (!hasStaff) {
    await interaction.editReply('❌ Only staff members can use `/edit-profile-others`.');
    return;
  }

  const target = interaction.options.getUser('user', true);
  const reg    = getRegistrationByDiscordId(target.id);
  if (!reg) {
    await interaction.editReply(
      `❌ <@${target.id}> is not registered in the system. They must use \`/register\` first.`,
    );
    return;
  }

  const newMcUsername  = interaction.options.getString('mc_username', false)?.trim() ?? null;
  const newRegion      = interaction.options.getString('region', false)?.trim().toUpperCase() ?? null;
  const skinAttachment = interaction.options.getAttachment('skin', false);
  const resetSkin      = interaction.options.getString('reset_skin', false) === 'yes';

  if (!newMcUsername && !newRegion && !skinAttachment && !resetSkin) {
    await interaction.editReply(
      '❌ Please provide at least one option to change: `mc_username`, `region`, `skin`, or `reset_skin`.',
    );
    return;
  }

  const result = await applyProfileEdits(
    interaction,
    interaction.guild,
    target.id,
    reg,
    newMcUsername,
    newRegion,
    skinAttachment,
    resetSkin,
    false,
  );

  // Prefix with who was edited for clarity
  const prefix = `**Edited profile for:** <@${target.id}> (\`${reg.mcUsername}\`)\n`;
  if (result.startsWith('❌') || result.startsWith('⚠️')) {
    await interaction.editReply(result);
  } else {
    await interaction.editReply(prefix + result.replace('✅ **Profile updated!**\n', '✅ **Profile updated!**\n'));
  }
}

// ─── /done Command (tier testers only) ────────────────────────────────────────

async function handleDoneAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const all     = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(r => ({ name: r.mcUsername, value: r.mcUsername }));
  await interaction.respond(choices);
}

async function handleDone(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const member = interaction.member as GuildMember;

  // Tier Testers, Mods, Staff, and Admins can use /done
  const isAdminForDone   = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasTesterForDone = config.tierTesterRoleId ? member.roles.cache.has(config.tierTesterRoleId) : false;
  const hasModForDone    = config.modRoleId        ? member.roles.cache.has(config.modRoleId)        : false;
  const hasStaffForDone  = config.staffRoleId      ? member.roles.cache.has(config.staffRoleId)      : false;
  if (!isAdminForDone && !hasTesterForDone && !hasModForDone && !hasStaffForDone) {
    await interaction.editReply('❌ Only Tier Testers, Moderators, or Staff can use `/done`.');
    return;
  }

  if (!config.staffChannelId) {
    await interaction.editReply(
      '❌ No staff channel is configured. Ask an admin to use `/set-staff-channel` first.',
    );
    return;
  }

  const mcUsername = interaction.options.getString('player', true).trim();
  const gameMode   = interaction.options.getString('game_mode', true);
  const score      = interaction.options.getString('score', true).trim();
  const opinion    = interaction.options.getString('opinion', false)?.trim() ?? null;

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(
      `❌ No registered player found with Minecraft username \`${mcUsername}\`.`,
    );
    return;
  }

  const testerReg = getRegistrationByDiscordId(interaction.user.id);
  const modeDisplay = displayGameMode(gameMode);
  const modeEmoji = (() => { const e = getGameModeEmoji(gameMode); return e ? `${e} ${modeDisplay}` : modeDisplay; })();
  const staffMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : '@staff';

  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('📋 Tier Test Match Report')
    .setAuthor({
      name: `Submitted by ${interaction.user.username} (${testerReg?.mcUsername ?? interaction.user.username})`,
      iconURL: interaction.user.displayAvatarURL({ size: 256 }),
    })
    .addFields(
      { name: '🧪 Tester',    value: `<@${interaction.user.id}> (\`${testerReg?.mcUsername ?? 'Unknown'}\`)`, inline: true },
      { name: '👤 Player',    value: `<@${reg.discordId}> (\`${mcUsername}\`)`, inline: true },
      { name: '🌍 Region',    value: reg.region, inline: true },
      { name: '⚔️ Game Mode', value: modeEmoji,  inline: true },
      { name: '📊 Score',     value: `\`\`\`${score}\`\`\``, inline: false },
      ...(opinion ? [{ name: '💭 Opinion', value: opinion, inline: false }] : []),
    )
    .setFooter({ text: 'Awaiting staff review — use /result to assign tier' })
    .setTimestamp();

  try {
    const staffChannel = await interaction.client.channels.fetch(config.staffChannelId);
    if (staffChannel && staffChannel.isTextBased()) {
      await (staffChannel as TextChannel).send({
        content: `${staffMention} — new match report submitted!`,
        embeds: [embed],
      });
    }
  } catch (err) {
    console.error('[done] Failed to post to staff channel:', err);
    await interaction.editReply('❌ Could not post to the staff channel. Check bot permissions.');
    return;
  }

  await interaction.editReply(
    `✅ Match report submitted to staff!\n` +
    `**Player:** \`${mcUsername}\` · **Game Mode:** ${gameMode} · **Score:** ${score}`,
  );
}

// ─── /set-staff-channel Command ───────────────────────────────────────────────

async function handleSetStaffChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const ch = interaction.options.getChannel('channel', true);
  setConfig({ staffChannelId: ch.id });
  await interaction.editReply(`✅ Staff channel set to <#${ch.id}>. Match reports from \`/done\` will be posted there.`);
}

// ─── /remove-tester Command (staff only) ──────────────────────────────────────

async function handleRemoveTester(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const caller = interaction.member as GuildMember;

  if (config.staffRoleId && !caller.roles.cache.has(config.staffRoleId)) {
    await interaction.editReply('❌ Only staff members can use `/remove-tester`.');
    return;
  }

  const guild  = interaction.guild!;
  const target = interaction.options.getUser('user', true);
  const reg    = getRegistrationByDiscordId(target.id);

  if (!reg) {
    await interaction.editReply(`❌ <@${target.id}> is not registered in the system.`);
    return;
  }

  let member: GuildMember;
  try {
    member = await guild.members.fetch(target.id);
  } catch {
    await interaction.editReply(`❌ Could not find <@${target.id}> in this server.`);
    return;
  }

  const removedRoles: string[] = [];

  // Remove general Tier Tester role
  if (config.tierTesterRoleId && member.roles.cache.has(config.tierTesterRoleId)) {
    try {
      await member.roles.remove(config.tierTesterRoleId, `Removed tester by ${interaction.user.username}`);
      removedRoles.push('Tier Tester');
    } catch { /* ignored */ }
  }

  // Remove all game-mode-specific tester roles
  for (const mode of GAME_MODES) {
    const gmRoleName = `${displayGameMode(mode)} Tester`;
    const gmRole = guild.roles.cache.find(r => r.name === gmRoleName);
    if (gmRole && member.roles.cache.has(gmRole.id)) {
      try {
        await member.roles.remove(gmRole.id, `Removed tester by ${interaction.user.username}`);
        removedRoles.push(gmRoleName);
      } catch { /* ignored */ }
    }
  }

  // Clear test count from config
  clearTesterStat(target.id);

  // Notify website API: remove tester role and clear game modes
  await callApi('/api/bot/tester-role', { discordId: target.id, action: 'remove' });
  await callApi('/api/bot/tester-game-modes', { discordId: target.id, gameModes: [] });

  scheduleTesterListRefresh(client);
  schedulePanelRefresh(client);

  const embed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('🗑️ Tier Tester Removed')
    .setDescription(
      `<@${target.id}> (\`${reg.mcUsername}\`) has been removed as a Tier Tester.\n\n` +
      `**Roles removed:** ${removedRoles.length > 0 ? removedRoles.map(r => `\`${r}\``).join(', ') : 'None found'}\n` +
      `**Test count:** Reset to 0`,
    );

  await interaction.editReply({ embeds: [embed] });
}

// ─── /add-test Command (staff only) ───────────────────────────────────────────

async function handleAddTestAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const all     = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(r => ({ name: r.mcUsername, value: r.mcUsername }));
  await interaction.respond(choices);
}

async function handleAddTest(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const caller = interaction.member as GuildMember;

  if (config.staffRoleId && !caller.roles.cache.has(config.staffRoleId)) {
    await interaction.editReply('❌ Only staff members can use `/add-test`.');
    return;
  }

  const guild     = interaction.guild!;
  const testerUser = interaction.options.getUser('tester', true);
  const mcUsername = interaction.options.getString('player', true).trim();
  const mode       = interaction.options.getString('game_mode', true);
  const earned     = interaction.options.getString('earned_tier', true);

  // Tester must be registered
  const testerReg = getRegistrationByDiscordId(testerUser.id);
  if (!testerReg) {
    await interaction.editReply(`❌ <@${testerUser.id}> is not registered in the system.`);
    return;
  }

  // Tester must have the Tier Tester role
  if (config.tierTesterRoleId) {
    let testerMember: GuildMember;
    try {
      testerMember = await guild.members.fetch(testerUser.id);
    } catch {
      await interaction.editReply(`❌ Could not find <@${testerUser.id}> in this server.`);
      return;
    }
    if (!testerMember.roles.cache.has(config.tierTesterRoleId)) {
      await interaction.editReply(`❌ <@${testerUser.id}> does not have the Tier Tester role.`);
      return;
    }
  }

  // Player must be registered
  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(
      `❌ No registered player found with Minecraft username \`${mcUsername}\`.`,
    );
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(`❌ Could not find <@${reg.discordId}> (\`${mcUsername}\`) in this server.`);
    return;
  }

  const previous       = await getMemberCurrentTier(playerMember, mode);
  const { emoji, label } = getRankChange(previous, earned);
  const color            = getTierColor(earned);
  const previousPoints   = getMemberPoints(playerMember);

  const modeDisplay = (() => { const e = getGameModeEmoji(mode); return e ? `${e} ${mode}` : mode; })();
  const websiteLinkField = getWebsiteLinkField();

  const embedFields: { name: string; value: string; inline?: boolean }[] = [
    { name: '👤 Tested Player', value: `<@${reg.discordId}>`,     inline: true },
    { name: '🎮 IGN',           value: `\`${mcUsername}\``,       inline: true },
    { name: '🌍 Region',        value: reg.region,                 inline: true },
    { name: '🧪 Tester',        value: `<@${testerUser.id}>`,     inline: true },
    { name: '⚔️ Game Mode',     value: modeDisplay,               inline: true },
    { name: '📋 Previous Tier', value: `**${previous}**`,         inline: true },
    { name: '🏆 Earned Tier',   value: `**${earned}**`,           inline: true },
  ];
  if (websiteLinkField) embedFields.push({ name: websiteLinkField.name, value: websiteLinkField.value, inline: false });

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Tier Test Result — ${label}`)
    .setColor(color)
    .setAuthor({ name: `Tested by ${testerUser.username}`, iconURL: testerUser.displayAvatarURL({ size: 256 }) })
    .setThumbnail(getBackendSkinUrl(reg.discordId))
    .addFields(...embedFields)
    .setFooter({ text: 'Tier Test System' })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  const roleResult = await assignTierRole(guild, reg.discordId, mode, earned, color);

  let titleName = 'None';
  let totalPoints = 0;
  let pointDelta  = 0;

  if (!('error' in roleResult)) {
    titleName   = await assignTitleRole(guild, roleResult.member);
    totalPoints = getMemberPoints(roleResult.member);
    pointDelta  = totalPoints - previousPoints;
    scheduleLeaderboardRefresh(client);
  }

  const titleEmoji   = getEmojiString(sanitizeToEmojiName(titleName));
  const trendEmoji   = getTrendEmojiString(pointDelta);
  const titleDisplay = titleEmoji ? `${titleEmoji} **${titleName}**` : `**${titleName}**`;

  embed.addFields(
    { name: '⭐ Title',  value: titleDisplay,                      inline: true },
    { name: '💎 Points', value: `${totalPoints} pts ${trendEmoji}`, inline: true },
  );

  if (config.resultsChannelId) {
    try {
      const ch = await interaction.client.channels.fetch(config.resultsChannelId);
      if (ch && ch.isTextBased()) {
        const resultMsg = await (ch as TextChannel).send({ embeds: [embed], files });
        for (const reactionEmoji of RESULT_REACTION_EMOJIS) {
          try { await resultMsg.react(reactionEmoji); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('[add-test] Failed to post result embed:', err);
    }
  }

  incrementTesterStat(testerUser.id);
  scheduleTesterListRefresh(client);

  await callApi('/api/bot/result', {
    discordId: reg.discordId,
    mcUsername,
    gameMode: mode,
    tier: earned,
    previousTier: previous,
    testerDiscordId: testerUser.id,
    testerMcUsername: testerReg.mcUsername,
  });
  await callApi('/api/bot/tester-stat', { discordId: testerUser.id, action: 'increment' });

  if ('error' in roleResult) {
    await interaction.editReply(`✅ Test added! ⚠️ Role assignment failed: ${roleResult.error}`);
    return;
  }

  let msg = `✅ Test added! Assigned **${roleResult.assigned}** to \`${mcUsername}\`.\n`;
  msg    += `⭐ Title: ${titleDisplay} — **${totalPoints} pts** ${trendEmoji}`;
  if (pointDelta > 0) msg += ` *(+${pointDelta})*`;
  await interaction.editReply(msg);
}

async function handleHelpInfo(interaction: ChatInputCommandInteraction) {
  const config = getConfig();

  const channelLines: string[] = [];
  if (config.tierTestChannelId)
    channelLines.push(`⚔️ **Tier Test** — <#${config.tierTestChannelId}>`);
  if (config.leaderboardChannelId)
    channelLines.push(`🏆 **Leaderboard** — <#${config.leaderboardChannelId}>`);
  if (config.currentTesterChannelId)
    channelLines.push(`📋 **Tier Tester List** — <#${config.currentTesterChannelId}>`);
  if (config.resultsChannelId)
    channelLines.push(`📢 **Results** — <#${config.resultsChannelId}>`);
  const channelValue = channelLines.length > 0
    ? channelLines.join('\n')
    : '*Not yet configured.*';

  const websiteLinkField = getWebsiteLinkField();

  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('⚔️ Cosmic Tiers — Help & Info')
    .setDescription(
      '**Free, cracked Minecraft PvP tier testing!**\n' +
      'Get ranked across multiple game modes by experienced tier testers.\n\u200b',
    )
    .addFields(
      {
        name: '📋 How to Get Tier Tested',
        value:
          '**1.** Use `/register` to link your Minecraft account\n' +
          '**2.** Go to the tier test channel → click **⚔️ Start Tier Test**\n' +
          '**3.** Pick your **Game Mode** from the buttons\n' +
          '**4.** A Tier Tester will join your private ticket and run the test\n' +
          '**5.** Your result appears in the results channel and on the website',
      },
      {
        name: '🏅 How to Become a Tier Tester',
        value:
          '**1.** Be a registered player with proven skill\n' +
          '**2.** Go to the Tier Tester list channel → click **📋 Apply for Tier Tester**\n' +
          '**3.** Staff will review and approve your application',
      },
      {
        name: '🎮 Available Game Modes',
        value: '`Sword-PvP` · `UHC` · `Pot-PvP` · `Nethpot` · `SMP-PvP` · `Axe-PvP` · `Mace-PvP` · `Crystal-PvP` · `Cart-PvP`',
      },
      {
        name: '📊 Tier Rankings (Highest → Lowest)',
        value: '`HT1` › `LT1` › `HT2` › `LT2` › `HT3` › `LT3` › `HT4` › `LT4` › `HT5` › `LT5`',
      },
      {
        name: '💰 Points per Tier (per game mode)',
        value:
          '`HT1` = **60 pts**  ·  `LT1` = **45 pts**\n' +
          '`HT2` = **30 pts**  ·  `LT2` = **20 pts**\n' +
          '`HT3` = **10 pts**  ·  `LT3` = **6 pts**\n' +
          '`HT4` = **4 pts**    ·  `LT4` = **3 pts**\n' +
          '`HT5` = **2 pts**    ·  `LT5` = **1 pt**\n' +
          '*Points are cumulative across all game modes.*',
      },
      {
        name: '🏆 Achievement Titles (by total points)',
        value:
          '`Rookie` — 1+ pts\n' +
          '`Combat Initiate` — 5+ pts\n' +
          '`Combat Novice` — 10+ pts\n' +
          '`Combat Cadet` — 20+ pts\n' +
          '`Combat Specialist` — 50+ pts\n' +
          '`Combat Ace` — 100+ pts\n' +
          '`Combat Master` — 250+ pts\n' +
          '`Combat Grandmaster` — 400+ pts',
      },
      {
        name: '👤 Your Commands',
        value:
          '`/register` — Register your Minecraft account\n' +
          '`/skin-change` — Upload or reset your Minecraft skin\n' +
          '`/profile <player>` — View any player\'s profile\n' +
          '`/done <player> <game_mode> <score>` — Submit a match report (tier testers)\n' +
          '`/help` or `/info` — Show this message',
      },
      {
        name: '📍 Server Channels',
        value: channelValue,
      },
    )
    .setFooter({ text: 'Register first, then head to the Tier Test channel to get started!' })
    .setTimestamp();

  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });

  await interaction.reply({ embeds: [embed], ephemeral: false });
}

async function handleHelpStaff(interaction: ChatInputCommandInteraction) {
  const websiteLinkField = getWebsiteLinkField();

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🛡️ Cosmic Tiers — Staff Guide')
    .setDescription(
      'This is the internal guide for **staff and tier testers**.\n' +
      'Keep it confidential — use `/help` for the public-facing info.\n\u200b',
    )
    .addFields(
      {
        name: '📌 Staff Workflow',
        value:
          '**When a player submits `/done`:**\n' +
          '1. A report is posted in the staff channel with the match score\n' +
          '2. Review the report and confirm the result\n' +
          '3. Use `/result` to post the official tier and update the player\n\n' +
          '**When a player applies for Tier Tester:**\n' +
          '1. Review their application ticket\n' +
          '2. Use `/add-tester <user> <game-mode>` to grant the Tier Tester role if approved',
      },
      {
        name: '⚔️ Tier Test Commands (Staff)',
        value:
          '`/result <player> <tester> <game-mode> <tier>` — Post an official tier test result\n' +
          '`/add-test <tester> <player> <game_mode> <tier>` — Manually record a test result\n' +
          '`/add-tester <user> <game-mode>` — Grant Tier Tester role\n' +
          '`/remove-tester <user>` — Remove Tier Tester (clears all tester roles)\n' +
          '`/clear-user <user>` — Strip all tier roles from a player\n' +
          '`/clear-tester <user>` — Reset a tester\'s test count to zero\n' +
          '`/delete-user <user>` — Fully remove a player from the system',
      },
      {
        name: '🎖️ Special Title Commands (Staff)',
        value:
          '`/create-title <name> <role>` — Create a special title linked to a Discord role\n' +
          '`/give-title <player> <title>` — Give a player the special title (+ grants the role)',
      },
      {
        name: '🔑 Admin-Only Commands',
        value:
          '`/register-other <user> <mc_username> <region>` — Register another user\n' +
          '`/skin-change-other <user> [skin]` — Change another user\'s skin\n' +
          '`/edit-profile-others <user> [mc_username] [region] [skin] [reset_skin]` — Edit another registered user\n' +
          '`/set-tiertest-channel <channel>` — Set the tier test channel\n' +
          '`/set-results-channel <channel>` — Set where results are posted\n' +
          '`/set-staff-channel <channel>` — Set where `/done` reports go\n' +
          '`/set-leaderboard-channel <channel>` — Set the leaderboard channel\n' +
          '`/set-current-tester-channel <channel>` — Set the tier tester list channel\n' +
          '`/set-tier-tester-role <role>` — Set the Tier Tester role\n' +
          '`/set-staff-role <role>` — Set the Staff role\n' +
          '`/set-unranked-role <role>` — Set the Unranked role',
      },
    )
    .setFooter({ text: 'Staff guide — not for public distribution' })
    .setTimestamp();

  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateTitle(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  const name       = interaction.options.getString('name', true).trim();
  const role       = interaction.options.getRole('role', true);
  const textColor  = interaction.options.getString('text_color')?.trim() ?? null;
  const bgColor    = interaction.options.getString('background_color')?.trim() ?? null;
  const outline    = interaction.options.getString('outline')?.trim() ?? null;
  const iconAttach = interaction.options.getAttachment('icon') ?? null;

  const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (textColor && !HEX_RE.test(textColor)) {
    await interaction.editReply('❌ `text_color` must be a valid HEX color code (e.g. `#FF4500`).');
    return;
  }
  if (bgColor && !HEX_RE.test(bgColor)) {
    await interaction.editReply('❌ `background_color` must be a valid HEX color code (e.g. `#FF4500`).');
    return;
  }
  if (outline && !HEX_RE.test(outline)) {
    await interaction.editReply('❌ `outline` must be a valid HEX color code (e.g. `#FF4500`).');
    return;
  }

  if (iconAttach) {
    const ct = iconAttach.contentType ?? '';
    if (!ct.includes('image/png') && !ct.includes('image/gif')) {
      await interaction.editReply('❌ The icon must be a **PNG** or **GIF** file.');
      return;
    }
  }

  let iconUrl: string | null = null;
  if (iconAttach) {
    try {
      const resp = await fetch(iconAttach.url, { signal: AbortSignal.timeout(15_000) });
      if (!resp.ok) throw new Error(`Failed to download icon: ${resp.status}`);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const mimeType = iconAttach.contentType?.split(';')[0]?.trim() ?? 'image/png';
      const baseName = `title_${name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}_${Date.now()}`;
      const uploadResp = await callApi('/api/bot/upload-title-icon', {
        filename: baseName,
        data: buffer.toString('base64'),
        mimeType,
      });
      if (uploadResp?.iconUrl) {
        iconUrl = uploadResp.iconUrl as string;
      }
    } catch (err) {
      console.error('[create-title] Icon upload failed:', err);
      await interaction.editReply('❌ Failed to upload the icon. Please try again.');
      return;
    }
  }

  try {
    await callApi('/api/bot/create-title', {
      name,
      roleId: role.id,
      textColor,
      backgroundColor: bgColor,
      outline,
      iconUrl,
    });

    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎖️ Special Title Created')
      .setDescription(`The special title **"${name}"** has been created and linked to <@&${role.id}>.`)
      .addFields(
        { name: 'Title Name',   value: `\`${name}\``,       inline: true },
        { name: 'Linked Role',  value: `<@&${role.id}>`,    inline: true },
      );

    if (textColor) embed.addFields({ name: '🎨 Text Color',       value: textColor,  inline: true });
    if (bgColor)   embed.addFields({ name: '🌫️ Background Color', value: bgColor,    inline: true });
    if (outline)   embed.addFields({ name: '✏️ Outline Color',    value: outline,    inline: true });
    if (iconUrl)   embed.addFields({ name: '🖼️ Icon',             value: 'Uploaded', inline: true });

    embed
      .setFooter({ text: 'Use /give-title to assign this title to a player' })
      .setTimestamp();

    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[create-title]', err);
    await interaction.editReply('❌ Failed to create title. Please try again.');
  }
}

async function handleRemoveTitle(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const mcUsername = interaction.options.getString('player', true);
  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(`❌ Player **\`${mcUsername}\`** is not registered.`);
    return;
  }

  let titleRoleId: string | null = null;
  try {
    const resp = await fetch(`${WEBSITE_API_URL}/api/special-titles`);
    const data = await resp.json() as { titles: Array<{ name: string; roleId: string }> };
    const playerResp = await fetch(`${WEBSITE_API_URL}/api/leaderboard`);
    const playerData = await playerResp.json() as { players: Array<{ discordId: string; specialTitle: { name: string; roleId: string } | null }> };
    const playerEntry = playerData.players.find(p => p.discordId === reg.discordId);
    if (playerEntry?.specialTitle) {
      const matched = data.titles.find(t => t.name === playerEntry.specialTitle?.name);
      if (matched) titleRoleId = matched.roleId;
    }
  } catch (err) {
    console.error('[remove-title] Failed to fetch title data:', err);
  }

  try {
    await callApi('/api/bot/remove-title', { discordId: reg.discordId });

    const guild = interaction.guild;
    if (guild && titleRoleId) {
      try {
        const member = await guild.members.fetch(reg.discordId);
        if (member.roles.cache.has(titleRoleId)) {
          await member.roles.remove(titleRoleId, `Special title removed by staff`);
        }
      } catch (err) {
        console.error('[remove-title] Failed to remove role:', err);
      }
    }

    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎖️ Special Title Removed')
      .setDescription(`The special title has been removed from **\`${mcUsername}\`**.`)
      .addFields({ name: 'Player', value: `\`${mcUsername}\``, inline: true })
      .setFooter({ text: 'Their title has been cleared from the website profile' })
      .setTimestamp();
    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[remove-title]', err);
    await interaction.editReply('❌ Failed to remove title. Please try again.');
  }
}

async function handleGiveTitle(interaction: ChatInputCommandInteraction) {
  const mcUsername = interaction.options.getString('player', true);
  const titleName = interaction.options.getString('title', true);

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.reply({ content: `❌ Player **\`${mcUsername}\`** is not registered.`, ephemeral: true });
    return;
  }

  let titleRoleId: string | null = null;
  try {
    const resp = await fetch(`${WEBSITE_API_URL}/api/special-titles`);
    const data = await resp.json() as { titles: Array<{ name: string; roleId: string }> };
    const found = data.titles.find(t => t.name === titleName);
    if (!found) {
      await interaction.reply({ content: `❌ Title **\`${titleName}\`** does not exist. Create it first with \`/create-title\`.`, ephemeral: true });
      return;
    }
    titleRoleId = found.roleId;
  } catch (err) {
    console.error('[give-title] Failed to fetch titles:', err);
    await interaction.reply({ content: '❌ Failed to look up titles. Please try again.', ephemeral: true });
    return;
  }

  try {
    await callApi('/api/bot/give-title', { discordId: reg.discordId, titleName });

    const guild = interaction.guild;
    if (guild && titleRoleId) {
      try {
        const member = await guild.members.fetch(reg.discordId);
        await member.roles.add(titleRoleId, `Special title given: ${titleName}`);
      } catch (err) {
        console.error('[give-title] Failed to assign role:', err);
      }
    }

    const websiteLinkField = getWebsiteLinkField();
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎖️ Special Title Granted')
      .setDescription(`**\`${mcUsername}\`** has been given the **"${titleName}"** title!`)
      .addFields(
        { name: 'Player', value: `\`${mcUsername}\``, inline: true },
        { name: 'Title', value: `\`${titleName}\``, inline: true },
        { name: 'Role', value: titleRoleId ? `<@&${titleRoleId}>` : '*(none)*', inline: true },
      )
      .setFooter({ text: 'Their title will now appear on the website profile' })
      .setTimestamp();
    if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
    await interaction.reply({ embeds: [embed], ephemeral: false });
  } catch (err) {
    console.error('[give-title]', err);
    await interaction.reply({ content: '❌ Failed to give title. Please try again.', ephemeral: true });
  }
}

async function handleGiveTitleAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name === 'player') {
    return handleProfileAutocomplete(interaction);
  }
  if (focused.name === 'title') {
    try {
      const resp = await fetch(`${WEBSITE_API_URL}/api/special-titles`);
      const data = await resp.json() as { titles: Array<{ name: string }> };
      const q = focused.value.toLowerCase();
      const choices = data.titles
        .filter(t => t.name.toLowerCase().includes(q))
        .slice(0, 25)
        .map(t => ({ name: t.name, value: t.name }));
      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
  }
}

async function handleClearTierTest(interaction: ChatInputCommandInteraction) {
  const tester = interaction.options.getUser('tester', true);
  clearTesterStat(tester.id);
  scheduleTesterListRefresh(client);
  await callApi('/api/bot/tester-stat', { discordId: tester.id, action: 'clear' });
  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(TIER_TEST_YELLOW)
    .setTitle('✅ Test Count Cleared')
    .setDescription(`<@${tester.id}>'s tier test count has been reset to **0**.`);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleClearUser(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guild  = interaction.guild!;
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', false)?.trim() || null;

  let member: GuildMember;
  try {
    member = await guild.members.fetch(target.id);
  } catch {
    await interaction.editReply(`❌ Could not find <@${target.id}> in this server.`);
    return;
  }

  const removed = await removeAllTierRoles(member);

  const config       = getConfig();
  let testerCleared = false;
  if (config.tierTesterRoleId && member.roles.cache.has(config.tierTesterRoleId)) {
    clearTesterStat(target.id);
    testerCleared = true;
    scheduleTesterListRefresh(client);
    await callApi('/api/bot/tester-stat', { discordId: target.id, action: 'clear' });
  }

  const unrankedRole = await getOrCreateUnrankedRole(guild);
  if (!member.roles.cache.has(unrankedRole.id)) {
    await member.roles.add(unrankedRole, 'Cleared by /clear-user');
  }

  member = await guild.members.fetch(target.id);
  await assignTitleRole(guild, member);
  scheduleLeaderboardRefresh(client);

  await callApi('/api/bot/clear-user', { discordId: target.id });

  const reg = getRegistrationByDiscordId(target.id);
  const mcUsername = reg?.mcUsername ?? target.username;

  await postRedResultEmbed({
    title: '🧹 User Cleared',
    discordId: target.id,
    mcUsername,
    fields: [
      {
        name: '🏆 Removed Tiers',
        value: removed.length > 0 ? removed.map(r => `\`${r}\``).join(', ') : '`None`',
        inline: false,
      },
    ],
    managerId: interaction.user.id,
    reason,
  });

  let desc = `All tier roles removed from <@${target.id}>. They now have the **Unranked** role.`;
  if (removed.length > 0) desc += `\n\nRemoved: ${removed.map(r => `\`${r}\``).join(', ')}`;
  if (testerCleared) desc += `\n\nTest count reset to **0**.`;
  if (reason)        desc += `\n\n**Reason:** ${reason}`;

  const websiteLinkField = getWebsiteLinkField();
  const embed = new EmbedBuilder()
    .setColor(RESULTS_RED)
    .setTitle('🧹 User Cleared')
    .setDescription(desc);
  if (websiteLinkField) embed.addFields({ name: websiteLinkField.name, value: websiteLinkField.value });
  await interaction.editReply({ embeds: [embed] });
}

// ─── Pagination Button Handlers ───────────────────────────────────────────────

async function handleTesterListPage(interaction: ButtonInteraction, newPage: number): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.reply({ content: '❌ Server not found.', ephemeral: true }); return; }
  const message = await buildTesterMessage(guild, newPage);
  await interaction.update(message);
}

async function handleLeaderboardPage(interaction: ButtonInteraction, newPage: number): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.reply({ content: '❌ Server not found.', ephemeral: true }); return; }
  const message = await buildLeaderboardMessage(guild, newPage);
  await interaction.update(message);
}

// ─── /upload Command ──────────────────────────────────────────────────────────

const EMOJIS_DIR = join(__dir, 'emojis');
const IMAGE_EXTS = /\.(png|gif|jpg|jpeg|webp)$/i;

async function handleUploadEmoji(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;

  if (!existsSync(EMOJIS_DIR)) {
    await interaction.editReply(
      '❌ The `emojis/` folder does not exist inside the bot directory.\n' +
      'Create it and add your image files there, then run `/upload` again.',
    );
    return;
  }

  const files = readdirSync(EMOJIS_DIR).filter(f => IMAGE_EXTS.test(f));

  if (files.length === 0) {
    await interaction.editReply(
      '❌ No image files found in the `emojis/` folder.\n' +
      'Add `.png`, `.gif`, `.jpg`, or `.webp` files there, then run `/upload` again.',
    );
    return;
  }

  const config = getConfig();
  const emojiStrings = config.emojiStrings ?? {};
  const results: string[] = [];
  let limitHit = false;

  for (const file of files) {
    const baseName = file.replace(/\.[^/.]+$/, '');
    const emojiName = sanitizeToEmojiName(baseName);

    if (emojiStrings[emojiName]) {
      results.push(`ℹ️ \`${emojiName}\` — already exists, skipped`);
      continue;
    }

    try {
      const buffer = readFileSync(join(EMOJIS_DIR, file));
      const emoji = await guild.emojis.create({ attachment: buffer, name: emojiName });
      const formatted = emoji.animated
        ? `<a:${emoji.name}:${emoji.id}>`
        : `<:${emoji.name}:${emoji.id}>`;
      emojiStrings[emojiName] = formatted;
      results.push(`✅ ${formatted} \`${emojiName}\`  ← \`${file}\``);
    } catch (err: any) {
      if (err?.code === 30008) {
        results.push(`❌ Server emoji limit reached — free up slots then run \`/upload\` again.`);
        limitHit = true;
        break;
      }
      results.push(`❌ \`${emojiName}\` — ${err?.message ?? String(err)}`);
    }
  }

  setConfig({ emojiStrings });
  scheduleLeaderboardRefresh(client);
  scheduleTesterListRefresh(client);

  const skipped  = results.filter(r => r.startsWith('ℹ️')).length;
  const uploaded = results.filter(r => r.startsWith('✅')).length;
  const failed   = results.filter(r => r.startsWith('❌')).length;

  const chunks: string[] = [];
  for (let i = 0; i < results.length; i += 20) {
    chunks.push(results.slice(i, i + 20).join('\n'));
  }

  const summaryLine = `**${uploaded} uploaded · ${skipped} skipped · ${failed} failed**${limitHit ? ' · ⚠️ emoji limit hit' : ''}`;

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(TIER_TEST_YELLOW)
        .setTitle('📤 Emoji Upload Results')
        .setDescription(`${summaryLine}\n\n${chunks[0] ?? ''}`)
        .setFooter({ text: 'Run /upload again to retry failed ones.' }),
    ],
  });

  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({ content: chunks[i], ephemeral: true });
  }
}

// ─── /retired Command (staff only) ────────────────────────────────────────────

async function handleRetiredAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const all     = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(r => ({ name: r.mcUsername, value: r.mcUsername }));
  await interaction.respond(choices);
}

async function handleRetired(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const member = interaction.member as GuildMember;

  const hasStaffForRetire = config.staffRoleId ? member.roles.cache.has(config.staffRoleId) : false;
  const hasModForRetire   = config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false;
  const hasPermsForRetire = member.permissions.has(PermissionFlagsBits.ManageRoles);
  if (config.staffRoleId && !hasStaffForRetire && !hasModForRetire && !hasPermsForRetire) {
    await interaction.editReply('❌ Only staff or mod members can use `/retired`.');
    return;
  }

  const mcUsername = interaction.options.getString('player', true).trim();
  const gameMode   = interaction.options.getString('game_mode', true);

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(
      `❌ No registered player found with Minecraft username \`${mcUsername}\`.`,
    );
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(
      `❌ Could not find the Discord member for **\`${mcUsername}\`** in this server.`,
    );
    return;
  }

  const currentTier = await getMemberCurrentTier(playerMember, gameMode);
  if (currentTier === 'Unranked') {
    await interaction.editReply(
      `❌ **\`${mcUsername}\`** has no active tier in **${displayGameMode(gameMode)}** to retire.`,
    );
    return;
  }

  try {
    const tierRoleName = `${displayGameMode(gameMode)} ${currentTier}`;
    const tierRole = guild.roles.cache.find(r => r.name === tierRoleName);
    if (tierRole) {
      await playerMember.roles.remove(tierRole, `Retired from ${displayGameMode(gameMode)} by ${interaction.user.username}`);
    }

    const retiredRoleName = `${displayGameMode(gameMode)} R${currentTier}`;
    let retiredRole = guild.roles.cache.find(r => r.name === retiredRoleName);
    if (!retiredRole) {
      retiredRole = await guild.roles.create({
        name: retiredRoleName,
        color: 0x8B4513,
        permissions: 0n,
        reason: 'Auto-created retired tier role',
      });
    }
    await sanitizeBotRole(retiredRole);
    await playerMember.roles.add(retiredRole, `Retired from ${displayGameMode(gameMode)} by ${interaction.user.username}`);
  } catch (err) {
    console.error('[retired] Role error:', err);
    await interaction.editReply('⚠️ Retired tier marked in DB, but there was an issue updating roles.');
  }

  const apiResult = await callApi('/api/bot/retire-tier', {
    discordId: reg.discordId,
    gameMode,
  });

  if ('error' in (apiResult as Record<string, unknown>)) {
    await interaction.editReply(`❌ Failed to mark retirement in the database.`);
    return;
  }

  scheduleLeaderboardRefresh(client);

  await postRedResultEmbed({
    title: '🪦 Player Retired',
    discordId: reg.discordId,
    mcUsername,
    fields: [
      { name: '⚔️ Game Mode',    value: displayGameMode(gameMode),                inline: true },
      { name: '🏆 Retired Tier', value: `**${currentTier}** → **R${currentTier}**`, inline: true },
    ],
    managerId: interaction.user.id,
    reason: null,
  });

  await interaction.editReply(
    `✅ **\`${mcUsername}\`** has been retired from **${displayGameMode(gameMode)}** (**${currentTier}** → **R${currentTier}**).\n` +
    `Their points remain unchanged and they no longer appear in the Top section for ${displayGameMode(gameMode)}.`,
  );
}

// ─── /remove-tier Command (staff only) ────────────────────────────────────────

async function handleRemoveTier(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const member = interaction.member as GuildMember;

  const hasStaff = config.staffRoleId ? member.roles.cache.has(config.staffRoleId) : false;
  const hasMod   = config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false;
  const hasPerms = member.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!hasStaff && !hasMod && !hasPerms) {
    await interaction.editReply('❌ Only staff or mod members can use `/remove-tier`.');
    return;
  }

  const mcUsername = interaction.options.getString('player', true).trim();
  const gameMode   = interaction.options.getString('game_mode', true);
  const reason     = interaction.options.getString('reason', false)?.trim() || null;

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(`❌ No registered player found with Minecraft username \`${mcUsername}\`.`);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(`❌ Could not find the Discord member for **\`${mcUsername}\`** in this server.`);
    return;
  }

  let removedTierLabel: string | null = null;
  const removedRoleNames: string[] = [];
  const reasonText = `Tier removed by /remove-tier (${interaction.user.username})`;

  for (const tier of ALL_TIERS) {
    const activeName  = `${displayGameMode(gameMode)} ${tier}`;
    const retiredName = `${displayGameMode(gameMode)} R${tier}`;
    const activeRole  = guild.roles.cache.find(r => r.name === activeName);
    const retiredRole = guild.roles.cache.find(r => r.name === retiredName);

    if (activeRole && playerMember.roles.cache.has(activeRole.id)) {
      try { await playerMember.roles.remove(activeRole, reasonText); } catch { /* ignored */ }
      removedRoleNames.push(activeName);
      if (!removedTierLabel) removedTierLabel = tier;
    }
    if (retiredRole && playerMember.roles.cache.has(retiredRole.id)) {
      try { await playerMember.roles.remove(retiredRole, reasonText); } catch { /* ignored */ }
      removedRoleNames.push(retiredName);
      if (!removedTierLabel) removedTierLabel = `R${tier}`;
    }
  }

  if (!removedTierLabel) {
    await interaction.editReply(
      `❌ **\`${mcUsername}\`** has no active or retired tier in **${displayGameMode(gameMode)}** to remove.`,
    );
    return;
  }

  const apiResult = await callApi('/api/bot/remove-tier', {
    discordId: reg.discordId,
    gameMode,
  });
  if ('error' in (apiResult as Record<string, unknown>)) {
    await interaction.editReply('⚠️ Tier role removed, but failed to clear it from the database.');
    return;
  }

  scheduleLeaderboardRefresh(client);

  await postRedResultEmbed({
    title: '❌ Tier Removed',
    discordId: reg.discordId,
    mcUsername,
    fields: [
      { name: '⚔️ Game Mode',    value: displayGameMode(gameMode),  inline: true },
      { name: '🏆 Removed Tier', value: `**${removedTierLabel}**`,  inline: true },
    ],
    managerId: interaction.user.id,
    reason,
  });

  await interaction.editReply(
    `✅ Removed **${removedTierLabel}** in **${displayGameMode(gameMode)}** from **\`${mcUsername}\`**.` +
    (removedRoleNames.length > 0 ? `\n\nRoles removed: ${removedRoleNames.map(r => `\`${r}\``).join(', ')}` : '') +
    (reason ? `\n\n**Reason:** ${reason}` : ''),
  );
}

// ─── /unretired Command ───────────────────────────────────────────────────────

async function handleUnretired(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();
  const member = interaction.member as GuildMember;

  const hasStaff = config.staffRoleId ? member.roles.cache.has(config.staffRoleId) : false;
  const hasMod   = config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false;
  const hasPerms = member.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!hasStaff && !hasMod && !hasPerms) {
    await interaction.editReply('❌ Only staff or mod members can use `/unretired`.');
    return;
  }

  const mcUsername = interaction.options.getString('player', true).trim();
  const gameMode   = interaction.options.getString('game_mode', true);

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(`❌ No registered player found with Minecraft username \`${mcUsername}\`.`);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ This command must be used inside a server.');
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(reg.discordId);
  } catch {
    await interaction.editReply(`❌ Could not find the Discord member for **\`${mcUsername}\`** in this server.`);
    return;
  }

  let retiredTier: string | null = null;
  for (const tier of ALL_TIERS) {
    const retiredRoleName = `${displayGameMode(gameMode)} R${tier}`;
    const retiredRole = guild.roles.cache.find(r => r.name === retiredRoleName);
    if (retiredRole && playerMember.roles.cache.has(retiredRole.id)) {
      retiredTier = tier;
      await playerMember.roles.remove(retiredRole, `Unretired from ${displayGameMode(gameMode)} by ${interaction.user.username}`);
      break;
    }
  }

  if (!retiredTier) {
    await interaction.editReply(`❌ **\`${mcUsername}\`** has no retired tier in **${displayGameMode(gameMode)}**.`);
    return;
  }

  const color = getTierColor(retiredTier);
  const regularRoleName = `${displayGameMode(gameMode)} ${retiredTier}`;
  let regularRole = guild.roles.cache.find(r => r.name === regularRoleName);
  if (!regularRole) {
    regularRole = await guild.roles.create({
      name: regularRoleName,
      color,
      permissions: 0n,
      reason: 'Auto-created tier role on unretire',
    });
  }
  await sanitizeBotRole(regularRole);
  await playerMember.roles.add(regularRole, `Unretired: restored ${regularRoleName}`);

  await callApi('/api/bot/unretire-tier', { discordId: reg.discordId, gameMode });
  scheduleLeaderboardRefresh(client);

  await interaction.editReply(
    `✅ **\`${mcUsername}\`** has been unretired from **${displayGameMode(gameMode)}** (**R${retiredTier}** → **${retiredTier}**).\n` +
    `Their tier has been restored to normal.`,
  );
}

// ─── /set-mod-role Command ────────────────────────────────────────────────────

async function handleSetModRole(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply('❌ Only administrators can use `/set-mod-role`.');
    return;
  }

  const role = interaction.options.getRole('role', true);
  setConfig({ modRoleId: role.id });

  await interaction.editReply(
    `✅ Mod role set to <@&${role.id}>.\n` +
    `Members with this role can now use \`/result\`, \`/done\`, and all tier tester commands.`,
  );
}

// ─── Command Registration ─────────────────────────────────────────────────────

async function registerCommands(clientId: string) {
  const rest = new REST({ version: '10' }).setToken(TOKEN!);
  try {
    console.log('Registering slash commands…');
    await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), {
      body: [
        uploadEmojiCommand.toJSON(),
        registerCommand.toJSON(),
        registerOtherCommand.toJSON(),
        setSkinCommand.toJSON(),
        skinChangeOtherCommand.toJSON(),
        resultCommand.toJSON(),
        doneCommand.toJSON(),
        addTestCommand.toJSON(),
        profileCommand.toJSON(),
        deleteUserCommand.toJSON(),
        setResultsChannelCommand.toJSON(),
        setStaffChannelCommand.toJSON(),
        setTierTesterRoleCommand.toJSON(),
        setTierTestChannelCommand.toJSON(),
        setCurrentTesterChannelCommand.toJSON(),
        setUnrankedRoleCommand.toJSON(),
        clearTierTestCommand.toJSON(),
        clearUserCommand.toJSON(),
        removeTierCommand.toJSON(),
        removeTesterCommand.toJSON(),
        setLeaderboardChannelCommand.toJSON(),
        setStaffRoleCommand.toJSON(),
        addTesterCommand.toJSON(),
        helpCommand.toJSON(),
        infoCommand.toJSON(),
        helpStaffCommand.toJSON(),
        infoStaffCommand.toJSON(),
        createTitleCommand.toJSON(),
        giveTitleCommand.toJSON(),
        removeTitleCommand.toJSON(),
        retiredCommand.toJSON(),
        unretiredCommand.toJSON(),
        setModRoleCommand.toJSON(),
        editProfileCommand.toJSON(),
        editProfileOtherCommand.toJSON(),
      ],
    });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
  console.log(`[Bot] Logged in as ${client.user!.tag}`);
  await loadConfigFromApi();
  await loadRegistrationsFromApi();
  await registerCommands(client.user!.id);
  // Audit all bot-managed roles and strip any dangerous permissions
  for (const [, guild] of client.guilds.cache) {
    auditBotRoles(guild).catch(err => console.error('[role-audit] Startup audit error:', err));
  }
  setInterval(() => refreshTierTestPanel(client),    10 * 60 * 1000);
  setInterval(() => refreshTesterListPanel(client),  10 * 60 * 1000);
  setInterval(() => refreshLeaderboardPanel(client), 10 * 60 * 1000);
  setInterval(() => {
    loadRegistrationsFromApi().catch(err =>
      console.error('[registration] Periodic sync failed:', err),
    );
  }, 5 * 60 * 1000);
});

client.on('guildMemberAdd', async member => {
  try {
    const unrankedRole = await getOrCreateUnrankedRole(member.guild);
    await member.roles.add(unrankedRole, 'New member — assigned Unranked role');
    await assignTitleRole(member.guild, member);
  } catch (err) {
    console.error('Failed to assign roles to new member:', err);
  }
});

client.on('presenceUpdate', (_old, newPresence) => {
  const config = getConfig();
  const member = newPresence?.member;
  if (!member) return;
  // Refresh the tier test panel when a tester's presence changes
  if (config.tierTesterRoleId && config.tierTestChannelId && member.roles.cache.has(config.tierTesterRoleId)) {
    schedulePanelRefresh(client);
  }
  // Always refresh active queue/tier-test embeds (player+tester online status matters)
  scheduleQueueRefresh(client);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const config = getConfig();
  const guild  = newMember.guild;

  // ── Tester role sync ──────────────────────────────────────────────────────
  if (config.tierTesterRoleId) {
    const hadTesterRole = oldMember.roles.cache.has(config.tierTesterRoleId);
    const hasTesterRole = newMember.roles.cache.has(config.tierTesterRoleId);

    if (!hadTesterRole && hasTesterRole) {
      // Role was just added — check if player is registered
      const reg = getRegistrationByDiscordId(newMember.id);
      if (reg) {
        // Sync to website DB
        await callApi('/api/bot/tester-role', { discordId: newMember.id, action: 'add' });
        schedulePanelRefresh(client);
        scheduleTesterListRefresh(client);
      } else {
        // Not registered — remove the tester role immediately
        try {
          await (newMember as GuildMember).roles.remove(
            config.tierTesterRoleId!,
            'Anti-mistake: User is not registered, cannot have Tier Tester role',
          );
          console.log(`[protection] Removed Tier Tester role from unregistered user ${newMember.id}`);
        } catch (err) {
          console.error('[protection] Failed to remove Tier Tester role:', err);
        }
      }
    }

    if (hadTesterRole && !hasTesterRole) {
      await callApi('/api/bot/tester-role', { discordId: newMember.id, action: 'remove' });
      if (config.tierTestChannelId) schedulePanelRefresh(client);
      scheduleTesterListRefresh(client);
    }

    if (hasTesterRole) {
      const oldCount = oldMember.roles.cache.filter(r => isTierRoleNameForTesterList(r.name)).size;
      const newCount = newMember.roles.cache.filter(r => isTierRoleNameForTesterList(r.name)).size;
      if (oldCount !== newCount) scheduleTesterListRefresh(client);
    }
  }

  // ── Admin mistake prevention: Registered role protection ──────────────────
  if (config.registeredRoleId) {
    const hadRegistered = oldMember.roles.cache.has(config.registeredRoleId);
    const hasRegistered = newMember.roles.cache.has(config.registeredRoleId);

    if (!hadRegistered && hasRegistered) {
      // Role was just added — check if the user is actually registered
      const reg = getRegistrationByDiscordId(newMember.id);
      if (!reg) {
        // Not registered — remove the role immediately
        try {
          await (newMember as GuildMember).roles.remove(
            config.registeredRoleId,
            'Anti-mistake: User is not registered in the system',
          );
          console.log(`[protection] Removed Registered role from unregistered user ${newMember.id}`);
        } catch (err) {
          console.error('[protection] Failed to remove Registered role:', err);
        }
        return;
      }
    }
  }

  // ── Admin mistake prevention: Tier role protection ────────────────────────
  const oldTierRoles = new Set(
    oldMember.roles.cache.filter(r => isTierRoleName(r.name)).map(r => r.id),
  );
  const newTierRoles = new Set(
    newMember.roles.cache.filter(r => isTierRoleName(r.name)).map(r => r.id),
  );

  // Find newly added tier roles
  const addedTierRoles = [...newTierRoles].filter(id => !oldTierRoles.has(id));

  if (addedTierRoles.length > 0) {
    const reg = getRegistrationByDiscordId(newMember.id);
    if (!reg) {
      // Not registered — remove all newly added tier roles
      for (const roleId of addedTierRoles) {
        try {
          await (newMember as GuildMember).roles.remove(
            roleId,
            'Anti-mistake: User is not registered, cannot have tier roles',
          );
          console.log(`[protection] Removed tier role ${roleId} from unregistered user ${newMember.id}`);
        } catch (err) {
          console.error('[protection] Failed to remove tier role:', err);
        }
      }
      return;
    }
  }

  // ── Leaderboard refresh on tier changes ───────────────────────────────────
  const oldTierCount = oldMember.roles.cache.filter(r => isTierRoleName(r.name)).size;
  const newTierCount = newMember.roles.cache.filter(r => isTierRoleName(r.name)).size;
  if (oldTierCount !== newTierCount) {
    try { await assignTitleRole(guild, newMember as GuildMember); } catch (err) {
      console.error('Failed to reassign title on role update:', err);
    }
    scheduleLeaderboardRefresh(client);
  }

  // ── Special title role sync ───────────────────────────────────────────────
  try {
    const resp = await fetch(`${WEBSITE_API_URL}/api/special-titles`);
    if (resp.ok) {
      const data = await resp.json() as { titles: Array<{ name: string; roleId: string }> };
      const specialTitlesList = data.titles ?? [];
      for (const st of specialTitlesList) {
        const hadRole = oldMember.roles.cache.has(st.roleId);
        const hasRole = newMember.roles.cache.has(st.roleId);
        if (hadRole && !hasRole) {
          // Role removed — clear title from DB
          const reg = getRegistrationByDiscordId(newMember.id);
          if (reg) {
            await callApi('/api/bot/remove-title', { discordId: newMember.id });
          }
        } else if (!hadRole && hasRole) {
          // Role added — grant title in DB (only 1 title per player)
          const reg = getRegistrationByDiscordId(newMember.id);
          if (reg) {
            await callApi('/api/bot/give-title', { discordId: newMember.id, titleName: st.name });
          }
        }
      }
    }
  } catch {
    // Silently ignore — non-critical
  }
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  // ── Skin upload inside a tier test ticket channel ────────────────────────────
  const channel = message.channel as TextChannel;
  const channelName = 'name' in channel ? channel.name : '';
  if (channelName.startsWith('tt-')) {
    const attachment = message.attachments.first();
    if (attachment && attachment.contentType === 'image/png' && attachment.size <= 20 * 1024) {
      const reg = getRegistrationByDiscordId(message.author.id);
      // Only process if this is the ticket owner's channel (topic contains their discord ID)
      const topic: string = ('topic' in channel ? channel.topic : '') ?? '';
      const isOwner = topic.includes(message.author.id) && !!reg;
      if (isOwner && reg) {
        try { await message.delete(); } catch { /* no permission */ }
        updateSkin(message.author.id, attachment.url);
        void renderAndUploadSkin(message.author.id, attachment.url).catch(err => console.error('[skin] Ticket skin update error:', err));
        try {
          await channel.send({
            content:
              `✅ <@${message.author.id}> Skin updated for **\`${reg.mcUsername}\`**!\n` +
              `Your new skin will appear in your tier test result embed.`,
          });
        } catch { /* ignored */ }
      }
    }
  }
});

// ─── Tier Select Button Handler ───────────────────────────────────────────────

async function handleTierSelect(interaction: ButtonInteraction): Promise<void> {
  const parts    = interaction.customId.split(':');
  const gameMode = parts[1];
  const tier     = parts[2];

  if (!gameMode || !tier) {
    await interaction.reply({ content: '❌ Invalid tier selection.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const member  = interaction.member as GuildMember;
  const config  = getConfig();

  // Resolve tier test info: in-memory map first, channel topic as fallback (post bot restart)
  const infoFromMap = getActiveTierTest(channel.id);
  const topicInfo   = parseTierTestTopic(channel.topic ?? '');
  const info        = infoFromMap ?? topicInfo;

  if (!info) {
    await interaction.reply({ content: '❌ Could not identify this tier test session. Contact an admin.', ephemeral: true });
    return;
  }

  // Permission check: only the accepting tester, or staff/mod/admin
  const isAcceptingTester = interaction.user.id === info.testerId;
  const hasMod   = config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false;
  const hasStaff = config.staffRoleId ? member.roles.cache.has(config.staffRoleId) : false;
  const isAdmin  = member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAcceptingTester && !hasMod && !hasStaff && !isAdmin) {
    await interaction.reply({ content: '⛔ You are not the tester for this session.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const guild = interaction.guild!;

  const reg = getRegistrationByDiscordId(info.playerId);
  if (!reg) {
    await channel.send('❌ Player registration not found. Cannot post result. Contact an admin.');
    return;
  }

  let playerMember: GuildMember;
  try {
    playerMember = await guild.members.fetch(info.playerId);
  } catch {
    await channel.send('❌ Could not find the player in this server. Cannot assign tier role.');
    return;
  }

  let testerMember: GuildMember | null = null;
  try { testerMember = await guild.members.fetch(info.testerId); } catch { /* ignored */ }

  const previous       = await getMemberCurrentTier(playerMember, gameMode);
  const { emoji, label } = getRankChange(previous, tier);
  const color          = getTierColor(tier);
  const previousPoints = getMemberPoints(playerMember);
  const testerReg      = getRegistrationByDiscordId(info.testerId);

  const modeDisplay = displayGameMode(gameMode);
  const modeEmoji   = getGameModeEmoji(gameMode);
  const modeFull    = modeEmoji ? `${modeEmoji} ${modeDisplay}` : modeDisplay;

  const embedFields: { name: string; value: string; inline?: boolean }[] = [
    { name: '👤 Tested Player', value: `<@${info.playerId}>`,    inline: true },
    { name: '🎮 IGN',           value: `\`${info.mcUsername}\``, inline: true },
    { name: '🌍 Region',        value: info.region,              inline: true },
    { name: '🧪 Tester',        value: `<@${info.testerId}>`,    inline: true },
    { name: '⚔️ Game Mode',     value: modeFull,                 inline: true },
    { name: '📋 Previous Tier', value: `**${previous}**`,        inline: true },
    { name: '🏆 Earned Tier',   value: `**${tier}**`,            inline: true },
  ];

  const resultEmbed = new EmbedBuilder()
    .setTitle(`${emoji} Tier Test Result — ${label}`)
    .setColor(color)
    .setAuthor({
      name: `Tested by ${testerMember?.user.username ?? 'Tester'}`,
      iconURL: testerMember?.user.displayAvatarURL({ size: 256 }),
    })
    .setThumbnail(getBackendSkinUrl(info.playerId))
    .addFields(...embedFields)
    .setFooter({ text: 'Tier Test System' })
    .setTimestamp();

  // Assign tier role
  const roleResult = await assignTierRole(guild, info.playerId, gameMode, tier, color);
  let updatedMember: GuildMember | null = null;
  let titleName = 'None';
  let totalPoints = 0;
  let pointDelta  = 0;

  if (!('error' in roleResult)) {
    updatedMember = roleResult.member;
    titleName     = await assignTitleRole(guild, updatedMember);
    totalPoints   = getMemberPoints(updatedMember);
    pointDelta    = totalPoints - previousPoints;
    scheduleLeaderboardRefresh(client);
  }

  const trendEmoji = getTrendEmojiString(pointDelta);
  resultEmbed.addFields({ name: '💎 Points', value: `${totalPoints} pts ${trendEmoji}`, inline: true });

  // Post to results channel
  if (config.resultsChannelId) {
    try {
      const resCh = await client.channels.fetch(config.resultsChannelId);
      if (resCh && resCh.isTextBased()) {
        const websiteRow = WEBSITE_LINK
          ? new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setLabel('View on Cosmic Tiers').setStyle(ButtonStyle.Link).setURL(WEBSITE_LINK),
            )
          : null;
        const resultMsg = await (resCh as TextChannel).send({
          embeds: [resultEmbed],
          ...(websiteRow ? { components: [websiteRow] } : {}),
        });
        for (const reactionEmoji of RESULT_REACTION_EMOJIS) {
          try { await resultMsg.react(reactionEmoji); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('[tier-select] Failed to post result to results channel:', err);
    }
  }

  // Update API and stats
  await callApi('/api/bot/result', {
    discordId:         info.playerId,
    mcUsername:        info.mcUsername,
    gameMode,
    tier,
    previousTier:      previous,
    testerDiscordId:   info.testerId,
    testerMcUsername:  testerReg?.mcUsername ?? null,
  });
  incrementTesterStat(info.testerId);
  scheduleTesterListRefresh(client);
  await callApi('/api/bot/tester-stat', { discordId: info.testerId, action: 'increment' });

  console.log(`[tier-select] ${testerMember?.user.username ?? info.testerId} → ${info.mcUsername} | ${gameMode} ${tier} (prev: ${previous})`);

  // Clean up and delete the tier test channel
  removeTierTestEntry(channel.id);
  await channel.send(`✅ Result posted for **${info.mcUsername}** — **${tier}** in **${modeDisplay}**!`);
  setTimeout(() => channel.delete('Tier test completed').catch(console.error), 2500);
}

client.on('error', err => console.error('[Discord Client Error]', err));

client.on('interactionCreate', async interaction => {
  try {
    // ── Autocomplete ──────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'result')       return handleResultAutocomplete(interaction);
      if (interaction.commandName === 'profile')      return handleProfileAutocomplete(interaction);
      if (interaction.commandName === 'done')         return handleDoneAutocomplete(interaction);
      if (interaction.commandName === 'add-test')     return handleAddTestAutocomplete(interaction);
      if (interaction.commandName === 'give-title')   return handleGiveTitleAutocomplete(interaction);
      if (interaction.commandName === 'remove-title') return handleProfileAutocomplete(interaction);
      if (interaction.commandName === 'retired')      return handleRetiredAutocomplete(interaction);
      if (interaction.commandName === 'unretired')    return handleRetiredAutocomplete(interaction);
      if (interaction.commandName === 'remove-tier')  return handleRetiredAutocomplete(interaction);
      return;
    }

    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'upload')                     return await handleUploadEmoji(interaction);
      if (interaction.commandName === 'register')                   return await handleRegisterCommand(interaction);
      if (interaction.commandName === 'register-other')             return await handleRegisterOther(interaction);
      if (interaction.commandName === 'skin-change')                 return await handleSkinChange(interaction);
      if (interaction.commandName === 'skin-change-other')          return await handleSkinChangeOther(interaction);
      if (interaction.commandName === 'result')                     return await handleResult(interaction);
      if (interaction.commandName === 'done')                       return await handleDone(interaction);
      if (interaction.commandName === 'add-test')                   return await handleAddTest(interaction);
      if (interaction.commandName === 'profile')                    return await handleProfile(interaction);
      if (interaction.commandName === 'delete-user')                return await handleDeleteUser(interaction);
      if (interaction.commandName === 'set-results-channel')        return await handleSetResultsChannel(interaction);
      if (interaction.commandName === 'set-staff-channel')          return await handleSetStaffChannel(interaction);
      if (interaction.commandName === 'set-tier-tester-role')       return await handleSetTierTesterRole(interaction);
      if (interaction.commandName === 'set-tiertest-channel')       return await handleSetTierTestChannel(interaction);
      if (interaction.commandName === 'set-current-tester-channel') return await handleSetCurrentTesterChannel(interaction);
      if (interaction.commandName === 'set-unranked-role')          return await handleSetUnrankedRole(interaction);
      if (interaction.commandName === 'set-leaderboard-channel')    return await handleSetLeaderboardChannel(interaction);
      if (interaction.commandName === 'set-staff-role')             return await handleSetStaffRole(interaction);
      if (interaction.commandName === 'add-tester')                 return await handleAddTester(interaction);
      if (interaction.commandName === 'clear-tester')               return await handleClearTierTest(interaction);
      if (interaction.commandName === 'clear-user')                 return await handleClearUser(interaction);
      if (interaction.commandName === 'remove-tier')                return await handleRemoveTier(interaction);
      if (interaction.commandName === 'remove-tester')              return await handleRemoveTester(interaction);
      if (interaction.commandName === 'help')                       return await handleHelpInfo(interaction);
      if (interaction.commandName === 'info')                       return await handleHelpInfo(interaction);
      if (interaction.commandName === 'help-staff')                 return await handleHelpStaff(interaction);
      if (interaction.commandName === 'info-staff')                 return await handleHelpStaff(interaction);
      if (interaction.commandName === 'create-title')               return await handleCreateTitle(interaction);
      if (interaction.commandName === 'give-title')                 return await handleGiveTitle(interaction);
      if (interaction.commandName === 'remove-title')               return await handleRemoveTitle(interaction);
      if (interaction.commandName === 'retired')                    return await handleRetired(interaction);
      if (interaction.commandName === 'unretired')                  return await handleUnretired(interaction);
      if (interaction.commandName === 'set-mod-role')               return await handleSetModRole(interaction);
      if (interaction.commandName === 'edit-profile')               return await handleEditProfile(interaction);
      if (interaction.commandName === 'edit-profile-others')        return await handleEditProfileOther(interaction);
      if (interaction.commandName === 'edit-profile-other')         return await handleEditProfileOther(interaction);
      return;
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === BUTTON_ID)        return await handleStartButton(interaction);
      if (id === CLOSE_TICKET_ID)  return await handleCloseTicket(interaction);
      if (id === DELETE_TICKET_ID) return await handleDeleteTicket(interaction);
      if (id === APPLY_TESTER_ID)  return await handleApplyTesterButton(interaction);

      // ── Queue system ────────────────────────────────────────────────────────
      if (id === QUEUE_LEAVE_ID)  return await handleQueueLeave(interaction as ButtonInteraction);
      if (id === QUEUE_NEXT_ID)   return await handleQueueNext(interaction as ButtonInteraction);
      if (id === QUEUE_END_ID)    return await handleQueueEnd(interaction as ButtonInteraction);
      if (id === TT_CLOSE_ID)     return await handleTtClose(interaction as ButtonInteraction);
      if (id.startsWith(TIER_SELECT_PREFIX + ':')) return await handleTierSelect(interaction as ButtonInteraction);

      if (id === PANEL_REGISTER_ID) {
        const existing = getRegistrationByDiscordId(interaction.user.id);
        if (existing) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(TIER_TEST_YELLOW)
                .setTitle('✅ Already Registered')
                .setDescription(
                  `You are already registered as **\`${existing.mcUsername}\`** (${existing.region}).\n` +
                  `Use \`/skin-change\` to update your skin.`,
                ),
            ],
            ephemeral: true,
          });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(REGISTER_MODAL_ID)
          .setTitle('Register Your Minecraft Account');
        const mcInput = new TextInputBuilder()
          .setCustomId(REG_INPUT_MC)
          .setLabel('MC Username — permanent, cannot change!')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Steve123')
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(16);
        const regionInput = new TextInputBuilder()
          .setCustomId(REG_INPUT_REGION)
          .setLabel('Your Region')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('AS · AF · EU · NA · SA · OC · AN')
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(2);
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(mcInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(regionInput),
        );
        await interaction.showModal(modal);
        return;
      }

      if (id.startsWith(SELECT_GM_PREFIX + ':')) {
        const gameMode = id.slice(SELECT_GM_PREFIX.length + 1);
        return await handleGameModeSelect(interaction as ButtonInteraction, gameMode);
      }

      if (id.startsWith(TL_PREV_ID + ':') || id.startsWith(TL_NEXT_ID + ':')) {
        const [prefix, pageStr] = id.split(':');
        const currentPage = parseInt(pageStr, 10);
        const newPage     = prefix === TL_PREV_ID ? currentPage - 1 : currentPage + 1;
        return await handleTesterListPage(interaction as ButtonInteraction, newPage);
      }

      if (id.startsWith(LB_PREV_ID + ':') || id.startsWith(LB_NEXT_ID + ':')) {
        const [prefix, pageStr] = id.split(':');
        const currentPage = parseInt(pageStr, 10);
        const newPage     = prefix === LB_PREV_ID ? currentPage - 1 : currentPage + 1;
        return await handleLeaderboardPage(interaction as ButtonInteraction, newPage);
      }

      return;
    }

    // ── Modals ────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId === MODAL_ID)          return await handleTierTestModal(interaction);
      if (interaction.customId === REGISTER_MODAL_ID) return await handleRegisterModal(interaction as ModalSubmitInteraction);
      return;
    }
  } catch (err) {
    console.error('[Interaction Error]', err);
    try {
      const reply = { content: '❌ An unexpected error occurred. Please try again.', ephemeral: true };
      if (interaction.isRepliable()) {
        if ((interaction as any).deferred || (interaction as any).replied) {
          await (interaction as any).editReply(reply);
        } else {
          await (interaction as any).reply(reply);
        }
      }
    } catch { /* ignore secondary error */ }
  }
});

client.login(TOKEN);

import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});
