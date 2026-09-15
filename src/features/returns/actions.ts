"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { salesReturnSchema, purchaseReturnSchema } from "./schema";
import type { Prisma } from "@/generated/prisma/client";
import type { ZodError } from "zod";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import { isDeletePasswordValid, getDeletePasswordError } from "@/lib/delete-guard";
import { withDocumentNumber } from "@/lib/document-number";
import { adjustCustomerBalance } from "@/features/customers/balance";

type Result = { success?: boolean; id?: string; error?: string };
const cents = (value: number) => Math.round(value * 100) / 100;

export async function searchReturnSources(
  kind: "sales" | "purchase",
  rawQuery: string,
) {
  if (!(await hasPermission("RETURNS_MANAGE"))) return [];
  const query = rawQuery.trim();
  if (!query) return [];

  if (kind === "sales") {
    const rows = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, invoiceNumber: true, customerName: true },
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.invoiceNumber,
      party: row.customerName,
    }));
  }

  const rows = await prisma.purchaseOrder.findMany({
    where: {
      status: "RECEIVED",
      OR: [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { supplier: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, orderNumber: true, supplier: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.orderNumber,
    party: row.supplier.name,
  }));
}

function returnActionError(error: unknown, fallback: string, safeMessages: string[]) {
  if (!(error instanceof Error)) return fallback;
  return safeMessages.includes(error.message) ? error.message : fallback;
}

/**
 * Sales and purchase returns share the same field names (reason, notes,
 * items, refundAmount, refundMethod), so one lookup covers both schemas —
 * points at exactly which field/rule failed instead of the generic "check
 * the return data" message.
 */
function describeReturnValidationError(t: Dictionary, error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return t.returns.invalidData;
  const field = issue.path[0];

  if (field === "reason") {
    if (issue.code === "too_small") return t.returns.reasonTooShortError;
    if (issue.code === "too_big") return t.returns.reasonTooLongError;
  }
  if (field === "notes" && issue.code === "too_big") {
    return t.returns.notesTooLongError;
  }
  if (field === "items" && issue.code === "too_small") {
    return t.returns.noItemsSelectedError;
  }
  if (field === "refundAmount") return t.returns.invalidRefundAmountError;
  if (field === "refundMethod") return t.returns.invalidRefundMethodError;
  if (field === "invoiceId" || field === "purchaseId") {
    return t.returns.noSourceSelectedError;
  }
  return t.returns.invalidData;
}

export async function createSalesReturn(input: unknown): Promise<Result> {
  const [session,t] = await Promise.all([auth(),getDictionary()]);
  if (!session?.user?.id) return { error: t.returns.unauthorized };
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const parsed = salesReturnSchema.safeParse(input);
  if (!parsed.success) return { error: describeReturnValidationError(t, parsed.error) };

  try {
    const createdById = session.user.id;
    const result = await withDocumentNumber("SALES_RETURN", (returnNumber) =>
      prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        include: { items: { include: { returnItems: { where: { salesReturn: { status: "CONFIRMED" } } } } } },
      });
      if (!invoice) throw new Error(t.returns.invoiceNotFound);

      const requested = new Map(parsed.data.items.map((item) => [item.invoiceItemId, item]));
      let subtotal = 0;
      const rows = invoice.items.filter((item) => requested.has(item.id)).map((item) => {
        const request = requested.get(item.id)!;
        // row.quantity is a live Prisma.Decimal (SalesReturnItem.quantity)
        // — .toNumber() before the `+` avoids string-concatenation across
        // multiple prior returns of the same invoice item.
        const returned = item.returnItems.reduce((sum, row) => sum + row.quantity.toNumber(), 0);
        const itemQuantity = item.quantity.toNumber();
        if (request.quantity > itemQuantity - returned) throw new Error(formatMessage(t.returns.quantityExceedsTemplate,{product:item.name,requested:request.quantity,sold:itemQuantity,returned,available:itemQuantity-returned}));
        const total = cents(request.quantity * Number(item.unitPrice));
        subtotal += total;
        return { item, request, total };
      });
      if (rows.length !== requested.size) throw new Error(t.returns.invalidInvoiceItem);
      subtotal = cents(subtotal);
      if (parsed.data.refundAmount > subtotal + 0.005) throw new Error(t.returns.refundExceedsValue);

      const noRefund = parsed.data.refundMethod === "NO_IMMEDIATE_REFUND";
      const credited = parsed.data.refundMethod === "CUSTOMER_CREDIT";
      const created = await tx.salesReturn.create({
        data: {
          returnNumber, invoiceId: invoice.id, customerId: invoice.customerId,
          reason: parsed.data.reason, notes: parsed.data.notes || null, subtotal,
          refundAmount: parsed.data.refundAmount, refundMethod: parsed.data.refundMethod,
          refundStatus: noRefund ? "PENDING" : credited ? "CREDITED" : "COMPLETED",
          refundDate: noRefund ? null : new Date(), createdById,
          items: { create: rows.map(({ item, request, total }) => ({
            invoiceItemId: item.id, productId: item.productId, quantity: request.quantity,
            unitPrice: item.unitPrice, total, condition: request.condition,
            restock: request.condition === "GOOD" && Boolean(item.productId),
          })) },
        },
      });

      for (const { item, request } of rows) {
        if (!item.productId) continue;
        const productUpdate = request.condition === "GOOD"
          ? { quantity: { increment: request.quantity } }
          : request.condition === "DAMAGED"
            ? { damagedQuantity: { increment: request.quantity } }
            : { defectiveQuantity: { increment: request.quantity } };
        await tx.product.update({ where: { id: item.productId }, data: productUpdate });
        // DAMAGED/DEFECTIVE returns only touch their own counters, not
        // Product.quantity (they aren't restocked as sellable) — a
        // SALE_RETURN movement here would be a phantom entry that
        // corrupts historical inventory reconstruction the next time this
        // condition is used. Only log a movement for the condition that
        // actually changes available stock.
        if (request.condition !== "GOOD") continue;
        await tx.inventoryMovement.create({ data: {
          productId: item.productId, type: "SALE_RETURN", quantity: request.quantity,
          reference: returnNumber,
          reason: `${parsed.data.reason} | ${t.returns.conditionAudit}: ${request.condition} | ${t.returns.employeeAudit}: ${session.user.name ?? session.user.email ?? session.user.id}`,
        } });
      }
      if (credited && invoice.customerId && parsed.data.refundAmount > 0) {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: invoice.customerId } });
        const previous = Number(customer.balance);
        await tx.customer.update({ where: { id: customer.id }, data: { balance: { increment: parsed.data.refundAmount } } });
        await tx.customerBalanceHistory.create({ data: {
          customerId: customer.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
          previousBalance: previous, change: parsed.data.refundAmount,
          newBalance: cents(previous + parsed.data.refundAmount), reason: "BALANCE_RETURNED",
          note: formatMessage(t.returns.customerCreditNote,{number:returnNumber}),
        } });
      }
      return created;
      }),
    );
    revalidatePath("/dashboard/sales-returns");
    revalidatePath(`/dashboard/invoices/${parsed.data.invoiceId}`);
    revalidatePath("/dashboard/inventory");
    return { success: true, id: result.id };
  } catch (error) {
    const safe=[t.returns.invoiceNotFound,t.returns.invalidInvoiceItem,t.returns.refundExceedsValue];
    const quantityPrefix=t.returns.quantityExceedsTemplate.split("{requested}")[0];
    if(error instanceof Error && error.message.startsWith(quantityPrefix)) safe.push(error.message);
    return { error: returnActionError(error, t.returns.createSalesError,safe) };
  }
}

export async function createPurchaseReturn(input: unknown): Promise<Result> {
  const [session,t] = await Promise.all([auth(),getDictionary()]);
  if (!session?.user?.id) return { error: t.returns.unauthorized };
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const parsed = purchaseReturnSchema.safeParse(input);
  if (!parsed.success) return { error: describeReturnValidationError(t, parsed.error) };
  try {
    const createdById = session.user.id;
    const result = await withDocumentNumber("PURCHASE_RETURN", (returnNumber) =>
      prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseId },
        include: { items: { include: { returnItems: { where: { purchaseReturn: { status: "CONFIRMED" } } }, product: true } } },
      });
      if (!purchase) throw new Error(t.returns.purchaseNotFound);
      if (purchase.status !== "RECEIVED") throw new Error(t.returns.receivedOnly);
      const requested = new Map(parsed.data.items.map((item) => [item.purchaseOrderItemId, item]));
      let total = 0;
      const rows = purchase.items.filter((item) => requested.has(item.id)).map((item) => {
        const request = requested.get(item.id)!;
        // Same Decimal-vs-`+` risk as the sales-return path above.
        const returned = item.returnItems.reduce((sum, row) => sum + row.quantity.toNumber(), 0);
        const itemQuantity = item.quantity.toNumber();
        if (request.quantity > itemQuantity - returned) throw new Error(formatMessage(t.returns.quantityExceedsTemplate,{product:item.product.name,requested:request.quantity,sold:itemQuantity,returned,available:itemQuantity-returned}));
        if (request.quantity > item.product.quantity.toNumber()) throw new Error(formatMessage(t.returns.stockInsufficientTemplate,{product:item.product.name}));
        const rowTotal = cents(request.quantity * Number(item.unitCost)); total += rowTotal;
        return { item, request, total: rowTotal };
      });
      if (rows.length !== requested.size) throw new Error(t.returns.invalidPurchaseItem);
      total = cents(total);
      if (parsed.data.refundAmount > total + 0.005) throw new Error(t.returns.refundExceedsValue);
      const noRefund = parsed.data.refundMethod === "NO_IMMEDIATE_REFUND";
      const credited = parsed.data.refundMethod === "SUPPLIER_CREDIT";
      const created = await tx.purchaseReturn.create({ data: {
        returnNumber, purchaseId: purchase.id, supplierId: purchase.supplierId,
        reason: parsed.data.reason, notes: parsed.data.notes || null, total,
        refundAmount: parsed.data.refundAmount, refundMethod: parsed.data.refundMethod,
        refundStatus: noRefund ? "PENDING" : credited ? "CREDITED" : "COMPLETED",
        refundDate: noRefund ? null : new Date(), createdById,
        items: { create: rows.map(({ item, request, total: rowTotal }) => ({
          purchaseOrderItemId: item.id, productId: item.productId, quantity: request.quantity,
          unitCost: item.unitCost, total: rowTotal, reason: request.reason || null,
        })) },
      } });
      if (credited && parsed.data.refundAmount > 0) {
        const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: purchase.supplierId } });
        const previousBalance = Number(supplier.balance);
        await tx.supplier.update({ where: { id: supplier.id }, data: { balance: { increment: parsed.data.refundAmount } } });
        await tx.supplierBalanceHistory.create({ data: {
          supplierId: supplier.id, purchaseOrderId: purchase.id, reference: returnNumber,
          previousBalance, change: parsed.data.refundAmount,
          newBalance: cents(previousBalance + parsed.data.refundAmount), reason: "PURCHASE_RETURN_CREDIT",
          note: formatMessage(t.returns.supplierCreditNote,{number:returnNumber}), createdById: session.user.id,
        } });
      }
      for (const { item, request } of rows) {
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: request.quantity } } });
        await tx.inventoryMovement.create({ data: {
          productId: item.productId, type: "PURCHASE_RETURN", quantity: -request.quantity,
          reference: returnNumber,
          reason: `${parsed.data.reason} | ${t.returns.employeeAudit}: ${session.user.name ?? session.user.email ?? session.user.id}`,
        } });
      }
      return created;
      }),
    );
    revalidatePath("/dashboard/purchase-returns");
    revalidatePath(`/dashboard/purchases/${parsed.data.purchaseId}`);
    revalidatePath("/dashboard/inventory");
    return { success: true, id: result.id };
  } catch (error) {
    const safe=[t.returns.purchaseNotFound,t.returns.receivedOnly,t.returns.invalidPurchaseItem,t.returns.refundExceedsValue];
    const quantityPrefix=t.returns.quantityExceedsTemplate.split("{requested}")[0];
    const stockPrefix=t.returns.stockInsufficientTemplate.split("{product}")[0];
    if(error instanceof Error && (error.message.startsWith(quantityPrefix) || error.message.startsWith(stockPrefix))) safe.push(error.message);
    return { error: returnActionError(error, t.returns.createPurchaseError,safe) };
  }
}

type SalesReturnWithItems = Prisma.SalesReturnGetPayload<{
  include: { items: true; invoice: { select: { invoiceNumber: true } } };
}>;

/**
 * Reverses exactly what creating a sales return did: the stock (or
 * damaged/defective counter) each item added back, and — if the refund was
 * credited to the customer's رصيد — that credit. Then deletes the return
 * itself. Shared by the single and bulk delete actions so both stay in
 * sync. The quantity reversal is guarded against going negative (e.g. the
 * restocked units were already resold since); the other two condition
 * counters aren't, matching how loosely those auxiliary counters are
 * already tracked elsewhere.
 */
async function reverseAndDeleteSalesReturn(
  tx: Prisma.TransactionClient,
  existing: SalesReturnWithItems,
  t: Dictionary,
) {
  for (const item of existing.items) {
    if (!item.productId) continue;
    if (item.condition === "GOOD") {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      // Only the GOOD-condition branch ever touched Product.quantity (and
      // got a SALE_RETURN movement) when this return was created — mirror
      // that exactly here, or a DAMAGED/DEFECTIVE item would get a phantom
      // reversal movement for a stock effect that never happened.
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: "SALE_RETURN",
          quantity: -item.quantity,
          reference: existing.returnNumber,
          reason: formatMessage(t.returns.deletedReturnReasonTemplate, {
            number: existing.returnNumber,
          }),
        },
      });
    } else if (item.condition === "DAMAGED") {
      await tx.product.update({
        where: { id: item.productId },
        data: { damagedQuantity: { decrement: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { defectiveQuantity: { decrement: item.quantity } },
      });
    }
  }
  if (
    existing.refundMethod === "CUSTOMER_CREDIT" &&
    existing.customerId &&
    Number(existing.refundAmount) > 0
  ) {
    await adjustCustomerBalance(tx, existing.customerId, -Number(existing.refundAmount), {
      reason: "MANUAL_ADJUSTMENT",
      invoiceId: existing.invoiceId,
      invoiceNumber: existing.invoice.invoiceNumber,
      note: formatMessage(t.returns.deletedReturnCreditNoteTemplate, {
        number: existing.returnNumber,
      }),
    });
  }
  await tx.salesReturn.delete({ where: { id: existing.id } });
}

export async function deleteSalesReturn(id: string, password: string): Promise<Result> {
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };

  const existing = await prisma.salesReturn.findUnique({
    where: { id },
    include: { items: true, invoice: { select: { invoiceNumber: true } } },
  });
  if (!existing) return { error: t.returns.notFoundError };

  try {
    await prisma.$transaction((tx) => reverseAndDeleteSalesReturn(tx, existing, t));
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return { error: t.returns.deleteInsufficientStockError };
    }
    return { error: t.returns.deleteSalesError };
  }

  revalidatePath("/dashboard/sales-returns");
  revalidatePath(`/dashboard/invoices/${existing.invoiceId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  if (existing.customerId) revalidatePath(`/dashboard/customers/${existing.customerId}`);
  return { success: true };
}

export async function deleteSalesReturns(
  ids: string[],
  password?: string,
): Promise<Result> {
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (ids.length === 0) return { success: true };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };

  let failedCount = 0;
  const invoiceIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const id of ids) {
    try {
      const existing = await prisma.salesReturn.findUnique({
        where: { id },
        include: { items: true, invoice: { select: { invoiceNumber: true } } },
      });
      if (!existing) {
        failedCount++;
        continue;
      }
      await prisma.$transaction((tx) => reverseAndDeleteSalesReturn(tx, existing, t));
      invoiceIds.add(existing.invoiceId);
      if (existing.customerId) customerIds.add(existing.customerId);
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/sales-returns");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  for (const invoiceId of invoiceIds) revalidatePath(`/dashboard/invoices/${invoiceId}`);
  for (const customerId of customerIds) revalidatePath(`/dashboard/customers/${customerId}`);

  if (failedCount > 0) {
    return {
      error: formatMessage(t.returns.bulkDeleteSalesErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}

type PurchaseReturnWithItems = Prisma.PurchaseReturnGetPayload<{
  include: { items: true };
}>;

/**
 * Reverses exactly what creating a purchase return did: the stock it
 * removed (returned to the supplier) and, if the refund was credited to
 * the supplier's رصيد, that credit. Then deletes the return itself. Shared
 * by the single and bulk delete actions.
 */
async function reverseAndDeletePurchaseReturn(
  tx: Prisma.TransactionClient,
  existing: PurchaseReturnWithItems,
  t: Dictionary,
  createdById: string,
) {
  for (const item of existing.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "PURCHASE_RETURN",
        quantity: item.quantity,
        reference: existing.returnNumber,
        reason: formatMessage(t.returns.deletedReturnReasonTemplate, {
          number: existing.returnNumber,
        }),
      },
    });
  }
  if (existing.refundMethod === "SUPPLIER_CREDIT" && Number(existing.refundAmount) > 0) {
    const supplier = await tx.supplier.findUniqueOrThrow({
      where: { id: existing.supplierId },
    });
    const previousBalance = Number(supplier.balance);
    const amount = Number(existing.refundAmount);
    const newBalance = previousBalance - amount;
    await tx.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: newBalance },
    });
    await tx.supplierBalanceHistory.create({
      data: {
        supplierId: existing.supplierId,
        purchaseOrderId: existing.purchaseId,
        reference: existing.returnNumber,
        previousBalance,
        change: -amount,
        newBalance,
        reason: "MANUAL_ADJUSTMENT",
        note: formatMessage(t.returns.deletedReturnSupplierCreditNoteTemplate, {
          number: existing.returnNumber,
        }),
        createdById,
      },
    });
  }
  await tx.purchaseReturn.delete({ where: { id: existing.id } });
}

export async function deletePurchaseReturn(id: string, password: string): Promise<Result> {
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };

  const existing = await prisma.purchaseReturn.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return { error: t.returns.notFoundError };

  try {
    await prisma.$transaction((tx) =>
      reverseAndDeletePurchaseReturn(tx, existing, t, access.adminId),
    );
  } catch {
    return { error: t.returns.deletePurchaseError };
  }

  revalidatePath("/dashboard/purchase-returns");
  revalidatePath(`/dashboard/purchases/${existing.purchaseId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/suppliers/${existing.supplierId}`);
  return { success: true };
}

export async function deletePurchaseReturns(
  ids: string[],
  password?: string,
): Promise<Result> {
  const access = await requirePermission("RETURNS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();
  if (ids.length === 0) return { success: true };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };

  let failedCount = 0;
  const purchaseIds = new Set<string>();
  const supplierIds = new Set<string>();
  for (const id of ids) {
    try {
      const existing = await prisma.purchaseReturn.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        failedCount++;
        continue;
      }
      await prisma.$transaction((tx) =>
        reverseAndDeletePurchaseReturn(tx, existing, t, access.adminId),
      );
      purchaseIds.add(existing.purchaseId);
      supplierIds.add(existing.supplierId);
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/purchase-returns");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  for (const purchaseId of purchaseIds) revalidatePath(`/dashboard/purchases/${purchaseId}`);
  for (const supplierId of supplierIds) revalidatePath(`/dashboard/suppliers/${supplierId}`);

  if (failedCount > 0) {
    return {
      error: formatMessage(t.returns.bulkDeletePurchaseErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}
