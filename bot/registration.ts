import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REGISTRATIONS_PATH = join(__dir, '..', 'bot-registrations.json');
const WEBSITE_API_URL = process.env['WEBSITE_API_URL'] ?? 'http://localhost:5000';
const INTERNAL_API_KEY = process.env['INTERNAL_API_KEY'] ?? '';

export const DEFAULT_SKIN_PATH = join(__dir, '..', 'default-skin.png');

export interface Registration {
  discordId: string;
  mcUsername: string;
  region: string;
  skinUrl: string | null;
  renderedSkinPath?: string;
  registeredAt: number;
}

interface RegistrationStore {
  byDiscordId: Record<string, Registration>;
  byMcUsername: Record<string, string>;
}

function loadStore(): RegistrationStore {
  if (!existsSync(REGISTRATIONS_PATH)) return { byDiscordId: {}, byMcUsername: {} };
  try {
    return JSON.parse(readFileSync(REGISTRATIONS_PATH, 'utf-8'));
  } catch {
    return { byDiscordId: {}, byMcUsername: {} };
  }
}

function saveStore(store: RegistrationStore): void {
  writeFileSync(REGISTRATIONS_PATH, JSON.stringify(store, null, 2));
}

export function getRegistrationByDiscordId(discordId: string): Registration | undefined {
  return loadStore().byDiscordId[discordId];
}

export function getRegistrationByMcUsername(mcUsername: string): Registration | undefined {
  const store = loadStore();
  const discordId = store.byMcUsername[mcUsername.toLowerCase()];
  if (!discordId) return undefined;
  return store.byDiscordId[discordId];
}

export function saveRegistration(reg: Registration): void {
  const store = loadStore();
  store.byDiscordId[reg.discordId] = reg;
  store.byMcUsername[reg.mcUsername.toLowerCase()] = reg.discordId;
  saveStore(store);
}

export function updateSkin(discordId: string, skinUrl: string | null): boolean {
  const store = loadStore();
  if (!store.byDiscordId[discordId]) return false;
  store.byDiscordId[discordId].skinUrl = skinUrl;
  saveStore(store);
  return true;
}

export function updateRenderedSkinPath(discordId: string, path: string): boolean {
  const store = loadStore();
  if (!store.byDiscordId[discordId]) return false;
  store.byDiscordId[discordId].renderedSkinPath = path;
  saveStore(store);
  return true;
}

export function getAllRegistrations(): Registration[] {
  return Object.values(loadStore().byDiscordId);
}

export function updateMcUsername(discordId: string, newUsername: string): { oldUsername: string } | undefined {
  const store = loadStore();
  const reg = store.byDiscordId[discordId];
  if (!reg) return undefined;
  const oldUsername = reg.mcUsername;
  delete store.byMcUsername[oldUsername.toLowerCase()];
  reg.mcUsername = newUsername;
  store.byMcUsername[newUsername.toLowerCase()] = discordId;
  saveStore(store);
  return { oldUsername };
}

export function updateRegion(discordId: string, region: string): boolean {
  const store = loadStore();
  if (!store.byDiscordId[discordId]) return false;
  store.byDiscordId[discordId].region = region;
  saveStore(store);
  return true;
}

export function deleteRegistration(discordId: string): Registration | undefined {
  const store = loadStore();
  const reg = store.byDiscordId[discordId];
  if (!reg) return undefined;
  delete store.byDiscordId[discordId];
  delete store.byMcUsername[reg.mcUsername.toLowerCase()];
  saveStore(store);
  return reg;
}

export async function loadRegistrationsFromApi(): Promise<void> {
  try {
    const res = await fetch(`${WEBSITE_API_URL.replace(/\/$/, '')}/api/bot/players`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('[registration] Failed to load from API:', res.status);
      return;
    }

    const data = await res.json();
    const players: Array<{ discordId: string; mcUsername: string; region: string; skinUrl: string | null; registeredAt: number }> = data.players ?? [];
    const store = loadStore();

    for (const p of players) {
      const previous = store.byDiscordId[p.discordId];
      if (previous) delete store.byMcUsername[previous.mcUsername.toLowerCase()];
      store.byDiscordId[p.discordId] = {
        discordId: p.discordId,
        mcUsername: p.mcUsername,
        region: p.region,
        skinUrl: p.skinUrl,
        registeredAt: p.registeredAt,
      };
      store.byMcUsername[p.mcUsername.toLowerCase()] = p.discordId;
    }

    saveStore(store);
    console.log(`[registration] Synced ${players.length} players from API`);
  } catch (err) {
    console.error('[registration] Failed to load registrations from API:', err);
  }
}
