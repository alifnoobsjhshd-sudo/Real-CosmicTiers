import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKIN_PATH = join(__dir, '..', 'default-skin.png');

const API_BASE = (process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000').replace(/\/$/, '');
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
const _byMcUsername: Map<string, string> = new Map();

function usernameKey(mcUsername: string): string {
  return mcUsername.trim().toLowerCase();
}

function cloneRegistration(reg: Registration): Registration {
  return { ...reg };
}

function cacheRegistration(reg: Registration): void {
  const existing = _byDiscordId.get(reg.discordId);
  if (existing) _byMcUsername.delete(usernameKey(existing.mcUsername));
  const normalized: Registration = {
    discordId: reg.discordId,
    mcUsername: reg.mcUsername.trim(),
    region: reg.region.trim().toUpperCase(),
    skinUrl: reg.skinUrl ?? null,
    renderedSkinPath: reg.renderedSkinPath,
    registeredAt: reg.registeredAt,
  };
  _byDiscordId.set(normalized.discordId, normalized);
  _byMcUsername.set(usernameKey(normalized.mcUsername), normalized.discordId);
}

export function getRegistrationByDiscordId(discordId: string): Registration | undefined {
  const reg = _byDiscordId.get(discordId);
  return reg ? cloneRegistration(reg) : undefined;
}

export function getRegistrationByMcUsername(mcUsername: string): Registration | undefined {
  const discordId = _byMcUsername.get(usernameKey(mcUsername));
  if (!discordId) return undefined;
  const reg = _byDiscordId.get(discordId);
  return reg ? cloneRegistration(reg) : undefined;
}

export function saveRegistration(reg: Registration): void {
  cacheRegistration(reg);
}

export function updateSkin(discordId: string, skinUrl: string | null): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  cacheRegistration({ ...reg, skinUrl });
  return true;
}

export function updateRenderedSkinPath(discordId: string, path: string): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  cacheRegistration({ ...reg, renderedSkinPath: path });
  return true;
}

export function updateMcUsername(discordId: string, newUsername: string): { oldUsername: string } | undefined {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return undefined;
  const oldUsername = reg.mcUsername;
  cacheRegistration({ ...reg, mcUsername: newUsername });
  return { oldUsername };
}

export function updateRegion(discordId: string, region: string): boolean {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return false;
  cacheRegistration({ ...reg, region });
  return true;
}

export function getAllRegistrations(): Registration[] {
  return Array.from(_byDiscordId.values()).map(cloneRegistration);
}

export function deleteRegistration(discordId: string): Registration | undefined {
  const reg = _byDiscordId.get(discordId);
  if (!reg) return undefined;
  _byDiscordId.delete(discordId);
  _byMcUsername.delete(usernameKey(reg.mcUsername));
  return cloneRegistration(reg);
}

export async function loadRegistrationsFromApi(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/bot/players`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('[registration] Failed to load from API:', res.status);
      return;
    }
    const data = await res.json();
    const players: Array<{ discordId: string; mcUsername: string; region: string; skinUrl: string | null; registeredAt: number }> = Array.isArray(data.players) ? data.players : [];
    _byDiscordId.clear();
    _byMcUsername.clear();
    for (const p of players) {
      if (!p.discordId || !p.mcUsername || !p.region) continue;
      cacheRegistration({
        discordId: p.discordId,
        mcUsername: p.mcUsername,
        region: p.region,
        skinUrl: p.skinUrl ?? null,
        registeredAt: p.registeredAt ?? Date.now(),
      });
    }
    console.log(`[registration] Synced ${_byDiscordId.size} players from API`);
  } catch (err) {
    console.error('[registration] Failed to load registrations from API:', err);
  }
}
