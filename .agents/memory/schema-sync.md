---
name: Schema sync between server and backend
description: Root shared/schema.ts and backend/shared/schema.ts are separate files that must be kept in sync manually.
---

## Rule
The project maintains two schema files:
- `shared/schema.ts` — used by `server/` (local dev, `Start application` workflow)
- `backend/shared/schema.ts` — used by `backend/` (deployed on Render)

Both connect to the **same** PostgreSQL database via `DATABASE_URL`. If a column exists in one schema, it must be added to both, and `db:push` run for both configs.

**Why:** The `bonus_test_count` column existed in the DB (added via root `shared/schema.ts`) but `backend/shared/schema.ts` was out of date, causing Drizzle type errors in backend code.

**How to apply:** After every schema change, update both files and run:
1. `npm run db:push` (root)
2. `cd backend && npm run db:push` (backend — may prompt interactively)
