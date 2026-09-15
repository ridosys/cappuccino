"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { getDictionary } from "@/i18n/server";
import { roleSchema } from "./schema";

type ActionResult = { error?: string; success?: boolean };

export async function createRole(input: unknown): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: t.roles.validationError };

  try {
    await prisma.role.create({
      data: {
        name: parsed.data.name,
        isFullAccess: parsed.data.isFullAccess,
        permissions: parsed.data.isFullAccess
          ? undefined
          : {
              create: parsed.data.permissions.map((permission) => ({
                permission,
              })),
            },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: t.roles.nameTakenError };
    return { error: t.roles.createError };
  }

  revalidatePath("/dashboard/settings/roles");
  return { success: true };
}

export async function updateRole(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: t.roles.validationError };

  const existing = await prisma.role.findUnique({
    where: { id },
    select: { isSystem: true, isFullAccess: true },
  });
  if (!existing) return { error: t.roles.notFoundError };

  // The built-in Admin role's name and full-access flag are locked so the
  // app always keeps at least one un-editable full-access role to fall
  // back on — only its permission set (moot, since isFullAccess bypasses
  // it) would otherwise be editable.
  if (existing.isSystem && (parsed.data.name !== "Admin" || !parsed.data.isFullAccess)) {
    return { error: t.roles.cannotEditSystemRoleError };
  }

  if (existing.isFullAccess && !parsed.data.isFullAccess) {
    const otherActiveFullAccessAdmins = await prisma.admin.count({
      where: { isActive: true, roleId: { not: id }, role: { isFullAccess: true } },
    });
    if (otherActiveFullAccessAdmins === 0) {
      return { error: t.roles.cannotRemoveFullAccessError };
    }
  }

  try {
    await prisma.$transaction([
      prisma.role.update({
        where: { id },
        data: { name: parsed.data.name, isFullAccess: parsed.data.isFullAccess },
      }),
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      ...(parsed.data.isFullAccess
        ? []
        : [
            prisma.rolePermission.createMany({
              data: parsed.data.permissions.map((permission) => ({
                roleId: id,
                permission,
              })),
            }),
          ]),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: t.roles.nameTakenError };
    return { error: t.roles.updateError };
  }

  revalidatePath("/dashboard/settings/roles");
  return { success: true };
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const role = await prisma.role.findUnique({
    where: { id },
    select: { isSystem: true, _count: { select: { admins: true } } },
  });
  if (!role) return { error: t.roles.notFoundError };
  if (role.isSystem) return { error: t.roles.cannotDeleteSystemRoleError };
  if (role._count.admins > 0) {
    return { error: t.roles.cannotDeleteLinkedRoleError };
  }

  await prisma.role.delete({ where: { id } });
  revalidatePath("/dashboard/settings/roles");
  return { success: true };
}
