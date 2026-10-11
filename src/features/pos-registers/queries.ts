import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type AdminPosRegister = {
  id: string;
  name: string;
  customerId: string;
  /** Empty = no category restriction. */
  categoryIds: string[];
};

/** The caisse an admin is locked to, or null when they use the regular
 * unrestricted one. An admin assigned to several active caisses gets the
 * first by name — the settings page recommends one caisse per user.
 * Memoized per request only (so a config change applies immediately). */
export const getAdminPosRegister = cache(
  async (adminId: string): Promise<AdminPosRegister | null> => {
    const row = await prisma.posRegister.findFirst({
      where: { isActive: true, admins: { some: { id: adminId } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        customerId: true,
        categories: { select: { id: true } },
      },
    });
    return row
      ? {
          id: row.id,
          name: row.name,
          customerId: row.customerId,
          categoryIds: row.categories.map((c) => c.id),
        }
      : null;
  },
);

export async function getPosRegisters() {
  return prisma.posRegister.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      customer: { select: { id: true, name: true, phone: true } },
      categories: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      admins: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
}

export type PosRegisterRow = Awaited<ReturnType<typeof getPosRegisters>>[number];

export async function getPosRegisterFormOptions() {
  const [customers, categories, admins] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { customers, categories, admins };
}
