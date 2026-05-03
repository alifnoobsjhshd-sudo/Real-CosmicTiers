# Cosmic Tiers — Full-Stack System

## Overview

Cosmic Tiers is a comprehensive full-stack system designed for Minecraft PvP tier testing. It integrates a Discord bot for managing tier tests, a PostgreSQL database for persistent data, an Express API server for both internal bot communication and public website access, and a React-based website for displaying leaderboards, tier testers, and player profiles. The project aims to provide a robust and streamlined platform for competitive Minecraft communities to track and manage player tiers.

## User Preferences

I prefer iterative development with clear communication on significant changes. Please ask before making major architectural decisions or changes that might impact core functionalities. I appreciate detailed explanations of complex implementations.

## System Architecture

The Cosmic Tiers system is composed of three main services: a Discord Bot, a Backend API, and a React Frontend, all sharing a PostgreSQL database.

**Frontend (React Website):**
- Built with React, Vite, Wouter (for routing), TanStack Query (for data fetching), and Shadcn UI for components.
- Features a dark-only theme with Cosmic Tiers branding (dark navy and gold).
- UI/UX:
    - Player profiles open as a right-side slide-in overlay with `translateX` transitions and a dark blurred backdrop.
    - Global search functionality is implemented as a full-page overlay triggered by a button or the `/` key. It includes tabs for Players, Results, and Testers with search capabilities.
    - Player skins are rendered via a custom component (`PlayerSkin`) that fetches from the backend, providing fallbacks.
    - Special titles and retired tiers are visually represented with distinct badges and styling.

**Backend (Express API Server):**
- An Express 5 server (port 5000) handles both public website API requests and internal bot API calls.
- All persistent data (skins, registrations, configuration) is stored in PostgreSQL, never on the filesystem.
- Provides endpoints for leaderboard data, tester information, server stats, and dynamic player skin retrieval.
- Internal API endpoints facilitate communication with the Discord bot for player registration, result saving, skin updates, and configuration management.
- Includes `/health` and root ping endpoints for monitoring.

**Discord Bot (discord.js v14):**
- Manages tier tests, player registration, and staff commands using discord.js v14.
- Interacts with the backend API for data persistence and retrieval.
- Features:
    - Tier test flow with game mode selection and private ticket channel creation.
    - Staff commands for managing players, tiers (`/remove-tier`, `/retired`), and special titles (`/create-title`, `/remove-title`).
    - Automatic skin updates via image uploads in ticket channels.
    - Custom embeds for results, leaderboards, and tester lists.
    - In-memory cache for bot configuration and player registrations, periodically synced with the database.

**Database (PostgreSQL via Drizzle ORM):**
- PostgreSQL is used for all persistent data storage.
- Drizzle ORM is utilized for database interactions, defining schema, and types.
- Stores player data, guild configurations, tier test results, retired tiers, special titles, and rendered player skins (as base64 PNG data).

**Core Design Patterns:**
- **Modular Services:** The project is split into three independently deployable services (Bot, Backend, Website).
- **API-driven Communication:** Bot and Website communicate with the Backend API.
- **Data Persistence:** All crucial data is stored in the PostgreSQL database, avoiding filesystem reliance for deployability.
- **Theming:** Consistent dark-only theme with specific branding colors across the frontend.

## External Dependencies

- **PostgreSQL:** Primary database for all persistent data.
- **Discord API:** Used by the Discord bot for all Discord-related interactions (commands, events, messages, roles).
- **Render:** Deployment platform for the Bot, Backend API, and Website.
- **Neon/Supabase:** Potential hosting solutions for the PostgreSQL database.
- **Vite:** Frontend build tool.
- **Wouter:** React routing library.
- **TanStack Query:** Data fetching and state management for the frontend.
- **Shadcn UI:** UI component library for the frontend.
- **discord.js v14:** Discord API wrapper for the bot.
- **Express 5:** Web framework for the backend API.
- **Drizzle ORM:** TypeScript ORM for database interaction.
- **Jimp:** Image processing library used by the bot for Minecraft skin rendering.
- **`mc-heads.net`:** External service for fetching Mojang player heads (proxied and cached by the backend).