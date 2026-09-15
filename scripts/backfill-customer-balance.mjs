import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Historical invoices never used من الرصيد (the method didn't exist yet),
  // so each one's lifetime effect on its customer's رصيد is simply whatever
  // was overpaid beyond its total — matching computeBalanceEffect() for a
  // payment set with no BALANCE-method lines.
  await prisma.$executeRawUnsafe(`
    UPDATE "Invoice"
    SET "balanceEffectApplied" = GREATEST(0, "paidAmount" - total)
  `);

  const rows = await prisma.$queryRaw`
    SELECT "customerId", COALESCE(SUM("balanceEffectApplied"), 0) AS "balance"
    FROM "Invoice"
    WHERE "customerId" IS NOT NULL
    GROUP BY "customerId"
  `;

  for (const row of rows) {
    await prisma.customer.update({
      where: { id: row.customerId },
      data: { balance: Number(row.balance) },
    });
  }

  console.log(
    `Backfilled balanceEffectApplied on all invoices and balance for ${rows.length} customer(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
