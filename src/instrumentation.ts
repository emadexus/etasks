export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      console.warn("[cron] CRON_SECRET not set, reminder cron disabled");
      return;
    }

    const INTERVAL = 60_000; // every 60 seconds
    const PORT = process.env.PORT || "3000";
    const BASE = `http://localhost:${PORT}`;

    console.log("[cron] Starting reminder cron (every 60s)");

    setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/notify/deadline?secret=${CRON_SECRET}`);
        const data = await res.json();
        if (data.processed > 0) {
          console.log(`[cron] Reminders: ${data.sent} sent, ${data.skipped} skipped`);
        }
      } catch (e) {
        console.error("[cron] Reminder check failed:", e);
      }
    }, INTERVAL);
  }
}
