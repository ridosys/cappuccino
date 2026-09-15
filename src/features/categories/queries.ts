import "server-only";
import { prisma } from "@/lib/prisma";

export const CATEGORIES_PAGE_SIZE = 10;
export const CATEGORY_PROFILE_PRODUCTS_PAGE_SIZE = 10;

export async function getCategoriesPage({
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
    prisma.category.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CATEGORIES_PAGE_SIZE,
      take: CATEGORIES_PAGE_SIZE,
    }),
    prisma.category.count({ where }),
  ]);

  return { items, total, pageSize: CATEGORIES_PAGE_SIZE };
}

export async function getCategoryOptions(excludeId?: string) {
  return prisma.category.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function getCategoryProfile(id: string, productPage: number) {
  const [category, stock, lowStockRows] = await Promise.all([
    prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true }, orderBy: { name: "asc" } },
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
          skip: (productPage - 1) * CATEGORY_PROFILE_PRODUCTS_PAGE_SIZE,
          take: CATEGORY_PROFILE_PRODUCTS_PAGE_SIZE,
        },
      },
    }),
    prisma.product.aggregate({
      where: { categoryId: id },
      _sum: { quantity: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM public."Product"
      WHERE "categoryId" = ${id} AND quantity <= "minStockLevel"
    `,
  ]);
  if (!category) return null;

  return {
    category: {
      ...category,
      products: category.products.map((product) => ({
        ...product,
        quantity: product.quantity.toNumber(),
        minStockLevel: product.minStockLevel.toNumber(),
      })),
    },
    productsTotal: category._count.products,
    productsPageSize: CATEGORY_PROFILE_PRODUCTS_PAGE_SIZE,
    totalStock: stock._sum.quantity?.toNumber() ?? 0,
    lowStockCount: Number(lowStockRows[0]?.count ?? 0),
  };
}
