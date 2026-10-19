# Cosmic Tiers: development and Render deployment guide

This guide is based on the active service code in `backend/`, `bot/`, and
`website/`. The repository also contains a Replit-oriented monolith in
`server/`, `client/`, and `shared/`; those directories are not the three
separate Render services described below.

## 1. What runs where

| Service | Directory and entry point | Responsibility |
| --- | --- | --- |
| Backend API | `backend/src/index.ts` | Express API, PostgreSQL access, public website data, bot operations, and admin API |
| Discord bot | `bot/index.ts` | Discord Gateway client, slash commands, tier testing, registration, and API calls |
| Frontend | `website/` (Vite builds `website/dist/`) | Static React website; calls the backend API from visitors' browsers |

The data flow is:

```text
Visitor's browser
  └─> Render Static Site (website)
        └─> Render Web Service (backend API)
              └─> PostgreSQL

Discord Gateway <─> Render Background Worker (bot)
                         └─> Render Web Service (backend API)
```

The bot does not connect directly to PostgreSQL. The website does not need a
database credential. Keep `DATABASE_URL` on the backend only.

### Which copy of the code is active?

- Deploy `backend/`, `bot/`, and `website/` as separate services.
- The bot package's `start` script runs `bot/index.ts`. It does **not** run
  `bot/src/index.ts`.
- The Replit root command `npm run dev` starts `server/index.ts`, the separate
  Replit monolith (API and the `client/` frontend together). It is useful for
  local Replit development, but it is not the standalone Render deployment.
- The root and backend schema files are separate. The standalone Render API
  uses `backend/shared/schema.ts`.
- There is no Render Blueprint (`render.yaml`) in the repository at present.

The existing `.env.example` files mention older hosts (Koyeb, Vercel, and
Netlify). Use the Render settings in this guide instead. `DISCORD_CLIENT_ID`
appears in the bot example but is not read by the active `bot/index.ts`.

## 2. Before creating the services

### PostgreSQL

Create a PostgreSQL database in Render, or use an existing PostgreSQL service.
For a Render-managed database, put it in the same Render region as the backend
so the backend can use the database's internal connection URL.

The API expects a schema created from `backend/shared/schema.ts`; starting the
API does not apply schema changes automatically. Apply the schema before
testing the bot or website (see [Database setup and schema changes](#6-database-setup-and-schema-changes)).

### Discord application and server

1. Create or select the Discord application and bot in the Discord Developer
   Portal.
2. Copy the bot token into Render as `DISCORD_BOT_TOKEN`; do not put it in the
   repository or a frontend variable.
3. Enable the privileged Gateway intents the bot requests:
   - Server Members Intent (`GuildMembers`)
   - Presence Intent (`GuildPresences`)
   - Message Content Intent (`MessageContent`)
4. Invite the bot to the server with the OAuth2 scopes `bot` and
   `applications.commands`.
5. Give it only the Discord permissions needed by the commands you plan to use.
   The features include reading/sending messages, embeds and file attachments,
   managing roles and channels, and operating ticket/test channels. Keep the
   bot's role above any roles it needs to assign or edit.
6. Copy the server's guild ID into `SERVER_ID`.

The bot registers guild-specific application commands using its logged-in
Discord application identity and `SERVER_ID`; a separate `DISCORD_CLIENT_ID`
variable is not used in the active entry point.

## 3. Create the Render backend API service

Create a **Web Service** from the repository:

| Render setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Region | Same region as the database; preferably also the bot |

Including development dependencies in the build is intentional: the backend's
build and database scripts use `tsx` and `drizzle-kit`, which are listed as
development dependencies. The production start command runs the generated
`dist/index.cjs`.

Do not set `PORT` yourself for a Render Web Service. Render supplies it, and
the API listens on `0.0.0.0`. The `/health` endpoint returns HTTP 200 when the
process is running; it currently does not perform a database query.

### Backend environment variables

| Variable | Required? | Purpose and guidance |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. Use Render's internal database URL when using Render Postgres. This is a secret. The backend Drizzle config and schema-push command use this name. |
| `INTERNAL_API_KEY` | **Yes before public launch** | Shared secret for bot-to-backend operations. Generate a long random value and set exactly the same value on the bot. If it is empty, the current API middleware skips the key check. |
| `WEBSITE_LINK` | Recommended | Public website URL. The backend returns this from `/api/info`; the bot also uses its own copy of this value in embeds. |
| `DISCORD_SERVER_LINK` | Optional | Discord invite link returned by `/api/info` for website links/buttons. |
| `NEON_DATABASE_URL` | Usually **leave unset** | Compatibility override. At runtime the backend prefers this over `DATABASE_URL`, but Drizzle's config uses only `DATABASE_URL`. Setting both to different databases can make the app and schema command target different databases. |
| `PORT` | Do not set manually | Render supplies this to the Web Service; the code defaults to `3000` only outside Render. |
| `ADMIN_PASSWORD` | **Not effective in the current standalone backend** | The active `backend/src/routes.ts` has an admin password embedded in source instead of reading this variable. Adding this variable in Render will not change the admin password. Fix this in code before exposing `/admin`; see [Production blockers and durability](#8-production-blockers-and-durability). |

`NODE_ENV=production` is set by the backend's `npm start` script. No `CORS_ORIGIN`
setting exists: the current API sends `Access-Control-Allow-Origin: *`.

### Backend URL

After the service is created, note its HTTPS `onrender.com` URL. The frontend
and bot must use the backend URL, not the frontend URL. Do not add a trailing
slash to URLs used for `WEBSITE_API_URL`, `WEBSITE_LINK`, or `VITE_API_URL`.

The bot can call the public backend URL. If you choose to use Render's private
network for bot-to-backend traffic, use the backend's private hostname and
correct listening port shown by Render, and keep the browser's frontend API
URL pointed at the public HTTPS backend URL.

## 4. Create the Render bot service

Create a **Background Worker**, not a Web Service. The bot maintains a
long-lived outbound Discord Gateway connection and does not need public
incoming HTTP traffic. The active entry point also starts a small Express
server on `PORT` or `3000`, but its `/` response is only a simple liveness
message; it is not required for the worker.

| Render setting | Value |
| --- | --- |
| Root Directory | `bot` |
| Runtime | Node |
| Build Command | `npm ci --include=dev` |
| Start Command | `npm start` |
| Region | Prefer the backend's region |

The bot's `start` script runs TypeScript with `tsx`, a development dependency,
so `--include=dev` is required for a clean install. No Render port or health
check needs to be configured for a Background Worker.

### Bot environment variables

| Variable | Required? | Purpose and guidance |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | **Yes** | Discord bot token. Store as a Render secret. |
| `SERVER_ID` | **Yes** | Discord server/guild ID. The bot registers server-specific slash commands and uses this ID when loading/saving server configuration. |
| `WEBSITE_API_URL` | **Yes** | Base URL of the backend API, e.g. `https://<backend-service>.onrender.com`. Do not point this at the frontend. |
| `INTERNAL_API_KEY` | **Yes** | Must exactly match the backend's `INTERNAL_API_KEY`. Store as a secret. |
| `WEBSITE_LINK` | Recommended | Public website URL inserted into bot messages and embeds. |
| `PORT` | No | The worker has no public ingress. The bot's small local HTTP listener falls back to port `3000`. |
| `DISCORD_CLIENT_ID` | No | Present in the old example file but not used by the active `bot/index.ts`. |

## 5. Create the Render frontend static site

Create a **Static Site**:

| Render setting | Value |
| --- | --- |
| Root Directory | `website` |
| Build Command | `npm ci --include=dev && npm run build` |
| Publish Directory | `dist` |
| Region | Any; same-region placement is not required for a static CDN site |

Add a rewrite rule so Wouter routes such as `/admin` and `/user/...` load when
visited directly or refreshed:

| Type | Source | Destination |
| --- | --- | --- |
| Rewrite | `/*` | `/index.html` |

The Netlify config in `website/netlify.toml` does not configure a Render site.
Add the rewrite in the Render Static Site settings (or its Blueprint if you
add one later).

### Frontend environment variables

Vite embeds `VITE_*` values into the client bundle at **build time**. A change
to one requires a new frontend deploy. These values are public; never put
passwords, tokens, or database URLs in them.

| Variable | Required? | Purpose and guidance |
| --- | --- | --- |
| `VITE_API_URL` | **Yes in production** | HTTPS base URL of the backend API. Without it, the deployed static site requests `/api/...` from its own domain and the API calls fail. Use no trailing slash. |
| `VITE_DISCORD_LINK` | Optional fallback | Discord invite link used if `/api/info` has no `DISCORD_SERVER_LINK`. |
| `VITE_WEBSITE_LINK` | Optional fallback | Website URL used if `/api/info` has no `WEBSITE_LINK`. |

Because `/api/info` comes from the backend, set `DISCORD_SERVER_LINK` and
`WEBSITE_LINK` there as well if you want the backend values to be the
source of truth.

## 6. Database setup and schema changes

1. Set `DATABASE_URL` on the backend to the intended PostgreSQL database.
2. From the repository root, install backend dependencies and apply the
   standalone backend schema:

   ```sh
   cd backend
   npm ci --include=dev
   npm run db:push
   ```

   `drizzle-kit push` may ask for confirmation when it detects changes. Review
   its proposed changes before accepting them. Run this against the same
   database that the backend will use.
3. Deploy/restart the backend after the schema is ready.
4. When changing the schema, update both `backend/shared/schema.ts` and the
   separate root `shared/schema.ts` if the Replit monolith is still used. Apply
   the backend schema against the Render database; the root `npm run db:push`
   uses the root schema and is not a substitute for the backend command.

The bot's registrations, player tiers, results, tester details, server config,
and skin data flow through the backend and PostgreSQL. The frontend and bot
must never receive `DATABASE_URL`.

## 7. Local development

The code reads environment variables from `process.env`; the active service
entry points do not load `.env` files themselves. Export variables in your
shell or use a local environment loader. Keep local secrets out of Git.

### Run the three services separately

Start the backend first. It listens on port `3000` by default:

```sh
cd backend
npm ci
export DATABASE_URL='postgresql://...'
export INTERNAL_API_KEY='use-the-same-random-value-as-the-bot'
npm run dev
```

In another terminal, run the bot against that backend:

```sh
cd bot
npm ci
export DISCORD_BOT_TOKEN='your-local-bot-token'
export SERVER_ID='your-discord-guild-id'
export WEBSITE_API_URL='http://localhost:3000'
export INTERNAL_API_KEY='use-the-same-random-value-as-the-backend'
export WEBSITE_LINK='http://localhost:5173'
npm run dev
```

In a third terminal, run the standalone Vite frontend:

```sh
cd website
npm ci
npm run dev
```

For this local setup, leave `VITE_API_URL` unset: Vite serves the frontend on
port `5173` and proxies `/api` requests to `http://localhost:3000` as configured
in `website/vite.config.ts`. If you set `VITE_API_URL`, the browser calls that
absolute URL directly instead of using the same-origin proxy.

The repository root also has convenience scripts (after installing root
dependencies): `npm run dev:backend`, `npm run dev:bot`, and
`npm run dev:website`. `npm run dev` starts the separate Replit monolith on
port `5000`; when using that server instead, point the bot to
`http://localhost:5000`.

### Build locally

```sh
cd backend && npm ci --include=dev && npm run build
cd ../bot && npm ci --include=dev
cd ../website && npm ci --include=dev && npm run build
```

The backend build outputs `backend/dist/index.cjs`. The bot runs directly
through `tsx` and has no compiled build step. The website outputs
`website/dist/`.

## 8. Production blockers and durability

Address these items before relying on the public deployment:

1. **Admin password is hardcoded in the standalone backend.** The
   `ADMIN_PASSWORD` value in `backend/src/routes.ts` is a source-code constant;
   the backend does not read `process.env.ADMIN_PASSWORD`. The admin login
   endpoint is public, so changing a Render variable alone does not secure it.
   Move the password to a required secret, fail startup if it is missing, and
   rotate any password that has been present in repository history.
2. **Bot API authentication is optional in code but must be mandatory in
   deployment.** `backend/src/routes.ts` only checks
   `x-internal-api-key` when `INTERNAL_API_KEY` is non-empty. Set a strong,
   non-empty value on both backend and bot before exposing the API.
3. **Uploaded title icons are filesystem data.** The backend writes uploaded
   icons under its working directory's `title-icons/` folder while the
   database stores their URLs. Render's ordinary service filesystem is not
   durable across deploys. Add a persistent disk mounted at the directory the
   code writes to, or change the code to use durable object storage.
4. **Theme persistence expects a table absent from the current schema.** The
   backend queries and writes `site_settings`, but that table is not declared
   in `backend/shared/schema.ts`. The handlers catch database errors, so the
   website can appear to accept a theme change without persisting it. Add the
   table/migration or change the persistence implementation.
5. **CORS is open to every origin.** The backend currently sends
   `Access-Control-Allow-Origin: *`; `WEBSITE_LINK` is display data, not a CORS
   allowlist. This permits cross-origin browser reads of public API data. If
   you need a restrictive policy, implement one in code; there is no current
   CORS environment variable.

The bot keeps a local JSON config backup, but its intended cross-redeploy
source of truth is the backend's `guild_config` table. Ensure both
`SERVER_ID` and `INTERNAL_API_KEY` are present so config synchronization can
work; do not depend on the worker's local filesystem for durable state.

## 9. Deployment order and smoke checks

Recommended order:

1. Create PostgreSQL.
2. Create and deploy the backend with `DATABASE_URL` and `INTERNAL_API_KEY`.
3. Apply the backend schema with `npm run db:push`.
4. Create the frontend with `VITE_API_URL` set to the backend URL; add the SPA
   rewrite.
5. Set the final website URL in the backend's `WEBSITE_LINK`; set the Discord
   invite in `DISCORD_SERVER_LINK`.
6. Create the bot worker with its token, server ID, backend URL, and matching
   internal API key.
7. Rebuild the frontend if any `VITE_*` value changed.

After deployment:

- Open `https://<backend-service>.onrender.com/health`; expect `200` and
  `{"status":"ok",...}`.
- Check the API's `/api/leaderboard`, `/api/testers`, `/api/results`,
  `/api/info`, and `/api/top-players` responses.
- Open the website and test refreshes on `/admin` and `/user/<username>`.
- In browser developer tools, confirm API calls go to the backend URL and
  return successfully; inspect the console for CORS, missing-URL, or API errors.
- Check bot worker logs for successful Discord login and command registration.
  Test a read command, a registration, and a result/config write.
- Redeploy after saving data and confirm PostgreSQL-backed data remains. Also
  verify title icons separately until their filesystem storage is made durable.

## 10. Render documentation

- [Web Services](https://render.com/docs/web-services)
- [Background Workers](https://render.com/docs/background-workers)
- [Static Sites](https://render.com/docs/static-sites)
- [Health Checks](https://render.com/docs/health-checks)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
