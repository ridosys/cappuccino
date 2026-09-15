import { z } from "zod";
import { PAYMENT_LINE_METHODS } from "@/features/invoices/schema";

export { PAYMENT_LINE_METHODS };

export const posSaleSchema = z.object({
  saleToken: z.string().uuid(),
  customerId: z.string().min(1),
  language: z.enum(["AR", "EN", "FR"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().min(0.001),
      }),
    )
    .min(1),
  payment: z.object({
    method: z.enum(PAYMENT_LINE_METHODS),
    amount: z.coerce.number().min(0),

    allowNegativeBalance: z.boolean().optional(),

    excessToBalance: z.boolean().optional(),
  }),
});

export type PosSaleInput = z.input<typeof posSaleSchema>;
export type PosSaleOutput = z.output<typeof posSaleSchema>;
