import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getConfig } from './config.js';
import { COUNTRY_OPTIONS, getCountryOption } from './countryZones.js';
import { getRegistrationByDiscordId } from './registration.js';
import {
  createDirectTicketChannel,
  createQueueChannel,
  isStaffOrAdmin,
  isTester,
  markTestScheduleNotified,
  parseTicketTopic,
  parseTierTestTopic,
  setTestSchedule,
} from './queue.js';

export const QUEUE_PREF_NOW_PREFIX = 'queue_pref_now';
export const QUEUE_PREF_SET_PREFIX = 'queue_pref_set';
export const QUEUE_COUNTRY_PREFIX = 'queue_pref_country';
export const QUEUE_COUNTRY_PAGE_PREFIX = 'queue_pref_page';
export const QUEUE_TIME_MODAL_PREFIX = 'queue_pref_modal';
export const QUEUE_TIME_CONFIRM_PREFIX = 'queue_pref_confirm';
export const QUEUE_TIME_CANCEL_PREFIX = 'queue_pref_cancel';

export const TEST_TIME_NOW_ID = 'testtime_now';
export const TEST_TIME_PREFERRED_ID = 'testtime_preferred';
export const TEST_TIME_SELECT_ID = 'testtime_select';
export const TEST_TIME_COUNTRY_PREFIX = 'testtime_country';
export const TEST_TIME_COUNTRY_PAGE_PREFIX = 'testtime_page';
export const TEST_TIME_MODAL_PREFIX = 'testtime_modal';
export const TEST_TIME_CONFIRM_PREFIX = 'testtime_confirm';
export const TEST_TIME_CANCEL_PREFIX = 'testtime_cancel';

const PAGE_SIZE = 25;
const DATE_INPUT = 'test_date';
const TIME_INPUT = 'test_time';

function countryPageCount(): number {
  return Math.ceil(COUNTRY_OPTIONS.length / PAGE_SIZE);
}

function buildCountryPickerRows(
  customId: string,
  previousId: string,
  nextId: string,
  page: number,
): [
  ActionRowBuilder<StringSelectMenuBuilder>,
  ActionRowBuilder<ButtonBuilder>,
] {
  const countries = COUNTRY_OPTIONS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(`Select your country · page ${page + 1}/${countryPageCount()}`)
    .addOptions(countries.map(country => ({
      label: country.name.slice(0, 100),
      value: country.code,
      description: `Time zone used: ${country.timeZone}`.slice(0, 100),
    })));
  const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(previousId)
      .setLabel('Previous countries')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(nextId)
      .setLabel('More countries')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= countryPageCount() - 1),
  );
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), navigation];
}

function buildDateTimeModal(customId: string, countryCode: string): ModalBuilder {
  const country = getCountryOption(countryCode);
  const date = new TextInputBuilder()
    .setCustomId(DATE_INPUT)
    .setLabel('Date (YYYY-MM-DD)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2026-12-31')
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(10);
  const time = new TextInputBuilder()
    .setCustomId(TIME_INPUT)
    .setLabel('Time in 24-hour format (HH:mm)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('18:30')
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(5);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(`Test time · ${country?.code ?? countryCode}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(date),
      new ActionRowBuilder<TextInputBuilder>().addComponents(time),
    );
}

export function localDateTimeToUnix(dateText: string, timeText: string, timeZone: string): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeText);
  if (!dateMatch || !timeMatch) {
    throw new Error('Enter a valid date as YYYY-MM-DD and a 24-hour time as HH:mm (for example, 18:30).');
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const target = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const calendarDate = new Date(targetUtc);
  if (
    calendarDate.getUTCFullYear() !== target.year ||
    calendarDate.getUTCMonth() + 1 !== target.month ||
    calendarDate.getUTCDate() !== target.day
  ) {
    throw new Error('That calendar date is not valid. Check the year, month, and day.');
  }

  let candidate = targetUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const values = Object.fromEntries(
      formatter.formatToParts(new Date(candidate))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const observedUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
    const difference = targetUtc - observedUtc;
    candidate += difference;
    if (difference === 0) break;
  }

  const verified = Object.fromEntries(
    formatter.formatToParts(new Date(candidate))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  if (
    verified.year !== target.year ||
    verified.month !== target.month ||
    verified.day !== target.day ||
    verified.hour !== target.hour ||
    verified.minute !== target.minute
  ) {
    throw new Error('That local time does not exist because of a time-zone clock change. Choose another time.');
  }
  if (candidate <= Date.now()) throw new Error('Choose a future date and time.');
  return Math.floor(candidate / 1000);
}

function formatScheduledTime(timestamp: number, countryCode: string): string {
  const country = getCountryOption(countryCode);
  return `<t:${timestamp}:D> · <t:${timestamp}:t> (${country?.name ?? countryCode})`;
}

function parseQueuePreferenceId(customId: string, prefix: string): { gameMode: string; aimingTier: string } | null {
  const [actualPrefix, gameMode, aimingTier] = customId.split(':');
  if (actualPrefix !== prefix || !gameMode || !aimingTier) return null;
  return { gameMode, aimingTier };
}

function getTestSession(channel: TextChannel) {
  const topic = channel.topic ?? '';
  const tierTest = parseTierTestTopic(topic);
  if (tierTest) {
    return {
      playerId: tierTest.playerId,
      testerId: tierTest.testerId || tierTest.scheduledBy,
      preferredAt: tierTest.preferredAt,
      preferredCountry: tierTest.preferredCountry,
      scheduledAt: tierTest.scheduledAt,
    };
  }
  const ticket = parseTicketTopic(topic);
  if (ticket) {
    return {
      playerId: ticket.playerId,
      testerId: ticket.testerId ?? ticket.scheduledBy,
      preferredAt: ticket.preferredAt,
      preferredCountry: ticket.preferredCountry,
      scheduledAt: ticket.scheduledAt,
    };
  }
  return null;
}

function canTesterSchedule(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
  session: NonNullable<ReturnType<typeof getTestSession>>,
): boolean {
  const member = interaction.member as GuildMember;
  const isStaff = isStaffOrAdmin(member);
  const hasTesterRole = isTester(member);
  const assignedTester = session.testerId;
  return isStaff || (hasTesterRole && (!assignedTester || assignedTester === interaction.user.id));
}

function buildConfirmRows(confirmId: string, cancelId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function handleQueuePreferenceNow(interaction: ButtonInteraction): Promise<void> {
  const selected = parseQueuePreferenceId(interaction.customId, QUEUE_PREF_NOW_PREFIX);
  if (!selected) return;
  const guild = interaction.guild;
  const registration = getRegistrationByDiscordId(interaction.user.id);
  if (!guild || !registration) {
    await interaction.reply({ content: '❌ Please register before joining a test queue.', ephemeral: true });
    return;
  }
  await interaction.deferUpdate();
  const config = getConfig();
  if (config.queueEnabled === false) {
    await createDirectTicketChannel(
      interaction,
      guild,
      selected.gameMode,
      interaction.user.id,
      registration.mcUsername,
      registration.region,
      selected.aimingTier,
    );
  } else {
    await createQueueChannel(
      interaction,
      guild,
      selected.gameMode,
      interaction.user.id,
      registration.mcUsername,
      registration.region,
      selected.aimingTier,
    );
  }
}

export async function handleQueuePreferenceSet(interaction: ButtonInteraction): Promise<void> {
  const selected = parseQueuePreferenceId(interaction.customId, QUEUE_PREF_SET_PREFIX);
  if (!selected) return;
  await interaction.update({
    content: 'Choose your country. The selected country’s primary time zone will be used. Enter the date and time in 24-hour format.',
    components: buildCountryPickerRows(
      `${QUEUE_COUNTRY_PREFIX}:${selected.gameMode}:${selected.aimingTier}:0`,
      `${QUEUE_COUNTRY_PAGE_PREFIX}:${selected.gameMode}:${selected.aimingTier}:0`,
      `${QUEUE_COUNTRY_PAGE_PREFIX}:${selected.gameMode}:${selected.aimingTier}:1`,
      0,
    ),
  });
}

export async function handleQueueCountryPage(interaction: ButtonInteraction): Promise<void> {
  const [, gameMode, aimingTier, pageText] = interaction.customId.split(':');
  const page = Number(pageText);
  if (!gameMode || !aimingTier || !Number.isInteger(page) || page < 0 || page >= countryPageCount()) return;
  const previous = Math.max(0, page - 1);
  const next = Math.min(countryPageCount() - 1, page + 1);
  await interaction.update({
    content: 'Choose your country. The selected country’s primary time zone will be used. Enter the date and time in 24-hour format.',
    components: buildCountryPickerRows(
      `${QUEUE_COUNTRY_PREFIX}:${gameMode}:${aimingTier}:${page}`,
      `${QUEUE_COUNTRY_PAGE_PREFIX}:${gameMode}:${aimingTier}:${previous}`,
      `${QUEUE_COUNTRY_PAGE_PREFIX}:${gameMode}:${aimingTier}:${next}`,
      page,
    ),
  });
}

export async function handleQueueCountrySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, gameMode, aimingTier] = interaction.customId.split(':');
  const countryCode = interaction.values[0];
  if (!gameMode || !aimingTier || !getCountryOption(countryCode)) return;
  await interaction.showModal(buildDateTimeModal(
    `${QUEUE_TIME_MODAL_PREFIX}:${interaction.user.id}:${gameMode}:${aimingTier}:${countryCode}`,
    countryCode,
  ));
}

export async function handleQueueTimeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, ownerId, gameMode, aimingTier, countryCode] = interaction.customId.split(':');
  const country = getCountryOption(countryCode);
  if (ownerId !== interaction.user.id || !country) {
    await interaction.reply({ content: '❌ This time form is no longer valid. Start again from the queue panel.', ephemeral: true });
    return;
  }

  let timestamp: number;
  try {
    timestamp = localDateTimeToUnix(
      interaction.fields.getTextInputValue(DATE_INPUT).trim(),
      interaction.fields.getTextInputValue(TIME_INPUT).trim(),
      country.timeZone,
    );
  } catch (error) {
    await interaction.reply({
      content: `❌ ${error instanceof Error ? error.message : 'Could not read that date and time.'}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content:
      `Confirm your preferred test time: **${formatScheduledTime(timestamp, countryCode)}**\n` +
      `This is a one-time appointment; Discord will show the same instant in each viewer’s local time.`,
    components: buildConfirmRows(
      `${QUEUE_TIME_CONFIRM_PREFIX}:${ownerId}:${gameMode}:${aimingTier}:${timestamp}:${countryCode}`,
      `${QUEUE_TIME_CANCEL_PREFIX}:${ownerId}`,
    ),
    ephemeral: true,
  });
}

export async function handleQueueTimeCancel(interaction: ButtonInteraction): Promise<void> {
  const [, ownerId] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: '❌ This confirmation belongs to another player.', ephemeral: true });
    return;
  }
  await interaction.update({ content: 'Time selection cancelled. You have not joined the queue.', components: [] });
}

export async function handleQueueTimeConfirm(interaction: ButtonInteraction): Promise<void> {
  const [, ownerId, gameMode, aimingTier, timestampText, countryCode] = interaction.customId.split(':');
  const timestamp = Number(timestampText);
  const country = getCountryOption(countryCode);
  const guild = interaction.guild;
  const registration = getRegistrationByDiscordId(interaction.user.id);
  if (ownerId !== interaction.user.id || !country || !Number.isFinite(timestamp) || !guild || !registration) {
    await interaction.reply({ content: '❌ This confirmation is no longer valid. Please start again.', ephemeral: true });
    return;
  }
  if (timestamp <= Math.floor(Date.now() / 1000)) {
    await interaction.update({ content: '❌ That time has passed. Please choose a future date and time.', components: [] });
    return;
  }
  await interaction.deferUpdate();
  const config = getConfig();
  if (config.queueEnabled === false) {
    await createDirectTicketChannel(
      interaction,
      guild,
      gameMode,
      interaction.user.id,
      registration.mcUsername,
      registration.region,
      aimingTier,
      timestamp,
      countryCode,
    );
  } else {
    await createQueueChannel(
      interaction,
      guild,
      gameMode,
      interaction.user.id,
      registration.mcUsername,
      registration.region,
      aimingTier,
      timestamp,
      countryCode,
    );
  }
}

async function showTicketCountryPicker(
  interaction: ButtonInteraction,
  page = 0,
  promptMessageId = interaction.message.id,
): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const session = getTestSession(channel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }
  const previous = Math.max(0, page - 1);
  const next = Math.min(countryPageCount() - 1, page + 1);
  await interaction.reply({
    content: 'Choose the country for the test time. The country’s primary time zone will be used; enter the date and time in 24-hour format.',
    components: buildCountryPickerRows(
      `${TEST_TIME_COUNTRY_PREFIX}:${channel.id}:${interaction.user.id}:${promptMessageId}:${page}`,
      `${TEST_TIME_COUNTRY_PAGE_PREFIX}:${channel.id}:${interaction.user.id}:${promptMessageId}:${previous}`,
      `${TEST_TIME_COUNTRY_PAGE_PREFIX}:${channel.id}:${interaction.user.id}:${promptMessageId}:${next}`,
      page,
    ),
    ephemeral: true,
  });
}

export async function handleTestTimeCountryPage(interaction: ButtonInteraction): Promise<void> {
  const [, channelId, ownerId, promptMessageId, pageText] = interaction.customId.split(':');
  const page = Number(pageText);
  const channel = interaction.guild?.channels.cache.get(channelId);
  if (
    ownerId !== interaction.user.id ||
    !channel ||
    channel.type !== ChannelType.GuildText ||
    !Number.isInteger(page) ||
    page < 0 ||
    page >= countryPageCount()
  ) {
    await interaction.reply({ content: '❌ This country picker is no longer valid.', ephemeral: true });
    return;
  }
  const textChannel = channel as TextChannel;
  const session = getTestSession(textChannel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }
  const previous = Math.max(0, page - 1);
  const next = Math.min(countryPageCount() - 1, page + 1);
  await interaction.update({
    content: 'Choose the country for the test time. The country’s primary time zone will be used; enter the date and time in 24-hour format.',
    components: buildCountryPickerRows(
      `${TEST_TIME_COUNTRY_PREFIX}:${channelId}:${ownerId}:${promptMessageId}:${page}`,
      `${TEST_TIME_COUNTRY_PAGE_PREFIX}:${channelId}:${ownerId}:${promptMessageId}:${previous}`,
      `${TEST_TIME_COUNTRY_PAGE_PREFIX}:${channelId}:${ownerId}:${promptMessageId}:${next}`,
      page,
    ),
  });
}

export async function handleTestTimeCountrySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, channelId, ownerId, promptMessageId] = interaction.customId.split(':');
  const countryCode = interaction.values[0];
  const channel = interaction.guild?.channels.cache.get(channelId);
  if (ownerId !== interaction.user.id || !channel || channel.type !== ChannelType.GuildText || !getCountryOption(countryCode)) {
    await interaction.reply({ content: '❌ This time form is no longer valid.', ephemeral: true });
    return;
  }
  const session = getTestSession(channel as TextChannel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }
  await interaction.showModal(buildDateTimeModal(
    `${TEST_TIME_MODAL_PREFIX}:${channelId}:${ownerId}:${promptMessageId}:${countryCode}`,
    countryCode,
  ));
}

async function getTextChannel(interaction: ModalSubmitInteraction | ButtonInteraction, channelId: string): Promise<TextChannel | null> {
  const channel = interaction.guild?.channels.cache.get(channelId) ?? await interaction.guild?.channels.fetch(channelId).catch(() => null);
  return channel?.type === ChannelType.GuildText ? channel as TextChannel : null;
}

export async function handleTestTimeSelect(interaction: ButtonInteraction): Promise<void> {
  await showTicketCountryPicker(interaction);
}

async function finalizeTestTime(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  client: Client,
  channel: TextChannel,
  promptMessageId: string,
  timestamp: number,
  countryCode: string,
): Promise<void> {
  const session = getTestSession(channel);
  if (!session || !canTesterSchedule(interaction, session)) {
    const response = { content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
    return;
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    await interaction.reply({ content: '❌ The selected time is invalid.', ephemeral: true });
    return;
  }

  const scheduledChannel = await setTestSchedule(channel, timestamp, countryCode, interaction.user.id);
  const prompt = await scheduledChannel.messages.fetch(promptMessageId).catch(() => null);
  if (prompt) await prompt.delete().catch(err => console.error('[test-time] Could not remove schedule controls:', err));

  const isDue = timestamp <= Math.floor(Date.now() / 1000);
  await scheduledChannel.send({
    content: isDue
      ? `✅ **Tier test starts now** · <t:${timestamp}:t>`
      : `✅ **Tier test time confirmed** · <t:${timestamp}:D> at <t:${timestamp}:t>`,
  });
  if (isDue) {
    await deliverTestTimeReminder(client, scheduledChannel);
    const clickedPublicPrompt = interaction.isButton() && interaction.message.id === promptMessageId;
    if (clickedPublicPrompt) {
      await interaction.followUp({ content: '✅ Test time confirmed. The player and tester have been notified by DM.', ephemeral: true });
    } else if (interaction.isButton()) {
      await interaction.editReply({ content: '✅ Test time confirmed. The player and tester have been notified by DM.', components: [] });
    } else {
      await interaction.editReply({ content: '✅ Test time confirmed. The player and tester have been notified by DM.' });
    }
  } else if (interaction.isButton()) {
    const confirmation = `✅ Test time confirmed: ${formatScheduledTime(timestamp, countryCode)}. The player and tester will be DM’d when it is time.`;
    if (interaction.message.id === promptMessageId) {
      await interaction.followUp({ content: confirmation, ephemeral: true });
    } else {
      await interaction.editReply({ content: confirmation, components: [] });
    }
  } else {
    await interaction.editReply(
      `✅ Test time confirmed: ${formatScheduledTime(timestamp, countryCode)}. The player and tester will be DM’d when it is time.`,
    );
  }
}

export async function handleTestTimeNow(interaction: ButtonInteraction, client: Client): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const session = getTestSession(channel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }
  await interaction.deferUpdate();
  await finalizeTestTime(interaction, client, channel, interaction.message.id, Math.floor(Date.now() / 1000), 'UTC');
}

export async function handleTestTimePreferred(interaction: ButtonInteraction, client: Client): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const session = getTestSession(channel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }
  if (!session.preferredAt || !session.preferredCountry) {
    await interaction.reply({ content: '❌ The player did not set a preferred time. Use **Select time** instead.', ephemeral: true });
    return;
  }
  if (session.preferredAt <= Math.floor(Date.now() / 1000)) {
    await interaction.reply({ content: '❌ The player’s preferred time has passed. Use **Select time** to choose a new appointment.', ephemeral: true });
    return;
  }
  await interaction.deferUpdate();
  await finalizeTestTime(interaction, client, channel, interaction.message.id, session.preferredAt, session.preferredCountry);
}

export async function handleTestTimeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, channelId, ownerId, promptMessageId, countryCode] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id || !getCountryOption(countryCode)) {
    await interaction.reply({ content: '❌ This time form is no longer valid.', ephemeral: true });
    return;
  }
  const channel = await getTextChannel(interaction, channelId);
  if (!channel) {
    await interaction.reply({ content: '❌ The test channel could not be found.', ephemeral: true });
    return;
  }
  const session = getTestSession(channel);
  if (!session || !canTesterSchedule(interaction, session)) {
    await interaction.reply({ content: '⛔ Only the assigned tester or staff can finalize this test time.', ephemeral: true });
    return;
  }

  let timestamp: number;
  try {
    const country = getCountryOption(countryCode)!;
    timestamp = localDateTimeToUnix(
      interaction.fields.getTextInputValue(DATE_INPUT).trim(),
      interaction.fields.getTextInputValue(TIME_INPUT).trim(),
      country.timeZone,
    );
  } catch (error) {
    await interaction.reply({
      content: `❌ ${error instanceof Error ? error.message : 'Could not read that date and time.'}`,
      ephemeral: true,
    });
    return;
  }

  const confirmId = `${TEST_TIME_CONFIRM_PREFIX}:${channelId}:${ownerId}:${promptMessageId}:${timestamp}:${countryCode}`;
  const cancelId = `${TEST_TIME_CANCEL_PREFIX}:${channelId}:${ownerId}`;
  await interaction.reply({
    content:
      `Confirm the test time: **${formatScheduledTime(timestamp, countryCode)}**\n` +
      `This is a one-time appointment, displayed to each viewer in their local time.`,
    components: buildConfirmRows(confirmId, cancelId),
    ephemeral: true,
  });
}

export async function handleTestTimeCancel(interaction: ButtonInteraction): Promise<void> {
  const [, , ownerId] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: '❌ This confirmation belongs to another tester.', ephemeral: true });
    return;
  }
  await interaction.update({ content: 'Test-time selection cancelled. The schedule controls are still available in the ticket.', components: [] });
}

export async function handleTestTimeConfirm(interaction: ButtonInteraction, client: Client): Promise<void> {
  const [, channelId, ownerId, promptMessageId, timestampText, countryCode] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id || !getCountryOption(countryCode)) {
    await interaction.reply({ content: '❌ This confirmation is no longer valid.', ephemeral: true });
    return;
  }
  const channel = await getTextChannel(interaction, channelId);
  if (!channel) {
    await interaction.reply({ content: '❌ The test channel could not be found.', ephemeral: true });
    return;
  }
  if (Number(timestampText) <= Math.floor(Date.now() / 1000)) {
    await interaction.update({
      content: '❌ That time has passed. Choose another future date and time from the ticket controls.',
      components: [],
    });
    return;
  }
  await interaction.deferUpdate();
  await finalizeTestTime(interaction, client, channel, promptMessageId, Number(timestampText), countryCode);
}

async function deliverTestTimeReminder(client: Client, channel: TextChannel): Promise<void> {
  const session = getTestSession(channel);
  if (!session?.scheduledAt || !session.testerId || !session.playerId) return;
  const current = parseTierTestTopic(channel.topic ?? '') ?? parseTicketTopic(channel.topic ?? '');
  if (!current || current.notified) return;

  // Mark first so a process restart during DM delivery cannot send duplicates.
  await markTestScheduleNotified(channel);
  const recipients = Array.from(new Set([session.playerId, session.testerId]));
  const timestampText = `<t:${session.scheduledAt}:t>`;
  const message = `It’s time for the tier test (**${timestampText}**). Please start the test in <#${channel.id}>.`;
  for (const userId of recipients) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(message);
    } catch (error) {
      console.error(`[test-time] Could not DM ${userId} for channel ${channel.id}:`, error);
    }
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;
let checkingReminders = false;

export function startTestTimeScheduler(client: Client): void {
  if (reminderInterval) clearInterval(reminderInterval);
  const check = async () => {
    if (checkingReminders) return;
    checkingReminders = true;
    try {
      const now = Math.floor(Date.now() / 1000);
      for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
          if (channel.type !== ChannelType.GuildText) continue;
          const textChannel = channel as TextChannel;
          if (!textChannel.topic?.startsWith('TIERTEST|') && !textChannel.topic?.startsWith('TICKET|')) continue;
          const session = getTestSession(textChannel);
          if (!session?.scheduledAt || session.scheduledAt > now) continue;
          await deliverTestTimeReminder(client, textChannel);
        }
      }
    } catch (error) {
      console.error('[test-time] Reminder scan failed:', error);
    } finally {
      checkingReminders = false;
    }
  };
  void check();
  reminderInterval = setInterval(() => void check(), 30_000);
}

export function isSchedulingInteraction(customId: string): boolean {
  return customId.startsWith(`${QUEUE_PREF_NOW_PREFIX}:`) ||
    customId.startsWith(`${QUEUE_PREF_SET_PREFIX}:`) ||
    customId.startsWith(`${QUEUE_COUNTRY_PREFIX}:`) ||
    customId.startsWith(`${QUEUE_COUNTRY_PAGE_PREFIX}:`) ||
    customId.startsWith(`${QUEUE_TIME_CONFIRM_PREFIX}:`) ||
    customId.startsWith(`${QUEUE_TIME_CANCEL_PREFIX}:`) ||
    customId.startsWith(`${TEST_TIME_COUNTRY_PREFIX}:`) ||
    customId.startsWith(`${TEST_TIME_COUNTRY_PAGE_PREFIX}:`) ||
    customId.startsWith(`${TEST_TIME_CONFIRM_PREFIX}:`) ||
    customId.startsWith(`${TEST_TIME_CANCEL_PREFIX}:`) ||
    customId === TEST_TIME_NOW_ID ||
    customId === TEST_TIME_PREFERRED_ID ||
    customId === TEST_TIME_SELECT_ID;
}

export function isSchedulingSelect(customId: string): boolean {
  return customId.startsWith(`${QUEUE_COUNTRY_PREFIX}:`) || customId.startsWith(`${TEST_TIME_COUNTRY_PREFIX}:`);
}

export function isSchedulingModal(customId: string): boolean {
  return customId.startsWith(`${QUEUE_TIME_MODAL_PREFIX}:`) || customId.startsWith(`${TEST_TIME_MODAL_PREFIX}:`);
}

export function isQueuePreferenceButton(customId: string): boolean {
  return customId.startsWith(`${QUEUE_PREF_NOW_PREFIX}:`) || customId.startsWith(`${QUEUE_PREF_SET_PREFIX}:`);
}

export async function handleSchedulingButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const id = interaction.customId;
  if (id.startsWith(`${QUEUE_PREF_NOW_PREFIX}:`)) return handleQueuePreferenceNow(interaction);
  if (id.startsWith(`${QUEUE_PREF_SET_PREFIX}:`)) return handleQueuePreferenceSet(interaction);
  if (id.startsWith(`${QUEUE_COUNTRY_PAGE_PREFIX}:`)) return handleQueueCountryPage(interaction);
  if (id.startsWith(`${QUEUE_TIME_CONFIRM_PREFIX}:`)) return handleQueueTimeConfirm(interaction);
  if (id.startsWith(`${QUEUE_TIME_CANCEL_PREFIX}:`)) return handleQueueTimeCancel(interaction);
  if (id.startsWith(`${TEST_TIME_COUNTRY_PAGE_PREFIX}:`)) return handleTestTimeCountryPage(interaction);
  if (id.startsWith(`${TEST_TIME_CONFIRM_PREFIX}:`)) return handleTestTimeConfirm(interaction, client);
  if (id.startsWith(`${TEST_TIME_CANCEL_PREFIX}:`)) return handleTestTimeCancel(interaction);
  if (id === TEST_TIME_NOW_ID) return handleTestTimeNow(interaction, client);
  if (id === TEST_TIME_PREFERRED_ID) return handleTestTimePreferred(interaction, client);
  if (id === TEST_TIME_SELECT_ID) return handleTestTimeSelect(interaction);
}

export async function handleSchedulingSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId.startsWith(`${QUEUE_COUNTRY_PREFIX}:`)) return handleQueueCountrySelect(interaction);
  if (interaction.customId.startsWith(`${TEST_TIME_COUNTRY_PREFIX}:`)) return handleTestTimeCountrySelect(interaction);
}

export async function handleSchedulingModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  if (interaction.customId.startsWith(`${QUEUE_TIME_MODAL_PREFIX}:`)) return handleQueueTimeModal(interaction);
  if (interaction.customId.startsWith(`${TEST_TIME_MODAL_PREFIX}:`)) {
    await handleTestTimeModal(interaction);
    return;
  }
}
