import { z } from "zod";
import { purchaseAttachmentSchema } from "@/features/purchases/schema";

/**
 * Schemas for the AI purchase-invoice scanner.
 *
 * `extractedInvoiceSchema` validates the JSON DeepSeek returns — that output
 * is UNTRUSTED. Every field is optional/nullable because a real supplier
 * invoice may be missing (or unreadable for) any of them, and the model is
 * told to emit null rather than guess. Numbers are parsed leniently (the
 * model sometimes returns "12,50" or "12.50 " or ""), and anything that
 * isn't a finite number becomes null.
 *
 * `confirmScannedPurchaseSchema` validates what the review screen submits on
 * Confirm — this is re-checked against the database server-side regardless.
 */

/** Accepts number | numeric string | "" | null | undefined -> number | null. */
const looseNumber = z
  .preprocess((value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      // Strip spaces and thousands separators; treat comma as decimal point
      // when there's no dot.
      const cleaned = value.trim().replace(/\s/g, "");
      const normalized = cleaned.includes(".")
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(/,/g, ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, z.number().nullable())
  .catch(null);

/** Accepts any scalar -> trimmed string | null. */
const looseString = z
  .preprocess((value) => {
    if (value == null) return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }, z.string().nullable())
  .catch(null);

export const extractedItemSchema = z.object({
  sku: looseString,
  barcode: looseString,
  name: looseString,
  description: looseString,
  quantity: looseNumber,
  unit: looseString,
  unitPrice: looseNumber,
  lineTotal: looseNumber,
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractedInvoiceSchema = z.object({
  supplier: z
    .object({
      name: looseString,
      phone: looseString,
      email: looseString,
      taxId: looseString,
    })
    .partial()
    .nullable()
    .catch(null),
  invoiceNumber: looseString,
  invoiceDate: looseString,
  currency: looseString,
  items: z.array(extractedItemSchema).catch([]),
  subtotal: looseNumber,
  total: looseNumber,
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

// ---------------------------------------------------------------------------
// Confirm payload
// ---------------------------------------------------------------------------

/** A line whose invoice item has no match in the system yet — the admin
 * fills this in (pre-seeded from the invoice text) and confirming the
 * purchase creates the product first, then the purchase line against it. */
export const newProductForScannedLineSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(1),
  barcode: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null),
  categoryId: z.string().min(1),
  brandId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null),
  price1: z.coerce.number().min(0).default(0),
});

export const confirmScannedLineSchema = z
  .object({
    productId: z.string().optional(),
    newProduct: newProductForScannedLineSchema.optional(),
    quantity: z.coerce.number().min(0.001),
    unitCost: z.coerce.number().min(0),
    // Only meaningful for an existing-product line (a new product's price1
    // lives on `newProduct.price1` instead) — always sent by the review
    // screen, defaulting to the matched product's current price1.
    price1: z.coerce.number().min(0).optional(),
    updateProductPurchasePrice: z.boolean().default(false),
  })
  .refine((line) => Boolean(line.productId) !== Boolean(line.newProduct), {
    error: "each line needs either an existing productId or a newProduct",
  });

export const confirmScannedPurchaseSchema = z.object({
  supplierId: z.string().min(1),
  supplierInvoiceNumber: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  supplierInvoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .transform((value) => value || null),
  language: z.enum(["AR", "EN", "FR"]).default("AR"),
  receiveNow: z.boolean().default(true),
  idempotencyKey: z.string().uuid(),
  attachments: z.array(purchaseAttachmentSchema).default([]),
  lines: z.array(confirmScannedLineSchema).min(1),
});

export type ConfirmScannedPurchaseInput = z.input<
  typeof confirmScannedPurchaseSchema
>;
export type ConfirmScannedPurchaseOutput = z.output<
  typeof confirmScannedPurchaseSchema
>;
