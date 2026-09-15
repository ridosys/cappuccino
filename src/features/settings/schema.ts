import { z } from "zod";

const colorTokensSchema = z.object({
  primary: z.string().min(1, { error: "مطلوب" }),
  secondary: z.string().min(1, { error: "مطلوب" }),
  sidebar: z.string().min(1, { error: "مطلوب" }),
  sidebarForeground: z.string().min(1, { error: "مطلوب" }),
  header: z.string().min(1, { error: "مطلوب" }),
  background: z.string().min(1, { error: "مطلوب" }),
  text: z.string().min(1, { error: "مطلوب" }),
  button: z.string().min(1, { error: "مطلوب" }),
  accent: z.string().min(1, { error: "مطلوب" }),
});

export const systemSettingsSchema = z.object({
  appName: z
    .string()
    .min(2, { error: "اسم النظام يجب أن يتكون من حرفين على الأقل" }),
  appShortName: z.string().min(1, { error: "الاسم المختصر مطلوب" }),
  colorsLight: colorTokensSchema,
  colorsDark: colorTokensSchema,
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
export type ColorTokens = z.infer<typeof colorTokensSchema>;
