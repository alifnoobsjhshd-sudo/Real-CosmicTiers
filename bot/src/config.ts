import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const GUILD_ID = process.env['SERVER_ID'] ?? '';
const API_BASE = (process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000').replace(/\/$/, '');
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

// Local file backup so config survives even if the API is briefly unavailable
const __dir = dirname(fileURLToPath(import.meta.url));
const LOCAL_BACKUP_PATH = join(__dir, '..', 'data', 'config-backup.json');

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
  queueEnabled?: boolean;
}

let _memConfig: BotConfig = {};

// Counts every successful persistence so we can log a clear summary at startup
let _persistSuccessCount = 0;
let _persistFailCount = 0;

function isConfigLike(value: unknown): value is BotConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getConfig(): BotConfig {
  return _memConfig;
}

export function setConfig(updates: Partial<BotConfig>): BotConfig {
  _memConfig = { ..._memConfig, ...updates };
  // Persist to BOTH the local file (instant) and the API (with retry)
  saveLocalBackup(_memConfig);
  void persistConfigToApiWithRetry(_memConfig);
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

// ─── Local file backup ──────────────────────────────────────────────────────

function saveLocalBackup(config: BotConfig): void {
  try {
    const dir = dirname(LOCAL_BACKUP_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(LOCAL_BACKUP_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('[config] Failed to write local backup:', err);
  }
}

function loadLocalBackup(): BotConfig | null {
  try {
    if (!existsSync(LOCAL_BACKUP_PATH)) return null;
    const raw = readFileSync(LOCAL_BACKUP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (isConfigLike(parsed)) return parsed;
  } catch (err) {
    console.error('[config] Failed to read local backup:', err);
  }
  return null;
}

// ─── API persistence ────────────────────────────────────────────────────────

async function persistConfigToApi(config: BotConfig): Promise<boolean> {
  if (!GUILD_ID) {
    console.warn('[config] SERVER_ID env var is empty — config CANNOT be persisted to the database.');
    return false;
  }
  if (!INTERNAL_API_KEY) {
    console.warn('[config] INTERNAL_API_KEY env var is empty — API persistence will fail auth.');
  }
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
      console.error(`[config] Failed to persist config to API: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[config] Failed to persist config to API:', err);
    return false;
  }
}

// Persist with up to 3 attempts (snappy backoff). Local backup is already saved
// before this runs, so even a total API outage still survives bot restart.
async function persistConfigToApiWithRetry(config: BotConfig): Promise<void> {
  const delays = [0, 800, 2500];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
    const ok = await persistConfigToApi(config);
    if (ok) {
      _persistSuccessCount++;
      return;
    }
  }
  _persistFailCount++;
  console.error('[config] Persistence failed after retries — relying on local backup until next successful save.');
}

export async function loadConfigFromApi(): Promise<void> {
  // 1) Always load local backup FIRST so we never start blank
  const local = loadLocalBackup();
  if (local) {
    _memConfig = { ..._memConfig, ...local };
    console.log('[config] Loaded local backup successfully.');
  }

  // 2) Then overlay the database copy (source of truth across redeploys)
  if (!GUILD_ID) {
    console.warn('[config] SERVER_ID env var is empty — skipping API config load.');
    summarizeLoadedConfig();
    return;
  }
  if (!INTERNAL_API_KEY) {
    console.warn('[config] INTERNAL_API_KEY env var is empty — API load may fail.');
  }

  try {
    const res = await fetch(`${API_BASE}/api/bot/config/${encodeURIComponent(GUILD_ID)}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error(`[config] Failed to load config from API: HTTP ${res.status} — falling back to local backup.`);
      summarizeLoadedConfig();
      return;
    }
    const data = await res.json();
    if (isConfigLike(data.config) && Object.keys(data.config).length > 0) {
      _memConfig = { ..._memConfig, ...data.config };
      console.log('[config] Loaded from database (guild_config) successfully.');
      // If the API had MORE data than the local backup, sync the local backup
      saveLocalBackup(_memConfig);
    } else if (Object.keys(_memConfig).length > 0) {
      // DB was empty but we have local data — push it up so the DB matches
      console.log('[config] Database had no config — pushing local backup up.');
      void persistConfigToApiWithRetry(_memConfig);
    }
  } catch (err) {
    console.error('[config] Failed to load config from API — using local backup:', err);
  }
  summarizeLoadedConfig();
}

function summarizeLoadedConfig(): void {
  const c = _memConfig;
  console.log('[config] ── Loaded configuration summary ──');
  console.log(`[config]   leaderboardChannelId: ${c.leaderboardChannelId ?? '(unset)'}`);
  console.log(`[config]   resultsChannelId:     ${c.resultsChannelId ?? '(unset)'}`);
  console.log(`[config]   staffChannelId:       ${c.staffChannelId ?? '(unset)'}`);
  console.log(`[config]   tierTestChannelId:    ${c.tierTestChannelId ?? '(unset)'}`);
  console.log(`[config]   currentTesterChannel: ${c.currentTesterChannelId ?? '(unset)'}`);
  console.log(`[config]   staffRoleId:          ${c.staffRoleId ?? '(unset)'}`);
  console.log(`[config]   modRoleId:            ${c.modRoleId ?? '(unset)'}`);
  console.log(`[config]   tierTesterRoleId:     ${c.tierTesterRoleId ?? '(unset)'}`);
  console.log(`[config]   unrankedRoleId:       ${c.unrankedRoleId ?? '(unset)'}`);
  console.log(`[config]   registeredRoleId:     ${c.registeredRoleId ?? '(unset)'}`);
  console.log(`[config]   custom emojis:        ${Object.keys(c.emojiStrings ?? {}).length}`);
  console.log(`[config]   custom titles:        ${Object.keys(c.titleRoleIds ?? {}).length}`);
  console.log(`[config]   tester stats entries: ${Object.keys(c.testerStats ?? {}).length}`);
  console.log('[config] ───────────────────────────────────');
}

export function getPersistStats(): { ok: number; fail: number } {
  return { ok: _persistSuccessCount, fail: _persistFailCount };
}
