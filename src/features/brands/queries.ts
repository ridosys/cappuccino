import "server-only";
import { prisma } from "@/lib/prisma";

export const BRANDS_PAGE_SIZE = 10;
export const BRAND_PROFILE_PRODUCTS_PAGE_SIZE = 10;

export async function getBrandsPage({
  query,
  page,
}: {
  query?: string;
  page: number;
}) {
  const where = query
    ? { name: { contains: query, mode: "insensitive" as const } }
    : {};

  const [items, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * BRANDS_PAGE_SIZE,
      take: BRANDS_PAGE_SIZE,
    }),
    prisma.brand.count({ where }),
  ]);

  return { items, total, pageSize: BRANDS_PAGE_SIZE };
}

export async function getBrandOptions() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getBrandById(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export async function getBrandProfile(id: string, productPage: number) {
  const [brand, stock, lowStockRows] = await Promise.all([
    prisma.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
        createdBy: { select: { name: true } },
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            minStockLevel: true,
            status: true,
          },
          orderBy: { name: "asc" },
          skip: (productPage - 1) * BRAND_PROFILE_PRODUCTS_PAGE_SIZE,
          take: BRAND_PROFILE_PRODUCTS_PAGE_SIZE,
        },
      },
    }),
    prisma.product.aggregate({
      where: { brandId: id },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM public."Product"
      WHERE "brandId" = ${id} AND quantity <= "minStockLevel"
    `,
  ]);
  if (!brand) return null;

  return {
    brand: {
      ...brand,
      products: brand.products.map((product) => ({
        ...product,
        quantity: product.quantity.toNumber(),
        minStockLevel: product.minStockLevel.toNumber(),
      })),
    },
    productsTotal: brand._count.products,
    productsPageSize: BRAND_PROFILE_PRODUCTS_PAGE_SIZE,
    totalStock: stock._sum.quantity?.toNumber() ?? 0,
    lowStockCount: Number(lowStockRows[0]?.count ?? 0),
  };
}
