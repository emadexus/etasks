# eTask — Remove Bot Logic, Pure Human Task Manager

## Context
eTask was originally designed for human task management but accumulated bot-specific complications: an "Ooih Bot" admin-only filter, hardcoded admin/bot Telegram IDs in the API, bot member records on every board, special hiding of bot tasks for non-admin users.

The bot now uses `/agent/SCHEDULE.md` (local file) for its own scheduling. eTask should become a pure human task management Mini App with no awareness of the bot.

Files to read for context:
- `src/lib/db/queries.ts` — `upsertMember`, `getSmartFilterCounts`, `getFilteredTasks`
- `src/components/home-screen.tsx` — smart filters including "ooih"
- `src/components/task-detail-sheet.tsx` — assignee picker with bot filtering
- `src/app/api/admin/tasks/[id]/route.ts` — bot task protection in GET/PATCH
- `src/app/api/admin/tasks/route.ts` — bot task filtering in list
- `src/app/api/user/tasks/route.ts` — bot task filtering for non-admin
- `src/app/api/home/route.ts` — counts including ooih
- `src/lib/i18n.ts` — "ooih" labels

## Task 1: [x] Remove "Ooih Bot" smart filter from home screen
**File:** `src/components/home-screen.tsx`
**Problem:** The smart filters list includes an "ooih" entry that shows bot tasks. With the bot's tasks moved out of eTask entirely, this filter is dead.
**Fix:** Remove the `{ key: "ooih", ... }` entry from the `smartFilters` array. Remove the admin check filter (`.filter(f => f.key !== "ooih" || tgUserId === "247463948")`) since it's no longer needed. Remove the "bot" icon case from the FilterIcon component.

## Task 2: [x] Remove ooih count from home API
**Files:** `src/lib/db/queries.ts` (`getSmartFilterCounts`), `src/app/api/home/route.ts`
**Problem:** `getSmartFilterCounts` calculates an `ooih` count by querying bot member records. This is dead code now.
**Fix:** Remove the bot member ID lookup and `ooihCount` calculation. Remove `ooih: ooihCount` from the returned object. Remove any references to the bot Telegram ID in this function.

## Task 3: [x] Remove ooih filter from getFilteredTasks
**File:** `src/lib/db/queries.ts` (`getFilteredTasks`)
**Problem:** The function has a `case "ooih":` branch that queries bot member tasks across all boards. Dead code.
**Fix:** Remove the entire `case "ooih":` block.

## Task 4: [x] Remove bot task protection from API endpoints
**Files:** `src/app/api/admin/tasks/[id]/route.ts`, `src/app/api/admin/tasks/route.ts`, `src/app/api/user/tasks/route.ts`
**Problem:** GET and PATCH check if the task assignee is the bot (8433233305) and return 404/403 for non-admin. List endpoints filter out bot tasks. All this complexity exists to hide bot tasks from non-admin users.
**Fix:** Remove the bot Telegram ID checks and the `BOT_TG_ID`/`ADMIN_TG_ID` constants from these route files. Bot tasks no longer exist in eTask, so this filtering is obsolete. Just let the normal authorization (board membership) handle access.

## Task 5: [x] Remove bot identity override in upsertMember
**File:** `src/lib/db/queries.ts` (`upsertMember`)
**Problem:** The function has a special case: if `telegramUserId === BigInt("8433233305")`, override `firstName="Ooih"` and `username="oooih_bot"`. This was needed because the bot was being added as a member when the migration script ran. With bot tasks gone from eTask, this is dead code.
**Fix:** Remove the bot ID check at the top of `upsertMember`. The function should treat all telegram IDs equally.

## Task 6: [x] Remove ooih i18n strings
**File:** `src/lib/i18n.ts`
**Problem:** "Ooih Bot" and "Ooih Бот" labels exist in the EN and RU translation maps but are no longer referenced.
**Fix:** Remove the `ooih:` lines from both EN and RU translation objects.

## Task 7: [x] Add UUID validation to admin tasks API
**File:** `src/app/api/admin/tasks/[id]/route.ts`
**Problem:** When passed an invalid UUID (8-char short ID), the API crashes with a NeonDbError 500 instead of returning 400. The bot has been hitting this constantly when using short IDs from CLI tools.
**Fix:** At the top of GET, PATCH, DELETE handlers, validate the `id` param against a UUID v4 regex:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(id)) {
  return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });
}
```

## Notes
- This is a removal task, not a feature task. The success criterion is fewer lines of code, fewer concepts in the UI.
- Make sure existing tests still pass (or update them).
- Don't break anything else — this is pure cleanup.
- Keep changes minimal and focused.
