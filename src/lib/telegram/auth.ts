import { createHmac } from "crypto";
import { getOrCreateUser } from "@/lib/db/queries";

export function validateInitData(initData: string): { userId: bigint; username: string | null; firstName: string } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(process.env.TG_BOT_TOKEN!)
    .digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;

  const user = JSON.parse(userStr);

  return {
    userId: BigInt(user.id),
    username: user.username || null,
    firstName: user.first_name,
  };
}

export function getAuthFromRequest(req: Request) {
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    // Dev bypass: return a fake user in development mode
    if (process.env.NODE_ENV === "development") {
      return {
        userId: BigInt(process.env.DEV_TELEGRAM_USER_ID || "247463948"),
        username: process.env.DEV_TELEGRAM_USERNAME || "dev_user",
        firstName: process.env.DEV_TELEGRAM_FIRST_NAME || "Dev",
      };
    }
    console.warn("No x-telegram-init-data header");
    return null;
  }
  const result = validateInitData(initData);
  if (!result) {
    console.warn("initData validation failed");
  }
  return result;
}

/** Resolves Telegram auth + ensures a users table record exists. */
export async function getAuthUser(req: Request) {
  const auth = getAuthFromRequest(req);
  if (!auth) return null;

  const user = await getOrCreateUser(auth.userId, auth.username, auth.firstName);
  return { ...auth, dbUserId: user.id };
}
