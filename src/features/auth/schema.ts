import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "الرجاء إدخال بريد إلكتروني صحيح" }),
  password: z
    .string()
    .min(1, { error: "كلمة المرور مطلوبة" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
