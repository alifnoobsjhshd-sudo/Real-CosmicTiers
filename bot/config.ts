import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dir, '..', 'bot-config.json');
const GUILD_ID = process.env['SERVER_ID'] ?? '';
const WEBSITE_API_URL = process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000';
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

let _memConfig: BotConfig | null = null;

export function getConfig(): BotConfig {
  if (_memConfig) return _memConfig;
  if (!existsSync(CONFIG_PATH)) {
    _memConfig = {};
    return _memConfig;
  }
  try {
    _memConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return _memConfig ?? {};
  } catch {
    _memConfig = {};
    return _memConfig;
  }
}

export function setConfig(updates: Partial<BotConfig>): BotConfig {
  const current = getConfig();
  const updated = { ...current, ...updates };
  _memConfig = updated;
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  void persistConfigToApi(updated);
  return updated;
}

async function persistConfigToApi(config: BotConfig): Promise<void> {
  if (!GUILD_ID) return;
  try {
    await fetch(`${WEBSITE_API_URL.replace(/\/$/, '')}/api/bot/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ guildId: GUILD_ID, config }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    console.error('[config] Failed to persist config to API:', err);
  }
}

export async function loadConfigFromApi(): Promise<void> {
  if (!GUILD_ID) return;
  try {
    const res = await fetch(`${WEBSITE_API_URL.replace(/\/$/, '')}/api/bot/config/${GUILD_ID}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.config && typeof data.config === 'object') {
      _memConfig = { ...getConfig(), ...data.config };
      writeFileSync(CONFIG_PATH, JSON.stringify(_memConfig, null, 2));
      console.log('[config] Loaded from API successfully');
    }
  } catch (err) {
    console.error('[config] Failed to load config from API:', err);
  }
}

export function incrementTesterStat(userId: string): number {
  const config = getConfig();
  const stats = config.testerStats ?? {};
  stats[userId] = (stats[userId] ?? 0) + 1;
  setConfig({ testerStats: stats });
  return stats[userId];
}

export function clearTesterStat(userId: string): void {
  const config = getConfig();
  const stats = config.testerStats ?? {};
  delete stats[userId];
  setConfig({ testerStats: stats });
}
