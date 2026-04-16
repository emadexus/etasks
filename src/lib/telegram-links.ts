const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
const BOT_DM_USERNAME = process.env.NEXT_PUBLIC_BOT_DM_USERNAME || "oooih_bot";

export function getTaskLink(taskId: string): string {
  return `https://t.me/${BOT_USERNAME}/open?startapp=task${taskId}`;
}

export function openBotDeepLink(taskId: string) {
  const taskLink = getTaskLink(taskId);
  const tg = (window as any).Telegram?.WebApp;

  // Detect if we're already inside the bot's own DM chat.
  // When true, openTelegramLink with ?text= is silently dropped by Telegram.
  const chatUsername = tg?.initDataUnsafe?.chat?.username;
  const isInBotDM = chatUsername === BOT_DM_USERNAME;

  if (isInBotDM) {
    // Copy task link to clipboard and collapse the Mini App so user can paste
    navigator.clipboard?.writeText(taskLink).catch(() => {});
    if (tg?.showPopup) {
      tg.showPopup(
        {
          message: '📋 Ссылка скопирована — вставьте в чат',
          buttons: [{ type: 'close' }],
        },
        () => tg.collapse?.()
      );
    } else {
      tg?.collapse?.();
    }
    return;
  }

  // Default: open bot DM with task link pre-filled (works when navigating FROM another chat)
  const text = `${taskLink}\n\n`;
  const deepLink = `https://t.me/${BOT_DM_USERNAME}?text=${encodeURIComponent(text)}`;
  try {
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(deepLink);
      return;
    }
  } catch (_) {
    /* fall through */
  }
  window.open(deepLink, "_blank");
}
