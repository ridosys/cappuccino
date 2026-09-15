"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { withDocumentNumber } from "@/lib/document-number";
import { isUniqueConstraintErrorOn } from "@/lib/prisma-errors";
import { slugify, ensureUniqueSlug } from "@/lib/slug";
import { applyPurchaseReceipt } from "@/features/purchases/receive";
import { supplierSchema } from "@/features/suppliers/schema";
import {
  confirmScannedPurchaseSchema,
  type ConfirmScannedPurchaseOutput,
} from "@/features/purchases/scan-schema";
import { getDictionary } from "@/i18n/server";

type ActionResult = { error?: string; success?: boolean };

export type ConfirmScannedPurchaseResult =
  | { success: true; orderId: string; alreadyExists?: boolean }
  | { error: string; duplicateOrderId?: string };

/**
 * Turns a reviewed, admin-confirmed scanned invoice into a real purchase
 * order (and, when asked, receives it) through the same building blocks the
 * manual flow uses. Nothing here trusts the client or the AI: the supplier
 * and every product are re-read from the database, totals are recomputed,
 * and quantities/prices come only from the Zod-validated payload.
 */
export async function confirmScannedPurchase(
  input: unknown,
): Promise<ConfirmScannedPurchaseResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = confirmScannedPurchaseSchema.safeParse(input);
  if (!parsed.success) return { error: t.purchases.validationError };
  const data = parsed.data;

  // A line with no match in the system carries `newProduct` instead of a
  // `productId` — creating a product is a separate permission from managing
  // purchases, so this is gated on top of (not instead of) PURCHASES_MANAGE.
  const newProductLines = data.lines.filter(
    (
      line,
    ): line is typeof line & {
      newProduct: NonNullable<ConfirmScannedPurchaseOutput["lines"][number]["newProduct"]>;
    } => Boolean(line.newProduct),
  );
  if (newProductLines.length > 0) {
    const productAccess = await requirePermission("PRODUCTS_MANAGE");
    if (!productAccess.ok) return { error: productAccess.error };
  }

  // Idempotency: a retried / double-clicked Confirm resolves to the order it
  // already created.
  const existing = await prisma.purchaseOrder.findUnique({
    where: { scanIdempotencyKey: data.idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { success: true, orderId: existing.id, alreadyExists: true };
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: data.supplierId },
    select: { id: true },
  });
  if (!supplier) return { error: t.purchaseScan.supplierNotFoundError };

  // Re-read every referenced EXISTING product from the DB — never trust
  // client IDs. Lines with `newProduct` have no productId yet; those are
  // created inside the transaction below instead.
  const productIds = [
    ...new Set(
      data.lines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, purchasePrice: true },
      })
    : [];
  if (products.length !== productIds.length) {
    return { error: t.purchaseScan.unresolvedLinesError };
  }
  const currentPriceById = new Map(
    products.map((p) => [p.id, Number(p.purchasePrice)]),
  );

  // Friendly, fast pre-checks for the new-product lines — the DB's unique
  // constraints (sku/slug/barcode) inside the transaction are the real
  // guarantee against a race.
  let takenSlugs = new Set<string>();
  if (newProductLines.length > 0) {
    const [existingProducts, categories, brands] = await Promise.all([
      prisma.product.findMany({ select: { sku: true, slug: true } }),
      prisma.category.findMany({ select: { id: true } }),
      prisma.brand.findMany({ select: { id: true } }),
    ]);
    const takenSkus = new Set(existingProducts.map((p) => p.sku));
    takenSlugs = new Set(existingProducts.map((p) => p.slug));
    const categoryIds = new Set(categories.map((c) => c.id));
    const brandIds = new Set(brands.map((b) => b.id));

    const skusInThisRequest = new Set<string>();
    for (const line of newProductLines) {
      const np = line.newProduct;
      if (takenSkus.has(np.sku) || skusInThisRequest.has(np.sku)) {
        return { error: t.products.uniqueFieldsError };
      }
      skusInThisRequest.add(np.sku);
      if (!categoryIds.has(np.categoryId)) {
        return { error: t.purchases.validationError };
      }
      if (np.brandId && !brandIds.has(np.brandId)) {
        return { error: t.purchases.validationError };
      }
    }
  }

  // Hard duplicate-import guard (the DB unique index is the real guarantee;
  // this is the friendly early check).
  if (data.supplierInvoiceNumber) {
    const dup = await prisma.purchaseOrder.findFirst({
      where: {
        supplierId: data.supplierId,
        supplierInvoiceNumber: data.supplierInvoiceNumber,
      },
      select: { id: true },
    });
    if (dup) {
      return {
        error: t.purchaseScan.duplicateInvoiceError,
        duplicateOrderId: dup.id,
      };
    }
  }

  const total = data.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0,
  );
  const supplierInvoiceDate = data.supplierInvoiceDate
    ? new Date(`${data.supplierInvoiceDate}T12:00:00`)
    : null;

  let orderId: string;
  try {
    const order = await withDocumentNumber("PURCHASE_ORDER", (orderNumber) =>
      prisma.$transaction(async (tx) => {
        // Create any brand-new products first, so every line below has a
        // real productId to reference. A fresh copy of takenSlugs per
        // attempt — withDocumentNumber retries this whole callback on an
        // orderNumber collision, and the transaction rolling back means any
        // products created on a failed attempt never actually persisted.
        const slugsInUse = new Set(takenSlugs);
        const resolvedLines: {
          productId: string;
          quantity: number;
          unitCost: number;
          price1: number | undefined;
          updateProductPurchasePrice: boolean;
          isNewProduct: boolean;
        }[] = [];
        for (const line of data.lines) {
          if (line.productId) {
            resolvedLines.push({
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              price1: line.price1,
              updateProductPurchasePrice: line.updateProductPurchasePrice,
              isNewProduct: false,
            });
            continue;
          }
          const np = line.newProduct!;
          const slug = ensureUniqueSlug(
            slugify(np.name) || slugify(np.sku) || "product",
            slugsInUse,
          );
          const newProduct = await tx.product.create({
            data: {
              name: np.name,
              slug,
              sku: np.sku,
              barcode: np.barcode,
              categoryId: np.categoryId,
              brandId: np.brandId,
              price1: np.price1,
              price2: np.price1,
              price3: np.price1,
              purchasePrice: line.unitCost,
              createdById: access.adminId,
              // Same anchor createProduct writes for a manually-added
              // product — without this, any historical asOfDate between
              // this purchase and the product's first later price edit
              // would fall back to today's live price instead.
              priceHistory: {
                create: {
                  purchasePrice: line.unitCost,
                  reason: `السعر الأولي عند إنشائه من فاتورة شراء ممسوحة رقم ${orderNumber}`,
                  createdById: access.adminId,
                },
              },
            },
            select: { id: true },
          });
          resolvedLines.push({
            productId: newProduct.id,
            quantity: line.quantity,
            unitCost: line.unitCost,
            price1: undefined,
            updateProductPurchasePrice: false,
            isNewProduct: true,
          });
        }

        const created = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            supplierId: data.supplierId,
            language: data.language,
            total,
            supplierInvoiceNumber: data.supplierInvoiceNumber,
            supplierInvoiceDate,
            scanIdempotencyKey: data.idempotencyKey,
            createdById: access.adminId,
            items: {
              create: resolvedLines.map((line, index) => ({
                productId: line.productId,
                quantity: line.quantity,
                unitCost: line.unitCost,
                position: index + 1,
              })),
            },
            attachments: {
              create: data.attachments.map((attachment) => ({
                publicId: attachment.publicId,
                secureUrl: attachment.secureUrl,
                fileName: attachment.fileName,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
                resourceType: attachment.resourceType,
                uploadedById: access.adminId,
              })),
            },
          },
          select: { id: true },
        });

        // Price sync for EXISTING products — a brand-new product's price1,
        // purchasePrice and price history were already set when it was
        // created above, so this only runs for matched lines. price1
        // always follows the line (it defaults to the product's current
        // price1, so an untouched line is a no-op write); purchasePrice
        // only follows unitCost when explicitly opted in — only a real
        // change there is worth a ProductPriceHistory row.
        for (const line of resolvedLines) {
          if (line.isNewProduct) continue;
          if (line.price1 === undefined && !line.updateProductPurchasePrice) {
            continue;
          }
          await tx.product.update({
            where: { id: line.productId },
            data: {
              ...(line.price1 !== undefined ? { price1: line.price1 } : {}),
              ...(line.updateProductPurchasePrice
                ? { purchasePrice: line.unitCost }
                : {}),
            },
          });
          if (
            line.updateProductPurchasePrice &&
            currentPriceById.get(line.productId) !== line.unitCost
          ) {
            await tx.productPriceHistory.create({
              data: {
                productId: line.productId,
                purchasePrice: line.unitCost,
                reason: `تحديث السعر من فاتورة شراء ممسوحة رقم ${orderNumber}`,
                reference: orderNumber,
                createdById: access.adminId,
              },
            });
          }
        }

        if (data.receiveNow) {
          await applyPurchaseReceipt(tx, {
            id: created.id,
            orderNumber,
            items: resolvedLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          });
        }

        return created;
      }),
    );
    orderId = order.id;
  } catch (error) {
    if (
      isUniqueConstraintErrorOn(error, "sku") ||
      isUniqueConstraintErrorOn(error, "slug") ||
      isUniqueConstraintErrorOn(error, "barcode")
    ) {
      return { error: t.products.uniqueFieldsError };
    }
    // A race that beat us to the same supplier invoice number or idempotency
    // key. withDocumentNumber only retries collisions on orderNumber, so any
    // other P2002 lands here.
    if (
      isUniqueConstraintErrorOn(error, "supplierInvoiceNumber") ||
      isUniqueConstraintErrorOn(error, "supplierId")
    ) {
      return { error: t.purchaseScan.duplicateInvoiceError };
    }
    if (isUniqueConstraintErrorOn(error, "scanIdempotencyKey")) {
      const again = await prisma.purchaseOrder.findUnique({
        where: { scanIdempotencyKey: data.idempotencyKey },
        select: { id: true },
      });
      if (again) return { success: true, orderId: again.id, alreadyExists: true };
    }
    return { error: t.purchaseScan.createFailedError };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true, orderId };
}

/** Inline "add supplier" from the scanner's review screen. Separate
 * permission from PURCHASES_MANAGE because it creates a supplier record. */
export async function quickCreateSupplier(
  input: unknown,
): Promise<ActionResult & { supplier?: { id: string; name: string } }> {
  const access = await requirePermission("SUPPLIERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: t.suppliers.validationError };

  const supplier = await prisma.supplier.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      createdById: access.adminId,
    },
    select: { id: true, name: true },
  });

  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/purchases/scan");
  return { success: true, supplier };
}
