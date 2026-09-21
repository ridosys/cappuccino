import { z } from "zod";

/**
 * Zod schemas for the Telegram AI Voice Invoice feature.
 *
 * `extractedIntentSchema` validates DeepSeek's intent-extraction output —
 * that output is UNTRUSTED, so numbers/strings are parsed leniently (mirrors
 * `src/features/purchases/scan-schema.ts`'s `looseNumber`/`looseString`) and
 * there is deliberately no field for productId/price/total/invoiceId: the AI
 * is never given a shape it could fill those in with.
 */

const looseNumber = z
  .preprocess((value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
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

const looseString = z
  .preprocess((value) => {
    if (value == null) return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  }, z.string().nullable())
  .catch(null);

export const INTENT_ACTIONS = [
  "CREATE_INVOICE",
  "ADD_ITEM",
  "REMOVE_ITEM",
  "SET_QUANTITY",
  "SET_CUSTOMER",
  "GET_TOTAL",
  "CONFIRM",
  "CANCEL",
  "WHO_ARE_YOU",
  "CHAT",
  "UNKNOWN",
] as const;
export type IntentAction = (typeof INTENT_ACTIONS)[number];

export const extractedIntentItemSchema = z.object({
  spokenName: looseString,
  // A transliteration of spokenName into the OTHER script (Arabic script if
  // spokenName was written in Latin letters, or Latin letters if spokenName
  // was in Arabic script) — same referent, never a translation to a
  // different word. Lets server-side matching (which does plain text
  // similarity, not phonetics) check a product stored in either script
  // without the AI ever picking the product itself. Null when unsure.
  spokenNameAlt: looseString,
  // Absolute quantity for CREATE_INVOICE/ADD_ITEM/SET_QUANTITY. Defaults to 1
  // when the speaker just names a product with no number ("زيد كابتشينو").
  quantity: looseNumber,
});
export type ExtractedIntentItem = z.infer<typeof extractedIntentItemSchema>;

export const extractedIntentSchema = z.object({
  action: z.enum(INTENT_ACTIONS).catch("UNKNOWN"),
  items: z.array(extractedIntentItemSchema).catch([]),
  // Only meaningful for SET_CUSTOMER — the spoken customer name, exactly as
  // said. Matching it to a real Customer record is 100% separate server
  // code (src/features/telegram/actions.ts), never the AI.
  customerQuery: looseString,
  // Same idea as spokenNameAlt, for customerQuery.
  customerQueryAlt: looseString,
  // Only meaningful for CHAT — a short, already-localized conversational
  // reply the model wrote itself (greetings, "how can you help me",
  // capability questions, small talk). Truncated defensively; sent to
  // Telegram as plain text (HTML-escaped first), never as an action to
  // execute.
  reply: looseString.transform((value) => (value ? value.slice(0, 600) : value)),
});
export type ExtractedIntent = z.infer<typeof extractedIntentSchema>;

// ---------------------------------------------------------------------------
// Mini App action inputs — every one carries `token` (which draft) and
// `initData` (proof of who's calling), re-verified server-side on every call.
// ---------------------------------------------------------------------------

export const miniAppBaseSchema = z.object({
  token: z.string().min(1),
  initData: z.string().min(1),
});

export const miniAppSetQuantitySchema = miniAppBaseSchema.extend({
  itemId: z.string().min(1),
  quantity: z.coerce.number().min(0.001),
});

export const miniAppRemoveItemSchema = miniAppBaseSchema.extend({
  itemId: z.string().min(1),
});

export const miniAppAddItemSchema = miniAppBaseSchema.extend({
  productId: z.string().min(1),
  quantity: z.coerce.number().min(0.001).default(1),
});

export const miniAppSetCustomerSchema = miniAppBaseSchema.extend({
  customerId: z.string().min(1),
});

export const miniAppPickCandidateSchema = miniAppBaseSchema.extend({
  itemId: z.string().min(1),
  productId: z.string().min(1),
});

export type MiniAppBaseInput = z.infer<typeof miniAppBaseSchema>;
