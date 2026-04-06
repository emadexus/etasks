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

/** Check for admin API key in Authorization header. Returns admin identity if valid. */
export function getAdminAuth(req: Request): { userId: bigint; username: string | null; firstName: string; isAdmin: true } | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || token !== adminKey) return null;

  // Admin acts as the configured admin user
  const adminTelegramId = BigInt(process.env.ADMIN_TELEGRAM_ID || "247463948");
  const adminUsername = process.env.ADMIN_USERNAME || "emadex";
  const adminFirstName = process.env.ADMIN_FIRST_NAME || "E";

  return {
    userId: adminTelegramId,
    username: adminUsername,
    firstName: adminFirstName,
    isAdmin: true,
  };
}

export function getAuthFromRequest(req: Request) {
  // Check admin API key first
  const adminAuth = getAdminAuth(req);
  if (adminAuth) return adminAuth;

  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
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

/** Admin-only auth: returns admin identity with impersonation support. */
export function getAdminOnlyAuth(req: Request) {
  const adminAuth = getAdminAuth(req);
  if (!adminAuth) return null;
  return adminAuth;
}
