"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { categorySchema } from "@/features/categories/schema";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

type ActionResult = { error?: string; success?: boolean };

export async function createCategory(input: unknown): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: t.categories.validationError };

  try {
    await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        parentId: parsed.data.parentId || null,
        imagePublicId: parsed.data.image?.publicId ?? null,
        imageSecureUrl: parsed.data.image?.secureUrl ?? null,
        createdById: access.adminId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.categories.slugTakenError };
    }
    return { error: t.categories.createError };
  }

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function updateCategory(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: t.categories.validationError };

  if (parsed.data.parentId === id) {
    return { error: t.categories.selfParentError };
  }

  const existing = await prisma.category.findUnique({
    where: { id },
    select: { imagePublicId: true },
  });
  if (!existing) return { error: t.categories.notFoundError };
  const nextPublicId = parsed.data.image?.publicId ?? null;
  const removedPublicId =
    existing.imagePublicId && existing.imagePublicId !== nextPublicId
      ? existing.imagePublicId
      : null;

  try {
    await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        parentId: parsed.data.parentId || null,
        imagePublicId: parsed.data.image?.publicId ?? null,
        imageSecureUrl: parsed.data.image?.secureUrl ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.categories.slugTakenError };
    }
    return { error: t.categories.updateError };
  }

  if (removedPublicId) {
    await Promise.allSettled([destroyCloudinaryAsset(removedPublicId)]);
  }

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const category = await prisma.category.findUnique({
    where: { id },
    select: { imagePublicId: true },
  });
  if (!category) return { error: t.categories.notFoundError };

  try {
    await prisma.category.delete({ where: { id } });
  } catch {
    return { error: t.categories.cannotDeleteLinkedError };
  }

  if (category.imagePublicId) {
    await Promise.allSettled([destroyCloudinaryAsset(category.imagePublicId)]);
  }

  revalidatePath("/dashboard/categories");
  return { success: true };
}

export async function deleteCategories(ids: string[]): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  const t = await getDictionary();

  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, imagePublicId: true },
  });

  let failedCount = 0;
  for (const category of categories) {
    try {
      await prisma.category.delete({ where: { id: category.id } });
      if (category.imagePublicId) {
        await Promise.allSettled([
          destroyCloudinaryAsset(category.imagePublicId),
        ]);
      }
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/categories");

  if (failedCount > 0) {
    return {
      error: formatMessage(t.categories.bulkDeleteErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}
