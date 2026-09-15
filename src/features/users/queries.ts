import "server-only";
import { prisma } from "@/lib/prisma";

export const USERS_PAGE_SIZE = 10;

export async function getUsersPage({
  query,
  page,
}: {
  query?: string;
  page: number;
}) {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.admin.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, isFullAccess: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
    prisma.admin.count({ where }),
  ]);

  return { items, total, pageSize: USERS_PAGE_SIZE };
}

export async function getUserById(id: string) {
  return prisma.admin.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true, roleId: true },
  });
}

export async function getRoleOptions() {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isFullAccess: true },
  });
}
