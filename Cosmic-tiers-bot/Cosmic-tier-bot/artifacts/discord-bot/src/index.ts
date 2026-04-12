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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { keepAlive } from './keep_alive.js';
keepAlive();
import {
  uploadEmojiCommand,
  registerCommand,
  skinChangeCommand,
  resultCommand,
  setResultsChannelCommand,
  setTierTesterRoleCommand,
  setTierTestChannelCommand,
  setCurrentTesterChannelCommand,
  setUnrankedRoleCommand,
  clearTierTestCommand,
  clearUserCommand,
  setLeaderboardChannelCommand,
} from './commands.js';
import { getConfig, setConfig, incrementTesterStat, clearTesterStat } from './config.js';
import {
  BUTTON_ID,
  PANEL_REGISTER_ID,
  MODAL_ID,
  CLOSE_TICKET_ID,
  DELETE_TICKET_ID,
  APPLY_TESTER_ID,
  TIER_TEST_YELLOW,
  handleStartButton,
  handleTierTestModal,
  handleCloseTicket,
  handleDeleteTicket,
  handleApplyTesterButton,
  postTierTestPanel,
  refreshTierTestPanel,
  schedulePanelRefresh,
} from './tiertest.js';
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
  updateRenderedSkinPath,
  getAllRegistrations,
} from './registration.js';
import { sanitizeToEmojiName } from './emojis.js';
import { renderMinecraftSkin } from './skinrender.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const RENDERED_SKINS_DIR = join(__dir, '..', 'rendered-skins');
const TIER_DATA_PATH = join(__dir, '..', 'tierData.json');

function writeTierData(discordId: string, mode: string, tier: string): void {
  let data: Record<string, Record<string, string>> = {};
  if (existsSync(TIER_DATA_PATH)) {
    try { data = JSON.parse(readFileSync(TIER_DATA_PATH, 'utf-8')); } catch { data = {}; }
  }
  if (!data[discordId]) data[discordId] = {};
  data[discordId][mode] = tier;
  writeFileSync(TIER_DATA_PATH, JSON.stringify(data, null, 2));
}

client.login('MTQ4MjM5NzM4MTE1NTYyMzAxNg.G7D6iH.frpS8-CkITiYbMoQqvOMPeXfpOhROhNZD05JEo');


if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN is not set');

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

// ─── Registration Pending Map ─────────────────────────────────────────────────

interface PendingReg {
  mcUsername: string;
  region: string;
  channelId: string;
  promptMsgId: string;
  resolve: (skinUrl: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRegistrations = new Map<string, PendingReg>();

export const REGISTER_MODAL_ID = 'register_modal';
export const REG_INPUT_MC      = 'reg_mc_username';
export const REG_INPUT_REGION  = 'reg_region';
export const REG_SKIP_PREFIX   = 'reg_skip';

// ─── Tier / Role Constants ─────────────────────────────────────────────────────

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

// ─── Role Helpers ─────────────────────────────────────────────────────────────

async function findOrCreateRole(guild: Guild, roleName: string, color: number): Promise<Role> {
  const existing = guild.roles.cache.find(r => r.name === roleName);
  if (existing) return existing;
  return guild.roles.create({ name: roleName, color, reason: 'Auto-created by Tier Test Bot' });
}

async function getOrCreateUnrankedRole(guild: Guild): Promise<Role> {
  const config = getConfig();
  if (config.unrankedRoleId) {
    const existing = guild.roles.cache.get(config.unrankedRoleId);
    if (existing) return existing;
  }
  const role = await guild.roles.create({
    name: 'Unranked',
    color: 0x99aab5,
    reason: 'Auto-created by Tier Test Bot (Unranked role)',
  });
  setConfig({ unrankedRoleId: role.id });
  console.log(`Auto-created Unranked role: ${role.id}`);
  return role;
}

async function getOrCreateRegisteredRole(guild: Guild): Promise<Role> {
  const config = getConfig();
  if (config.registeredRoleId) {
    const existing = guild.roles.cache.get(config.registeredRoleId);
    if (existing) return existing;
    try {
      const fetched = await guild.roles.fetch(config.registeredRoleId);
      if (fetched) return fetched;
    } catch { /* fall through */ }
  }
  await guild.roles.fetch();
  const existingByName = guild.roles.cache.find(r => r.name === 'Registered');
  if (existingByName) {
    setConfig({ registeredRoleId: existingByName.id });
    return existingByName;
  }
  const role = await guild.roles.create({
    name: 'Registered',
    color: 0x57F287,
    reason: 'Auto-created by Tier Test Bot (Registered role)',
  });
  setConfig({ registeredRoleId: role.id });
  console.log(`Auto-created Registered role: ${role.id}`);
  return role;
}

async function getOrCreateTierTesterRole(guild: Guild): Promise<Role> {
  const config = getConfig();
  if (config.tierTesterRoleId) {
    const existing = guild.roles.cache.get(config.tierTesterRoleId);
    if (existing) return existing;
  }
  const role = await guild.roles.create({
    name: 'Tier Tester',
    color: TIER_TEST_YELLOW,
    reason: 'Auto-created by Tier Test Bot (Tier Tester role)',
  });
  setConfig({ tierTesterRoleId: role.id });
  console.log(`Auto-created Tier Tester role: ${role.id}`);
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
    }
  }
  return removed;
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

// ─── Registration Helpers ──────────────────────────────────────────────────────

async function getOrCreateMcUsernameRole(guild: Guild, mcUsername: string): Promise<Role> {
  await guild.roles.fetch();
  const existing = guild.roles.cache.find(r => r.name === mcUsername);
  if (existing) return existing;
  return guild.roles.create({
    name: mcUsername,
    color: 0x5865F2,
    reason: `MC username role for registered player ${mcUsername}`,
  });
}

async function renderAndSaveSkin(discordId: string, skinUrl: string | null): Promise<void> {
  try {
    mkdirSync(RENDERED_SKINS_DIR, { recursive: true });
    let skinBuffer: Buffer | null = null;
    if (skinUrl) {
      try {
        const resp = await fetch(skinUrl, { signal: AbortSignal.timeout(12_000) });
        if (resp.ok) skinBuffer = Buffer.from(await resp.arrayBuffer());
      } catch { /* fall through to default */ }
    }
    const rendered = await renderMinecraftSkin(skinBuffer, 'bust');
    const outPath  = join(RENDERED_SKINS_DIR, `${discordId}.png`);
    writeFileSync(outPath, rendered);
    updateRenderedSkinPath(discordId, outPath);
    console.log(`[skin] Rendered and saved for ${discordId}`);
  } catch (err) {
    console.error(`[skin] Render failed for ${discordId}:`, err);
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

  renderAndSaveSkin(discordId, skinUrl).catch(err =>
    console.error('[skin] Background render error:', err),
  );

  let member: GuildMember;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    console.error(`Could not fetch member ${discordId} during registration completion`);
    return;
  }

  const registeredRole = await getOrCreateRegisteredRole(guild);
  const mcRole         = await getOrCreateMcUsernameRole(guild, mcUsername);

  if (!member.roles.cache.has(registeredRole.id)) {
    await member.roles.add(registeredRole, 'Player registered');
  }
  if (!member.roles.cache.has(mcRole.id)) {
    await member.roles.add(mcRole, `MC username: ${mcUsername}`);
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

  const channel = interaction.channel as TextChannel | null;
  if (!channel) {
    await completeRegistration(guild, interaction.user.id, mcUsername, region, null);
    await interaction.editReply(
      `✅ Registered as **\`${mcUsername}\`** (${region})! Use \`/skin-change\` to upload your custom skin.`,
    );
    return;
  }

  const skipRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REG_SKIP_PREFIX}:${interaction.user.id}`)
      .setLabel('⏭️ Skip — use default skin')
      .setStyle(ButtonStyle.Secondary),
  );

  try {
    await channel.permissionOverwrites.edit(interaction.user.id, {
      SendMessages: true,
      AttachFiles:  true,
    });
  } catch { /* bot may lack MANAGE_CHANNEL permission */ }

  let promptMsg: Message;
  try {
    promptMsg = await channel.send({
      content:
        `<@${interaction.user.id}> **Step 2 of 2 — Skin Upload**\n` +
        `Please attach your **Minecraft skin PNG** file as a message in this channel.\n` +
        `You have **1 minute**, or click **Skip** to use the default Steve skin.\n` +
        `⚠️ Only image attachments are accepted — text messages will be auto-deleted.\n` +
        `> Username locked as \`${mcUsername}\` · Region: \`${region}\``,
      components: [skipRow],
    });
  } catch {
    try { await channel.permissionOverwrites.delete(interaction.user.id); } catch { /* ignored */ }
    await completeRegistration(guild, interaction.user.id, mcUsername, region, null);
    await interaction.editReply(
      `✅ Registered as **\`${mcUsername}\`** (${region})! Use \`/skin-change\` to set a custom skin.`,
    );
    return;
  }

  await interaction.editReply('⏳ Waiting for your skin upload or Skip in the channel…');

  const skinUrl = await new Promise<string | null>(resolve => {
    const timer = setTimeout(() => {
      const p = pendingRegistrations.get(interaction.user.id);
      if (p) {
        pendingRegistrations.delete(interaction.user.id);
        resolve(null);
      }
    }, 60_000);

    pendingRegistrations.set(interaction.user.id, {
      mcUsername,
      region,
      channelId: channel.id,
      promptMsgId: promptMsg.id,
      resolve,
      timer,
    });
  });

  try { await channel.permissionOverwrites.delete(interaction.user.id); } catch { /* ignored */ }
  try { await promptMsg.delete(); } catch { /* ignored */ }

  await completeRegistration(guild, interaction.user.id, mcUsername, region, skinUrl);

  const skinLabel = skinUrl ? 'your uploaded skin' : 'the default skin (Steve)';
  await interaction.editReply(
    `✅ Registration complete!\n` +
    `**Minecraft Username:** \`${mcUsername}\`\n` +
    `**Region:** \`${region}\`\n` +
    `**Skin:** ${skinLabel}\n\n` +
    `You've been given the **Registered** role and a role named after your MC username.\n` +
    `Use \`/skin-change\` any time to update your skin.`,
  );
}

// ─── /skin-change Command ─────────────────────────────────────────────────────

async function handleSkinChange(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const reg = getRegistrationByDiscordId(interaction.user.id);
  if (!reg) {
    await interaction.editReply('❌ You must be registered first. Use `/register` to register.');
    return;
  }

  const config = getConfig();
  const member = interaction.member as GuildMember;
  const isRegistered = config.registeredRoleId
    ? member.roles.cache.has(config.registeredRoleId)
    : true;

  if (!isRegistered) {
    await interaction.editReply('❌ You must have the **Registered** role to use this command.');
    return;
  }

  const reset      = interaction.options.getString('reset');
  const attachment = interaction.options.getAttachment('skin');

  if (reset === 'yes') {
    updateSkin(interaction.user.id, null);
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

  if (!attachment.contentType?.startsWith('image/')) {
    await interaction.editReply('❌ The attached file must be an image (PNG). Please try again.');
    return;
  }

  updateSkin(interaction.user.id, attachment.url);
  renderAndSaveSkin(interaction.user.id, attachment.url).catch(err =>
    console.error('[skin] /skin-change render error:', err),
  );
  await interaction.editReply(
    `✅ Skin updated for **\`${reg.mcUsername}\`**!\n` +
    `Your new skin will appear in future result embeds.`,
  );
}

// ─── /result Autocomplete ─────────────────────────────────────────────────────

async function handleResultAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const all = getAllRegistrations();
  const choices = all
    .filter(r => r.mcUsername.toLowerCase().startsWith(focusedValue))
    .slice(0, 25)
    .map(r => ({ name: `${r.mcUsername} (${r.region})`, value: r.mcUsername }));
  await interaction.respond(choices);
}

// ─── /result Command ─────────────────────────────────────────────────────────

async function handleResult(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getConfig();

  const member = interaction.member as GuildMember;
  const hasTesterRole = config.tierTesterRoleId
    ? member.roles.cache.has(config.tierTesterRoleId)
    : false;
  const hasManageRoles = member.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!hasTesterRole && !hasManageRoles) {
    await interaction.editReply('❌ Only Tier Testers can use this command.');
    return;
  }

  const resultsChannelId =
    config.resultsChannelId || process.env['DISCORD_RESULTS_CHANNEL_ID'] || '1482385104113373244';

  const mcUsername = interaction.options.getString('player', true).trim();
  const tester     = interaction.options.getUser('tester', true);
  const mode       = interaction.options.getString('game-mode', true);
  const previous   = interaction.options.getString('previous-tier', true);
  const earned     = interaction.options.getString('earned-tier', true);

  const reg = getRegistrationByMcUsername(mcUsername);
  if (!reg) {
    await interaction.editReply(
      `❌ No registered player found with Minecraft username **\`${mcUsername}\`**.\n` +
      `Only registered players can receive results. Ask them to use \`/register\` first.`,
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

  const { emoji, label } = getRankChange(previous, earned);
  const color            = getTierColor(earned);

  const renderedSkinPath = join(RENDERED_SKINS_DIR, `${reg.discordId}.png`);
  const hasSkin          = existsSync(renderedSkinPath);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Tier Test Result — ${label}`)
    .setColor(color)
    .setAuthor({ name: `Tested by ${tester.username}`, iconURL: tester.displayAvatarURL({ size: 256 }) })
    .setThumbnail(hasSkin ? 'attachment://skin.png' : (reg.skinUrl ?? null))
    .addFields(
      { name: '👤 Tested Player', value: `<@${reg.discordId}>`, inline: true },
      { name: '🎮 IGN',           value: `\`${mcUsername}\``,   inline: true },
      { name: '🌍 Region',        value: reg.region,            inline: true },
      { name: '🧪 Tester',        value: `<@${tester.id}>`,    inline: true },
      { name: '⚔️ Game Mode',     value: mode,                  inline: true },
      { name: '📋 Previous Tier', value: `**${previous}**`,    inline: true },
      { name: '🏆 Earned Tier',   value: `**${earned}**`,      inline: true },
    )
    .setFooter({ text: 'Tier Test System' })
    .setTimestamp();

  const files: AttachmentBuilder[] = hasSkin
    ? [new AttachmentBuilder(readFileSync(renderedSkinPath), { name: 'skin.png' })]
    : [];

  try {
    const channel = await client.channels.fetch(resultsChannelId);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply(
        '❌ Results channel not found. Use `/set-results-channel` to configure it.',
      );
      return;
    }
    await (channel as TextChannel).send({ embeds: [embed], files });
  } catch (err) {
    console.error('Failed to post result embed:', err);
    await interaction.editReply(
      '❌ Failed to post result. Check the bot has access to the results channel.',
    );
    return;
  }

  incrementTesterStat(tester.id);
  scheduleTesterListRefresh(client);

  const roleResult = await assignTierRole(guild, reg.discordId, mode, earned, color);
  if ('error' in roleResult) {
    await interaction.editReply(`✅ Result posted! ⚠️ Role assignment failed: ${roleResult.error}`);
    return;
  }

  const { member: updatedMember, assigned, removed } = roleResult;
  writeTierData(reg.discordId, mode, earned);
  const titleName  = await assignTitleRole(guild, updatedMember);
  const totalPoints = getMemberPoints(updatedMember);
  scheduleLeaderboardRefresh(client);

  let msg = `✅ Result posted! Assigned **${assigned}** to \`${mcUsername}\` (<@${reg.discordId}>).\n`;
  msg    += `🏆 Title: **${titleName}** (${totalPoints} pts)`;
  if (removed.length > 0) msg += `\nRemoved: ${removed.map(r => `**${r}**`).join(', ')}.`;
  await interaction.editReply(msg);
}

// ─── Admin Command Handlers ───────────────────────────────────────────────────

async function handleSetResultsChannel(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);
  setConfig({ resultsChannelId: channel.id });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Results Channel Set')
      .setDescription(`Tier test results will now be posted in <#${channel.id}>.`)],
    ephemeral: true,
  });
}

async function handleSetTierTesterRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  setConfig({ tierTesterRoleId: role.id });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Tier Tester Role Set')
      .setDescription(`<@&${role.id}> is now the Tier Tester role.`)],
    ephemeral: true,
  });
  const config = getConfig();
  if (config.tierTestChannelId) await postTierTestPanel(interaction.guild!, config.tierTestChannelId);
  if (config.currentTesterChannelId) await postTesterListPanel(interaction.guild!, config.currentTesterChannelId);
}

async function handleSetTierTestChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  setConfig({ tierTestChannelId: channel.id });
  try {
    await postTierTestPanel(interaction.guild!, channel.id);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Tier Test Channel Set')
        .setDescription(`The tier test panel has been posted in <#${channel.id}>.`)],
    });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post panel: ${err.message}`);
  }
}

async function handleSetCurrentTesterChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  setConfig({ currentTesterChannelId: channel.id });
  try {
    await postTesterListPanel(interaction.guild!, channel.id);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Current Tester Channel Set')
        .setDescription(`The tier tester list has been posted in <#${channel.id}>.`)],
    });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post tester list: ${err.message}`);
  }
}

async function handleSetUnrankedRole(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  setConfig({ unrankedRoleId: role.id });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Unranked Role Set')
      .setDescription(`<@&${role.id}> is now the Unranked role.`)],
    ephemeral: true,
  });
}

async function handleSetLeaderboardChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  setConfig({ leaderboardChannelId: channel.id });
  try {
    await postLeaderboardPanel(interaction.guild!, channel.id);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Leaderboard Channel Set')
        .setDescription(`The leaderboard has been posted in <#${channel.id}>.`)],
    });
  } catch (err: any) {
    await interaction.editReply(`❌ Failed to post leaderboard: ${err.message}`);
  }
}

async function handleClearTierTest(interaction: ChatInputCommandInteraction) {
  const tester = interaction.options.getUser('tester', true);
  clearTesterStat(tester.id);
  scheduleTesterListRefresh(client);
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ Test Count Cleared')
      .setDescription(`<@${tester.id}>'s tier test count has been reset to **0**.`)],
    ephemeral: true,
  });
}

async function handleClearUser(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guild  = interaction.guild!;
  const target = interaction.options.getUser('user', true);

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
  }

  const unrankedRole = await getOrCreateUnrankedRole(guild);
  if (!member.roles.cache.has(unrankedRole.id)) {
    await member.roles.add(unrankedRole, 'Cleared by /clear-user');
  }

  member = await guild.members.fetch(target.id);
  await assignTitleRole(guild, member);
  scheduleLeaderboardRefresh(client);

  let desc = `All tier roles removed from <@${target.id}>. They now have the **Unranked** role and **Novice** title.`;
  if (removed.length > 0) desc += `\n\nRemoved: ${removed.map(r => `\`${r}\``).join(', ')}`;
  if (testerCleared) desc += `\n\nTest count reset to **0**.`;

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(TIER_TEST_YELLOW).setTitle('✅ User Cleared').setDescription(desc)],
  });
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

const EMOJIS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'emojis');
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
        .setFooter({ text: 'Saved — emojis now appear in leaderboard & tester messages.' }),
    ],
  });

  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({ content: chunks[i], ephemeral: true });
  }
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
        skinChangeCommand.toJSON(),
        resultCommand.toJSON(),
        setResultsChannelCommand.toJSON(),
        setTierTesterRoleCommand.toJSON(),
        setTierTestChannelCommand.toJSON(),
        setCurrentTesterChannelCommand.toJSON(),
        setUnrankedRoleCommand.toJSON(),
        clearTierTestCommand.toJSON(),
        clearUserCommand.toJSON(),
        setLeaderboardChannelCommand.toJSON(),
      ],
    });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user!.tag}`);
  await registerCommands(client.user!.id);
  setInterval(() => refreshTierTestPanel(client),    10 * 60 * 1000);
  setInterval(() => refreshTesterListPanel(client),  10 * 60 * 1000);
  setInterval(() => refreshLeaderboardPanel(client), 10 * 60 * 1000);
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
  if (!config.tierTesterRoleId || !config.tierTestChannelId) return;
  const member = newPresence?.member;
  if (!member) return;
  if (member.roles.cache.has(config.tierTesterRoleId)) schedulePanelRefresh(client);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const config = getConfig();
  const guild  = newMember.guild;

  if (config.tierTesterRoleId) {
    const hadTesterRole = oldMember.roles.cache.has(config.tierTesterRoleId);
    const hasTesterRole = newMember.roles.cache.has(config.tierTesterRoleId);
    if (hadTesterRole !== hasTesterRole) {
      if (config.tierTestChannelId) schedulePanelRefresh(client);
      scheduleTesterListRefresh(client);
    }
    if (hasTesterRole) {
      const oldCount = oldMember.roles.cache.filter(r => isTierRoleNameForTesterList(r.name)).size;
      const newCount = newMember.roles.cache.filter(r => isTierRoleNameForTesterList(r.name)).size;
      if (oldCount !== newCount) scheduleTesterListRefresh(client);
    }
  }

  const oldTierCount = oldMember.roles.cache.filter(r => isTierRoleName(r.name)).size;
  const newTierCount = newMember.roles.cache.filter(r => isTierRoleName(r.name)).size;
  if (oldTierCount !== newTierCount) {
    try { await assignTitleRole(guild, newMember as GuildMember); } catch (err) {
      console.error('Failed to reassign title on role update:', err);
    }
    scheduleLeaderboardRefresh(client);
  }
});

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  const pending = pendingRegistrations.get(message.author.id);
  if (!pending) return;
  if (message.channelId !== pending.channelId) return;

  const attachment = message.attachments.first();

  if (!attachment || !attachment.contentType?.startsWith('image/')) {
    try { await message.delete(); } catch { /* no permission */ }
    return;
  }

  clearTimeout(pending.timer);
  pendingRegistrations.delete(message.author.id);

  try {
    const ch = message.channel as TextChannel;
    await ch.permissionOverwrites.delete(message.author.id);
  } catch { /* ignored */ }

  pending.resolve(attachment.url);
});

client.on('error', err => console.error('[Discord Client Error]', err));

client.on('interactionCreate', async interaction => {
  try {
    // ── Autocomplete ────────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'result') return handleResultAutocomplete(interaction);
      return;
    }

    // ── Slash commands ──────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'upload')                     return await handleUploadEmoji(interaction);
      if (interaction.commandName === 'register')                   return await handleRegisterCommand(interaction);
      if (interaction.commandName === 'skin-change')                return await handleSkinChange(interaction);
      if (interaction.commandName === 'result')                     return await handleResult(interaction);
      if (interaction.commandName === 'set-results-channel')        return await handleSetResultsChannel(interaction);
      if (interaction.commandName === 'set-tier-tester-role')       return await handleSetTierTesterRole(interaction);
      if (interaction.commandName === 'set-tiertest-channel')       return await handleSetTierTestChannel(interaction);
      if (interaction.commandName === 'set-current-tester-channel') return await handleSetCurrentTesterChannel(interaction);
      if (interaction.commandName === 'set-unranked-role')          return await handleSetUnrankedRole(interaction);
      if (interaction.commandName === 'set-leaderboard-channel')    return await handleSetLeaderboardChannel(interaction);
      if (interaction.commandName === 'clear-tier-test')            return await handleClearTierTest(interaction);
      if (interaction.commandName === 'clear-user')                 return await handleClearUser(interaction);
      return;
    }

    // ── Buttons ─────────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === BUTTON_ID)        return await handleStartButton(interaction);
      if (id === CLOSE_TICKET_ID)  return await handleCloseTicket(interaction);
      if (id === DELETE_TICKET_ID) return await handleDeleteTicket(interaction);
      if (id === APPLY_TESTER_ID)  return await handleApplyTesterButton(interaction);

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

      if (id.startsWith(`${REG_SKIP_PREFIX}:`)) {
        const userId  = id.split(':')[1];
        const pending = pendingRegistrations.get(userId);
        if (interaction.user.id !== userId) {
          await interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
          return;
        }
        if (pending) {
          clearTimeout(pending.timer);
          pendingRegistrations.delete(userId);
          pending.resolve(null);
          try {
            const ch = await client.channels.fetch(pending.channelId);
            if (ch && 'permissionOverwrites' in ch) {
              await (ch as TextChannel).permissionOverwrites.delete(userId);
            }
          } catch { /* ignored */ }
        }
        await interaction.reply({ content: '⏭️ Skipped! Using the default skin.', ephemeral: true });
        return;
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

    // ── Modals ───────────────────────────────────────────────────────────────────
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
