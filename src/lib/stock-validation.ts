import "server-only";

import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

export type AvailableStockIssue = {
  product: string;
  requested: number;
  available: number;
};

/**
 * `items`/`existingItems` must already be plain numbers — a caller passing
 * live Prisma rows (e.g. InvoiceItem/OrderItem, whose `quantity` is a
 * Prisma.Decimal) needs to map `Number(item.quantity)`/`item.quantity.toNumber()`
 * first, or the accumulation below would silently string-concatenate
 * instead of sum.
 */
export async function getAvailableStockIssue(
  items: Array<{ productId?: string | null; quantity: number }>,
  existingItems: Array<{ productId?: string | null; quantity: number }> = [],
): Promise<AvailableStockIssue | null> {
  const requestedByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    requestedByProduct.set(
      item.productId,
      (requestedByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }
  if (requestedByProduct.size === 0) return null;

  const existingByProduct = new Map<string, number>();
  for (const item of existingItems) {
    if (!item.productId) continue;
    existingByProduct.set(
      item.productId,
      (existingByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...requestedByProduct.keys()] } },
    select: { id: true, name: true, quantity: true },
  });

  for (const product of products) {
    const requested = requestedByProduct.get(product.id) ?? 0;
    // product.quantity is a live Prisma.Decimal — .toNumber() before the
    // `+` avoids silent string concatenation (Decimal.valueOf() returns a
    // string, which a native `+` treats as a string operand).
    const available =
      product.quantity.toNumber() + (existingByProduct.get(product.id) ?? 0);
    if (requested > available) {
      return { product: product.name, requested, available };
    }
  }
  return null;
}

export async function validateAvailableStock(
  items: Array<{ productId?: string | null; quantity: number }>,
  existingItems: Array<{ productId?: string | null; quantity: number }> = [],
): Promise<string | null> {
  const issue = await getAvailableStockIssue(items, existingItems);
  if (!issue) return null;
  const t = await getDictionary();
  return formatMessage(t.common.insufficientProductStockTemplate, issue);
}
