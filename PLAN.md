# eTask Frontend Fixes — Ralphex Plan

## Context
eTask is a task tracker Mini App for Telegram (Next.js 15 + Tailwind + Drizzle ORM + Neon Postgres).
The Mini App runs inside @oooih_bot. This plan fixes frontend UX bugs.

## Task 1: Task card refresh after mutation
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** After changing assignee or moving to a different board, the task card shows stale data. Priority updates work because localTask state is updated, but assignee display reads from `taskData?.assignee` (SWR response) which hasn't polled yet. Board label also stale after move.
**Fix:** 
- [x] Verify optimistic update + 5s poll defer works correctly for assignee (localAssignee, mutatedAt)
- [x] Ensure the board label in the card header reads from `localTask.boardId` (not stale SWR data)
- [x] Add test for optimistic assignee and board updates

## Task 2: Personal inbox assignee support
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** When a task is in personal inbox (boardId=null), the AssigneePicker has no members to show because `useMembers(resolvedChatId)` returns nothing (no chatId → no members).
**Fix:**
- [ ] For personal tasks (boardId=null), aggregate members from all boards or provide fallback
- [ ] Create useAllMembers() hook or pass fallback members list to AssigneePicker
- [ ] Add test for personal inbox assignee picker

## Task 3: Task description scrollable
**File:** `src/components/task-detail-sheet.tsx`
**Problem:** Long task descriptions are cut off in the card view.
**Fix:**
- [ ] Ensure description textarea auto-expands or has max-height with scroll
- [ ] Add test for description overflow behavior

## Task 4: Board avatars in board picker
**File:** `src/components/task-detail-sheet.tsx`, function `BoardPicker`
**Problem:** Board picker dropdown shows letter avatars instead of actual group photos.
**Fix:**
- [ ] Verify photoUrl rendering is working in BoardPicker
- [ ] Verify homeData.boards response includes photoUrl

## Task 5: Assignee picker shows bot only to admin
**File:** `src/components/task-detail-sheet.tsx`, function `AssigneePicker`  
**Problem:** Non-admin users can see and assign to the bot in the member list.
**Fix:**
- [ ] Filter out bot member (telegramUserId=8433233305) unless current user is admin (telegramUserId=247463948)
- [ ] Get current user's Telegram ID from useTelegram() context and pass to AssigneePicker
- [ ] Add test for bot filtering logic

## Notes
- SWR polling interval is 3s (`refreshInterval: 3000` in `src/hooks/use-board.ts`)
- The `dedupingInterval: 2000` prevents rapid re-fetches
- All API calls go through `useAuthMutate()` which sends `x-telegram-init-data` header
- Task detail uses `useTaskDetail(taskId)` for the single-task SWR key
