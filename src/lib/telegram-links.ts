const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
const BOT_DM_USERNAME = process.env.NEXT_PUBLIC_BOT_DM_USERNAME || "oooih_bot";

export function getTaskLink(taskId: string): string {
  return `https://t.me/${BOT_USERNAME}/open?startapp=task${taskId}`;
}

export function openBotDeepLink(taskId: string) {
  const taskLink = getTaskLink(taskId);
  const text = `${taskLink}\n\n`;
  const deepLink = `https://t.me/${BOT_DM_USERNAME}?text=${encodeURIComponent(text)}`;
  const tg = (window as any).Telegram?.WebApp;
  try {
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(deepLink);
      return;
    }
  } catch (_) { /* fall through to window.open */ }
  window.open(deepLink, "_blank");
}
