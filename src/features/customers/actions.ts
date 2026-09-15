"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { customerSchema } from "@/features/customers/schema";
import { normalizeArabicName } from "@/lib/arabic-name";
import {
  findCustomerByPhone,
  findCustomerByNormalizedName,
} from "@/features/customers/queries";
import { adjustCustomerBalance } from "@/features/customers/balance";
import { isDeletePasswordValid, getDeletePasswordError } from "@/lib/delete-guard";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

type ActionResult = { error?: string; success?: boolean };
type CreateCustomerResult = ActionResult & { customerId?: string };

export async function createCustomer(
  input: unknown,
): Promise<CreateCustomerResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: t.customers.validationError };

  const nameTaken = await prisma.customer.findFirst({
    where: { nameNormalized: normalizeArabicName(parsed.data.name) },
    select: { id: true },
  });
  if (nameTaken) {
    return { error: t.customers.nameTakenError };
  }

  if (parsed.data.phone) {
    const existing = await prisma.customer.findFirst({
      where: { phone: parsed.data.phone },
      select: { id: true },
    });
    if (existing) {
      return { error: t.customers.phoneTakenError };
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      nameNormalized: normalizeArabicName(parsed.data.name),
      phone: parsed.data.phone || "",
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      isFavorite: parsed.data.isFavorite,
      imageUrl: parsed.data.image?.secureUrl ?? null,
      imagePublicId: parsed.data.image?.publicId ?? null,
      createdById: access.adminId,
    },
  });

  revalidatePath("/dashboard/customers");
  return { success: true, customerId: customer.id };
}

export async function updateCustomer(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: t.customers.validationError };

  const current = await prisma.customer.findUnique({
    where: { id },
    select: { nameNormalized: true },
  });
  if (!current) return { error: t.customers.notFoundError };

  // Enforce unique names, but only when the name is actually being changed —
  // so an admin can still edit a customer that happens to share a name with
  // a record created before this rule existed.
  const nextNameNormalized = normalizeArabicName(parsed.data.name);
  if (nextNameNormalized !== current.nameNormalized) {
    const nameTaken = await prisma.customer.findFirst({
      where: { nameNormalized: nextNameNormalized, id: { not: id } },
      select: { id: true },
    });
    if (nameTaken) {
      return { error: t.customers.nameTakenError };
    }
  }

  if (parsed.data.phone) {
    const existing = await prisma.customer.findFirst({
      where: { phone: parsed.data.phone, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      return { error: t.customers.phoneTakenError };
    }
  }

  // `image` is only present when the caller actually manages a photo (the
  // main customer form) — other, lighter edit paths (e.g. the order-flow
  // customer sheet) never send it, and must leave any existing photo alone
  // rather than wiping it out.
  const changesImage = parsed.data.image !== undefined;
  const previous = changesImage
    ? await prisma.customer.findUnique({
        where: { id },
        select: { imagePublicId: true },
      })
    : null;

  // Invoices and orders each keep their own snapshot of the customer's
  // name/phone/email (so historical documents don't shift if the customer
  // record changes) — but admins expect a plain name correction to show up
  // everywhere that customer is referenced, not just on the Customer record
  // itself, so every one of their invoices/orders gets the same update.
  const customerData = {
    name: parsed.data.name,
    nameNormalized: normalizeArabicName(parsed.data.name),
    phone: parsed.data.phone || "",
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    isFavorite: parsed.data.isFavorite,
    ...(changesImage
      ? {
          imageUrl: parsed.data.image?.secureUrl ?? null,
          imagePublicId: parsed.data.image?.publicId ?? null,
        }
      : {}),
  };
  const snapshotData = {
    customerName: parsed.data.name,
    customerPhone: parsed.data.phone || "",
    customerEmail: parsed.data.email || null,
  };

  await prisma.$transaction([
    prisma.customer.update({ where: { id }, data: customerData }),
    prisma.invoice.updateMany({ where: { customerId: id }, data: snapshotData }),
    prisma.order.updateMany({ where: { customerId: id }, data: snapshotData }),
  ]);

  const newPublicId = parsed.data.image?.publicId ?? null;
  if (previous?.imagePublicId && previous.imagePublicId !== newPublicId) {
    try {
      await destroyCloudinaryAsset(previous.imagePublicId);
    } catch {
      // Best effort — the customer row already points at the new/no image.
    }
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/orders");
  return { success: true };
}

export async function adjustCustomerBalanceManual(
  customerId: string,
  input: { delta: number; note?: string },
): Promise<ActionResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!Number.isFinite(input.delta) || Math.abs(input.delta) < 0.005) {
    return { error: t.customers.invalidAmountError };
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: t.customers.notFoundError };

  await prisma.$transaction(async (tx) => {
    await adjustCustomerBalance(tx, customerId, input.delta, {
      reason: "MANUAL_ADJUSTMENT",
      note: input.note,
    });
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function findCustomerByPhoneAction(
  phone: string,
  excludeId?: string,
) {
  if (!(await hasPermission("CUSTOMERS_MANAGE"))) return [];
  if (phone.trim().length < 6) return [];
  return findCustomerByPhone(phone, excludeId);
}

export async function findCustomerByNameAction(
  name: string,
  excludeId?: string,
) {
  if (!(await hasPermission("CUSTOMERS_MANAGE"))) return [];
  if (name.trim().length < 2) return [];
  return findCustomerByNormalizedName(name, excludeId);
}

export async function deleteCustomer(
  id: string,
  password: string,
): Promise<ActionResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };
  const t = await getDictionary();

  const existing = await prisma.customer.findUnique({
    where: { id },
    select: { imagePublicId: true },
  });

  try {
    await prisma.customer.delete({ where: { id } });
  } catch {
    return { error: t.customers.cannotDeleteLinkedError };
  }

  if (existing?.imagePublicId) {
    try {
      await destroyCloudinaryAsset(existing.imagePublicId);
    } catch {
      // Best effort — the customer row is already gone.
    }
  }

  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function deleteCustomers(
  ids: string[],
  password?: string,
): Promise<ActionResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  if (!isDeletePasswordValid(password)) return { error: await getDeletePasswordError() };
  const t = await getDictionary();

  const existing = await prisma.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, imagePublicId: true },
  });
  const imagePublicIdById = new Map(
    existing.map((row) => [row.id, row.imagePublicId]),
  );

  let failedCount = 0;
  for (const id of ids) {
    try {
      await prisma.customer.delete({ where: { id } });
      const publicId = imagePublicIdById.get(id);
      if (publicId) {
        try {
          await destroyCloudinaryAsset(publicId);
        } catch {
          // Best effort — the customer row is already gone.
        }
      }
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/customers");

  if (failedCount > 0) {
    return {
      error: formatMessage(t.customers.bulkDeleteErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}

export async function toggleCustomerFavorite(
  id: string,
  isFavorite: boolean,
): Promise<ActionResult> {
  const access = await requirePermission("CUSTOMERS_MANAGE");
  if (!access.ok) return { error: access.error };

  await prisma.customer.update({
    where: { id },
    data: { isFavorite },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { success: true };
}
