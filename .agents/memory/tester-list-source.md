---
name: Tester list source of truth
description: Website tester section — what players qualify as testers, ghost exclusion, and period filtering.
---

## Rule — Who is a tester on the website
`getTesters()` in both `server/storage.ts` and `backend/src/storage.ts` must show:
- Players with `isTester = true` (explicitly set by bot via `/api/bot/tester-role`)
- OR players with rows in `result_entries` as a tester (registered players who ran tests)
- NEVER ghost testers (accounts in `result_entries` but NOT in the `players` table)

The query is: `WHERE isTester=true OR discordId IN (SELECT DISTINCT testerDiscordId FROM result_entries)` — but only players in the `players` table are returned, so ghost accounts are naturally excluded.

**Why:** Changing to `isTester=true` only is too aggressive — many legitimate testers have `result_entries` rows but their `isTester` flag was never explicitly set (sync gaps with the bot). This caused the website to show nothing after the "ghost tester" fix.

**How to apply:** Keep the OR condition, query from `players` table only. Ghost testers never appear because the outer query is on `players`. Do not remove the OR condition.

## Period filtering
Both `server/routes.ts` and `backend/src/routes.ts` accept `?period=alltime|month|year`.
The website frontend uses `queryKey: [\`/api/testers?period=${testerPeriod}\`]` so TanStack Query refetches when the period changes. The default fetcher joins the key array with "/" and uses it as the URL, so a single-element array with the full URL (including query string) works correctly.
