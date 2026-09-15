import "server-only";
import { prisma } from "@/lib/prisma";

export const ROLES_PAGE_SIZE = 20;

export async function getRolesPage({ page }: { page: number }) {
  const [items, total] = await Promise.all([
    prisma.role.findMany({
      include: { _count: { select: { admins: true } } },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * ROLES_PAGE_SIZE,
      take: ROLES_PAGE_SIZE,
    }),
    prisma.role.count(),
  ]);

  return { items, total, pageSize: ROLES_PAGE_SIZE };
}

export async function getRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: { permissions: { select: { permission: true } } },
  });
}
