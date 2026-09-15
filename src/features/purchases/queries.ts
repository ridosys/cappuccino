import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const PURCHASE_ORDERS_PAGE_SIZE = 10;

export async function getPurchaseOrdersPage({
  query,
  page,
}: {
  query?: string;
  page: number;
}) {
  const where: Prisma.PurchaseOrderWhereInput = query
    ? {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { supplierInvoiceNumber: { contains: query, mode: "insensitive" } },
          { supplier: { name: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PURCHASE_ORDERS_PAGE_SIZE,
      take: PURCHASE_ORDERS_PAGE_SIZE,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { items, total, pageSize: PURCHASE_ORDERS_PAGE_SIZE };
}

export async function getPurchaseOrderById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          product: { select: { name: true, sku: true, weight: true } },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
      returns: { where: { status: "CONFIRMED" }, include: { items: true }, orderBy: { createdAt: "desc" } },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      createdBy: { select: { name: true } },
    },
  });
}
