import { getConfig } from './config.js';

export function sanitizeToEmojiName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32)
    .padEnd(2, '_');
}

export function parseEmojiForButton(emojiStr: string): { name: string; id: string; animated: boolean } | null {
  const animMatch = /<a:(\w+):(\d+)>/.exec(emojiStr);
  if (animMatch) return { name: animMatch[1], id: animMatch[2], animated: true };
  const staticMatch = /<:(\w+):(\d+)>/.exec(emojiStr);
  if (staticMatch) return { name: staticMatch[1], id: staticMatch[2], animated: false };
  return null;
}

export function getEmojiString(name: string): string {
  const config = getConfig();
  return config.emojiStrings?.[name] ?? '';
}

export function getGameModeEmoji(gameMode: string): string {
  if (gameMode === 'cartpvp' || gameMode === 'Cart-PvP') return getEmojiString('cartpvp') || getEmojiString('cart_pvp');
  return getEmojiString(sanitizeToEmojiName(gameMode));
}

export function getTitleEmoji(titleName: string): string {
  return getEmojiString(sanitizeToEmojiName(titleName));
}

export function formatTierWithEmoji(tierRoleName: string): string {
  const parts = tierRoleName.split(' ');
  const tier = parts[parts.length - 1];
  const gameMode = parts.slice(0, -1).join(' ');
  const emoji = getGameModeEmoji(gameMode);
  return emoji ? `${emoji} ${tier}` : `[${tierRoleName}]`;
}
