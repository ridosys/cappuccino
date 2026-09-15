import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const REPORTS_PAGE_SIZE = 10;

export type InventoryHistoricalReportRow = {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  brandName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  minStockLevel: number;
  status: "ACTIVE" | "INACTIVE";
  purchasePrice: number;
  /** true when no ProductPriceHistory row exists on or before asOfDate, so
   * `purchasePrice` above fell back to this product's *earliest* recorded
   * price (never its current live price — that would make a fixed past
   * date's value keep changing every time someone edits the price today)
   * instead of a confirmed historical value — the caller must surface this
   * rather than presenting the number as equally reliable either way. */
  priceIsEstimated: boolean;
  value: number;
};

/**
 * Reconstructs inventory as of a given date by walking every product's live
 * quantity backward through InventoryMovement history (unaffected by this
 * change — see the movement_effect/reversal CTEs), and separately looks up
 * the purchasePrice actually in effect on that date via ProductPriceHistory
 * (the historical_price CTE): the most recent row recorded at or before
 * asOfDate.
 *
 * ProductPriceHistory only started being written when this report's price
 * accuracy was added — every existing product got a one-time backfill (a
 * baseline row dated the day this shipped, using whatever purchasePrice was
 * on file then, plus real dated rows reconstructed from RECEIVED purchase
 * orders where that history existed), and every product created since
 * (manually, imported, or via a purchase order) gets its own anchor row the
 * moment it's created. So a product with no row at or before asOfDate only
 * happens when asOfDate predates that product's very first recorded price —
 * there is no earlier data to have missed.
 *
 * That gap falls back to the *earliest* row this product has on record
 * (flagged via `priceIsEstimated`), not the product's current live price:
 * live price is deliberately never used as the historical fallback, because
 * it changes every time someone edits the price — using it here would make
 * a report for a *fixed* past date silently change value depending on when
 * it's viewed (e.g. edit today's price and a report for yesterday would
 * start showing today's new number). The earliest known row is stable and
 * is the closest honest answer to "what did this product cost before we
 * had any record of it." Only a product with literally zero history rows at
 * all (which the write paths above should make impossible today) falls all
 * the way back to Product.purchasePrice.
 */
async function fetchInventoryHistoricalReportRows({
  asOfDate,
  supplierId,
  query,
  skip,
  take,
}: {
  asOfDate: Date;
  supplierId?: string;
  query?: string;
  skip?: number;
  take?: number;
}): Promise<{
  items: InventoryHistoricalReportRow[];
  total: number;
  totals: { quantity: number; value: number };
}> {
  const searchClause = query
    ? Prisma.sql`AND (p.name ILIKE ${"%" + query + "%"} OR p.sku ILIKE ${"%" + query + "%"})`
    : Prisma.empty;
  const supplierClause = supplierId
    ? Prisma.sql`AND s.id = ${supplierId}`
    : Prisma.empty;
  const limitOffsetClause =
    take !== undefined
      ? Prisma.sql`LIMIT ${take} OFFSET ${skip ?? 0}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      sku: string;
      categoryName: string;
      brandName: string | null;
      supplierId: string | null;
      supplierName: string | null;
      quantity: string;
      minStockLevel: string;
      status: "ACTIVE" | "INACTIVE";
      purchasePrice: string;
      priceIsEstimated: boolean;
      totalCount: bigint;
      totalQuantitySum: string | null;
      totalValueSum: string | null;
    }[]
  >`
    WITH movement_effect AS (
      SELECT "productId",
        CASE WHEN "type" = 'OUT' THEN -"quantity" ELSE "quantity" END AS effect,
        "createdAt"
      FROM public."InventoryMovement"
      WHERE "productId" IS NOT NULL
    ),
    reversal AS (
      -- Not ::int — quantities carry up to 3 decimal places now (e.g.
      -- 1.5 kg), and truncating here would silently round every historical
      -- reconstruction to a whole number.
      SELECT "productId", SUM(effect)::numeric AS "reverseAmount"
      FROM movement_effect
      WHERE "createdAt" > ${asOfDate}
      GROUP BY "productId"
    ),
    latest_supplier AS (
      SELECT DISTINCT ON (poi."productId") poi."productId" AS "productId", po."supplierId"
      FROM public."PurchaseOrderItem" poi
      JOIN public."PurchaseOrder" po ON po.id = poi."purchaseOrderId"
      WHERE po.status = 'RECEIVED' AND po."receivedAt" <= ${asOfDate}
      ORDER BY poi."productId", po."receivedAt" DESC, po.id DESC
    ),
    historical_price AS (
      -- The purchase price actually in effect on asOfDate: the most recent
      -- ProductPriceHistory row recorded at or before that date.
      SELECT DISTINCT ON ("productId") "productId", "purchasePrice"
      FROM public."ProductPriceHistory"
      WHERE "createdAt" <= ${asOfDate}
      ORDER BY "productId", "createdAt" DESC, id DESC
    ),
    earliest_price AS (
      -- Fallback for a date before this product's first recorded price:
      -- its oldest known row, never its current live price (see the doc
      -- comment on fetchInventoryHistoricalReportRows for why).
      SELECT DISTINCT ON ("productId") "productId", "purchasePrice"
      FROM public."ProductPriceHistory"
      ORDER BY "productId", "createdAt" ASC, id ASC
    )
    SELECT
      p.id, p.name, p.sku, p."minStockLevel", p.status,
      COALESCE(hp."purchasePrice", ep."purchasePrice", p."purchasePrice")::numeric AS "purchasePrice",
      (hp."productId" IS NULL) AS "priceIsEstimated",
      c.name AS "categoryName", b.name AS "brandName",
      s.id AS "supplierId", s.name AS "supplierName",
      -- Neither of the next two casts is ::int/::bigint for the same
      -- reason as "reverseAmount" above — see the doc comment on
      -- fetchInventoryHistoricalReportRows for the reconstruction this
      -- feeds (e.g. 10.5 + 2.75 - 1.25 must stay 12.000, not round to 12).
      (p.quantity - COALESCE(r."reverseAmount", 0))::numeric AS "quantity",
      COUNT(*) OVER()::bigint AS "totalCount",
      SUM(p.quantity - COALESCE(r."reverseAmount", 0)) OVER()::numeric AS "totalQuantitySum",
      SUM((p.quantity - COALESCE(r."reverseAmount", 0)) * COALESCE(hp."purchasePrice", ep."purchasePrice", p."purchasePrice")) OVER()::numeric AS "totalValueSum"
    FROM public."Product" p
    JOIN public."Category" c ON c.id = p."categoryId"
    LEFT JOIN public."Brand" b ON b.id = p."brandId"
    LEFT JOIN reversal r ON r."productId" = p.id
    LEFT JOIN latest_supplier ls ON ls."productId" = p.id
    LEFT JOIN public."Supplier" s ON s.id = ls."supplierId"
    LEFT JOIN historical_price hp ON hp."productId" = p.id
    LEFT JOIN earliest_price ep ON ep."productId" = p.id
    WHERE p."createdAt" <= ${asOfDate}
    ${searchClause}
    ${supplierClause}
    ORDER BY p.name ASC
    ${limitOffsetClause}
  `;

  const total = rows.length > 0 ? Number(rows[0].totalCount) : 0;
  const totals = {
    quantity: rows.length > 0 ? Number(rows[0].totalQuantitySum ?? 0) : 0,
    value: rows.length > 0 ? Number(rows[0].totalValueSum ?? 0) : 0,
  };

  return {
    items: rows.map((row) => {
      const purchasePrice = Number(row.purchasePrice);
      const quantity = Number(row.quantity);
      return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        categoryName: row.categoryName,
        brandName: row.brandName,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        quantity,
        minStockLevel: Number(row.minStockLevel),
        status: row.status,
        purchasePrice,
        priceIsEstimated: row.priceIsEstimated,
        value: quantity * purchasePrice,
      };
    }),
    total,
    totals,
  };
}

export async function getInventoryReportData({
  asOfDate,
  supplierId,
  query,
  limit,
}: {
  asOfDate: Date;
  supplierId?: string;
  query?: string;
  limit?: number;
}) {
  return fetchInventoryHistoricalReportRows({
    asOfDate,
    supplierId,
    query,
    take: limit,
  });
}

export async function getInventoryReportPage({
  page,
  asOfDate,
  supplierId,
  query,
}: {
  page: number;
  asOfDate: Date;
  supplierId?: string;
  query?: string;
}) {
  const { items, total, totals } = await fetchInventoryHistoricalReportRows({
    asOfDate,
    supplierId,
    query,
    skip: (page - 1) * REPORTS_PAGE_SIZE,
    take: REPORTS_PAGE_SIZE,
  });

  return { items, total, pageSize: REPORTS_PAGE_SIZE, totals };
}

export async function getProductsReportData(limit?: number) {
  return prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, select: { secureUrl: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function getProductsReportPage({ page }: { page: number }) {
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
    }),
    prisma.product.count(),
  ]);

  return { items, total, pageSize: REPORTS_PAGE_SIZE };
}

export async function getPurchasesReportData(limit?: number) {
  return prisma.purchaseOrder.findMany({
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getPurchasesReportPage({ page }: { page: number }) {
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
    }),
    prisma.purchaseOrder.count(),
  ]);

  return { items, total, pageSize: REPORTS_PAGE_SIZE };
}

export async function getSuppliersReportData(limit?: number) {
  const suppliers = await prisma.supplier.findMany({
    include: { purchaseOrders: { select: { total: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return suppliers.map(mapSupplierReportRow);
}

export async function getSuppliersReportPage({ page }: { page: number }) {
  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      include: { purchaseOrders: { select: { total: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
    }),
    prisma.supplier.count(),
  ]);

  return {
    items: suppliers.map(mapSupplierReportRow),
    total,
    pageSize: REPORTS_PAGE_SIZE,
  };
}

function mapSupplierReportRow(supplier: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  purchaseOrders: { total: Prisma.Decimal | number }[];
}) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    ordersCount: supplier.purchaseOrders.length,
    totalPurchased: supplier.purchaseOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    ),
  };
}

export async function getOrdersReportData(limit?: number) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOrdersReportPage({ page }: { page: number }) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
    }),
    prisma.order.count(),
  ]);

  return { items, total, pageSize: REPORTS_PAGE_SIZE };
}

export async function getCustomersReportData(limit?: number) {
  const customers = await prisma.customer.findMany({
    include: { orders: { select: { total: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return customers.map(mapCustomerReportRow);
}

export async function getCustomersReportPage({ page }: { page: number }) {
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      include: { orders: { select: { total: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
    }),
    prisma.customer.count(),
  ]);

  return {
    items: customers.map(mapCustomerReportRow),
    total,
    pageSize: REPORTS_PAGE_SIZE,
  };
}

function mapCustomerReportRow(customer: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  orders: { total: Prisma.Decimal | number }[];
}) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    ordersCount: customer.orders.length,
    totalSpent: customer.orders.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    ),
  };
}
