"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import { createInvoice } from "@/features/invoices/actions";
import type { InvoiceLanguage } from "@/generated/prisma/enums";
import { posSaleSchema } from "@/features/pos/schema";
import {
  searchPosCustomers,
  getPosProductByBarcode,
  type PosCustomer,
} from "@/features/pos/queries";

type ActionError = { error: string };

export async function searchPosCustomersAction(q: string, offset = 0) {
  const access = await requirePermission("POS_VIEW");
  if (!access.ok) return { items: [] as PosCustomer[], hasMore: false };
  return searchPosCustomers({ q, offset });
}

export async function findPosProductByBarcodeAction(barcode: string) {
  const access = await requirePermission("POS_VIEW");
  if (!access.ok) return null;
  return getPosProductByBarcode(barcode);
}

export async function createPosSale(input: unknown): Promise<
  | (ActionError & { code?: "INSUFFICIENT_BALANCE"; available?: number })
  | {
      success: true;
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      total: number;
      paid: number;
      change: number;
      credited: number;
    }
> {
  const access = await requirePermission("POS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) return { error: t.pos.saleFailedError };
  const data = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, name: true, phone: true, email: true, balance: true },
  });
  if (!customer) return { error: t.pos.noCustomerError };

  // Confirm every product still exists and is active, and price every line
  // from the authoritative first price (price1) — the client never sends a
  // price.
  const productIds = data.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "ACTIVE" },
    select: { id: true, name: true, price1: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (data.items.some((item) => !byId.has(item.productId))) {
    return { error: t.pos.productUnavailableError };
  }

  const items = data.items.map((item) => {
    const product = byId.get(item.productId)!;
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: Number(product.price1),
    };
  });

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const method = data.payment.method;
  const tendered = data.payment.amount;
  const isCash = method === "CASH";
  const isBalance = method === "BALANCE";

  // من الرصيد can never overpay itself, so it only ever settles up to the
  // total. For every other method the cashier is asked (default: no) whether
  // an overpayment extends the customer's balance — if not, it's cash change
  // for نقداً and simply not recorded otherwise.
  const excessToBalance =
    !isBalance && (data.payment.excessToBalance ?? false);
  const applied =
    !isBalance && excessToBalance ? tendered : Math.min(tendered, total);
  const credited = excessToBalance ? Math.max(0, tendered - total) : 0;
  const change =
    isCash && !excessToBalance ? Math.max(0, tendered - total) : 0;

  if (isBalance && !data.payment.allowNegativeBalance) {
    const available = Number(customer.balance);
    if (applied > available + 0.005) {
      return {
        error: t.invoices.insufficientBalanceTitle,
        code: "INSUFFICIENT_BALANCE",
        available,
      };
    }
  }

  const payments = applied > 0 ? [{ method, amount: applied }] : [];
  const paid = Math.min(applied, total);

  const result = await createInvoice(
    {
      language: data.language,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email ?? "",
      items,
      payments,
    },
    {
      allowNegativeStock: true,
      redirect: false,
      permission: "POS_MANAGE",
      posSaleToken: data.saleToken,
      excessToBalance: credited > 0.005,
    },
  );

  if (result.error || !result.invoiceId) {
    return { error: result.error ?? t.pos.saleFailedError };
  }

  const created = await prisma.invoice.findUnique({
    where: { id: result.invoiceId },
    select: { invoiceNumber: true },
  });

  revalidatePath("/caisse");
  return {
    success: true,
    invoiceId: result.invoiceId,
    invoiceNumber: created?.invoiceNumber ?? "",
    customerName: customer.name,
    total,
    paid,
    change,
    credited,
  };
}

export async function updatePosSaleLanguage(
  invoiceId: string,
  language: InvoiceLanguage,
): Promise<ActionError | { success: true }> {
  const access = await requirePermission("POS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, posSaleToken: true },
  });
  if (!invoice || !invoice.posSaleToken) {
    return { error: t.pos.saleFailedError };
  }

  await prisma.invoice.update({ where: { id: invoiceId }, data: { language } });
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: true };
}
