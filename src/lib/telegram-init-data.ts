import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Telegram Mini App's `initData` string server-side, per
 * Telegram's documented algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * The Mini App is never trusted just because it's running "inside" Telegram
 * — every Server Action it calls re-verifies `initData` itself, since it's
 * just a query string the client controls until this check passes.
 */

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export type TelegramInitDataUser = {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
};

export type VerifyInitDataResult =
  | { ok: true; telegramUserId: bigint; user: TelegramInitDataUser }
  | { ok: false; reason: "missing_hash" | "bad_signature" | "stale" | "bad_payload" };

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
): VerifyInitDataResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing_hash" };
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const expected = Buffer.from(computedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return { ok: false, reason: "bad_payload" };
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) {
    return { ok: false, reason: "stale" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "bad_payload" };
  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (
    typeof userJson !== "object" ||
    userJson === null ||
    typeof (userJson as { id?: unknown }).id !== "number"
  ) {
    return { ok: false, reason: "bad_payload" };
  }
  const raw = userJson as {
    id: number;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
  };

  return {
    ok: true,
    telegramUserId: BigInt(raw.id),
    user: {
      id: raw.id,
      firstName: typeof raw.first_name === "string" ? raw.first_name : "",
      lastName: typeof raw.last_name === "string" ? raw.last_name : null,
      username: typeof raw.username === "string" ? raw.username : null,
    },
  };
}
