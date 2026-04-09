# eTask Frontend Fixes — Ralphex Plan

## Context
eTask is a task tracker Mini App for Telegram (Next.js 15 + Tailwind + Drizzle ORM + Neon Postgres).
The Mini App runs inside @oooih_bot. This plan fixes frontend UX bugs.

## Task 1: Task card refresh after mutation
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** After changing assignee or moving to a different board, the task card shows stale data. Priority updates work because localTask state is updated, but assignee display reads from `taskData?.assignee` (SWR response) which hasn't polled yet. Board label also stale after move.
**Fix:** 
- The optimistic update + 5s poll defer is already implemented (localAssignee, mutatedAt). Verify it works correctly.
- Ensure the board label in the card header reads from `localTask.boardId` (not stale SWR data).
- Test: change assignee → name should update instantly. Move board → label should update instantly.

## Task 2: Personal inbox assignee support
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** When a task is in personal inbox (boardId=null), the AssigneePicker has no members to show because `useMembers(resolvedChatId)` returns nothing (no chatId → no members).
**Fix:**
- For personal tasks (boardId=null), fetch ALL unique members the user has access to (from all their boards) or at minimum show the admin + bot as assignable.
- Option: create a new hook `useAllMembers()` that aggregates across boards, or pass a fallback members list to AssigneePicker.

## Task 3: Task description scrollable
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** Long task descriptions are cut off in the card view.
**Fix:** The description textarea already exists. Verify it has proper overflow/scroll. If it's a fixed height, make it auto-expand or add max-height with scroll.

## Task 4: Board avatars in board picker
**File:** `src/components/task-detail-sheet.tsx`, function `BoardPicker`
**Problem:** Board picker dropdown shows letter avatars instead of actual group photos.
**Fix:** Already implemented — `photoUrl` rendering added. Verify the `homeData.boards` response includes `photoUrl` for boards that have group photos. If photos are missing from the DB, they need to be fetched from Telegram API (separate task — not frontend).

## Task 5: Assignee picker shows bot only to admin
**File:** `src/components/task-detail-sheet.tsx`, function `AssigneePicker`  
**Problem:** Non-admin users can see and assign to the bot in the member list.
**Fix:**
- Get the current user's Telegram ID from `useTelegram()` context.
- In AssigneePicker, filter out the bot member (telegramUserId=8433233305) unless the current user is admin (telegramUserId=247463948).
- The `members` list comes from `useMembers()` which returns member objects with `telegramUserId`. Filter before rendering.

## Notes
- SWR polling interval is 3s (`refreshInterval: 3000` in `src/hooks/use-board.ts`)
- The `dedupingInterval: 2000` prevents rapid re-fetches
- All API calls go through `useAuthMutate()` which sends `x-telegram-init-data` header
- Task detail uses `useTaskDetail(taskId)` for the single-task SWR key
