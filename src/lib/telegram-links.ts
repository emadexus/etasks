const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
const BOT_DM_USERNAME = "oooih_bot";

export function openBotDeepLink(taskId: string, _boardId?: string | null) {
  const taskLink = `https://t.me/${BOT_USERNAME}/open?startapp=task${taskId}`;
  const text = `${taskLink}\n\n`;
  // Group deep links require a group username which we don't store,
  // so all tasks open the bot DM regardless of board context.
  const deepLink = `https://t.me/${BOT_DM_USERNAME}?text=${encodeURIComponent(text)}`;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(deepLink);
  } else {
    window.open(deepLink, "_blank");
  }
}

export function getTaskLink(taskId: string): string {
  return `https://t.me/${BOT_USERNAME}/open?startapp=task${taskId}`;
}
