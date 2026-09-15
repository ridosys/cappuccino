import { z } from "zod";

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, { error: "اسم المنتج مطلوب" }),
  quantity: z.coerce
    .number()
    .min(0.001, { error: "الكمية يجب أن تكون رقماً موجباً" }),
  unitPrice: z.coerce
    .number()
    .min(0, { error: "السعر يجب أن يكون رقماً موجباً" }),
});

export const PAYMENT_LINE_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "BALANCE",
  "OTHER",
] as const;

export const paymentLineSchema = z.object({
  method: z.enum(PAYMENT_LINE_METHODS),
  amount: z.coerce
    .number()
    .min(0.01, { error: "المبلغ يجب أن يكون أكبر من صفر" }),
});

export const invoiceSchema = z.object({
  language: z.enum(["AR", "EN", "FR"]),
  // Invoice date (YYYY-MM-DD) — editable from the invoice screen; blank
  // means "leave unchanged". Only applied when editing an existing invoice.
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "التاريخ غير صحيح" })
    .optional()
    .or(z.literal("")),
  customerId: z.string().min(1, { error: "الرجاء اختيار عميل" }),
  customerName: z
    .string()
    .min(2, { error: "الاسم يجب أن يتكون من حرفين على الأقل" }),
  // Optional — a customer may have no phone on file.
  customerPhone: z
    .union([z.string().min(6, { error: "رقم الهاتف غير صحيح" }), z.literal("")])
    .optional(),
  customerEmail: z
    .union([z.email({ error: "البريد الإلكتروني غير صحيح" }), z.literal("")])
    .optional(),
  notes: z.string().optional(),
  orderId: z.string().optional(),
  items: z
    .array(
      invoiceItemSchema.or(
        z.object({
          productId: z.literal(""),
          name: z.literal(""),
          quantity: z.coerce.number(),
          unitPrice: z.coerce.number(),
        }),
      ),
    )
    .refine((items) => items.some((item) => item.name !== ""), {
      error: "أضف منتجاً واحداً على الأقل",
    })
    .transform(
      (items): z.output<typeof invoiceItemSchema>[] =>
        items.filter((item) => item.name !== "") as z.output<typeof invoiceItemSchema>[],
    ),
  payments: z.array(paymentLineSchema).default([]),
});

export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceOutput = z.output<typeof invoiceSchema>;

export const INVOICE_LANGUAGE_LABELS: Record<string, string> = {
  AR: "العربية",
  EN: "English",
  FR: "Français",
};
