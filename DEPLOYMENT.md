# Cosmic Tiers — Deployment Guide

## Architecture Overview

```
Discord Bot (Koyeb)  ──────► Backend API (Koyeb) ──────► Database (Neon/Supabase)
                                     ▲
Website (Vercel)     ───────────────┘
```

- **Bot** (`/bot`) → Koyeb (long-running process)
- **Backend** (`/backend`) → Koyeb (API server)
- **Website** (`/website`) → Vercel (static frontend)
- **Database** → Neon or Supabase (PostgreSQL)

---

## Step 1 — Set Up the Database

### Option A: Neon (Recommended — free tier)

1. Go to [neon.tech](https://neon.tech) → Sign up
2. Create a new project → Name it `cosmic-tiers`
3. Copy the **Connection String** (looks like `postgresql://user:pass@host/dbname?sslmode=require`)

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) → Sign up
2. Create a new project
3. Go to **Settings → Database → Connection String** → Copy the **URI** format
4. Replace `[YOUR-PASSWORD]` with your actual password

### Push the Database Schema

Once you have `DATABASE_URL`, run this once from the **backend** directory:

```bash
cd backend
npm install
DATABASE_URL="your_connection_string" npm run db:push
```

---

## Step 2 — Deploy the Backend (Koyeb)

### Prepare Files

The `backend/` directory is self-contained. Push it (or your full repo) to GitHub.

### On Koyeb

1. Go to [koyeb.com](https://koyeb.com) → Sign up → **Create App**
2. Choose **GitHub** → Select your repo
3. Set the **root directory** to `backend`
4. Set the **build command**: `npm install && npm run build`
5. Set the **run command**: `npm run start`
6. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...` (your Neon/Supabase URL) |
| `INTERNAL_API_KEY` | A random secret (e.g. `openssl rand -hex 32`) |
| `WEBSITE_LINK` | `https://your-site.vercel.app` (set after Vercel deploy) |
| `DISCORD_SERVER_LINK` | Your Discord invite link |
| `PORT` | `3000` |

7. Deploy → Copy the **Koyeb public URL** (e.g. `https://cosmic-backend-xxx.koyeb.app`)

---

## Step 3 — Deploy the Website (Vercel)

### Prepare Files

The `website/` directory is a standalone Vite React app.

### On Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up → **Add New Project**
2. Import your GitHub repo
3. Set the **Root Directory** to `website`
4. **Framework Preset**: Vite
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend.koyeb.app` (from Step 2) |
| `VITE_WEBSITE_LINK` | `https://your-website.vercel.app` |

8. Deploy → Copy the **Vercel URL**

### Update Backend CORS

Go back to Koyeb → Edit `WEBSITE_LINK` env var → Set it to your Vercel URL → Redeploy.

---

## Step 4 — Deploy the Bot (Koyeb)

### Prepare Files

The `bot/` directory is self-contained.

### On Koyeb

1. **Create another App** → GitHub → same repo
2. Set the **root directory** to `bot`
3. Set the **build command**: `npm install`
4. Set the **run command**: `npm run start`
5. Set **Instance type** to the cheapest long-running option
6. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | Your bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Your bot's Application ID |
| `SERVER_ID` | Your Discord server (guild) ID |
| `WEBSITE_API_URL` | `https://your-backend.koyeb.app` (from Step 2) |
| `INTERNAL_API_KEY` | Same value as backend's `INTERNAL_API_KEY` |
| `WEBSITE_LINK` | `https://your-website.vercel.app` |
| `DISCORD_SERVER_LINK` | Your Discord invite link |

7. Deploy

---

## Step 5 — Verify Everything Works

### Check Backend

Visit: `https://your-backend.koyeb.app/api/leaderboard`

You should see: `{"players":[],"lastUpdated":...}`

### Check Website

Visit your Vercel URL. The leaderboard should load (empty or with your data).

### Check Bot

In your Discord server, run `/register` — it should respond and create a player.

---

## Important Notes

### Skin Files

The bot renders player skins as PNG files and saves them locally. The backend also serves
these skin files from its local storage. For this to work when bot and backend are on
**different Koyeb services**, you have two options:

**Option A (Simplest — Recommended):** Run bot and backend on the **same Koyeb service**
using a single `Procfile`:
```
web: node dist/index.cjs
bot: tsx ../bot/index.ts
```
This shares the local filesystem so skin files work automatically.

**Option B (True Separation):** Use cloud storage (Cloudflare R2, AWS S3, or Supabase Storage)
for skin images. The bot uploads rendered skins there; the backend serves them via the cloud URL.
This requires additional code changes.

### Environment Files

Each service has a `.env.example` file showing all required variables:
- `bot/.env.example`
- `backend/.env.example`
- `website/.env.example`

**Never commit actual `.env` files to git.** Only commit `.env.example`.

---

## Running Services Locally (Development)

```bash
# Full stack (current Replit setup)
npm run dev          # Backend + Frontend together (port 5000)
npm run dev:bot      # Bot only

# Individual services (standalone)
npm run dev:backend  # Backend API only (port 3000)
npm run dev:website  # Website only (port 5173, proxies /api to port 3000)
```

---

## Quick Summary Checklist

- [ ] Database created on Neon or Supabase
- [ ] `db:push` run to create tables
- [ ] Backend deployed to Koyeb with all env vars
- [ ] Website deployed to Vercel with `VITE_API_URL` pointing to backend
- [ ] Backend `WEBSITE_LINK` updated with Vercel URL (for CORS)
- [ ] Bot deployed to Koyeb with all env vars including `INTERNAL_API_KEY`
- [ ] `/api/leaderboard` returns JSON
- [ ] Website loads and shows leaderboard
- [ ] Bot responds to `/register` in Discord
