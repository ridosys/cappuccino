import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentStatus } from "@/generated/prisma/client";

export const INVOICES_PAGE_SIZE = 10;

export async function getInvoicesPage({
  query,
  paymentStatus,
  page,
}: {
  query?: string;
  paymentStatus?: PaymentStatus;
  page: number;
}) {
  // A digits-only query (e.g. "42" or the displayed "042") also matches the
  // invoice's serial number exactly. Bounded to a 32-bit int so an
  // oversized value can't error the query.
  const trimmedQuery = query?.trim();
  const sequenceNumberQuery =
    trimmedQuery && /^\d+$/.test(trimmedQuery)
      ? Number.parseInt(trimmedQuery, 10)
      : undefined;

  const where: Prisma.InvoiceWhereInput = {
    ...(query
      ? {
          OR: [
            { invoiceNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { customerPhone: { contains: query, mode: "insensitive" } },
            ...(sequenceNumberQuery !== undefined &&
            sequenceNumberQuery <= 2_147_483_647
              ? [{ sequenceNumber: sequenceNumberQuery }]
              : []),
          ],
        }
      : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * INVOICES_PAGE_SIZE,
      take: INVOICES_PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, pageSize: INVOICES_PAGE_SIZE };
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [
          { position: "asc" },
          { product: { createdAt: "asc" } },
        ],
        include: {
          product: { select: { name: true, sku: true, weight: true } },
        },
      },
      order: { select: { id: true } },
      payments: { orderBy: { createdAt: "desc" } },
      returns: { where: { status: "CONFIRMED" }, include: { items: true }, orderBy: { createdAt: "desc" } },
      createdBy: { select: { name: true } },
    },
  });
}

/**
 * All of a customer's other invoices that aren't مدفوع بالكامل (PAID) yet —
 * used for "الحساب القديم" on an invoice's print page, so printing any one
 * invoice always surfaces the customer's full outstanding picture
 * regardless of which invoice was created first.
 */
export async function getOtherOutstandingInvoices(
  customerId: string,
  excludeInvoiceId: string,
) {
  return prisma.invoice.findMany({
    where: {
      customerId,
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      NOT: { id: excludeInvoiceId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      createdAt: true,
      items: {
        orderBy: [
          { position: "asc" },
          { product: { createdAt: "asc" } },
        ],
        select: { id: true, name: true, quantity: true, unitPrice: true },
      },
    },
  });
}

/** All of a customer's invoices that aren't fully paid yet (UNPAID or
 * PARTIALLY_PAID), oldest first — used by the "تسجيل دفعة" dialog to let the
 * admin distribute one payment across multiple invoices instead of only the
 * one they opened the dialog from. */
export async function getCustomerOutstandingInvoices(customerId: string) {
  return prisma.invoice.findMany({
    where: {
      customerId,
      paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      createdAt: true,
    },
  });
}

export async function getOutstandingInvoicesSummary() {
  const rows = await prisma.invoice.findMany({
    where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    select: { total: true, paidAmount: true },
  });

  return {
    count: rows.length,
    totalOutstanding: rows.reduce(
      (sum, row) => sum + (Number(row.total) - Number(row.paidAmount)),
      0,
    ),
  };
}
