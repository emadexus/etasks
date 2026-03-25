import { Bot } from "grammy";

if (!process.env.TG_BOT_TOKEN) {
  throw new Error("TG_BOT_TOKEN is required");
}

export const bot = new Bot(process.env.TG_BOT_TOKEN);
