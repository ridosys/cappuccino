"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  countOtherActiveFullAccessAdmins,
} from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { isDeletePasswordValid, getDeletePasswordError } from "@/lib/delete-guard";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from "./schema";

type ActionResult = { error?: string; success?: boolean };

const PASSWORD_HASH_COST = 12;

export async function createUser(input: unknown): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: t.users.validationError };

  try {
    const hashed = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_COST);
    await prisma.admin.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashed,
        roleId: parsed.data.roleId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.users.emailTakenError };
    }
    return { error: t.users.createError };
  }

  revalidatePath("/dashboard/settings/users");
  return { success: true };
}

export async function updateUser(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { error: t.users.validationError };

  const target = await prisma.admin.findUnique({
    where: { id },
    select: { roleId: true, role: { select: { isFullAccess: true } } },
  });
  if (!target) return { error: t.users.notFoundError };

  // Structural guard against self-escalation: nobody can change their own
  // role, even an admin with USERS_MANAGE — closes the "grant myself more
  // permissions" hole without relying on the UI to hide the control.
  if (id === access.adminId && parsed.data.roleId !== target.roleId) {
    return { error: t.users.cannotChangeOwnRoleError };
  }

  const newRole = await prisma.role.findUnique({
    where: { id: parsed.data.roleId },
    select: { isFullAccess: true },
  });
  if (!newRole) return { error: t.users.roleNotFoundError };

  if (target.role.isFullAccess && !newRole.isFullAccess) {
    const others = await countOtherActiveFullAccessAdmins(id);
    if (others === 0) {
      return { error: t.users.cannotRemoveLastAdminError };
    }
  }

  try {
    await prisma.admin.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        roleId: parsed.data.roleId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.users.emailTakenError };
    }
    return { error: t.users.updateError };
  }

  revalidatePath("/dashboard/settings/users");
  return { success: true };
}

export async function resetUserPassword(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: t.users.validationError };

  const hashed = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_COST);
  await prisma.admin.update({ where: { id }, data: { password: hashed } });

  revalidatePath("/dashboard/settings/users");
  return { success: true };
}

export async function toggleUserActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!isActive) {
    if (id === access.adminId) {
      return { error: t.users.cannotDeactivateSelfError };
    }
    const target = await prisma.admin.findUnique({
      where: { id },
      select: { role: { select: { isFullAccess: true } } },
    });
    if (target?.role.isFullAccess) {
      const others = await countOtherActiveFullAccessAdmins(id);
      if (others === 0) {
        return { error: t.users.cannotDeactivateLastAdminError };
      }
    }
  }

  await prisma.admin.update({ where: { id }, data: { isActive } });
  revalidatePath("/dashboard/settings/users");
  return { success: true };
}

async function guardUserDeletion(
  id: string,
  currentAdminId: string,
  t: Dictionary,
): Promise<ActionResult | null> {
  if (id === currentAdminId) return { error: t.users.cannotDeleteSelfError };

  const target = await prisma.admin.findUnique({
    where: { id },
    select: { role: { select: { isFullAccess: true } } },
  });
  if (!target) return { error: t.users.notFoundError };
  if (target.role.isFullAccess) {
    const others = await countOtherActiveFullAccessAdmins(id);
    if (others === 0) return { error: t.users.cannotDeleteLastAdminError };
  }
  return null;
}

export async function deleteUser(
  id: string,
  password: string,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };
  const t = await getDictionary();

  const blocked = await guardUserDeletion(id, access.adminId, t);
  if (blocked) return blocked;

  try {
    await prisma.admin.delete({ where: { id } });
  } catch {
    return { error: t.users.cannotDeleteLinkedError };
  }

  revalidatePath("/dashboard/settings/users");
  return { success: true };
}

export async function deleteUsers(
  ids: string[],
  password?: string,
): Promise<ActionResult> {
  const access = await requirePermission("USERS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };
  const t = await getDictionary();

  let failedCount = 0;
  for (const id of ids) {
    const blocked = await guardUserDeletion(id, access.adminId, t);
    if (blocked) {
      failedCount++;
      continue;
    }
    try {
      await prisma.admin.delete({ where: { id } });
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/settings/users");

  if (failedCount > 0) {
    return { error: formatMessage(t.users.bulkDeleteErrorTemplate, { count: failedCount }) };
  }
  return { success: true };
}
