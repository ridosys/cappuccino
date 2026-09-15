import { z } from "zod";

export const productImageSchema = z.object({
  publicId: z.string(),
  secureUrl: z.string(),
});

export const productSchema = z.object({
  name: z.string().min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  slug: z
    .string()
    .min(2, { error: "الرابط يجب أن يتكون من حرفين على الأقل" })
    .regex(/^[a-z0-9-]+$/, {
      error: "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط",
    }),
  sku: z.string().min(1, { error: "SKU مطلوب" }),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1, { error: "الرجاء اختيار القسم" }),
  brandId: z.string().nullable().optional(),
  quantity: z.coerce
    .number()
    .min(0, { error: "الكمية يجب أن تكون رقماً موجباً" }),
  minStockLevel: z.coerce
    .number()
    .min(0, { error: "الحد الأدنى يجب أن يكون رقماً موجباً" }),
  price1: z.coerce
    .number()
    .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
  price2: z.coerce
    .number()
    .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
  price3: z.coerce
    .number()
    .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
  purchasePrice: z.coerce
    .number()
    .min(0, { error: "السعر يجب أن يكون رقماً موجباً" })
    .optional()
    .default(0),
  weight: z.coerce
    .number()
    .min(0, { error: "الوزن يجب أن يكون رقماً موجباً" })
    .optional()
    .default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  images: z.array(productImageSchema).default([]),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductOutput = z.output<typeof productSchema>;
