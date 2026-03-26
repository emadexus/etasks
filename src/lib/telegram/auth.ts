import { createHmac } from "crypto";

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
    console.warn("No x-telegram-init-data header");
    return null;
  }
  const result = validateInitData(initData);
  if (!result) {
    console.warn("initData validation failed");
  }
  return result;
}
