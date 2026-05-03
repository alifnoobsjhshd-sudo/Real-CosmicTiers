# Cosmic Tiers — Full-Stack System

## Overview

Cosmic Tiers is a comprehensive full-stack system designed for Minecraft PvP tier testing. It integrates a Discord bot for managing tier tests, a PostgreSQL database for persistent data, an Express API server for both internal bot communication and public website access, and a React-based website for displaying leaderboards, tier testers, and player profiles. The project aims to provide a robust and streamlined platform for competitive Minecraft communities to track and manage player tiers.

## User Preferences

I prefer iterative development with clear communication on significant changes. Please ask before making major architectural decisions or changes that might impact core functionalities. I appreciate detailed explanations of complex implementations.

## System Architecture

The Cosmic Tiers system is composed of three main services: a Discord Bot, a Backend API, and a React Frontend, all sharing a PostgreSQL database.

**Frontend (React Website):**
- Located in `client/` directory
- Built with React, Vite, Wouter (for routing), TanStack Query (for data fetching), and Shadcn UI for components.
- Features a dark-only theme with Cosmic Tiers branding (dark navy and gold).
- UI/UX:
    - Player profiles open as a right-side slide-in overlay with `translateX` transitions and a dark blurred backdrop.
    - Global search functionality is implemented as a full-page overlay triggered by a button or the `/` key. It includes tabs for Players, Results, and Testers with search capabilities.
    - Player skins are rendered via a custom component (`PlayerSkin`) that fetches from the backend, providing fallbacks.
    - Special titles and retired tiers are visually represented with distinct badges and styling.

**Backend (Express API Server):**
- Located in `server/` directory
- An Express 5 server (port 5000) handles both public website API requests and internal bot API calls.
- All persistent data (skins, registrations, configuration) is stored in PostgreSQL, never on the filesystem.
- Provides endpoints for leaderboard data, tester information, server stats, and dynamic player skin retrieval.
- Internal API endpoints facilitate communication with the Discord bot for player registration, result saving, skin updates, and configuration management.
- Custom HMAC-based admin token auth for the admin panel (no external auth provider).

**Discord Bot (discord.js v14):**
- Located in `bot/` directory
- Manages tier tests, player registration, and staff commands using discord.js v14.
- Interacts with the backend API for data persistence and retrieval.
- Requires `DISCORD_BOT_TOKEN`, `SERVER_ID`, `INTERNAL_API_KEY`, and `WEBSITE_API_URL` environment variables.

**Database (PostgreSQL via Drizzle ORM):**
- PostgreSQL is used for all persistent data storage (provided by Replit's built-in database).
- Drizzle ORM is utilized for database interactions, defining schema, and types.
- Schema defined in `shared/schema.ts`.
- Run `npm run db:push` to apply schema changes.

## Environment Variables / Secrets

- `DATABASE_URL` — PostgreSQL connection string (managed by Replit)
- `ADMIN_PASSWORD` — Password for the website admin panel
- `INTERNAL_API_KEY` — Shared secret between the Discord bot and backend API
- `DISCORD_BOT_TOKEN` — Discord bot token (needed to run the bot)
- `SERVER_ID` — Discord server/guild ID for the bot
- `WEBSITE_API_URL` — URL the bot uses to call the backend (e.g. https://your-repl.replit.app)
- `DISCORD_SERVER_LINK` — (optional) Discord invite link shown on the website
- `WEBSITE_LINK` — (optional) Website URL shown in bot embeds

## Running the Project

- **Development (web app):** `npm run dev` — starts Express + Vite on port 5000
- **Discord bot:** `npm run dev:bot` — starts the bot separately
- **Build for production:** `npm run build`
- **Database migrations:** `npm run db:push`

## Key Files

- `server/index.ts` — Express server entry point
- `server/routes.ts` — All API routes
- `server/storage.ts` — Database access layer
- `server/db.ts` — Drizzle DB connection
- `shared/schema.ts` — Database schema and shared types
- `client/src/App.tsx` — React app root
- `client/src/pages/home.tsx` — Main leaderboard/tiers page
- `client/src/pages/admin.tsx` — Admin panel
- `vite.config.ts` — Vite config (root: `client/`)
- `bot/index.ts` — Discord bot entry point

## External Dependencies

- **PostgreSQL:** Primary database (Replit built-in)
- **Discord API:** Used by the Discord bot
- **mc-heads.net:** External service for fetching Mojang player heads (proxied and cached by backend)
- **Vite:** Frontend build tool
- **Wouter:** React routing library
- **TanStack Query:** Data fetching and state management
- **Shadcn UI:** UI component library
- **discord.js v14:** Discord API wrapper
- **Express 5:** Web framework
- **Drizzle ORM:** TypeScript ORM
- **Jimp:** Image processing for Minecraft skin rendering
