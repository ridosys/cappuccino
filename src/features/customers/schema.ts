import { z } from "zod";

export const customerSchema = z.object({
  // Only a name is required now — a single first name is fine, and it does
  // not have to include a family name.
  name: z
    .string()
    .trim()
    .min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  // Phone is optional; when given it still has to look like a real number.
  phone: z
    .union([z.string().min(6, { error: "رقم الهاتف غير صحيح" }), z.literal("")])
    .optional(),
  email: z.union([z.email({ error: "البريد الإلكتروني غير صحيح" }), z.literal("")]).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isFavorite: z.boolean(),
  // Undefined = leave the existing photo untouched (callers that don't
  // manage a photo, e.g. the order-flow customer edit, never send this
  // field); null = explicitly remove it; an object = set/replace it.
  image: z
    .object({ publicId: z.string(), secureUrl: z.string() })
    .nullable()
    .optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
