"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { computePaymentStatus } from "@/lib/money";
import { isDeletePasswordValid, getDeletePasswordError } from "@/lib/delete-guard";
import { isUniqueConstraintErrorOn } from "@/lib/prisma-errors";
import { withDocumentNumber } from "@/lib/document-number";
import { applyPurchaseReceipt } from "@/features/purchases/receive";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";
import {
  purchaseOrderSchema,
  purchaseOrderItemsSchema,
  purchaseAttachmentSchema,
} from "@/features/purchases/schema";
import type {
  PaymentMethod,
  PurchaseOrderStatus,
  InvoiceLanguage,
  Prisma,
} from "@/generated/prisma/client";

type ActionResult = { error?: string; success?: boolean };

const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "PENDING",
  "RECEIVED",
  "CANCELLED",
];

const INVOICE_LANGUAGES: InvoiceLanguage[] = ["AR", "EN", "FR"];

export async function createPurchaseOrder(
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = purchaseOrderSchema.safeParse(input);
  if (!parsed.success) return { error: t.purchases.validationError };

  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  // Fetched up front (before the transaction) so the price-sync loop below
  // can tell an actual price change from a no-op resave of the same value
  // — only a real change is worth a ProductPriceHistory row.
  const priceSyncItems = parsed.data.items.filter(
    (item) => item.updateProductPurchasePrice,
  );
  const currentPrices =
    priceSyncItems.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: priceSyncItems.map((item) => item.productId) } },
          select: { id: true, purchasePrice: true },
        })
      : [];
  const currentPriceById = new Map(
    currentPrices.map((product) => [product.id, Number(product.purchasePrice)]),
  );

  const order = await withDocumentNumber("PURCHASE_ORDER", (orderNumber) =>
    prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: parsed.data.supplierId,
        language: parsed.data.language,
        total,
        createdById: access.adminId,
        items: {
          create: parsed.data.items.map((item, index) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            position: index + 1,
          })),
        },
        attachments: {
          create: parsed.data.attachments.map((attachment) => ({
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
    });

    for (const item of parsed.data.items) {
      // price1 (the product's selling price) is always kept in sync with
      // this line — it defaults to the product's current price1 in the
      // form, so a line the admin didn't touch is a harmless no-op write.
      // purchasePrice only follows unitCost when explicitly opted in.
      await tx.product.update({
        where: { id: item.productId },
        data: {
          price1: item.price1,
          ...(item.updateProductPurchasePrice
            ? { purchasePrice: item.unitCost }
            : {}),
        },
      });
      if (
        item.updateProductPurchasePrice &&
        currentPriceById.get(item.productId) !== item.unitCost
      ) {
        await tx.productPriceHistory.create({
          data: {
            productId: item.productId,
            purchasePrice: item.unitCost,
            reason: `تحديث السعر من أمر شراء رقم ${orderNumber}`,
            reference: orderNumber,
            createdById: access.adminId,
          },
        });
      }
    }

    return created;
    }),
  );

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/products");
  for (const item of parsed.data.items) {
    revalidatePath(`/dashboard/products/${item.productId}`);
  }
  redirect(`/dashboard/purchases/${order.id}`);
}

/**
 * Replaces a purchase order's items and recomputes its total. Blocked once
 * the order has been received — stock was already reserved against whatever
 * items existed at receive time, so editing them afterward would silently
 * desync the order's record from the stock/movements it already produced.
 * To correct a received order, change its status back to pending first
 * (which reverses that stock) or use a purchase return.
 */
export async function updatePurchaseOrderItems(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = purchaseOrderItemsSchema.safeParse(input);
  if (!parsed.success) return { error: t.purchases.validationError };

  const order = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!order) return { error: t.purchases.notFoundError };
  if (order.status === "RECEIVED") {
    return { error: t.purchases.cannotEditReceivedError };
  }

  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  const priceSyncItems = parsed.data.items.filter(
    (item) => item.updateProductPurchasePrice,
  );
  const currentPrices =
    priceSyncItems.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: priceSyncItems.map((item) => item.productId) } },
          select: { id: true, purchasePrice: true },
        })
      : [];
  const currentPriceById = new Map(
    currentPrices.map((product) => [product.id, Number(product.purchasePrice)]),
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: parsed.data.items.map((item, index) => ({
          purchaseOrderId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          position: index + 1,
        })),
      });
      await tx.purchaseOrder.update({ where: { id }, data: { total } });
      for (const item of parsed.data.items) {
        // Same rule as createPurchaseOrder: price1 always follows this
        // line (it defaults to the product's current price1, so a
        // no-touch line is a harmless no-op write); purchasePrice only
        // follows unitCost when explicitly opted in.
        await tx.product.update({
          where: { id: item.productId },
          data: {
            price1: item.price1,
            ...(item.updateProductPurchasePrice
              ? { purchasePrice: item.unitCost }
              : {}),
          },
        });
        if (
          item.updateProductPurchasePrice &&
          currentPriceById.get(item.productId) !== item.unitCost
        ) {
          await tx.productPriceHistory.create({
            data: {
              productId: item.productId,
              purchasePrice: item.unitCost,
              reason: `تحديث السعر من تعديل أمر شراء رقم ${order.orderNumber}`,
              reference: order.orderNumber,
              createdById: access.adminId,
            },
          });
        }
      }
    });
  } catch {
    return { error: t.purchases.itemsUpdateError };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${id}`);
  revalidatePath("/dashboard/products");
  for (const item of parsed.data.items) {
    revalidatePath(`/dashboard/products/${item.productId}`);
  }
  return { success: true };
}

/** Records money paid to the supplier against this purchase order, capped
 * at its own remaining balance — mirrors recordPayment for invoices, just
 * one-directional (money out, no رصيد/credit concept for suppliers). */
export async function recordSupplierPayment(
  purchaseOrderId: string,
  input: { amount: number; method: PaymentMethod; note?: string },
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!(input.amount > 0)) {
    return { error: t.purchases.invalidAmountError };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { supplier: { select: { balance: true } } },
  });
  if (!order) return { error: t.purchases.notFoundError };

  const total = Number(order.total);
  const remaining = Math.max(0, total - Number(order.paidAmount));
  if (input.amount > remaining + 0.005) {
    return { error: t.purchases.amountExceedsRemainingError };
  }
  if (input.method === "BALANCE" && input.amount > Number(order.supplier.balance) + 0.005) {
    return { error: t.purchases.insufficientSupplierBalanceError };
  }

  const newPaidAmount = Number(order.paidAmount) + input.amount;
  const paymentStatus = computePaymentStatus(total, newPaidAmount);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierPayment.create({
        data: {
          purchaseOrderId,
          amount: input.amount,
          method: input.method,
          note: input.note || null,
        },
      });
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { paidAmount: newPaidAmount, paymentStatus },
      });
      if (input.method === "BALANCE") {
        const previousBalance = Number(order.supplier.balance);
        await tx.supplier.update({ where: { id: order.supplierId }, data: { balance: { decrement: input.amount } } });
        await tx.supplierBalanceHistory.create({ data: {
          supplierId: order.supplierId, purchaseOrderId, reference: order.orderNumber,
          previousBalance, change: -input.amount, newBalance: previousBalance - input.amount,
          reason: "PURCHASE_PAYMENT", note: input.note || "استخدام رصيد المورد في الدفع",
          createdById: access.adminId,
        } });
      }
    });
  } catch {
    return { error: t.purchases.paymentError };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${purchaseOrderId}`);
  revalidatePath(`/dashboard/suppliers/${order.supplierId}`);
  return { success: true };
}

/** Deletes a recorded supplier payment and rolls this purchase order's
 * paidAmount/paymentStatus back to reflect its remaining payments. */
export async function deleteSupplierPayment(
  paymentId: string,
  password: string,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };

  const payment = await prisma.supplierPayment.findUnique({
    where: { id: paymentId },
    include: { purchaseOrder: { include: { payments: true } } },
  });
  if (!payment) return { error: t.purchases.paymentNotFoundError };

  const order = payment.purchaseOrder;
  const total = Number(order.total);
  const remainingPayments = order.payments.filter((p) => p.id !== paymentId);
  const newPaidAmount = remainingPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const paymentStatus = computePaymentStatus(total, newPaidAmount);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierPayment.delete({ where: { id: paymentId } });
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { paidAmount: newPaidAmount, paymentStatus },
      });
      if (payment.method === "BALANCE") {
        const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: order.supplierId } });
        const previousBalance = Number(supplier.balance);
        await tx.supplier.update({ where: { id: supplier.id }, data: { balance: { increment: payment.amount } } });
        await tx.supplierBalanceHistory.create({ data: {
          supplierId: supplier.id, purchaseOrderId: order.id, reference: order.orderNumber,
          previousBalance, change: payment.amount, newBalance: previousBalance + Number(payment.amount),
          reason: "PAYMENT_DELETED", note: "إعادة الرصيد بعد حذف دفعة المورد",
          createdById: access.adminId,
        } });
      }
    });
  } catch {
    return { error: t.purchases.paymentDeleteError };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${order.id}`);
  revalidatePath(`/dashboard/suppliers/${order.supplierId}`);
  return { success: true };
}

/**
 * Checks whether un-receiving this order (moving it away from RECEIVED)
 * would take any of its products below zero — e.g. because stock it
 * delivered was already resold. Returns null when the reversal is safe.
 */
export async function getPurchaseOrderStockIssue(id: string) {
  if (!(await hasPermission("PURCHASES_MANAGE"))) return null;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, quantity: true } } } },
    },
  });
  if (!order || order.status !== "RECEIVED") return null;

  // item.quantity/item.product.quantity are Prisma.Decimal instances —
  // their valueOf() returns a string, so a native `+` here would silently
  // string-concatenate instead of sum across multiple items for the same
  // product. Converting to a plain number up front (quantities are exact
  // to 3 decimal places, well within float precision for this comparison)
  // keeps every accumulation and comparison below genuinely numeric.
  const requestedByProduct = new Map<string, number>();
  for (const item of order.items) {
    requestedByProduct.set(
      item.productId,
      (requestedByProduct.get(item.productId) ?? 0) + item.quantity.toNumber(),
    );
  }
  for (const item of order.items) {
    const requested = requestedByProduct.get(item.productId) ?? 0;
    const available = item.product.quantity.toNumber();
    if (requested > available) {
      return {
        product: item.product.name,
        requested,
        available,
      };
    }
  }
  return null;
}

/**
 * Changes a purchase order's status, keeping stock in sync either way:
 * moving INTO RECEIVED reserves (adds) the ordered stock, exactly like the
 * old one-shot "receive" action; moving OUT of RECEIVED (back to pending or
 * to cancelled) reverses that same stock, since the goods are no longer
 * considered on hand because of this order. A status change that doesn't
 * cross the RECEIVED boundary (e.g. PENDING <-> CANCELLED) never touches
 * stock at all.
 */
export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
  options?: { allowNegativeStock?: boolean },
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!PURCHASE_ORDER_STATUSES.includes(status)) {
    return { error: t.purchases.invalidStatusError };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return { error: t.purchases.notFoundError };
  if (order.status === status) return { success: true };

  const wasReceived = order.status === "RECEIVED";
  const willBeReceived = status === "RECEIVED";

  try {
    if (willBeReceived && !wasReceived) {
      // Shared with the AI invoice scanner's Confirm — see
      // applyPurchaseReceipt in ./receive.ts.
      await prisma.$transaction((tx) => applyPurchaseReceipt(tx, order));
    } else if (wasReceived && !willBeReceived) {
      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status, receivedAt: null },
        });
        for (const item of order.items) {
          if (options?.allowNegativeStock) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.quantity } },
            });
          } else {
            const updated = await tx.product.updateMany({
              where: { id: item.productId, quantity: { gte: item.quantity } },
              data: { quantity: { decrement: item.quantity } },
            });
            if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
          }
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: item.quantity,
              reference: order.orderNumber,
              reason: "التراجع عن استلام أمر شراء",
            },
          });
        }
      });
    } else {
      await prisma.purchaseOrder.update({ where: { id }, data: { status } });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      const issue = await getPurchaseOrderStockIssue(id);
      return {
        error: issue
          ? formatMessage(t.common.insufficientProductStockTemplate, issue)
          : t.purchases.statusUpdateError,
      };
    }
    return { error: t.purchases.statusUpdateError };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${id}`);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Sets the language a purchase order prints in. Editable straight from the
 * order's detail page — the print/PDF view uses this saved value unless a
 * `?lang=` override is passed. Touches nothing but the `language` column.
 */
export async function updatePurchaseOrderLanguage(
  id: string,
  language: InvoiceLanguage,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!INVOICE_LANGUAGES.includes(language)) {
    return { error: t.purchases.validationError };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order) return { error: t.purchases.notFoundError };

  await prisma.purchaseOrder.update({ where: { id }, data: { language } });

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${id}`);
  return { success: true };
}

/**
 * Reassigns which supplier a purchase order was placed with. Touches
 * nothing but the `supplierId` column — payments, price history and stock
 * are unaffected. Blocked if the target supplier already has an order with
 * this order's `supplierInvoiceNumber` (the same guard the AI invoice
 * scanner uses — see `@@unique([supplierId, supplierInvoiceNumber])`).
 */
export async function updatePurchaseOrderSupplier(
  id: string,
  supplierId: string,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!supplierId) return { error: t.purchases.validationError };

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order) return { error: t.purchases.notFoundError };

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) return { error: t.purchases.validationError };

  try {
    await prisma.purchaseOrder.update({
      where: { id },
      data: { supplierId },
    });
  } catch (error) {
    if (isUniqueConstraintErrorOn(error, "supplierId")) {
      return { error: t.purchaseScan.duplicateInvoiceError };
    }
    throw error;
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${id}`);
  revalidatePath(`/dashboard/suppliers/${supplierId}`);
  return { success: true };
}

/**
 * Sets a purchase order's date. This is `createdAt` — the value shown as
 * the order date everywhere (list, detail, print/PDF) and used for report
 * period filtering — so backdating moves the order to the right period.
 * `date` is `YYYY-MM-DD`; parsed at noon local time so the calendar day
 * doesn't shift under the browser's timezone offset. Touches nothing else.
 */
export async function updatePurchaseOrderDate(
  id: string,
  date: string,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: t.purchases.validationError };
  }
  const createdAt = new Date(`${date}T12:00:00`);
  if (Number.isNaN(createdAt.getTime())) {
    return { error: t.purchases.validationError };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order) return { error: t.purchases.notFoundError };

  await prisma.purchaseOrder.update({ where: { id }, data: { createdAt } });

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Reverses a RECEIVED purchase order's stock effect before it's deleted, so
 * deleting the record doesn't leave phantom stock behind with no order left
 * to justify it. A PENDING or CANCELLED order never added stock, so there's
 * nothing to undo.
 */
async function reversePurchaseOrderStockOnDelete(
  tx: Prisma.TransactionClient,
  order: {
    orderNumber: string;
    status: string;
    items: { productId: string; quantity: Prisma.Decimal }[];
  },
) {
  if (order.status !== "RECEIVED") return;
  for (const item of order.items) {
    const updated = await tx.product.updateMany({
      where: { id: item.productId, quantity: { gte: item.quantity } },
      data: { quantity: { decrement: item.quantity } },
    });
    if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        reference: order.orderNumber,
        reason: "حذف أمر شراء مستلم",
      },
    });
  }
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      attachments: { select: { publicId: true, resourceType: true } },
      _count: { select: { returns: true } },
    },
  });
  if (!order) return { error: t.purchases.notFoundError };
  if (order._count.returns > 0) {
    return { error: t.purchases.cannotDeleteReturnedError };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await reversePurchaseOrderStockOnDelete(tx, order);
      await tx.purchaseOrder.delete({ where: { id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      const issue = await getPurchaseOrderStockIssue(id);
      return {
        error: issue
          ? formatMessage(t.common.insufficientProductStockTemplate, issue)
          : t.purchases.deleteError,
      };
    }
    return { error: t.purchases.deleteError };
  }
  // The order row (and its PurchaseAttachment rows, via onDelete: Cascade)
  // is already gone — best-effort cleanup of the underlying Cloudinary
  // files, same as every other entity's delete action.
  await Promise.allSettled(
    order.attachments.map((a) =>
      destroyCloudinaryAsset(a.publicId, a.resourceType === "raw" ? "raw" : "image"),
    ),
  );

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePurchaseOrders(
  ids: string[],
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  const t = await getDictionary();

  let failedCount = 0;
  let blockedByReturnsCount = 0;
  for (const id of ids) {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          attachments: { select: { publicId: true, resourceType: true } },
          _count: { select: { returns: true } },
        },
      });
      if (!order) {
        failedCount++;
        continue;
      }
      if (order._count.returns > 0) {
        blockedByReturnsCount++;
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await reversePurchaseOrderStockOnDelete(tx, order);
        await tx.purchaseOrder.delete({ where: { id } });
      });
      await Promise.allSettled(
        order.attachments.map((a) =>
          destroyCloudinaryAsset(a.publicId, a.resourceType === "raw" ? "raw" : "image"),
        ),
      );
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");

  if (blockedByReturnsCount > 0) {
    return {
      error: formatMessage(t.purchases.bulkDeleteReturnedErrorTemplate, {
        count: blockedByReturnsCount,
      }),
    };
  }
  if (failedCount > 0) {
    return {
      error: formatMessage(t.purchases.bulkDeleteErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}

/** Attaches an already-uploaded (client-side, via FileAttachmentUploader)
 * file to an existing purchase order — used on the detail page, after the
 * order already exists. Creating a new order attaches files as a nested
 * write inside createPurchaseOrder instead; this is the edit-time path. */
export async function addPurchaseAttachment(
  purchaseOrderId: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = purchaseAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: t.purchases.fileUploadGenericError };

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { id: true },
  });
  if (!order) return { error: t.purchases.notFoundError };

  await prisma.purchaseAttachment.create({
    data: { purchaseOrderId, ...parsed.data, uploadedById: access.adminId },
  });

  revalidatePath(`/dashboard/purchases/${purchaseOrderId}`);
  return { success: true };
}

/** Removes a purchase attachment's DB row and its underlying Cloudinary
 * asset. A plain confirm dialog (not a password-confirmed one) is enough
 * here — unlike a payment or the order itself, deleting an attached
 * document has no financial/stock effect to guard against. */
export async function deletePurchaseAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  const access = await requirePermission("PURCHASES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const attachment = await prisma.purchaseAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) return { error: t.purchases.attachmentNotFoundError };

  await prisma.purchaseAttachment.delete({ where: { id: attachmentId } });
  await destroyCloudinaryAsset(
    attachment.publicId,
    attachment.resourceType === "raw" ? "raw" : "image",
  );

  revalidatePath(`/dashboard/purchases/${attachment.purchaseOrderId}`);
  return { success: true };
}
