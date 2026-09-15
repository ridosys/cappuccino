"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";
import { invoiceSchema } from "@/features/invoices/schema";
import { getCustomerOutstandingInvoices } from "@/features/invoices/queries";
import { computePaymentStatus } from "@/lib/money";
import {
  adjustCustomerBalance,
  computeBalanceEffect,
} from "@/features/customers/balance";
import {
  isDeletePasswordValid,
  getDeletePasswordError,
} from "@/lib/delete-guard";
import { formatDocumentNumber } from "@/lib/document-number";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";
import {
  getAvailableStockIssue,
  validateAvailableStock,
} from "@/lib/stock-validation";
import type {
  InvoiceLanguage,
  PaymentMethod,
  BalanceChangeReason,
  OrderStatus,
  Prisma,
} from "@/generated/prisma/client";

type ActionResult = { error?: string; success?: boolean };

export async function checkInvoiceStockAvailability(
  items: Array<{ productId?: string | null; quantity: number }>,
  invoiceId?: string,
) {
  if (!(await hasPermission("INVOICES_MANAGE"))) return null;
  const existingItems = invoiceId
    ? (
        await prisma.invoiceItem.findMany({
          where: { invoiceId },
          select: { productId: true, quantity: true },
        })
      ).map((item) => ({
        productId: item.productId,
        quantity: item.quantity.toNumber(),
      }))
    : [];
  return getAvailableStockIssue(items, existingItems);
}

function computeTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function balanceEffectReason(delta: number): BalanceChangeReason {
  return delta < 0 ? "BALANCE_USED" : "OVERPAYMENT_CREDIT";
}

function temporaryInvoiceNumber(): string {
  return `TMP-${randomUUID()}`;
}

/** Client-callable wrapper — invoice creation forms need this to offer
 * distributing an overpayment across a customer's other outstanding
 * invoices before the new invoice even exists yet. */
export async function fetchCustomerOutstandingInvoices(customerId: string) {
  if (!(await hasPermission("INVOICES_MANAGE"))) return [];
  const invoices = await getCustomerOutstandingInvoices(customerId);
  // Server action return values cross the same serialization boundary as
  // RSC props — Decimal instances aren't plain objects, so they have to be
  // converted here rather than left for the caller to convert after the
  // fact.
  return invoices.map((invoice) => ({
    ...invoice,
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
  }));
}

export async function createInvoice(
  input: unknown,
  options?: {
    excessToBalance?: boolean;
    batchId?: string;
    allowNegativeStock?: boolean;

    redirect?: boolean;
    /** Permission to enforce instead of INVOICES_MANAGE — La Caisse cashiers
     * hold POS_MANAGE, not INVOICES_MANAGE, but are still allowed to ring up
     * a standalone sale. */
    permission?: PermissionKey;
    /** POS idempotency token (Invoice.posSaleToken). A repeated/retried call
     * with the same token resolves to the existing invoice instead of
     * creating a second one. */
    posSaleToken?: string;
  },
): Promise<ActionResult & { invoiceId?: string }> {
  const access = await requirePermission(
    options?.permission ?? "INVOICES_MANAGE",
  );
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  // Idempotency: a POS sale that's already been committed under this token
  // must never create a second invoice (double-click, retried request).
  if (options?.posSaleToken) {
    const existing = await prisma.invoice.findUnique({
      where: { posSaleToken: options.posSaleToken },
      select: { id: true },
    });
    if (existing) return { success: true, invoiceId: existing.id };
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { error: t.invoices.validationError };

  const linkedOrderId = parsed.data.orderId || null;

  // An invoice tied to an already-COMPLETED order must not re-deduct that
  // order's stock — it was booked OUT when the order completed. Skip the
  // availability pre-check for that case; the locked re-check inside the
  // transaction below is the authoritative guard.
  const linkedOrderAlreadyCompleted =
    linkedOrderId !== null &&
    (
      await prisma.order.findUnique({
        where: { id: linkedOrderId },
        select: { status: true },
      })
    )?.status === "COMPLETED";

  if (!options?.allowNegativeStock && !linkedOrderAlreadyCompleted) {
    const stockError = await validateAvailableStock(parsed.data.items);
    if (stockError) return { error: stockError };
  }

  const total = computeTotal(parsed.data.items);
  const payments = parsed.data.payments.filter((line) => line.amount > 0);
  const paidAmount = payments.reduce((sum, line) => sum + line.amount, 0);
  const paymentStatus = computePaymentStatus(total, paidAmount);
  const primaryMethod = payments[0]?.method ?? "CASH";
  const customerId = parsed.data.customerId;

  const rawBalanceEffect = computeBalanceEffect(total, payments);
  const balanceEffect =
    rawBalanceEffect > 0.005 && !options?.excessToBalance
      ? 0
      : rawBalanceEffect;

  let invoiceId: string;
  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      // A linked order governs its own stock: lock it for the life of this
      // transaction so a concurrent invoice/completion of the same order
      // serializes here, then read its authoritative state under the lock.
      let skipOrderStock = false;
      if (linkedOrderId) {
        const lockedRows = await tx.$queryRaw<{ status: OrderStatus }[]>`
          SELECT "status" FROM "Order" WHERE "id" = ${linkedOrderId} FOR UPDATE
        `;
        if (!lockedRows[0]) throw new Error("ORDER_NOT_FOUND");

        // Whoever committed first already issued this order's invoice — stop
        // here so a second one is never created and stock is never doubled.
        const existingForOrder = await tx.invoice.findUnique({
          where: { orderId: linkedOrderId },
          select: { id: true },
        });
        if (existingForOrder) throw new Error("ORDER_ALREADY_INVOICED");

        // COMPLETED ⇒ the order already created its stock OUT (via
        // updateOrderStatus or a prior invoice) ⇒ this invoice must not
        // deduct the same sale again.
        skipOrderStock = lockedRows[0].status === "COMPLETED";
      }

      const created = await tx.invoice.create({
        data: {
          invoiceNumber: temporaryInvoiceNumber(),
          language: parsed.data.language,
          customerId,
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone || "",
          customerEmail: parsed.data.customerEmail || null,
          notes: parsed.data.notes || null,
          orderId: linkedOrderId,
          total,
          paymentMethod: primaryMethod,
          paymentStatus,
          paidAmount,
          balanceEffectApplied: balanceEffect,
          posSaleToken: options?.posSaleToken ?? null,
          createdById: access.adminId,
          items: {
            create: parsed.data.items.map((item, index) => ({
              productId: item.productId || null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              position: index + 1,
            })),
          },
        },
      });

      // Stamp the real number from the DB-assigned serial so the #####
      // segment of INV-YYYY-MMDD-#####-XX always equals the الرقم التسلسلي
      // shown in the UI.
      const invoiceNumber = formatDocumentNumber(
        "INVOICE",
        created.sequenceNumber,
        created.createdAt,
      );
      await tx.invoice.update({
        where: { id: created.id },
        data: { invoiceNumber },
      });

      if (payments.length > 0) {
        await tx.payment.createMany({
          data: payments.map((line) => ({
            invoiceId: created.id,
            amount: line.amount,
            method: line.method,
            batchId: options?.batchId,
          })),
        });
      }

      const stockItems = skipOrderStock
        ? []
        : parsed.data.items.filter((item) => item.productId);
      for (const item of stockItems) {
        if (options?.allowNegativeStock) {
          await tx.product.update({
            where: { id: item.productId! },
            data: { quantity: { decrement: item.quantity } },
          });
        } else {
          const updated = await tx.product.updateMany({
            where: { id: item.productId!, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
        }
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId!,
            type: "OUT",
            quantity: item.quantity,
            reason: `فاتورة رقم ${invoiceNumber}`,
            reference: created.id,
          },
        });
      }

      await adjustCustomerBalance(tx, customerId, balanceEffect, {
        reason: balanceEffectReason(balanceEffect),
        invoiceId: created.id,
        invoiceNumber,
      });

      return created.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      const stockError = await validateAvailableStock(parsed.data.items);
      return { error: stockError ?? t.invoices.insufficientStockFallbackError };
    }
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return { error: t.invoices.orderNotFoundError };
    }
    if (error instanceof Error && error.message === "ORDER_ALREADY_INVOICED") {
      return { error: t.orders.invoiceAlreadyIssuedMessage };
    }
    // Two POS submits raced past the pre-check above and both tried to
    // insert the same posSaleToken — the unique index rejected the loser.
    // Resolve to the invoice the winner created.
    if (
      options?.posSaleToken &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const winner = await prisma.invoice.findUnique({
        where: { posSaleToken: options.posSaleToken },
        select: { id: true },
      });
      if (winner) return { success: true, invoiceId: winner.id };
    }
    return { error: t.invoices.createError };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/customers/${customerId}`);

  if (options?.redirect === false) {
    revalidatePath("/caisse");
    return { success: true, invoiceId };
  }
  redirect(`/dashboard/invoices/${invoiceId}`);
}

export async function updateInvoice(
  id: string,
  input: unknown,
  options?: { allowNegativeStock?: boolean },
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { error: t.invoices.validationError };

  // Optional backdating: an empty/absent issueDate leaves createdAt as-is.
  // Noon local time avoids the date landing on the previous day once the
  // browser's timezone offset is applied.
  let issuedAt: Date | undefined;
  if (parsed.data.issueDate) {
    const candidate = new Date(`${parsed.data.issueDate}T12:00:00`);
    if (Number.isNaN(candidate.getTime())) {
      return { error: t.invoices.validationError };
    }
    issuedAt = candidate;
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: {
      payments: true,
      items: true,
      _count: { select: { returns: true } },
    },
  });
  if (!existing) return { error: t.invoices.notFoundError };

  // Editing rewrites every item row from scratch (delete + recreate below),
  // but a sales return references its original InvoiceItem row with a
  // restrict-on-delete relation — deleting it would hit a foreign-key
  // violation. Once a return exists, further corrections belong in a new
  // return rather than rewriting the invoice's own history.
  if (existing._count.returns > 0) {
    return { error: t.invoices.cannotEditReturnedError };
  }

  // existing.items' quantity is a live Prisma.Decimal — stock-validation.ts
  // expects plain numbers (see its doc comment), so it's converted once
  // here and reused by both call sites below.
  const existingItemsForStockCheck = existing.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity.toNumber(),
  }));

  if (!options?.allowNegativeStock) {
    const stockError = await validateAvailableStock(
      parsed.data.items,
      existingItemsForStockCheck,
    );
    if (stockError) return { error: stockError };
  }

  const total = computeTotal(parsed.data.items);
  // Items/total edits never touch the payments already on file — رصيد only
  // ever moves because of من الرصيد or an over/under-paid total, both
  // captured by re-deriving the effect against the (unchanged) payments.
  const paidAmount = Number(existing.paidAmount);
  const paymentStatus = computePaymentStatus(total, paidAmount);
  const newBalanceEffect = computeBalanceEffect(
    total,
    existing.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method,
    })),
  );
  const previousBalanceEffect = Number(existing.balanceEffectApplied);
  const newCustomerId = parsed.data.customerId;

  const existingQtyByProduct = new Map<string, number>();
  for (const item of existing.items) {
    if (!item.productId) continue;
    existingQtyByProduct.set(
      item.productId,
      (existingQtyByProduct.get(item.productId) ?? 0) +
        item.quantity.toNumber(),
    );
  }
  const newQtyByProduct = new Map<string, number>();
  for (const item of parsed.data.items) {
    if (!item.productId) continue;
    newQtyByProduct.set(
      item.productId,
      (newQtyByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }
  const affectedProductIds = new Set([
    ...existingQtyByProduct.keys(),
    ...newQtyByProduct.keys(),
  ]);
  const stockDeltas = [...affectedProductIds]
    .map((productId) => ({
      productId,
      delta:
        (newQtyByProduct.get(productId) ?? 0) -
        (existingQtyByProduct.get(productId) ?? 0),
    }))
    .filter((row) => row.delta !== 0);

  try {
    await prisma.$transaction(async (tx) => {
      for (const { productId, delta } of stockDeltas) {
        if (delta > 0) {
          // More of this product is on the invoice now — reserve the extra
          // stock, same as a fresh sale of that quantity.
          if (options?.allowNegativeStock) {
            await tx.product.update({
              where: { id: productId },
              data: { quantity: { decrement: delta } },
            });
          } else {
            const updated = await tx.product.updateMany({
              where: { id: productId, quantity: { gte: delta } },
              data: { quantity: { decrement: delta } },
            });
            if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
          }
          await tx.inventoryMovement.create({
            data: {
              productId,
              type: "OUT",
              quantity: delta,
              reason: `تعديل فاتورة رقم ${existing.invoiceNumber}`,
              reference: id,
            },
          });
        } else {
          const restored = -delta;
          await tx.product.update({
            where: { id: productId },
            data: { quantity: { increment: restored } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId,
              type: "IN",
              quantity: restored,
              reason: `تعديل فاتورة رقم ${existing.invoiceNumber}`,
              reference: id,
            },
          });
        }
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          language: parsed.data.language,
          ...(issuedAt ? { createdAt: issuedAt } : {}),
          customerId: newCustomerId,
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone || "",
          customerEmail: parsed.data.customerEmail || null,
          notes: parsed.data.notes || null,
          total,
          paidAmount,
          paymentStatus,
          balanceEffectApplied: newBalanceEffect,
          items: {
            create: parsed.data.items.map((item, index) => ({
              productId: item.productId || null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              position: index + 1,
            })),
          },
        },
      });

      if (existing.customerId === newCustomerId) {
        if (existing.customerId) {
          const delta = newBalanceEffect - previousBalanceEffect;
          await adjustCustomerBalance(tx, existing.customerId, delta, {
            reason: "INVOICE_EDIT",
            invoiceId: id,
            invoiceNumber: existing.invoiceNumber,
          });
        }
      } else {
        // Reassigned to a different customer: fully reverse the effect on
        // the old customer, then apply it fresh to the new one.
        if (existing.customerId) {
          await adjustCustomerBalance(
            tx,
            existing.customerId,
            -previousBalanceEffect,
            {
              reason: "INVOICE_EDIT",
              invoiceId: id,
              invoiceNumber: existing.invoiceNumber,
            },
          );
        }
        await adjustCustomerBalance(tx, newCustomerId, newBalanceEffect, {
          reason: "INVOICE_EDIT",
          invoiceId: id,
          invoiceNumber: existing.invoiceNumber,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      const stockError = await validateAvailableStock(
        parsed.data.items,
        existingItemsForStockCheck,
      );
      return { error: stockError ?? t.invoices.insufficientStockFallbackError };
    }
    return { error: t.invoices.updateError };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  if (existing.customerId)
    revalidatePath(`/dashboard/customers/${existing.customerId}`);
  if (newCustomerId !== existing.customerId) {
    revalidatePath(`/dashboard/customers/${newCustomerId}`);
  }
  return { success: true };
}

async function reverseInvoiceBalanceOnDelete(
  tx: Prisma.TransactionClient,
  invoice: {
    id: string;
    invoiceNumber: string;
    customerId: string | null;
    balanceEffectApplied: unknown;
  },
  applyBalanceChange?: boolean,
) {
  if (!invoice.customerId) return;

  const effect = Number(invoice.balanceEffectApplied);
  if (Math.abs(effect) <= 0.005 || !applyBalanceChange) return;

  const change = -effect;
  await adjustCustomerBalance(tx, invoice.customerId, change, {
    reason: change > 0 ? "BALANCE_RETURNED" : "INVOICE_CANCELLATION",
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  });
}

async function reverseInvoiceStockOnDelete(
  tx: Prisma.TransactionClient,
  invoice: { id: string; invoiceNumber: string },
): Promise<void> {
  const movements = await tx.inventoryMovement.findMany({
    where: { reference: invoice.id, productId: { not: null } },
    select: { productId: true, type: true, quantity: true },
  });
  const netByProduct = new Map<string, number>();
  for (const movement of movements) {
    const quantity = movement.quantity.toNumber();
    const effect = movement.type === "OUT" ? -quantity : quantity;
    netByProduct.set(
      movement.productId!,
      (netByProduct.get(movement.productId!) ?? 0) + effect,
    );
  }

  for (const [productId, net] of netByProduct) {
    if (net === 0) continue;
    // Negative stock is allowed — undo the invoice's own net effect with a
    // plain write (net > 0 removes stock it added, net < 0 adds back stock
    // it took) and no availability guard.
    await tx.product.update({
      where: { id: productId },
      data: { quantity: { decrement: net } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId,
        type: net > 0 ? "OUT" : "IN",
        quantity: Math.abs(net),
        reference: invoice.id,
        reason: `حذف فاتورة رقم ${invoice.invoiceNumber}`,
      },
    });
  }
}

/**
 * The stock + order half of deleting one invoice, run inside a transaction
 * that already holds a FOR UPDATE lock on the invoice row.
 *
 * Reverses only the stock the invoice's OWN movements booked (see
 * reverseInvoiceStockOnDelete — stock ownership is read from movements, not
 * from Order.status). When the invoice is linked to an order, deleting it
 * voids that sale: the order moves to CANCELLED. A standalone invoice
 * (orderId null) has no order to touch.
 */
async function reverseInvoiceOnDelete(
  tx: Prisma.TransactionClient,
  invoice: {
    id: string;
    invoiceNumber: string;
    orderId: string | null;
    customerId: string | null;
    balanceEffectApplied: unknown;
  },
  applyBalanceChange?: boolean,
): Promise<void> {
  let orderStillExists = false;
  if (invoice.orderId) {
    // Lock the linked order too, so this reversal serializes against any
    // concurrent completion / re-invoicing of the same order.
    const lockedOrder = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Order" WHERE "id" = ${invoice.orderId} FOR UPDATE
    `;
    orderStillExists = lockedOrder.length > 0;
  }

  await reverseInvoiceStockOnDelete(tx, invoice);
  await reverseInvoiceBalanceOnDelete(tx, invoice, applyBalanceChange);

  if (invoice.orderId && orderStillExists) {
    await tx.order.update({
      where: { id: invoice.orderId },
      data: { status: "CANCELLED" },
    });
  }
}

export async function deleteInvoice(
  id: string,
  options?: { applyBalanceChange?: boolean; password?: string },
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (!isDeletePasswordValid(options?.password)) {
    return { error: await getDeletePasswordError() };
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { _count: { select: { returns: true } } },
  });
  if (!existing) return { error: t.invoices.notFoundError };
  if (existing._count.returns > 0) {
    return { error: t.invoices.cannotDeleteReturnedError };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Lock the invoice row: a concurrent deleteInvoice for the same id
      // blocks here, then finds it gone and no-ops — the stock reversal runs
      // exactly once.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE
      `;
      if (!locked[0]) return;

      await reverseInvoiceOnDelete(tx, existing, options?.applyBalanceChange);
      await tx.invoice.delete({ where: { id } });
    });
  } catch {
    return { error: t.invoices.deleteError };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/orders");
  if (existing.orderId) revalidatePath(`/dashboard/orders/${existing.orderId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  if (existing.customerId)
    revalidatePath(`/dashboard/customers/${existing.customerId}`);
  return { success: true };
}

/**
 * Cancels a just-completed La Caisse sale: deletes the standalone invoice and
 * fully reverses its effects — stock booked OUT comes back IN, any رصيد draw
 * (من الرصيد) or credited overpayment is undone, payment/item rows cascade.
 * Gated on POS_MANAGE (not INVOICES_MANAGE) and only ever touches an
 * untouched POS invoice, so a cashier can undo their own mistake without the
 * dashboard delete password.
 */
export async function deletePosSale(invoiceId: string): Promise<ActionResult> {
  const access = await requirePermission("POS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { _count: { select: { returns: true } } },
  });
  if (!existing || !existing.posSaleToken) {
    return { error: t.invoices.notFoundError };
  }
  if (existing._count.returns > 0) {
    return { error: t.invoices.cannotDeleteReturnedError };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE
      `;
      if (!locked[0]) return;

      await reverseInvoiceOnDelete(tx, existing, true);
      await tx.invoice.delete({ where: { id: invoiceId } });
    });
  } catch {
    return { error: t.invoices.deleteError };
  }

  revalidatePath("/caisse");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  if (existing.customerId) {
    revalidatePath(`/dashboard/customers/${existing.customerId}`);
  }
  return { success: true };
}

export async function deleteInvoices(
  decisions: { id: string; applyBalanceChange?: boolean }[],
  password?: string,
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (decisions.length === 0) return { success: true };
  if (!isDeletePasswordValid(password))
    return { error: await getDeletePasswordError() };

  const decisionById = new Map(
    decisions.map((d) => [d.id, d.applyBalanceChange]),
  );
  const ids = decisions.map((d) => d.id);

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { returns: true } } },
  });
  const deletable = invoices.filter((invoice) => invoice._count.returns === 0);
  const blockedCount = ids.length - deletable.length;

  if (deletable.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Deterministic lock order (by id) so two overlapping bulk deletes
        // can't deadlock on each other.
        const ordered = [...deletable].sort((a, b) => a.id.localeCompare(b.id));
        for (const invoice of ordered) {
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Invoice" WHERE "id" = ${invoice.id} FOR UPDATE
          `;
          if (!locked[0]) continue;

          await reverseInvoiceOnDelete(
            tx,
            invoice,
            decisionById.get(invoice.id),
          );
          await tx.invoice.delete({ where: { id: invoice.id } });
        }
      });
    } catch {
      return { error: t.invoices.bulkDeleteError };
    }
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  if (blockedCount > 0) {
    return {
      error: formatMessage(t.invoices.bulkDeleteReturnedErrorTemplate, {
        count: blockedCount,
      }),
    };
  }
  return { success: true };
}

export async function getOrCreateInvoiceForOrder(
  orderId: string,
  options: {
    language: InvoiceLanguage;
    payments: { method: PaymentMethod; amount: number }[];
    excessToBalance?: boolean;
  },
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const existing = await prisma.invoice.findUnique({
    where: { orderId },
  });

  if (existing) {
    redirect(`/dashboard/invoices/${existing.id}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return { error: t.invoices.orderNotFoundError };

  const payments = options.payments.filter((line) => line.amount > 0);

  if (payments.some((line) => line.method === "BALANCE") && !order.customerId) {
    return { error: t.invoices.noCustomerForBalance };
  }

  const total = Number(order.total);
  const paidAmount = payments.reduce((sum, line) => sum + line.amount, 0);
  const paymentStatus = computePaymentStatus(total, paidAmount);
  const primaryMethod = payments[0]?.method ?? "CASH";
  const rawBalanceEffect = computeBalanceEffect(total, payments);
  const balanceEffect =
    rawBalanceEffect > 0.005 && !options.excessToBalance ? 0 : rawBalanceEffect;

  let invoiceId: string;
  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      // Lock the order row for the life of the transaction. A concurrent
      // request invoicing or completing this same order (a second
      // getOrCreateInvoiceForOrder, or updateOrderStatus) blocks here until
      // we commit, then reads the fresh invoice/status below — so stock is
      // never decremented twice for one order.
      const lockedRows = await tx.$queryRaw<{ status: OrderStatus }[]>`
        SELECT "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (!lockedRows[0]) throw new Error("ORDER_NOT_FOUND");

      // Whoever committed first already created the invoice for this order —
      // hand back its id so both requests land on the same invoice without
      // creating a second one or touching stock again.
      const alreadyInvoiced = await tx.invoice.findUnique({
        where: { orderId },
        select: { id: true },
      });
      if (alreadyInvoiced) return alreadyInvoiced.id;

      // Did the order already move stock? It reaches COMPLETED only via a
      // stock OUT (updateOrderStatus, or a just-committed invoice), so a
      // COMPLETED status here means the decrement already happened.
      const orderAlreadyAffectedStock = lockedRows[0].status === "COMPLETED";

      const created = await tx.invoice.create({
        data: {
          invoiceNumber: temporaryInvoiceNumber(),
          language: options.language,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          orderId: order.id,
          total: order.total,
          paymentMethod: primaryMethod,
          paymentStatus,
          paidAmount,
          balanceEffectApplied: balanceEffect,
          createdById: access.adminId,
          items: {
            create: order.items.map((item, index) => ({
              productId: item.productId,
              name: item.product.name,
              quantity: item.quantity,
              unitPrice: item.price,
              position: index + 1,
            })),
          },
        },
      });

      // Stamp the real number from the DB-assigned serial so the #####
      // segment of INV-YYYY-MMDD-#####-XX always equals the الرقم التسلسلي.
      const invoiceNumber = formatDocumentNumber(
        "INVOICE",
        created.sequenceNumber,
        created.createdAt,
      );
      await tx.invoice.update({
        where: { id: created.id },
        data: { invoiceNumber },
      });

      if (payments.length > 0) {
        await tx.payment.createMany({
          data: payments.map((line) => ({
            invoiceId: created.id,
            amount: line.amount,
            method: line.method,
          })),
        });
      }

      if (!orderAlreadyAffectedStock) {
        for (const item of order.items) {
          // Stock is no longer a hard gate here — an order can be invoiced
          // even if it oversold, same as this dialog already allows a
          // customer's balance to go negative rather than blocking.
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: item.quantity,
              reason: `فاتورة رقم ${invoiceNumber}`,
              reference: created.id,
            },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: "COMPLETED" },
        });
      }

      if (order.customerId) {
        await adjustCustomerBalance(tx, order.customerId, balanceEffect, {
          reason: balanceEffectReason(balanceEffect),
          invoiceId: created.id,
          invoiceNumber,
        });
      }

      return created.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return { error: t.invoices.orderNotFoundError };
    }
    return { error: t.invoices.createError };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  if (order.customerId)
    revalidatePath(`/dashboard/customers/${order.customerId}`);
  redirect(`/dashboard/invoices/${invoiceId}`);
}

export async function recordPayment(
  invoiceId: string,
  input: { amount: number; method: PaymentMethod; note?: string },
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!(input.amount > 0)) {
    return { error: t.invoices.invalidAmountError };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { error: t.invoices.notFoundError };

  if (input.method === "BALANCE" && !invoice.customerId) {
    return { error: t.invoices.noCustomerForBalance };
  }

  const total = Number(invoice.total);
  const newPaidAmount = Number(invoice.paidAmount) + input.amount;
  const paymentStatus = computePaymentStatus(total, newPaidAmount);

  const allPayments = [
    ...invoice.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method as string,
    })),
    { amount: input.amount, method: input.method as string },
  ];
  const newBalanceEffect = computeBalanceEffect(total, allPayments);
  const previousBalanceEffect = Number(invoice.balanceEffectApplied);
  const delta = newBalanceEffect - previousBalanceEffect;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          amount: input.amount,
          method: input.method,
          note: input.note || null,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus,
          balanceEffectApplied: newBalanceEffect,
        },
      });

      if (invoice.customerId) {
        await adjustCustomerBalance(tx, invoice.customerId, delta, {
          reason: balanceEffectReason(delta),
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    });
  } catch {
    return { error: t.invoices.paymentError };
  }

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  if (invoice.customerId) {
    revalidatePath(`/dashboard/customers/${invoice.customerId}`);
  }
  return { success: true };
}

/**
 * Records one payment against a customer's outstanding invoices, oldest
 * first, capping the normal allocation at each invoice's remaining balance.
 * If the caller accepts an excess as customer credit, that excess is stored
 * on the final Payment row. The invoice's balanceEffectApplied therefore
 * tracks it, allowing payment edits/deletions to reverse the exact credit
 * later instead of leaving an anonymous, orphaned رصيد adjustment.
 */
export async function recordPaymentAcrossInvoices(
  customerId: string,
  input: {
    invoiceIds: string[];
    amount: number;
    method: PaymentMethod;
    note?: string;
    excessToBalance?: boolean;
    /** Lets a BALANCE payment proceed even past the customer's current
     * رصيد (mirrors the existing single-invoice "allow negative" choice). */
    allowNegativeBalance?: boolean;
    /** Reuse an existing batch (e.g. a new invoice's own payments) instead
     * of starting a fresh one — lets two separate action calls still be
     * recognized as "the same payment session" later. */
    batchId?: string;
  },
): Promise<ActionResult & { batchId?: string }> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!(input.amount > 0)) {
    return { error: t.invoices.invalidAmountError };
  }
  if (input.invoiceIds.length === 0) {
    return { error: t.invoices.selectAtLeastOneInvoice };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) return { error: t.invoices.customerNotFoundError };

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: input.invoiceIds }, customerId },
    include: { payments: true },
    orderBy: { createdAt: "asc" },
  });
  if (invoices.length === 0)
    return { error: t.invoices.selectedInvoicesNotFoundError };

  if (input.method === "BALANCE" && !input.allowNegativeBalance) {
    const customerBalance = Number(customer.balance);
    if (input.amount > customerBalance + 0.005) {
      return { error: t.invoices.insufficientBalanceTitle };
    }
  }

  let amountLeft = input.amount;
  const allocations: {
    invoice: (typeof invoices)[number];
    allocated: number;
  }[] = [];
  for (const invoice of invoices) {
    if (amountLeft <= 0.005) break;
    const total = Number(invoice.total);
    const invoiceRemaining = Math.max(0, total - Number(invoice.paidAmount));
    if (invoiceRemaining <= 0.005) continue;
    const allocated = Math.min(invoiceRemaining, amountLeft);
    allocations.push({ invoice, allocated });
    amountLeft -= allocated;
  }

  const excess = Math.max(0, amountLeft);
  // Keep an accepted overpayment attached to a real Payment row instead of
  // creating an anonymous balance credit. This makes later edit/delete
  // operations able to recompute and reverse that credit exactly, even when
  // the customer's current balance is too small (adjustCustomerBalance
  // deliberately permits the resulting negative balance).
  if (allocations.length === 0 && excess > 0.005 && input.excessToBalance) {
    allocations.push({ invoice: invoices[0], allocated: 0 });
  }
  const batchId = input.batchId ?? crypto.randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      for (const [index, { invoice, allocated }] of allocations.entries()) {
        const creditedExcess =
          input.excessToBalance && index === allocations.length - 1
            ? excess
            : 0;
        const recordedAmount = allocated + creditedExcess;
        if (recordedAmount <= 0.005) continue;

        const total = Number(invoice.total);
        const newPaidAmount = Number(invoice.paidAmount) + recordedAmount;
        const paymentStatus = computePaymentStatus(total, newPaidAmount);

        const allPayments = [
          ...invoice.payments.map((p) => ({
            amount: Number(p.amount),
            method: p.method as string,
          })),
          { amount: recordedAmount, method: input.method as string },
        ];
        const newBalanceEffect = computeBalanceEffect(total, allPayments);
        const previousBalanceEffect = Number(invoice.balanceEffectApplied);
        const delta = newBalanceEffect - previousBalanceEffect;

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: recordedAmount,
            method: input.method,
            note:
              creditedExcess > 0.005
                ? [
                    input.note,
                    `Overpayment credited to balance: ${creditedExcess.toFixed(2)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : input.note || null,
            batchId,
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
            balanceEffectApplied: newBalanceEffect,
          },
        });
        await adjustCustomerBalance(tx, customerId, delta, {
          reason: balanceEffectReason(delta),
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    });
  } catch {
    return { error: t.invoices.paymentError };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/customers/${customerId}`);
  for (const { invoice } of allocations) {
    revalidatePath(`/dashboard/invoices/${invoice.id}`);
  }
  return { success: true, batchId };
}

/**
 * Corrects an already-recorded payment's amount/method/note. Recomputes the
 * invoice's paidAmount, paymentStatus, and balanceEffectApplied from scratch
 * against the *other* payments plus this edited one (same derivation
 * recordPayment uses), then applies only the difference from what رصيد
 * previously reflected — exactly the delta-based approach updateInvoice and
 * deleteInvoice already use, so edits/deletes elsewhere keep working off an
 * accurate balanceEffectApplied no matter how many times a payment here is
 * corrected.
 */
export async function updatePayment(
  paymentId: string,
  input: { amount: number; method: PaymentMethod; note?: string },
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!(input.amount > 0)) {
    return { error: t.invoices.invalidAmountError };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { payments: true } } },
  });
  if (!payment) return { error: t.invoices.paymentNotFoundError };

  const invoice = payment.invoice;

  if (input.method === "BALANCE" && !invoice.customerId) {
    return { error: t.invoices.noCustomerForBalance };
  }

  const total = Number(invoice.total);
  const otherPayments = invoice.payments.filter((p) => p.id !== paymentId);
  const otherPaidAmount = otherPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const newPaidAmount = otherPaidAmount + input.amount;
  const paymentStatus = computePaymentStatus(total, newPaidAmount);

  const allPayments = [
    ...otherPayments.map((p) => ({
      amount: Number(p.amount),
      method: p.method as string,
    })),
    { amount: input.amount, method: input.method as string },
  ];
  const newBalanceEffect = computeBalanceEffect(total, allPayments);
  const previousBalanceEffect = Number(invoice.balanceEffectApplied);
  const delta = newBalanceEffect - previousBalanceEffect;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: input.amount,
          method: input.method,
          note: input.note || null,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus,
          balanceEffectApplied: newBalanceEffect,
        },
      });

      if (invoice.customerId) {
        await adjustCustomerBalance(tx, invoice.customerId, delta, {
          reason: "INVOICE_EDIT",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    });
  } catch {
    return { error: t.invoices.paymentUpdateError };
  }

  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  if (invoice.customerId) {
    revalidatePath(`/dashboard/customers/${invoice.customerId}`);
  }
  return { success: true };
}

/**
 * Removes a payment entirely. Recomputes the invoice's paidAmount and
 * paymentStatus from the *remaining* payments only (so a fully-refunded
 * invoice correctly falls back to غير مدفوع, including the zero-total edge
 * case computePaymentStatus already guards), and reverses whatever رصيد
 * effect this payment contributed — same delta-against-balanceEffectApplied
 * approach updatePayment uses, just against an empty slot instead of an
 * edited one.
 */
export async function deletePayment(
  paymentId: string,
  password: string,
): Promise<ActionResult> {
  const access = await requirePermission("INVOICES_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (!isDeletePasswordValid(password))
    return { error: await getDeletePasswordError() };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { payments: true } } },
  });
  if (!payment) return { error: t.invoices.paymentNotFoundError };

  const invoice = payment.invoice;
  const total = Number(invoice.total);
  const otherPayments = invoice.payments.filter((p) => p.id !== paymentId);
  const newPaidAmount = otherPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const paymentStatus = computePaymentStatus(total, newPaidAmount);

  const newBalanceEffect = computeBalanceEffect(
    total,
    otherPayments.map((p) => ({
      amount: Number(p.amount),
      method: p.method as string,
    })),
  );
  const previousBalanceEffect = Number(invoice.balanceEffectApplied);
  const delta = newBalanceEffect - previousBalanceEffect;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus,
          balanceEffectApplied: newBalanceEffect,
        },
      });

      if (invoice.customerId) {
        await adjustCustomerBalance(tx, invoice.customerId, delta, {
          reason: "INVOICE_EDIT",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    });
  } catch {
    return { error: t.invoices.paymentDeleteError };
  }

  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  if (invoice.customerId) {
    revalidatePath(`/dashboard/customers/${invoice.customerId}`);
  }
  return { success: true };
}
