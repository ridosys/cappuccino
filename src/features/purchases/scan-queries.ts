import "server-only";
import { prisma } from "@/lib/prisma";

/** Every product, with the fields the invoice-scanner matcher compares
 * against. The catalog for a small/mid business is at most a few thousand
 * rows, so matching runs in application code over this list rather than in
 * SQL — deterministic, testable, and no DB extension dependency. */
export async function getProductsForMatching() {
  return prisma.product.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      sku: true,
      barcode: true,
      purchasePrice: true,
    },
  });
}

export type ProductForMatching = Awaited<
  ReturnType<typeof getProductsForMatching>
>[number];

export async function getSuppliersForMatching() {
  return prisma.supplier.findMany({
    select: { id: true, name: true, phone: true },
  });
}

export type SupplierForMatching = Awaited<
  ReturnType<typeof getSuppliersForMatching>
>[number];

/** Is there already a purchase order for this supplier carrying this exact
 * supplier invoice number? Used both for the soft warning shown in the
 * review screen and (re-checked) as the hard block on Confirm. */
export async function findPurchaseOrderBySupplierInvoice(
  supplierId: string,
  supplierInvoiceNumber: string,
) {
  return prisma.purchaseOrder.findFirst({
    where: { supplierId, supplierInvoiceNumber },
    select: { id: true, orderNumber: true, createdAt: true },
  });
}
