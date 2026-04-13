const GUILD_ID = process.env['SERVER_ID'] ?? '';
const API_BASE = (process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000').replace(/\/$/, '');
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

export interface BotConfig {
  resultsChannelId?: string;
  staffChannelId?: string;
  tierTesterRoleId?: string;
  staffRoleId?: string;
  modRoleId?: string;
  tierTestChannelId?: string;
  tierTestMessageId?: string;
  currentTesterChannelId?: string;
  currentTesterMessageId?: string;
  unrankedRoleId?: string;
  registeredRoleId?: string;
  leaderboardChannelId?: string;
  leaderboardMessageId?: string;
  testerStats?: Record<string, number>;
  usernameChangeTimestamps?: Record<string, number>;
  titleRoleIds?: Record<string, string>;
  emojiStrings?: Record<string, string>;
}

let _memConfig: BotConfig = {};

function isConfigLike(value: unknown): value is BotConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getConfig(): BotConfig {
  return _memConfig;
}

export function setConfig(updates: Partial<BotConfig>): BotConfig {
  _memConfig = { ..._memConfig, ...updates };
  void persistConfigToApi(_memConfig);
  return _memConfig;
}

export function incrementTesterStat(userId: string): number {
  const stats = { ...(_memConfig.testerStats ?? {}) };
  stats[userId] = (stats[userId] ?? 0) + 1;
  setConfig({ testerStats: stats });
  return stats[userId];
}

export function clearTesterStat(userId: string): void {
  const stats = { ...(_memConfig.testerStats ?? {}) };
  delete stats[userId];
  setConfig({ testerStats: stats });
}

async function persistConfigToApi(config: BotConfig): Promise<void> {
  if (!GUILD_ID) return;
  try {
    const res = await fetch(`${API_BASE}/api/bot/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ guildId: GUILD_ID, config }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error('[config] Failed to persist config to API:', res.status);
    }
  } catch (err) {
    console.error('[config] Failed to persist config to API:', err);
  }
}

export async function loadConfigFromApi(): Promise<void> {
  if (!GUILD_ID) return;
  try {
    const res = await fetch(`${API_BASE}/api/bot/config/${encodeURIComponent(GUILD_ID)}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error('[config] Failed to load config from API:', res.status);
      return;
    }
    const data = await res.json();
    if (isConfigLike(data.config)) {
      _memConfig = { ..._memConfig, ...data.config };
      console.log('[config] Loaded from API successfully');
    }
  } catch (err) {
    console.error('[config] Failed to load config from API:', err);
  }
}
