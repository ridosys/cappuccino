import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, { error: "الرجاء اختيار المنتج" }),
  quantity: z.coerce
    .number()
    .min(0.001, { error: "الكمية يجب أن تكون رقماً موجباً" }),
  unitCost: z.coerce
    .number()
    .min(0, { error: "التكلفة يجب أن تكون رقماً موجباً" }),
});

export const purchaseAttachmentSchema = z.object({
  publicId: z.string().min(1),
  secureUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().min(0),
  resourceType: z.enum(["image", "raw"]),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, { error: "الرجاء اختيار المورد" }),
  language: z.enum(["AR", "EN", "FR"]).default("AR"),
  attachments: z.array(purchaseAttachmentSchema).default([]),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().min(0.001),
        unitCost: z.coerce.number().min(0),
        price1: z.coerce.number().min(0),
        updateProductPurchasePrice: z.boolean().default(false),
      }),
    )
    .refine((items) => items.some((item) => item.productId !== ""), {
      error: "أضف عنصراً واحداً على الأقل",
    })
    .transform((items) => items.filter((item) => item.productId !== "")),
});

export type PurchaseOrderInput = z.input<typeof purchaseOrderSchema>;
export type PurchaseOrderOutput = z.output<typeof purchaseOrderSchema>;

export const purchaseOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce.number().min(0.001),
        unitCost: z.coerce.number().min(0),
        price1: z.coerce.number().min(0),
        updateProductPurchasePrice: z.boolean().default(false),
      }),
    )
    .refine((items) => items.some((item) => item.productId !== ""), {
      error: "أضف عنصراً واحداً على الأقل",
    })
    .transform((items) => items.filter((item) => item.productId !== "")),
});

export type PurchaseOrderItemsInput = z.input<typeof purchaseOrderItemsSchema>;
export type PurchaseOrderItemsOutput = z.output<typeof purchaseOrderItemsSchema>;
