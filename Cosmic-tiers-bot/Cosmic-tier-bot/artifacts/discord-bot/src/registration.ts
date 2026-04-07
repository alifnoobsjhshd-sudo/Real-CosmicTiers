import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REGISTRATIONS_PATH = join(__dir, '..', 'registrations.json');

export const DEFAULT_SKIN_PATH =
  join(__dir, '..', 'default-skin.png');

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
