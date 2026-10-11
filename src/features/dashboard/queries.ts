import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { getOutstandingInvoicesSummary } from "@/features/invoices/queries";
import { getCustomersOwingSummary } from "@/features/customers/queries";

export async function getDashboardStats() {
  const [
    totalProducts,
    totalCustomers,
    pendingOrders,
    activeOrders,
    lowStockRows,
    outstanding,
    owingSummary,
    inventoryPurchaseValueRows,
  ] = await withDbRetry(() =>
    Promise.all([
      prisma.product.count({ where: {} }),
      prisma.customer.count({ where: {} }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
      }),
      prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*)::bigint AS count FROM public."Product" WHERE quantity <= "minStockLevel" AND status = 'ACTIVE'`,
      getOutstandingInvoicesSummary(),
      getCustomersOwingSummary(),
      prisma.$queryRaw<
        { total: string | null }[]
      >`SELECT SUM(quantity * "purchasePrice")::numeric AS total FROM public."Product"`,
    ]),
  );

  return {
    totalProducts,
    totalCustomers,
    pendingOrders,
    activeOrders,
    lowStockCount: Number(lowStockRows[0]?.count ?? 0),
    unpaidInvoicesCount: outstanding.count,
    totalOwedByCustomers: owingSummary.totalOwed,
    totalInventoryPurchaseValue: Number(
      inventoryPurchaseValueRows[0]?.total ?? 0,
    ),
  };
}

/** The three sidebar badge counts — a lightweight stand-in for
 * `getDashboardStats` in the dashboard layout (which only needs these).
 * Cached for 30s under a tag: the badges are a hint, not a source of truth,
 * and the pages they point to always read live data. */
export const getSidebarBadges = unstable_cache(
  async () => {
    const [pendingOrders, lowStockRows, unpaidInvoicesCount] =
      await withDbRetry(() =>
        Promise.all([
          prisma.order.count({ where: { status: "PENDING" } }),
          prisma.$queryRaw<
            { count: bigint }[]
          >`SELECT COUNT(*)::bigint AS count FROM public."Product" WHERE quantity <= "minStockLevel" AND status = 'ACTIVE'`,
          prisma.invoice.count({
            where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
          }),
        ]),
      );
    return {
      pendingOrders,
      lowStockCount: Number(lowStockRows[0]?.count ?? 0),
      unpaidInvoicesCount,
    };
  },
  ["sidebar-badges"],
  { revalidate: 30, tags: ["sidebar-badges"] },
);
