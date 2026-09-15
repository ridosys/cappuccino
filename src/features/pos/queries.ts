import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { normalizeArabicName } from "@/lib/arabic-name";

export const POS_PRODUCTS_PAGE_SIZE = 24;
export const POS_CUSTOMERS_PAGE_SIZE = 60;
export const POS_CATEGORIES_PAGE_SIZE = 20;

export type PosCategory = {
  id: string;
  name: string;
  image: string | null;
  count: number;
};

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  /** The product's first price — the only price the POS sells at. `price`
   * and `price1` are the same value (kept for the card / cart call sites). */
  price: number;
  price1: number;
  stock: number;
  image: string | null;
};

export type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  balance: number;
  imageUrl: string | null;
};

function mapProduct(row: {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price1: Prisma.Decimal;
  quantity: Prisma.Decimal;
  images: { secureUrl: string }[];
}): PosProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    price: Number(row.price1),
    price1: Number(row.price1),
    stock: Number(row.quantity),
    image: row.images[0]?.secureUrl ?? null,
  };
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  price1: true,
  quantity: true,
  images: {
    orderBy: { position: "asc" as const },
    take: 1,
    select: { secureUrl: true },
  },
} satisfies Prisma.ProductSelect;

export const POS_PRODUCT_SORTS = [
  "best",
  // Orders by how often the selected customer has bought each product
  // (needs `customerId`; falls back to "best" without one).
  "customerFrequent",
  "newest",
  "name",
  "priceAsc",
  "priceDesc",
  "stockDesc",
] as const;
export type PosProductSort = (typeof POS_PRODUCT_SORTS)[number];

const SORT_ORDER: Record<PosProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  best: [{ invoiceItems: { _count: "desc" } }, { name: "asc" }],
  // Handled by a dedicated raw query before this map is consulted; kept here
  // only so the Record stays exhaustive.
  customerFrequent: [{ invoiceItems: { _count: "desc" } }, { name: "asc" }],
  newest: [{ createdAt: "desc" }],
  name: [{ name: "asc" }],
  priceAsc: [{ price1: "asc" }, { name: "asc" }],
  priceDesc: [{ price1: "desc" }, { name: "asc" }],
  stockDesc: [{ quantity: "desc" }, { name: "asc" }],
};

function productWhere(
  categoryId?: string | null,
  q?: string | null,
  inStockOnly?: boolean,
): Prisma.ProductWhereInput {
  const search = q?.trim();
  return {
    status: "ACTIVE",
    ...(categoryId ? { categoryId } : {}),
    ...(inStockOnly ? { quantity: { gt: 0 } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/** Offset-paginated left-rail categories for the infinite-scroll list —
 * each with its count of ACTIVE products. `total` is the ACTIVE product
 * count (the "All" pseudo-row's badge) and is only computed for the first
 * page. `take + 1` tells us whether there's another page. */
export async function getPosCategoriesPage({
  offset = 0,
  take = POS_CATEGORIES_PAGE_SIZE,
}: {
  offset?: number;
  take?: number;
} = {}) {
  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      skip: offset,
      take: take + 1,
      select: {
        id: true,
        name: true,
        imageSecureUrl: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    }),
    offset === 0
      ? prisma.product.count({ where: { status: "ACTIVE" } })
      : Promise.resolve(0),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    total,
    items: page.map((row) => ({
      id: row.id,
      name: row.name,
      image: row.imageSecureUrl,
      count: row._count.products,
    })) satisfies PosCategory[],
    nextOffset: hasMore ? offset + take : null,
  };
}

/** Offset-paginated product feed for the infinite-scroll grid. Ordered
 * best-seller first (by how many invoice lines reference the product),
 * then by name — unless `sort` overrides it. `take + 1` tells us whether
 * there's another page. */
export async function getPosProducts({
  offset = 0,
  categoryId,
  q,
  sort = "best",
  inStockOnly = false,
  customerId,
  take = POS_PRODUCTS_PAGE_SIZE,
}: {
  offset?: number;
  categoryId?: string | null;
  q?: string | null;
  sort?: PosProductSort;
  inStockOnly?: boolean;
  /** Required for the "customerFrequent" sort; ignored otherwise. */
  customerId?: string | null;
  take?: number;
}) {
  if (sort === "customerFrequent" && customerId) {
    return getPosProductsByCustomerHistory({
      customerId,
      categoryId,
      q,
      inStockOnly,
      offset,
      take,
    });
  }

  const where = productWhere(categoryId, q, inStockOnly);
  const effectiveSort: PosProductSort =
    sort === "customerFrequent" ? "best" : sort;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORT_ORDER[effectiveSort] ?? SORT_ORDER.best,
      skip: offset,
      take: take + 1,
      select: PRODUCT_SELECT,
    }),
    prisma.product.count({ where }),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map(mapProduct),
    total,
    nextOffset: hasMore ? offset + take : null,
  };
}

/** Product feed ordered by the given customer's own purchase history —
 * products they've bought on the most separate invoices come first, then by
 * total quantity, then name. Products they've never bought still appear,
 * after the ones they have. Same filters / paging shape as `getPosProducts`. */
async function getPosProductsByCustomerHistory({
  customerId,
  categoryId,
  q,
  inStockOnly,
  offset,
  take,
}: {
  customerId: string;
  categoryId?: string | null;
  q?: string | null;
  inStockOnly?: boolean;
  offset: number;
  take: number;
}) {
  const where = productWhere(categoryId, q, inStockOnly);

  const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];
  if (categoryId) conditions.push(Prisma.sql`p."categoryId" = ${categoryId}`);
  if (inStockOnly) conditions.push(Prisma.sql`p.quantity > 0`);
  const search = q?.trim();
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      Prisma.sql`(p.name ILIKE ${like} OR p.sku ILIKE ${like} OR p.barcode ILIKE ${like})`,
    );
  }
  const whereSql = Prisma.join(conditions, " AND ");

  const [idRows, total] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM public."Product" p
      LEFT JOIN (
        SELECT ii."productId" AS pid,
               COUNT(DISTINCT i.id) AS purchases,
               SUM(ii.quantity)     AS qty
        FROM public."InvoiceItem" ii
        JOIN public."Invoice" i ON i.id = ii."invoiceId"
        WHERE i."customerId" = ${customerId}
          AND ii."productId" IS NOT NULL
        GROUP BY ii."productId"
      ) f ON f.pid = p.id
      WHERE ${whereSql}
      ORDER BY
        COALESCE(f.purchases, 0) DESC,
        COALESCE(f.qty, 0)       DESC,
        p.name ASC,
        p.id ASC
      LIMIT ${take + 1} OFFSET ${offset}
    `,
    prisma.product.count({ where }),
  ]);

  const hasMore = idRows.length > take;
  const pageIds = (hasMore ? idRows.slice(0, take) : idRows).map((r) => r.id);

  const rows = await prisma.product.findMany({
    where: { id: { in: pageIds } },
    select: PRODUCT_SELECT,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  // Re-apply the ranked order — `findMany`'s `in` filter doesn't preserve it.
  const items: PosProduct[] = [];
  for (const id of pageIds) {
    const row = byId.get(id);
    if (row) items.push(mapProduct(row));
  }

  return {
    items,
    total,
    nextOffset: hasMore ? offset + take : null,
  };
}

export async function getPosProductByBarcode(barcode: string) {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const row = await prisma.product.findFirst({
    where: { barcode: trimmed, status: "ACTIVE" },
    select: PRODUCT_SELECT,
  });
  return row ? mapProduct(row) : null;
}

/** Customer search for Step 1 — exact phone match OR pg_trgm name
 * similarity, mirroring `searchCustomers` but with paging for the
 * "View more customers" control. */
export async function searchPosCustomers({
  q,
  offset = 0,
  take = POS_CUSTOMERS_PAGE_SIZE,
}: {
  q?: string | null;
  offset?: number;
  take?: number;
}) {
  const trimmed = q?.trim() ?? "";
  const limit = take + 1;

  let rows: PosCustomer[];
  if (!trimmed) {
    // `id` is a secondary tiebreaker: several customers can share the exact
    // same createdAt (bulk imports/seeds), and skip/take paging over a
    // non-unique sort order isn't guaranteed stable across requests — rows
    // can shift between pages and come back duplicated (or dropped).
    const found = await prisma.customer.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        balance: true,
        imageUrl: true,
      },
    });
    rows = found.map((c) => ({ ...c, balance: Number(c.balance) }));
  } else {
    const normalized = normalizeArabicName(trimmed);
    const raw = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        balance: Prisma.Decimal;
        imageUrl: string | null;
      }[]
    >`
      SELECT id, name, phone, email, balance, "imageUrl"
      FROM public."Customer"
      WHERE (phone ILIKE ${"%" + trimmed + "%"} OR similarity("nameNormalized", ${normalized}) > 0.2)
      ORDER BY similarity("nameNormalized", ${normalized}) DESC, "createdAt" DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    rows = raw.map((c) => ({ ...c, balance: Number(c.balance) }));
  }

  const hasMore = rows.length > take;
  return { items: hasMore ? rows.slice(0, take) : rows, hasMore };
}

export async function getPosCustomerById(id: string): Promise<PosCustomer | null> {
  const row = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      balance: true,
      imageUrl: true,
    },
  });
  return row ? { ...row, balance: Number(row.balance) } : null;
}
