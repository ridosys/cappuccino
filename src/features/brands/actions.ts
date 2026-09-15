"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { brandSchema } from "@/features/brands/schema";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

type ActionResult = { error?: string; success?: boolean };

export async function createBrand(input: unknown): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { error: t.brands.validationError };

  try {
    await prisma.brand.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        logoUrl: parsed.data.logo?.secureUrl ?? null,
        logoPublicId: parsed.data.logo?.publicId ?? null,
        createdById: access.adminId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.brands.slugTakenError };
    }
    return { error: t.brands.createError };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function updateBrand(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { error: t.brands.validationError };

  const existing = await prisma.brand.findUnique({
    where: { id },
    select: { logoPublicId: true },
  });
  if (!existing) return { error: t.brands.notFoundError };
  const nextPublicId = parsed.data.logo?.publicId ?? null;
  const removedPublicId =
    existing.logoPublicId && existing.logoPublicId !== nextPublicId
      ? existing.logoPublicId
      : null;

  try {
    await prisma.brand.update({
      where: { id },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        logoUrl: parsed.data.logo?.secureUrl ?? null,
        logoPublicId: parsed.data.logo?.publicId ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: t.brands.slugTakenError };
    }
    return { error: t.brands.updateError };
  }

  if (removedPublicId) {
    await Promise.allSettled([destroyCloudinaryAsset(removedPublicId)]);
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { logoPublicId: true },
  });
  if (!brand) return { error: t.brands.notFoundError };

  try {
    await prisma.brand.delete({ where: { id } });
  } catch {
    return { error: t.brands.cannotDeleteLinkedError };
  }

  if (brand.logoPublicId) {
    await Promise.allSettled([destroyCloudinaryAsset(brand.logoPublicId)]);
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function deleteBrands(ids: string[]): Promise<ActionResult> {
  const access = await requirePermission("PRODUCTS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  const t = await getDictionary();

  const brands = await prisma.brand.findMany({
    where: { id: { in: ids } },
    select: { id: true, logoPublicId: true },
  });

  let failedCount = 0;
  for (const brand of brands) {
    try {
      await prisma.brand.delete({ where: { id: brand.id } });
      if (brand.logoPublicId) {
        await Promise.allSettled([destroyCloudinaryAsset(brand.logoPublicId)]);
      }
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/brands");

  if (failedCount > 0) {
    return {
      error: formatMessage(t.brands.bulkDeleteErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}
