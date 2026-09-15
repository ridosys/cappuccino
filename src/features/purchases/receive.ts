import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The stock side-effect of receiving a purchase order: mark it RECEIVED and,
 * for every line, add the ordered quantity to the product and write the
 * matching `IN` inventory movement.
 *
 * This is the single source of truth for "goods arrived" — used both by the
 * manual status change (`updatePurchaseOrderStatus`) and by the AI invoice
 * scanner's Confirm (`confirmScannedPurchase`). Callers run it inside their
 * own `prisma.$transaction`. It never decrements, so it can't drive stock
 * negative and it has no bearing on the negative-stock rules elsewhere.
 */
export async function applyPurchaseReceipt(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    orderNumber: string;
    items: { productId: string; quantity: Prisma.Decimal | number }[];
  },
): Promise<void> {
  await tx.purchaseOrder.update({
    where: { id: order.id },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "IN",
        quantity: item.quantity,
        reference: order.orderNumber,
        reason: "استلام أمر شراء",
      },
    });
  }
}
