import { z } from "zod";

export const inventoryMovementSchema = z.object({
  productId: z.string().min(1, { error: "الرجاء اختيار المنتج" }),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce
    .number()
    .min(0, { error: "الكمية يجب أن تكون رقماً موجباً" }),
  reason: z.string().optional(),
});

export type InventoryMovementInput = z.input<typeof inventoryMovementSchema>;
export type InventoryMovementOutput = z.output<
  typeof inventoryMovementSchema
>;
