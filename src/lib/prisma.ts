import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
  adapter?: PrismaPg;
};

function withPgSslCompatibility(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    const hasLibpqCompat = url.searchParams.has("uselibpqcompat");

    if (sslMode === "require" && !hasLibpqCompat) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool =
  globalForPrisma.pool ??
  new Pool({ connectionString: withPgSslCompatibility(databaseUrl) });

const adapter = globalForPrisma.adapter ?? new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Neon can suspend its compute after idling and take a few seconds to
    // wake on the next query; the default 2s/5s transaction limits are too
    // tight for that cold start and surface as P2028 "unable to start a
    // transaction in the given time" on the first request after idle.
    transactionOptions: {
      maxWait: 15000,
      timeout: 20000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.adapter = adapter;
  globalForPrisma.prisma = prisma;
}
