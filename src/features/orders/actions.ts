"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import {
  orderItemsSchema,
  reassignOrderCustomerSchema,
  createOrderSchema,
} from "@/features/orders/schema";
import { customerSchema } from "@/features/customers/schema";
import { normalizeArabicName } from "@/lib/arabic-name";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { validateAvailableStock } from "@/lib/stock-validation";
import { withDocumentNumber } from "@/lib/document-number";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

type ActionResult = { error?: string; success?: boolean };

export type ConflictCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
};

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  if (!VALID_STATUSES.includes(status as OrderStatus)) {
    return { error: t.orders.invalidStatusError };
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      invoice: { select: { id: true } },
    },
  });
  if (!order) return { error: t.orders.notFoundError };
  if (order.status === status) return { success: true };

  // Once an order has an issued invoice, the invoice's own OUT movements
  // (not the order's status) are the source of truth for the stock it
  // sold — createInvoice/getOrCreateInvoiceForOrder never reference the
  // order when logging those movements. Letting a status change here
  // independently decrement/restore stock on top of that would double up
  // (completing again) or wrongly restore stock the invoice still
  // legitimately holds decremented (uncompleting) — so it's blocked
  // entirely, matching the item-editing lock already shown in the UI for
  // an invoiced order.
  if (order.invoice) {
    return { error: t.orders.cannotChangeStatusInvoicedError };
  }

  const completingNow = status === "COMPLETED" && order.status !== "COMPLETED";
  const uncompletingNow = order.status === "COMPLETED" && status !== "COMPLETED";

  if (completingNow) {
    // An order is completed by generating its invoice, not from this
    // dropdown — getOrCreateInvoiceForOrder issues the invoice, books the
    // stock OUT and sets the status COMPLETED in one step. The UI opens that
    // dialog instead of calling this; this guard is the safety net for a
    // direct call.
    return { error: t.orders.completeViaInvoiceError };
  } else if (uncompletingNow) {
    // Mirrors the completion path in reverse: restores exactly what
    // completing this order decremented, with a matching IN movement so
    // the reversal is visible in stock history too.
    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
      }),
      ...order.items.map((item) =>
        prisma.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        }),
      ),
      ...order.items.map((item) =>
        prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            reason: `التراجع عن اكتمال الطلب رقم ${order.orderNumber}`,
          },
        }),
      ),
    ]);
  } else {
    await prisma.order.update({
      where: { id },
      data: { status: status as OrderStatus },
    });
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getOrderStockIssue(id: string) {
  if (!(await hasPermission("ORDERS_MANAGE"))) return null;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { name: true, quantity: true } } } } },
  });
  if (!order) return null;
  // item.quantity/item.product.quantity are Prisma.Decimal instances — a
  // native `+` here would silently string-concatenate instead of sum
  // across multiple items for the same product (Decimal.valueOf() returns
  // a string). Converting to a plain number up front keeps this genuinely
  // numeric; quantities are exact to 3 decimal places, well within float
  // precision for a stock-availability check.
  const totals = new Map<string, number>();
  order.items.forEach((item) => totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity.toNumber()));
  for (const item of order.items) {
    const requested = totals.get(item.productId) ?? 0;
    const available = item.product.quantity.toNumber();
    if (requested > available) {
      return { product: item.product.name, requested, available };
    }
  }
  return null;
}

export async function updateOrderItems(
  orderId: string,
  input: unknown,
  options?: { allowNegativeStock?: boolean },
): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = orderItemsSchema.safeParse(input);
  if (!parsed.success) return { error: t.orders.validationError };

  if (!options?.allowNegativeStock) {
    const stockError = await validateAvailableStock(parsed.data.items);
    if (stockError) return { error: stockError };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { error: t.orders.notFoundError };

  const existingIds = new Set(order.items.map((item) => item.id));
  const updates = parsed.data.items.filter(
    (item) => item.id && existingIds.has(item.id),
  );
  const newItems = parsed.data.items.filter((item) => !item.id);
  // Lines the form dropped (Trash button) come back simply absent from the
  // payload — delete those rows, otherwise the product stays on the order in
  // the DB and keeps tripping the stock check / inflating the total.
  const keptIds = new Set(
    parsed.data.items.filter((item) => item.id).map((item) => item.id!),
  );
  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

  if (newItems.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: newItems.map((item) => item.productId) } },
    });
    if (products.length !== new Set(newItems.map((item) => item.productId)).size) {
      return { error: t.orders.addedProductNotFoundError };
    }
  }

  const updatesById = new Map(updates.map((item) => [item.id, item]));
  const total =
    order.items
      .filter((item) => keptIds.has(item.id))
      .reduce((sum, item) => {
        const edited = updatesById.get(item.id);
        const price = edited?.price ?? Number(item.price);
        const quantity = edited?.quantity ?? item.quantity.toNumber();
        return sum + price * quantity;
      }, 0) +
    newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  await prisma.$transaction([
    ...(removedIds.length > 0
      ? [prisma.orderItem.deleteMany({ where: { id: { in: removedIds } } })]
      : []),
    ...updates.map((item) =>
      prisma.orderItem.update({
        where: { id: item.id! },
        data: { price: item.price, quantity: item.quantity },
      }),
    ),
    ...(newItems.length > 0
      ? [
          prisma.orderItem.createMany({
            data: newItems.map((item) => ({
              orderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          }),
        ]
      : []),
    prisma.order.update({ where: { id: orderId }, data: { total } }),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function reassignOrderCustomer(
  orderId: string,
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = reassignOrderCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: t.orders.validationError };

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
  });
  if (!customer) return { error: t.orders.customerNotFoundError };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { success: true };
}

/**
 * Saves the customer info attached to an order (creating a customer if the
 * order has none yet, or updating the one it's already linked to), guarding
 * against silently creating a duplicate customer when the submitted phone
 * number already belongs to someone else.
 *
 * On the first call (no `resolution`), a phone match against a *different*
 * customer is returned as `conflict` instead of being saved, so the caller
 * can ask the admin how to proceed, then call again with `resolution`:
 * - "update_existing": overwrite the matched customer's info with the
 *   submitted values and link the order to them.
 * - "keep_existing": leave the matched customer untouched and link the
 *   order to them as-is, discarding the submitted edits.
 * - "force_save": save exactly as if there were no conflict (creates a
 *   separate customer, or updates the order's own linked customer).
 */
export async function saveOrderCustomerInfo(
  orderId: string,
  customerId: string | null,
  input: unknown,
  resolution?: {
    action: "update_existing" | "keep_existing" | "force_save";
    existingCustomerId: string;
  },
): Promise<ActionResult & { conflict?: ConflictCustomer }> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: t.orders.validationError };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: t.orders.notFoundError };

  // Names must be unique. `keep_existing` doesn't write the submitted name
  // anywhere, so it's exempt; otherwise the row that will receive the name is
  // excluded, and the check is skipped when that row already carries this
  // name (so pre-existing same-name records stay editable).
  if (resolution?.action !== "keep_existing") {
    const nameOwnerId =
      resolution?.action === "update_existing"
        ? resolution.existingCustomerId
        : customerId;
    const nextNameNormalized = normalizeArabicName(parsed.data.name);
    const nameOwner = nameOwnerId
      ? await prisma.customer.findUnique({
          where: { id: nameOwnerId },
          select: { nameNormalized: true },
        })
      : null;
    if (nameOwner?.nameNormalized !== nextNameNormalized) {
      const nameTaken = await prisma.customer.findFirst({
        where: {
          nameNormalized: nextNameNormalized,
          ...(nameOwnerId ? { id: { not: nameOwnerId } } : {}),
        },
        select: { id: true },
      });
      if (nameTaken) return { error: t.customers.nameTakenError };
    }
  }

  if (!resolution && parsed.data.phone) {
    const conflictingCustomer = await prisma.customer.findFirst({
      where: {
        phone: parsed.data.phone,
        ...(customerId ? { id: { not: customerId } } : {}),
      },
    });
    if (conflictingCustomer) {
      return {
        conflict: {
          id: conflictingCustomer.id,
          name: conflictingCustomer.name,
          phone: conflictingCustomer.phone,
          email: conflictingCustomer.email,
          address: conflictingCustomer.address,
          notes: conflictingCustomer.notes,
        },
      };
    }
  }

  const customerData = {
    name: parsed.data.name,
    nameNormalized: normalizeArabicName(parsed.data.name),
    phone: parsed.data.phone || "",
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  };

  let targetCustomerId: string;

  if (resolution?.action === "keep_existing") {
    targetCustomerId = resolution.existingCustomerId;
  } else if (resolution?.action === "update_existing") {
    await prisma.customer.update({
      where: { id: resolution.existingCustomerId },
      data: customerData,
    });
    targetCustomerId = resolution.existingCustomerId;
  } else if (customerId) {
    await prisma.customer.update({ where: { id: customerId }, data: customerData });
    targetCustomerId = customerId;
  } else {
    const created = await prisma.customer.create({ data: customerData });
    targetCustomerId = created.id;
  }

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: targetCustomerId },
  });
  const snapshotData = {
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
  };

  // Orders and invoices each keep their own name/phone/email snapshot, so a
  // correction here needs to be pushed out to every other order and invoice
  // already linked to this customer too — not just the current order.
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { customerId: customer.id, ...snapshotData },
    }),
    prisma.order.updateMany({
      where: { customerId: customer.id, NOT: { id: orderId } },
      data: snapshotData,
    }),
    prisma.invoice.updateMany({
      where: { customerId: customer.id },
      data: snapshotData,
    }),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/invoices");
  if (customerId) revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath(`/dashboard/customers/${customer.id}`);

  return { success: true };
}

export async function createOrder(
  input: unknown,
  options?: { allowNegativeStock?: boolean },
): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { error: t.orders.validationError };

  if (!options?.allowNegativeStock) {
    const stockError = await validateAvailableStock(parsed.data.items);
    if (stockError) return { error: stockError };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
  });
  if (!customer) return { error: t.orders.customerNotFoundError };

  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.items.map((item) => item.productId) } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of parsed.data.items) {
    const product = productById.get(item.productId);
    if (!product) return { error: t.orders.productNotFoundError };
  }

  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );

  let orderId: string;
  try {
    const order = await withDocumentNumber("ORDER", (orderNumber) =>
      prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          notes: parsed.data.notes || null,
          total,
          createdById: access.adminId,
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      }),
    );
    orderId = order.id;
  } catch {
    return { error: t.orders.createError };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  redirect(`/dashboard/orders/${orderId}`);
}

/**
 * Reverses a COMPLETED order's stock effect before it's deleted, so the
 * order disappearing doesn't leave stock permanently short with nothing
 * left to explain it — mirrors reversePurchaseOrderStockOnDelete. Skipped
 * entirely for an invoiced order: the invoice (not the order) owns that
 * stock decrement via its own OUT movements, and the invoice isn't being
 * deleted here, so reversing it a second time would double up. A
 * PENDING/PROCESSING/CANCELLED order never touched stock in the first
 * place, so there's nothing to undo either.
 */
async function reverseOrderStockOnDelete(
  tx: Prisma.TransactionClient,
  order: {
    orderNumber: string;
    status: string;
    invoice: { id: string } | null;
    items: { productId: string; quantity: Prisma.Decimal }[];
  },
) {
  if (order.status !== "COMPLETED" || order.invoice) return;
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "IN",
        quantity: item.quantity,
        reference: order.orderNumber,
        reason: `حذف طلب مكتمل رقم ${order.orderNumber}`,
      },
    });
  }
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, invoice: { select: { id: true } } },
  });
  if (!order) return { error: t.orders.notFoundError };
  // An invoiced order can't be deleted directly — deleting it would orphan
  // the invoice (FK sets orderId null). Delete the invoice first (that
  // cancels the order), then delete the order.
  if (order.invoice) return { error: t.orders.cannotDeleteLinkedError };

  try {
    await prisma.$transaction(async (tx) => {
      await reverseOrderStockOnDelete(tx, order);
      await tx.order.delete({ where: { id } });
    });
  } catch {
    return { error: t.orders.cannotDeleteLinkedError };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteOrders(ids: string[]): Promise<ActionResult> {
  const access = await requirePermission("ORDERS_MANAGE");
  if (!access.ok) return { error: access.error };
  if (ids.length === 0) return { success: true };
  const t = await getDictionary();

  let failedCount = 0;
  for (const id of ids) {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { items: true, invoice: { select: { id: true } } },
      });
      if (!order || order.invoice) {
        failedCount++;
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await reverseOrderStockOnDelete(tx, order);
        await tx.order.delete({ where: { id } });
      });
    } catch {
      failedCount++;
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  if (failedCount > 0) {
    return {
      error: formatMessage(t.orders.bulkDeleteErrorTemplate, { count: failedCount }),
    };
  }
  return { success: true };
}
