"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import { posRegisterSchema } from "./schema";

type ActionResult = { error?: string; success?: boolean };

export async function createPosRegister(input: unknown): Promise<ActionResult> {
  const access = await requirePermission("POS_CONFIGURE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = posRegisterSchema.safeParse(input);
  if (!parsed.success) return { error: t.posRegisters.validationError };
  const data = parsed.data;

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true },
  });
  if (!customer) return { error: t.posRegisters.customerNotFoundError };

  try {
    await prisma.posRegister.create({
      data: {
        name: data.name,
        isActive: data.isActive,
        customerId: data.customerId,
        categories: { connect: data.categoryIds.map((id) => ({ id })) },
        admins: { connect: data.adminIds.map((id) => ({ id })) },
      },
    });
  } catch {
    return { error: t.posRegisters.createError };
  }

  revalidatePath("/dashboard/settings/caisses");
  return { success: true };
}

export async function updatePosRegister(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("POS_CONFIGURE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = posRegisterSchema.safeParse(input);
  if (!parsed.success) return { error: t.posRegisters.validationError };
  const data = parsed.data;

  const [existing, customer] = await Promise.all([
    prisma.posRegister.findUnique({ where: { id }, select: { id: true } }),
    prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true },
    }),
  ]);
  if (!existing) return { error: t.posRegisters.notFoundError };
  if (!customer) return { error: t.posRegisters.customerNotFoundError };

  try {
    await prisma.posRegister.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        customerId: data.customerId,
        categories: { set: data.categoryIds.map((cid) => ({ id: cid })) },
        admins: { set: data.adminIds.map((aid) => ({ id: aid })) },
      },
    });
  } catch {
    return { error: t.posRegisters.updateError };
  }

  revalidatePath("/dashboard/settings/caisses");
  return { success: true };
}

export async function deletePosRegister(id: string): Promise<ActionResult> {
  const access = await requirePermission("POS_CONFIGURE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  try {
    await prisma.posRegister.delete({ where: { id } });
  } catch {
    return { error: t.posRegisters.deleteError };
  }

  revalidatePath("/dashboard/settings/caisses");
  return { success: true };
}
