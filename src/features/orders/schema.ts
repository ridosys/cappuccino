import { z } from "zod";

export const orderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string(),
        price: z.coerce
          .number()
          .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
        quantity: z.coerce
          .number()
          .min(0.001, { error: "الكمية يجب أن تكون رقماً موجباً" }),
      }),
    )
    .refine((items) => items.some((item) => item.productId !== ""))
    .transform((items) => items.filter((item) => item.productId !== "")),
});

export type OrderItemsInput = z.input<typeof orderItemsSchema>;
export type OrderItemsOutput = z.output<typeof orderItemsSchema>;

export const reassignOrderCustomerSchema = z.object({
  customerId: z.string().min(1, { error: "الرجاء اختيار عميل" }),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, { error: "الرجاء اختيار عميل" }),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.coerce
          .number()
          .min(0.001, { error: "الكمية يجب أن تكون رقماً موجباً" }),
        price: z.coerce
          .number()
          .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
      }),
    )
    .refine((items) => items.some((item) => item.productId !== ""), {
      error: "أضف منتجاً واحداً على الأقل",
    })
    .transform((items) => items.filter((item) => item.productId !== "")),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderOutput = z.output<typeof createOrderSchema>;
