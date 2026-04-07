import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dir, '..', 'config.json');

export interface BotConfig {
  resultsChannelId?: string;
  tierTesterRoleId?: string;
  tierTestChannelId?: string;
  tierTestMessageId?: string;
  currentTesterChannelId?: string;
  currentTesterMessageId?: string;
  unrankedRoleId?: string;
  registeredRoleId?: string;
  leaderboardChannelId?: string;
  leaderboardMessageId?: string;
  testerStats?: Record<string, number>;
  titleRoleIds?: Record<string, string>;
  emojiStrings?: Record<string, string>;
}

export function getConfig(): BotConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function setConfig(updates: Partial<BotConfig>): BotConfig {
  const current = getConfig();
  const updated = { ...current, ...updates };
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  return updated;
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
