import "server-only";
import { prisma } from "@/lib/prisma";

/** Active products only — a Telegram voice order should never resolve to a
 * product that's been deactivated, mirroring how POS only sells ACTIVE
 * products (`src/features/pos/queries.ts`). */
export async function getProductsForVoiceMatching() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      description: true,
      sku: true,
      barcode: true,
      price1: true,
    },
  });
}

export type ProductForVoiceMatching = Awaited<
  ReturnType<typeof getProductsForVoiceMatching>
>[number];

export async function getTelegramAccountForAdmin(adminId: string) {
  return prisma.telegramAccount.findUnique({ where: { adminId } });
}
