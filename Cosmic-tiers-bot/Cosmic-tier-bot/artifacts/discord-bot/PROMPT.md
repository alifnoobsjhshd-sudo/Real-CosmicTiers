# Cosmic Tier Bot — Project Reference Prompt

Use this document to onboard a developer or AI agent onto the project. It describes every feature, where the code lives, and how the systems connect.

---

## What This Bot Does

This is a Discord.js bot (`Cosmic tiers#6698`) for managing competitive Minecraft PvP tier tests. Players register with their Minecraft username, upload a custom skin, and get tested by Tier Testers. Results are posted to a results channel and tier/title roles are assigned automatically.

---

## Project Location

All bot code lives in:
```
Cosmic-tier-bot/artifacts/discord-bot/
```

The bot is run via:
```bash
cd Cosmic-tier-bot && pnpm --filter @workspace/discord-bot run dev
```
Which executes `tsx src/index.ts`.

---

## Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main bot entry point. All interaction/message handlers, registration flow, result posting logic. (~1150 lines) |
| `src/commands.ts` | All slash command definitions (builders). Defines all 12 commands. |
| `src/registration.ts` | Player registration data: interface, read/write to `registrations.json`, `updateSkin`, `updateRenderedSkinPath` helpers. |
| `src/skinrender.ts` | Minecraft skin PNG renderer. Converts a flat skin PNG into a pixel-art bust (head + body + arms). Outputs a transparent-background PNG buffer. Supports `head`, `bust`, and `body` render types. |
| `src/tiertest.ts` | Tier test panel UI: panel buttons (Register, Start Tier Test), modal, ticket-style channel handling, `postTierTestPanel`, `refreshTierTestPanel`. |
| `src/leaderboard.ts` | Leaderboard embed + pagination. Shows players sorted by total tier points descending, with custom rank emojis and MC usernames. |
| `src/testerlist.ts` | Active testers panel. Lists all members with Tier Tester role and their per-game-mode tier data with game mode emojis. |
| `src/emojis.ts` | Emoji helpers: `sanitizeToEmojiName` (filename → Discord emoji name), `formatTierWithEmoji`, `getTitleEmoji`. Reads emoji strings from `config.json`. |
| `src/config.ts` | `BotConfig` interface + `getConfig`/`setConfig` helpers. Persists to `config.json`. Includes `emojiStrings`, channel IDs, role IDs. |
| `src/keep_alive.ts` | Express server on port 3000 to keep the process alive on Replit. |

---

## Data Files (bot root: `Cosmic-tier-bot/artifacts/discord-bot/`)

| File/Dir | Purpose |
|----------|---------|
| `registrations.json` | All registered player data. Keyed by Discord ID and MC username. Each entry: `discordId`, `mcUsername`, `region`, `skinUrl` (Discord CDN URL), `renderedSkinPath` (local file path), `registeredAt`. |
| `config.json` | Bot config: channel IDs for results/tier-test/leaderboard/tester-list, role IDs for registered/tier-tester/unranked, `emojiStrings` map (emoji name → Discord emoji string), panel message IDs. |
| `default-skin.png` | The default Steve skin used when a player skips skin upload or skin rendering fails. |
| `rendered-skins/<discordId>.png` | Per-player rendered skin PNG (128×160px bust). Generated after registration or `/skin-change`. Used as thumbnail in result embeds. |
| `emojis/` | 16 image files (8 game mode PNGs + 8 rank PNGs/GIFs). Used by `/upload` to create Discord custom emojis. |

---

## All Slash Commands

| Command | Who | What |
|---------|-----|------|
| `/register` | Players | Opens a modal for MC username + region, then prompts for skin upload. Grants temporary SEND_MESSAGES in the channel for 1 minute. |
| `/skin-change` | Players | Updates the player's skin. Accepts a PNG attachment or `reset: Yes` to revert to default. Re-renders and saves the new skin. |
| `/result` | Tier Testers | Posts a tier test result embed to the results channel. Autocompletes player MC usernames from registered players. Attaches the player's rendered Minecraft skin as a thumbnail. |
| `/set-tiertest-channel` | Admins | Sets the tier test panel channel and posts the panel. |
| `/set-results-channel` | Admins | Sets the channel where result embeds are posted. |
| `/set-tier-tester-role` | Admins | Sets the Tier Tester role. |
| `/set-current-tester-channel` | Admins | Sets the active testers list channel. |
| `/set-leaderboard-channel` | Admins | Sets the leaderboard channel. |
| `/set-unranked-role` | Admins | Sets the role given to players before they get a tier. |
| `/clear-tier-test` | Admins | Deletes and reposts the tier test panel in the configured channel. |
| `/clear-user` | Admins | Removes all tier roles from a player. |
| `/upload` | Admins | Scans the `emojis/` folder, uploads all images as Discord server emojis, and saves the emoji strings to `config.json`. |

---

## Key Flows

### Player Registration
1. Player clicks **Register** on the tier test panel (or runs `/register`).
2. A modal appears: enter MC username (permanent) + region (`AS`, `EU`, `NA`, etc.).
3. Bot grants temporary `SEND_MESSAGES` + `ATTACH_FILES` in the channel for **1 minute**.
4. Player sends a Minecraft skin PNG as an attachment. Text messages and non-image attachments are **auto-deleted**.
5. Or player clicks **Skip** to use the default Steve skin.
6. Bot renders the skin (or default), saves it to `rendered-skins/<discordId>.png`, assigns `Registered` and MC username roles.

### Skin Rendering (`src/skinrender.ts`)
- Uses **jimp 0.22** (pure-JS, no native dependencies) for pixel manipulation.
- Input: a `Buffer`, a URL string, or `null` (uses `default-skin.png`).
- Extracts face regions from the flat 64×64 skin PNG using exact Minecraft skin coordinates.
- Scales each region up by 8× using nearest-neighbor (pixel-perfect).
- Composites: left arm | body | right arm, head centered above.
- Hat (overlay) layer is drawn on top of the head if it has any visible pixels.
- Output: a transparent-background 128×160px PNG buffer.
- Render types: `'head'` (64×64), `'bust'` (128×160 — default), `'body'` (future).
- Called automatically after registration and after `/skin-change`.

### Result Posting (`handleResult` in `src/index.ts`)
1. Tester runs `/result player:<mc-username> tester:<user> ...`.
2. Bot looks up the player's registration to get their Discord ID.
3. Loads `rendered-skins/<discordId>.png` if it exists; attaches as a Discord file.
4. Embed thumbnail is set to `attachment://skin.png` (local rendered image) — no external URLs needed.
5. Falls back to the Discord CDN skin URL if no rendered file is found.
6. Role assignment: awards the tier role for the game mode, assigns an overall title role based on total points.

### Custom Emoji Upload (`/upload`)
1. Scans `emojis/` folder for all image files (PNG/GIF).
2. Sanitizes each filename to a valid Discord emoji name: `Sword-PvP.png` → `sword_pvp`.
3. Uploads each as a guild emoji (animated if GIF).
4. Saves all emoji strings (e.g. `<:sword_pvp:123456>` / `<a:combat_ace:123456>`) to `config.json`.
5. These are used in leaderboard, tester list, and result embeds via `src/emojis.ts`.

### Tier Roles & Points
- Role names follow the pattern: `{Game Mode} {Tier}` (e.g. `Sword-PvP HT1`).
- Tiers: `LT5 HT5 LT4 HT4 LT3 HT3 LT2 HT2 LT1 HT1` (higher index = higher tier).
- Points per tier: HT1=100, LT1=90, HT2=80, LT2=70, ... assigned in `leaderboard.ts`.
- Title roles: Combat Initiate → Rookie → Combat Novice → Combat Cadet → Combat Specialist → Combat Ace → Combat Master → Combat Grandmaster.

---

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `DISCORD_BOT_TOKEN` | Yes | — |
| `DISCORD_GUILD_ID` | No | `1470462150081253429` |

---

## Dependencies

Key packages in `Cosmic-tier-bot/artifacts/discord-bot/package.json`:
- `discord.js` — Discord API client
- `jimp@0.22.12` — Pure-JS image processing (skin renderer)
- `tsx` — TypeScript runner
- `express` — Keep-alive server

---

## Adding Features

To add a new slash command:
1. Define the command builder in `src/commands.ts` and add it to the exported array.
2. Add a handler function in `src/index.ts` and call it from the `interactionCreate` switch.

To change the render style:
- Edit `src/skinrender.ts`. The skin coordinate regions are in the `REGIONS` constant. `SCALE` (default: 8) controls how many pixels per skin pixel.

To add a new render type (e.g. full body with legs):
- Add a new case to the `RenderType` union in `src/skinrender.ts` and implement a `buildBody` function using the leg regions from the skin.

Leg regions (for future use):
- Right leg front: `x=4, y=20, w=4, h=12`
- Left leg front: `x=20, y=52, w=4, h=12`
