import "server-only";
import { prisma } from "@/lib/prisma";

export const RETURNS_PAGE_SIZE = 10;

export async function getSalesReturnsPage({ query, page }: { query?: string; page: number }) {
  const where = query ? { OR: [
    { returnNumber: { contains: query, mode: "insensitive" as const } },
    { invoice: { invoiceNumber: { contains: query, mode: "insensitive" as const } } },
    { invoice: { customerName: { contains: query, mode: "insensitive" as const } } },
  ] } : {};
  const [items, total] = await Promise.all([
    prisma.salesReturn.findMany({ where, include: { invoice: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * RETURNS_PAGE_SIZE, take: RETURNS_PAGE_SIZE }),
    prisma.salesReturn.count({ where }),
  ]);
  return { items, total, pageSize: RETURNS_PAGE_SIZE };
}

export async function getPurchaseReturnsPage({ query, page }: { query?: string; page: number }) {
  const where = query ? { OR: [
    { returnNumber: { contains: query, mode: "insensitive" as const } },
    { purchase: { orderNumber: { contains: query, mode: "insensitive" as const } } },
    { supplier: { name: { contains: query, mode: "insensitive" as const } } },
  ] } : {};
  const [items, total] = await Promise.all([
    prisma.purchaseReturn.findMany({ where, include: { purchase: true, supplier: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * RETURNS_PAGE_SIZE, take: RETURNS_PAGE_SIZE }),
    prisma.purchaseReturn.count({ where }),
  ]);
  return { items, total, pageSize: RETURNS_PAGE_SIZE };
}

export async function getInvoiceForReturn(id: string) {
  return prisma.invoice.findUnique({ where: { id }, include: { items: { orderBy: [{ position: "asc" }, { product: { createdAt: "asc" } }], include: {
    product: { select: { name: true, sku: true, barcode: true } },
    returnItems: { where: { salesReturn: { status: "CONFIRMED" } }, select: { quantity: true } },
  } } } });
}

export async function getPurchaseForReturn(id: string) {
  return prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, items: { include: {
    product: { select: { name: true, sku: true, barcode: true, quantity: true } },
    returnItems: { where: { purchaseReturn: { status: "CONFIRMED" } }, select: { quantity: true } },
  } } } });
}

export async function getReturnSourceOptions() {
  const [invoices, purchases] = await Promise.all([
    prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceNumber: true, customerName: true, createdAt: true } }),
    prisma.purchaseOrder.findMany({ where: { status: "RECEIVED" }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, orderNumber: true, supplier: { select: { name: true } }, createdAt: true } }),
  ]);
  return { invoices, purchases };
}

export async function getSalesReturnById(id: string) {
  return prisma.salesReturn.findUnique({ where: { id }, include: { invoice: true, customer: true, createdBy: { select: { name: true, email: true } }, items: { include: { invoiceItem: true, product: true } } } });
}

export async function getPurchaseReturnById(id: string) {
  return prisma.purchaseReturn.findUnique({ where: { id }, include: { purchase: true, supplier: true, createdBy: { select: { name: true, email: true } }, items: { include: { product: true } } } });
}
