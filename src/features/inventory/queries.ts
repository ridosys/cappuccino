import "server-only";
import { prisma } from "@/lib/prisma";

export const MOVEMENTS_PAGE_SIZE = 15;

export async function getInventoryMovementsPage({ page }: { page: number }) {
  // Legacy databases can contain movements whose product was removed before
  // the current foreign-key restriction was introduced.
  const where = { product: { isNot: null } };

  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MOVEMENTS_PAGE_SIZE,
      take: MOVEMENTS_PAGE_SIZE,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return {
    items: items.map((item) => ({ ...item, quantity: item.quantity.toNumber() })),
    total,
    pageSize: MOVEMENTS_PAGE_SIZE,
  };
}
