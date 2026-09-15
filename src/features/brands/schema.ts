import { z } from "zod";

export const brandLogoSchema = z.object({
  publicId: z.string(),
  secureUrl: z.string(),
});

export const brandSchema = z.object({
  name: z.string().min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  slug: z
    .string()
    .min(2, { error: "الرابط يجب أن يتكون من حرفين على الأقل" })
    .regex(/^[a-z0-9-]+$/, {
      error: "الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط",
    }),
  logo: brandLogoSchema.nullable().optional(),
});

export type BrandInput = z.infer<typeof brandSchema>;
