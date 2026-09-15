import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;
const ALEF_VARIANTS = /[أإآٱ]/g;
const ALEF_MAKSURA = /ى/g;

function normalizeArabicName(name) {
  return name
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(ALEF_MAKSURA, "ي")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  console.log("pg_trgm extension ready.");

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
  });
  for (const customer of customers) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { nameNormalized: normalizeArabicName(customer.name) },
    });
  }
  console.log(`Backfilled nameNormalized for ${customers.length} customer(s).`);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS customer_name_trgm_idx
    ON "Customer" USING gin ("nameNormalized" gin_trgm_ops);
  `);
  console.log("Trigram index ready.");

  const invoices = await prisma.invoice.findMany({
    include: { order: { select: { customerId: true } } },
  });
  for (const invoice of invoices) {
    let customerId = invoice.order?.customerId ?? null;
    if (!customerId) {
      const match = await prisma.customer.findFirst({
        where: { phone: invoice.customerPhone },
        select: { id: true },
      });
      customerId = match?.id ?? null;
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        customerId,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        paidAmount: invoice.total,
      },
    });
  }
  console.log(`Backfilled payment fields for ${invoices.length} invoice(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
