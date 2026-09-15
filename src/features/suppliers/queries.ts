import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const SUPPLIERS_PAGE_SIZE = 10;

export async function getSuppliersPage({
  query,
  page,
  orders,
  balance,
  sort,
}: {
  query?: string;
  page: number;
  orders?: "withOrders" | "withoutOrders";
  balance?: "outstanding" | "paid";
  sort?: "name" | "orders";
}) {
  const filters: Prisma.SupplierWhereInput[] = [];
  if (query) {
    filters.push({ name: { contains: query, mode: "insensitive" } });
  }
  if (orders === "withOrders") {
    filters.push({ purchaseOrders: { some: {} } });
  } else if (orders === "withoutOrders") {
    filters.push({ purchaseOrders: { none: {} } });
  }
  if (balance === "outstanding") {
    filters.push({
      purchaseOrders: {
        some: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      },
    });
  } else if (balance === "paid") {
    filters.push({
      purchaseOrders: {
        none: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      },
    });
  }
  const where: Prisma.SupplierWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const orderBy =
    sort === "name"
      ? ({ name: "asc" } as const)
      : sort === "orders"
        ? ({ purchaseOrders: { _count: "desc" } } as const)
        : ({ createdAt: "desc" } as const);

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { purchaseOrders: true } },
      },
      orderBy,
      skip: (page - 1) * SUPPLIERS_PAGE_SIZE,
      take: SUPPLIERS_PAGE_SIZE,
    }),
    prisma.supplier.count({ where }),
  ]);

  return { items, total, pageSize: SUPPLIERS_PAGE_SIZE };
}

export async function getSupplierOptions() {
  return prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSupplierById(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getSupplierProfile(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      balanceHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      createdBy: { select: { name: true } },
    },
  });
  if (!supplier) return null;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { supplierId: id },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  const totalPurchased = purchaseOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const totalPaid = purchaseOrders.reduce(
    (sum, order) => sum + Number(order.paidAmount),
    0,
  );
  const totalOutstanding = purchaseOrders.reduce(
    (sum, order) =>
      sum + Math.max(0, Number(order.total) - Number(order.paidAmount)),
    0,
  );

  const payments = purchaseOrders
    .flatMap((order) =>
      order.payments.map((payment) => ({
        ...payment,
        orderNumber: order.orderNumber,
        purchaseOrderId: order.id,
      })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    supplier,
    purchaseOrders,
    payments,
    totals: { totalPurchased, totalPaid, totalOutstanding },
  };
}

export type SupplierDeliveredProduct = {
  key: string;
  name: string;
  quantity: number;
  deliveries: number;
  totalCost: number;
  avgCost: number;
  latestCost: number;
};

/** All-time, per-product breakdown of what this supplier has delivered —
 * aggregated from every PurchaseOrderItem on their purchase orders,
 * regardless of order status (received/pending/cancelled all still
 * represent something the supplier was asked to deliver). */
export async function getSupplierProductsDelivered(
  supplierId: string,
): Promise<SupplierDeliveredProduct[]> {
  const rows = await prisma.$queryRaw<
    {
      key: string;
      name: string;
      quantity: string;
      deliveries: bigint;
      totalCost: string;
      latestCost: string;
    }[]
  >`
    WITH items AS (
      SELECT poi."productId" as key, p.name, poi.quantity, poi."unitCost",
        po."createdAt", po.id as "purchaseOrderId"
      FROM public."PurchaseOrderItem" poi
      JOIN public."PurchaseOrder" po ON po.id = poi."purchaseOrderId"
      JOIN public."Product" p ON p.id = poi."productId"
      WHERE po."supplierId" = ${supplierId}
    ),
    agg AS (
      SELECT key, MIN(name) as name,
        -- Not ::bigint — PurchaseOrderItem.quantity carries up to 3
        -- decimal places now, and a bigint cast would truncate that.
        SUM(quantity)::numeric as quantity,
        COUNT(DISTINCT "purchaseOrderId")::bigint as deliveries,
        SUM(quantity * "unitCost")::numeric as "totalCost"
      FROM items
      GROUP BY key
    ),
    ranked AS (
      SELECT key, "unitCost",
        ROW_NUMBER() OVER (PARTITION BY key ORDER BY "createdAt" DESC) as rn
      FROM items
    )
    SELECT agg.key, agg.name, agg.quantity, agg.deliveries, agg."totalCost",
      latest."unitCost" as "latestCost"
    FROM agg
    JOIN ranked latest ON latest.key = agg.key AND latest.rn = 1
    ORDER BY agg."totalCost" DESC
  `;

  return rows.map((row) => {
    const quantity = Number(row.quantity);
    const totalCost = Number(row.totalCost);
    return {
      key: row.key,
      name: row.name,
      quantity,
      deliveries: Number(row.deliveries),
      totalCost,
      avgCost: quantity > 0 ? totalCost / quantity : 0,
      latestCost: Number(row.latestCost),
    };
  });
}
