# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes a Discord bot for a PvP tier test system.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord bot**: discord.js v14

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── discord-bot/        # Discord PvP Tier Test Bot
│       ├── src/
│       │   ├── index.ts        # Main bot entry point + command handlers
│       │   ├── commands.ts     # Slash command definitions
│       │   ├── config.ts       # Persistent config (config.json)
│       │   └── tiertest.ts     # Tier test panel + ticket system
│       └── config.json         # Runtime config (auto-generated)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Discord Bot — `artifacts/discord-bot`

A full PvP tier test Discord bot for a single guild.

### Environment Variables / Secrets
- `DISCORD_BOT_TOKEN` — bot token (Replit Secret)
- `DISCORD_GUILD_ID` — (optional env var, defaults to hardcoded guild ID)
- `DISCORD_RESULTS_CHANNEL_ID` — (optional fallback if not set via /set-results-channel)

### Slash Commands

| Command | Permission | Description |
|---|---|---|
| `/result` | Manage Roles | Post a tier test result, auto-assign tier role |
| `/set-results-channel` | Administrator | Set the channel where results are posted |
| `/set-tier-tester-role` | Administrator | Set the Tier Tester role |
| `/set-tiertest-channel` | Administrator | Set tier test channel and post the panel embed |

### Features
- **Tier Test Panel** — Yellow embed in the tier test channel showing how many tier testers are online, how to apply, available tiers/modes. Has a "Start Tier Test" button. Refreshes online count every 5 minutes.
- **Ticket System** — Clicking the button shows a modal (Minecraft username + region). A private `tt-{username}` channel is created for the user + tier tester role only.
- **Auto Role Assignment** — `/result` automatically creates/reuses tier roles (e.g. `Nethpot HT4`), removes old roles for the same game mode, and assigns the new one.

### Discord Developer Portal Requirements
- Enable **Server Members Intent** (for online count)
- Enable **Presence Intent** (for online count)
- Bot permissions: **Manage Roles**, **Manage Channels**, **Send Messages**, **Embed Links**, **Read Message History**

### Setup Order (after inviting bot)
1. `/set-tier-tester-role` — set the role
2. `/set-results-channel` — set results channel
3. `/set-tiertest-channel` — post the tier test panel

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
