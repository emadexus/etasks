# eTask — Forward to Bot Feature

## Context
Currently, to ask the bot to work on a task, users have to:
1. Open the task card
2. Add a comment with @oooih_bot mention
3. Hope the bot picks it up

This is clunky. Better UX: a small button on each task card that opens the bot chat with the task link pre-filled.

## How it works
- Each task card has a small "🤖" or "Ask bot" button
- Tapping it constructs a Telegram deep link: `https://t.me/oooih_bot?text=<encoded-task-link>%20`
  - The `text` param pre-fills the message input with the task link + a space
  - User adds their instruction and sends
- Alternatively, if the task is on a board (group chat), the link could open THAT chat instead, with `@oooih_bot <task-link> ` pre-filled

## Task 1: [x] Add forward-to-bot button to TaskCard component
**File:** `src/components/task-card.tsx`
**Goal:** Add a small icon button (🤖 or send-arrow) at the right side of the task card, next to the priority/comment count icons. Tapping it should:
1. Construct the task link: `https://t.me/oooih_bot/open?startapp=task<id>`
2. Construct the deep link to open Ooih bot DM: `https://t.me/oooih_bot?text=<encoded>`
3. Open the link via `window.Telegram.WebApp.openTelegramLink(...)` or fallback to `window.open()`

The pre-filled text should be: `<task-link>\n\n` so the user just types their instruction below.

Use a small unobtrusive icon — same size as the existing comment-count icon. Color: muted, becomes accent on hover.

## Task 2: [x] Add forward-to-bot button to TaskDetailSheet
**File:** `src/components/task-detail-sheet.tsx`
**Goal:** Same button in the task detail bottom sheet. Place it near the "copy link" button that already exists. Same behavior as Task 1.

## Task 3: [x] Make the button context-aware (group vs DM)
**File:** Wherever the button is implemented
**Goal:** If the task belongs to a board (group chat), the button should offer two options OR default to opening the group chat with `@oooih_bot <link>` pre-filled (using `tg://resolve?domain=<group>&...` or similar).

If you can't easily target a group chat with deep link, just open the bot DM by default. Don't over-engineer this — the bot DM works for all cases since the bot has access to all boards.

## Task 4: [x] i18n labels
**File:** `src/lib/i18n.ts`
**Goal:** Add EN and RU labels:
- `forwardToBot: "Forward to bot"` (EN)
- `forwardToBot: "Передать боту"` (RU)
- `askBot: "Ask bot"` (EN, for tooltip)
- `askBot: "Спросить бота"` (RU)

## Notes
- The button is small and unobtrusive — don't make it dominant
- It doesn't replace comments or assignments — it's a quick "send to bot" shortcut
- The bot will then receive the link in chat, click it (or fetch the task by ID), see the user's instruction, and act
- This is the cleanest "ask the bot to handle a task" UX
