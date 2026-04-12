# Cosmic Tiers — Full-Stack System

A full-stack Minecraft PvP tier test system consisting of:
1. A Discord bot (`bot/`) using discord.js v14 for managing tier tests
2. A PostgreSQL database (via Drizzle ORM) for persistent data
3. An Express API server (`server/`) with internal bot API and public website API
4. A React website (`client/`) showing player leaderboards, tier testers, and profiles

## Architecture

- **Frontend**: React + Vite + Wouter + TanStack Query + Shadcn UI
- **Backend**: Express 5 server (port 5000, both API and frontend in dev)
- **Database**: PostgreSQL via Drizzle ORM
- **Discord Bot**: discord.js v14, runs as separate workflow (`tsx bot/index.ts`)
- **Theme**: Dark-only, Cosmic Tiers branding (dark navy `213 30% 10%` + gold `45 90% 55%`)

## Deployment-Ready Services

The project is split into three independently deployable services on Render, all sharing one PostgreSQL database:

| Service | Directory | Deploy To | Start Command |
|---------|-----------|-----------|---------------|
| Bot | `bot/` | Render | `npm run start` |
| Backend API | `backend/` | Render | `npm run start` (runs `node dist/index.cjs`) |
| Website | `website/` | Render (Static) | `npm run build` → `dist/` |

Each service has its own `package.json`, `tsconfig.json`, and `.env.example`.

**IMPORTANT: All persistent data (skins, registrations, config) must be stored in PostgreSQL, never the filesystem (Render wipes files on redeploy).**

## Connection Flow

```
Bot (Koyeb) ──────► Backend API (Koyeb) ──────► Database (Neon/Supabase)
                           ▲
Website (Vercel) ──────────┘
```

## Workflows (Replit Dev)

- **Start application** — `NODE_ENV=development tsx server/index.ts` — Full-stack dev server on port 5000
- **Discord Bot** — `NODE_ENV=development tsx bot/index.ts` — Discord bot process

## Backend Deployment (Render)

The `backend/` folder is the standalone deployable backend.

- **Build command**: `npm install && npm run build`
- **Start command**: `npm run start` (runs `node dist/index.cjs`)
- **Health/UptimeRobot endpoint**: `GET /health` — always returns 200
- **Root ping endpoint**: `GET /` — returns plain text, also pingable

### Fixed Issues (backend/src/index.ts)
- Removed duplicate `app.listen()` that was causing EADDRINUSE crash on startup
- Moved `/` and `/health` routes to be registered before the server starts
- Added `/health` endpoint for UptimeRobot monitoring

## Skin System

- Uploaded Minecraft skins are rendered by the Discord bot and saved to PostgreSQL as base64 PNG data in `players.rendered_skin_data`.
- The bot no longer depends on `rendered-skins/` local files for website skin persistence.
- The backend serves all player skins through `GET /api/skin/:discordId`; if a player has no saved skin data, the route serves the default Steve skin.
- Public backend responses expose `skinUrl` for leaderboard players, tier testers, top players, and tester profiles, plus `playerSkinUrl` for result entries.
- The website renders `player.skinUrl`/`result.playerSkinUrl` through `PlayerSkin` and no longer uses Mojang or mc-heads avatar URLs.

## Key Files

### Bot (`bot/`)
- `bot/index.ts` — Main bot entry point (all commands, events, API calls to website)
- `bot/commands.ts` — Slash command definitions
- `bot/config.ts` — Local bot config (JSON file-based)
- `bot/registration.ts` — Player registration storage (JSON file-based)
- `bot/emojis.ts` — Emoji string helpers
- `bot/skinrender.ts` — Minecraft skin rendering with Jimp
- `bot/tiertest.ts` — Tier test panel, ticket creation handlers
- `bot/testerlist.ts` — Live tier tester list embed
- `bot/leaderboard.ts` — Discord leaderboard embed + points/titles

### Server (`server/`)
- `server/routes.ts` — All API endpoints (public + bot internal)
- `server/storage.ts` — PostgreSQL storage via Drizzle ORM
- `server/index.ts` — Express + Vite setup

### Shared
- `shared/schema.ts` — Drizzle schema, types, TIER_POINTS, TITLES, GAME_MODES constants

### Client (`client/src/`)
- `pages/home.tsx` — Main page (Leaderboard, Tier Testers, Results, Top, Information tabs)
- `components/TierBadge.tsx` — Tier badge with game mode colors
- `components/TitleBadge.tsx` — Player title badge with dynamic colors
- `components/PlayerSkin.tsx` — Minecraft skin display with fallback
- `components/PlayerModal.tsx` — Expanded player profile dialog (shows special title if present)
- `components/RankBadge.tsx` — Gold/silver/bronze rank badges
- `components/Navbar.tsx` — Sticky navbar with search and Discord link

## Data Files (Runtime)

- `bot-config.json` — Bot config (results channel ID, role IDs, etc.)
- `bot-registrations.json` — Player registrations (Discord ID, MC username, region, skin)
- `rendered-skins/` — Pre-rendered Minecraft bust images (PNG)
- `default-skin.png` — Default Steve skin fallback
- `emojis/` — Game mode emoji images (uploaded via /upload command)

## API Endpoints

### Public (Website)
- `GET /api/leaderboard` — Players sorted by points with tier data
- `GET /api/testers` — Tier testers sorted by test count
- `GET /api/info` — Server stats and Discord link
- `GET /api/skin/:discordId` — Served rendered skin PNG or default

### Internal (Bot → Website, requires `x-internal-api-key`)
- `POST /api/bot/register` — Register a new player
- `POST /api/bot/result` — Save tier test result
- `POST /api/bot/skin` — Update player skin path
- `POST /api/bot/tester-stat` — Increment/clear tester stat
- `POST /api/bot/tester-role` — Add/remove tester role tracking
- `POST /api/bot/tester-game-modes` — Set which game modes a tester tests
- `POST /api/bot/clear-user` — Remove all tier data for a user
- `POST /api/bot/delete-player` — Fully delete a player from the database
- `POST /api/bot/create-title` — Create a styled special title (name, roleId, textColor, backgroundColor, outline, iconUrl)
- `POST /api/bot/remove-title` — Remove a special title by name
- `POST /api/bot/upload-title-icon` — Upload base64-encoded icon for a title; saved to `title-icons/`
- `GET  /api/title-icon/:filename` — Serve a title icon image

## Phase 3 Feature Summary (Implemented)

### Result Embed Cleanup + Website Button
- Removed `⭐ Title` field from `/result` embed (title still assigned, just not shown in embed)
- Removed website link inline field from `/result` embed; replaced with a Discord Link Button component ("View on Cosmic Tiers") below the embed
- Added optional `score` string option to `/result` command (shows as `📊 Score` field in embed if provided)

### /done Opinion Field
- Added optional `opinion` string option to `/done` command
- If provided, appears as `💭 Opinion` field in the staff match report embed

### Retired Tier System
- New `retired_player_tiers` DB table (`discordId`, `gameMode`) to track retired game mode tiers
- `PlayerProfile` and `TierTester` types now include `retiredTiers: string[]`
- New `/retired <player> <game_mode>` slash command (staff only): removes tier role, creates `<GameMode> R<Tier>` role (dark brown `#8B4513`), marks retired in DB
- New `POST /api/bot/retire-tier` internal endpoint
- `getTopPlayers()` excludes retired players from their game mode's tier column
- `getLeaderboard()` and `getTesters()` include `retiredTiers` in responses
- Website: retired tier badges show dark brown background (`rgba(61,32,0,0.85)`) with amber text (`#C47B3A`) and `R` prefix (e.g. `RHT4`)
- `TierBadge` accepts `retired?: boolean` prop; `TierList` accepts `retiredTiers?: string[]` and passes `retired` flag to each badge
- `PlayerModal`, leaderboard player row, tester row, and result card all pass `retiredTiers` through to `TierList`

## Phase 2 Feature Summary (Implemented)

### Special Title System Enhancement
- `specialTitles` DB table now has `textColor`, `backgroundColor`, `outline`, `iconUrl` columns
- `SpecialTitle` type carries the full styling object; `PlayerProfile.specialTitle` is `SpecialTitle | null`
- `/create-title` slash command accepts optional `text_color`, `background_color`, `outline`, `icon` options; hex colors validated; icon downloaded from Discord and stored server-side
- `/remove-title` slash command deletes a title by name
- `guildMemberUpdate` event syncs title assignment automatically when Discord roles change
- `SpecialTitleBadge` component renders styled badge using all four style fields (text color, background, outline, icon)
- `PlayerModal` renders `SpecialTitleBadge` when a player has a special title (above the normal title)

## Phase 1 Feature Summary (Implemented)

### Tier Test Flow
- "Start Tier Test" now shows game mode selection buttons (8 modes, 2 rows of 4) instead of a text modal
- After selecting a game mode, a private ticket channel is created
- Ticket mentions both the general Tier Tester role AND the game-mode-specific tester role (e.g. "Nethpot Tester")
- Ticket channel topic stores: user ID, MC username, region, game mode

### /add-tester Command
- Requires `game-mode` option (dropdown with all 8 modes)
- Assigns both the general "Tier Tester" role AND a `<GameMode> Tester` role (e.g. "Nethpot Tester")
- Auto-creates the `<GameMode> Tester` role if it doesn't exist
- Persists which game modes the tester tests in the `tester_game_modes` DB column
- Accumulates game modes — can be called multiple times to add more

### Website Tester Profile
- `PlayerProfile` and `TierTester` types now include `isTester`, `testerGameModes`/`gameModes`
- PlayerModal shows a gold "Tier Tester" badge (with shield icon) if player is a tester
- PlayerModal shows which game modes they test (gold badges)

### Skin Upload in Tier Test Ticket
- If a player uploads an image in their `tt-*` ticket channel, the bot auto-updates their skin
- Verifies ownership via the channel topic (contains the player's Discord ID)
- Deletes the image message and confirms with a success message

### Discord Embed Cleanup
- Removed all website link fields (`🌐 Cosmic Tiers Website`) from leaderboard and testerlist embeds
- Removed website link from testerlist footer text

## Game Modes

Sword-PvP, UHC, Pot-PvP, Nethpot, SMP-PvP, Axe-PvP, Mace-PvP, Crystal-PvP

## Tier System (Points)

- HT1 = 60pts, LT1 = 45pts
- HT2 = 30pts, LT2 = 20pts
- HT3 = 10pts, LT3 = 6pts
- HT4 = 4pts, LT4 = 3pts
- HT5 = 2pts, LT5 = 1pt

## Titles (by total points)

- Combat Grandmaster (400+), Combat Master (250+), Combat Ace (100+)
- Combat Specialist (50+), Combat Cadet (20+), Combat Novice (10+)
- Combat Initiate (5+), Rookie (1+), Unranked (0)

## Environment Variables

- `DISCORD_BOT_TOKEN` — Bot token
- `SERVER_ID` — Discord server (guild) ID
- `DISCORD_CLIENT_ID` — Bot application client ID
- `INTERNAL_API_KEY` — Shared secret for bot ↔ server communication
- `WEBSITE_API_URL` — URL the bot uses to call the website API (e.g. http://localhost:5000)
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Express session secret (if sessions needed)
- `DISCORD_SERVER_LINK` — Discord invite link shown in the website's "Join Discord" button
- `WEBSITE_LINK` — Public website URL shown in Discord embeds
- `DISCORD_REDIRECT_URI`, `DISCORD_CLIENT_SECRET` — For OAuth (if needed)
