import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKIN_PATH = join(__dir, '..', 'default-skin.png');

const WEBSITE_API_URL  = process.env['WEBSITE_API_URL']  ?? 'http://localhost:5000';
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

export interface Registration {
  discordId: string;
  mcUsername: string;
  region: string;
  skinUrl: string | null;
  renderedSkinPath?: string;
  registeredAt: number;
}

const _byDiscordId: Map<string, Registration> = new Map();
const _byMcUsername: Map<string, string>      = new Map();

export function getRegistrationByDiscordId(discordId: string): Registration | undefined {
  return _byDiscordId.get(discordId);
}

export function getRegistrationByMcUsername(mcUsername: string): Registration | undefined {
  const discordId = _byMcUsername.get(mcUsername.toLowerCase());
  if (!discordId) return undefined;
  return _byDiscordId.get(discordId);
}

export function saveRegistration(reg: Registration): void {
  _byDiscordId.set(reg.discordId, reg);
  _byMcUsername.set(reg.mcUsername.toLowerCase(), reg.discordId);
}

export function updateSkin(discordId: string, skinUrl: string | null): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  reg.skinUrl = skinUrl;
  _byDiscordId.set(discordId, reg);
  return true;
}

export function updateRenderedSkinPath(discordId: string, path: string): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  reg.renderedSkinPath = path;
  _byDiscordId.set(discordId, reg);
  return true;
}

export function updateMcUsername(discordId: string, mcUsername: string): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  _byMcUsername.delete(reg.mcUsername.toLowerCase());
  reg.mcUsername = mcUsername;
  _byDiscordId.set(discordId, reg);
  _byMcUsername.set(mcUsername.toLowerCase(), discordId);
  return true;
}

export function updateRegion(discordId: string, region: string): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  reg.region = region;
  _byDiscordId.set(discordId, reg);
  return true;
}

export function getAllRegistrations(): Registration[] {
  return Array.from(_byDiscordId.values());
}

export function deleteRegistration(discordId: string): Registration | undefined {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return undefined;
  _byDiscordId.delete(discordId);
  _byMcUsername.delete(reg.mcUsername.toLowerCase());
  return reg;
}

export async function loadRegistrationsFromApi(): Promise<void> {
  try {
    const res = await fetch(`${WEBSITE_API_URL}/api/bot/players`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('[registration] Failed to load from API:', res.status);
      return;
    }
    const data = await res.json();
    const players: Array<{ discordId: string; mcUsername: string; region: string; skinUrl: string | null; registeredAt: number }> = data.players ?? [];
    let count = 0;
    for (const p of players) {
      if (!_byDiscordId.has(p.discordId)) {
        _byDiscordId.set(p.discordId, {
          discordId: p.discordId,
          mcUsername: p.mcUsername,
          region: p.region,
          skinUrl: p.skinUrl,
          registeredAt: p.registeredAt,
        });
        _byMcUsername.set(p.mcUsername.toLowerCase(), p.discordId);
        count++;
      }
    }
    console.log(`[registration] Synced ${count} players from API (total: ${_byDiscordId.size})`);
  } catch (err) {
    console.error('[registration] Failed to load registrations from API:', err);
  }
}
