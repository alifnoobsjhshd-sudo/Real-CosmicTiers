---
name: Tester list source of truth
description: Website tester section must only show isTester=true players to stay in sync with the bot's Discord role list.
---

## Rule
The website's `getTesters()` in `backend/src/storage.ts` must query **only** `players WHERE isTester=true`. Do NOT include players from `result_entries` who are not in the players table ("ghost testers"), and do NOT include players who had `isTester` revoked (they still have result_entries rows).

**Why:** The old query used `OR isTester=true OR discordId IN (result_entries.testerDiscordId)` which included deleted/unregistered/former testers that the Discord bot would never show (bot shows only active role members).

**How to apply:** The fix is a simple `WHERE isTester = true` on the players table. The bonus test count (`bonusTestCount`) is added on top of the period stats at display time.
