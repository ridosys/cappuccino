import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  phone: z.string().optional(),
  email: z
    .union([z.email({ error: "البريد الإلكتروني غير صحيح" }), z.literal("")])
    .optional(),
  address: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
