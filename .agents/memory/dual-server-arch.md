---
name: Dual-server architecture
description: The project has two separate Express servers; the Discord bot talks to the backend, not the dev server.
---

## Rule
`server/routes.ts` is the local dev/frontend server. `backend/src/routes.ts` is the deployed Render backend. The Discord bot's `WEBSITE_API_URL` points to the **backend** (Render), so new bot-facing routes must be added to **both** `server/routes.ts` AND `backend/src/routes.ts`.

**Why:** The bot calling `/api/bot/add-test-count` returned 404 because the route existed in `server/routes.ts` but was missing from `backend/src/routes.ts`.

**How to apply:** Whenever adding a new `/api/bot/*` endpoint, add it in both files and add the matching storage method to both `server/storage.ts` and `backend/src/storage.ts`.
