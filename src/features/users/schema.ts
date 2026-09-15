import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  email: z.email({ error: "الرجاء إدخال بريد إلكتروني صحيح" }),
  password: z
    .string()
    .min(8, { error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل" }),
  roleId: z.string().min(1, { error: "الرجاء اختيار دور" }),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  email: z.email({ error: "الرجاء إدخال بريد إلكتروني صحيح" }),
  roleId: z.string().min(1, { error: "الرجاء اختيار دور" }),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, { error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل" }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
