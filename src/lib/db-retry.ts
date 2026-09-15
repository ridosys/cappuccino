import { Prisma } from "@/generated/prisma/client";

const TRANSIENT_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);

function isTransientPrismaError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (TRANSIENT_CODES.has(error.code)) {
    return true;
  }

  const code =
    typeof error.meta === "object" &&
    error.meta &&
    "code" in error.meta &&
    typeof (error.meta as { code?: unknown }).code === "string"
      ? (error.meta as { code: string }).code
      : undefined;

  return !!code && TRANSIENT_CODES.has(code);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 4) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientPrismaError(error) || attempt >= retries) {
        throw error;
      }

      // Neon can suspend its compute after idling and take a few seconds to
      // wake on the next query (same cold-start the Prisma client's
      // transactionOptions already accounts for) — a plain query outside a
      // transaction hits that same wake-up delay as a raw ETIMEDOUT. The
      // previous 200/400ms backoff (600ms total) was too short to cover it;
      // this ramps up to ~5.8s across 4 retries, which comfortably absorbs a
      // typical cold start without dragging out a genuine outage forever.
      await sleep(Math.min(3000, 400 * 2 ** attempt));
      attempt += 1;
    }
  }
}
