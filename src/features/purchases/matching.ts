import { normalizeArabicName } from "@/lib/arabic-name";
import type { ExtractedItem } from "@/features/purchases/scan-schema";
import type {
  ProductForMatching,
  SupplierForMatching,
} from "@/features/purchases/scan-queries";

/**
 * Deterministic, server-side matching of extracted invoice lines to EXISTING
 * products. The AI never picks a product — it only reads text. This module
 * turns that text into a match status + ranked candidates; the admin makes
 * the final call in the review screen.
 *
 * Priority: name/description fuzzy (strong, unambiguous match only) > exact
 * normalized SKU > exact barcode > weaker name/description fuzzy.
 */

export type MatchStatus =
  | "EXACT_SKU"
  | "EXACT_BARCODE"
  | "STRONG_NAME_MATCH"
  | "REVIEW_REQUIRED"
  | "NOT_FOUND";

export type MatchCandidate = {
  productId: string;
  name: string;
  sku: string;
  score: number;
};

export type LineMatch = {
  status: MatchStatus;
  /** Pre-selected product for EXACT_* and STRONG_NAME_MATCH; null otherwise.
   * Even a pre-selected match must still be confirmed by the admin. */
  suggestedProductId: string | null;
  candidates: MatchCandidate[];
};

const STRONG_SCORE = 0.8;
const STRONG_LEAD = 0.12;
const REVIEW_FLOOR = 0.3;
const MAX_CANDIDATES = 5;

/** Codes (SKU / reference / barcode): case- and separator-insensitive. */
export function normalizeCode(value: string | null | undefined): string {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Free text (product names/descriptions), AR/FR/EN. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  const latinFolded = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalizeArabicName(latinFolded)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): Map<string, number> {
  const grams = new Map<string, number>();
  const compact = value.replace(/\s+/g, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return a.length > 0 ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let overlap = 0;
  let totalA = 0;
  for (const count of gramsA.values()) totalA += count;
  let totalB = 0;
  for (const count of gramsB.values()) totalB += count;
  for (const [gram, countA] of gramsA) {
    const countB = gramsB.get(gram);
    if (countB) overlap += Math.min(countA, countB);
  }
  return (2 * overlap) / (totalA + totalB);
}

/** Token-level overlap that tolerates OCR typos inside a word instead of
 * requiring it to match some other token exactly, the way a plain Jaccard
 * set-intersection would. Each token of the smaller side is paired with its
 * best still-unused match on the other side (exact match, or bigram
 * similarity for a near-miss like "poisse"/"pousse"); word order doesn't
 * matter, and a match below 0.5 similarity isn't counted at all so
 * unrelated words don't contribute noise. */
function fuzzyTokenOverlap(a: string, b: string): number {
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const [small, large] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const used = new Set<number>();
  let matched = 0;
  for (const token of small) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let i = 0; i < large.length; i++) {
      if (used.has(i)) continue;
      const s = token === large[i] ? 1 : diceCoefficient(token, large[i]);
      if (s > bestScore) {
        bestScore = s;
        bestIndex = i;
      }
    }
    if (bestIndex !== -1 && bestScore >= 0.5) {
      used.add(bestIndex);
      matched += bestScore;
    }
  }
  return matched / Math.max(tokensA.length, tokensB.length);
}

/** 0..1 similarity between two already-normalized text strings. */
export function textScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const compactA = a.replace(/\s+/g, "");
  const compactB = b.replace(/\s+/g, "");
  if (compactA === compactB) return 1;

  const dice = diceCoefficient(a, b);
  const tokenOverlap = fuzzyTokenOverlap(a, b);
  let score = 0.5 * dice + 0.5 * tokenOverlap;

  // Containment boost: a supplier often abbreviates or extends our name, or
  // spaces a code differently ("20 W" vs "20W").
  const [shortWords, longWords] = a.length <= b.length ? [a, b] : [b, a];
  if (shortWords.length >= 4 && longWords.includes(shortWords)) {
    score = Math.max(score, 0.85);
  }
  const [shortCompact, longCompact] =
    compactA.length <= compactB.length
      ? [compactA, compactB]
      : [compactB, compactA];
  if (shortCompact.length >= 6 && longCompact.includes(shortCompact)) {
    score = Math.max(score, 0.9);
  }
  return Math.min(1, score);
}

/** Company legal-form suffixes / generic words that carry no matching signal. */
const SUPPLIER_STOPWORDS = new Set([
  "sarl",
  "sa",
  "sas",
  "sasu",
  "eurl",
  "llc",
  "ltd",
  "inc",
  "co",
  "company",
  "societe",
  "ste",
  "group",
  "groupe",
  "trading",
  "import",
  "export",
  "distribution",
  "distrib",
  "sarlau",
  "spa",
  "et",
  "and",
]);

function stripSupplierNoise(normalized: string): string {
  return normalized
    .split(" ")
    .filter((token) => token && !SUPPLIER_STOPWORDS.has(token))
    .join(" ");
}

type IndexedProduct = ProductForMatching & {
  _code: string;
  _barcode: string;
  _text: string;
};

export function indexProducts(
  products: ProductForMatching[],
): IndexedProduct[] {
  return products.map((product) => ({
    ...product,
    _code: normalizeCode(product.sku),
    _barcode: normalizeCode(product.barcode),
    // Include sku/barcode so a line whose "name" text actually contains the
    // product's code (common when a supplier crams the reference into the
    // description column) still scores well against it.
    _text: normalizeText(
      `${product.name} ${product.description ?? ""} ${product.sku ?? ""} ${product.barcode ?? ""}`,
    ),
  }));
}

export function matchInvoiceLine(
  item: ExtractedItem,
  indexed: IndexedProduct[],
): LineMatch {
  const lineCode = normalizeCode(item.sku);
  const lineBarcode = normalizeCode(item.barcode);

  // 1. Name / description fuzzy match first. Only short-circuits on a
  //    strong, unambiguous match — anything weaker falls through to the
  //    exact-code checks below, which are more trustworthy than a fuzzy
  //    text score, and is only used as a last-resort fallback (step 4).
  const lineText = normalizeText(
    `${item.name ?? ""} ${item.description ?? ""}`,
  );
  const nameScored = lineText
    ? indexed
        .map((p) => ({ product: p, score: textScore(lineText, p._text) }))
        .filter((entry) => entry.score >= REVIEW_FLOOR)
        .sort((a, b) => b.score - a.score)
    : [];

  if (nameScored.length > 0) {
    const best = nameScored[0];
    const second = nameScored[1];
    const clearLead = !second || best.score - second.score >= STRONG_LEAD;
    if (best.score >= STRONG_SCORE && clearLead) {
      return {
        status: "STRONG_NAME_MATCH",
        suggestedProductId: best.product.id,
        candidates: nameScored
          .slice(0, MAX_CANDIDATES)
          .map((entry) => toCandidate(entry.product, entry.score)),
      };
    }
  }

  // 2. Exact SKU (also allow the invoice's "sku" field to hit our barcode,
  //    since suppliers label that column inconsistently).
  if (lineCode) {
    const bySku = indexed.filter((p) => p._code && p._code === lineCode);
    if (bySku.length === 1) {
      return {
        status: "EXACT_SKU",
        suggestedProductId: bySku[0].id,
        candidates: [toCandidate(bySku[0], 1)],
      };
    }
    if (bySku.length > 1) {
      return {
        status: "REVIEW_REQUIRED",
        suggestedProductId: null,
        candidates: bySku
          .slice(0, MAX_CANDIDATES)
          .map((p) => toCandidate(p, 1)),
      };
    }
    const byCodeOnBarcode = indexed.filter(
      (p) => p._barcode && p._barcode === lineCode,
    );
    if (byCodeOnBarcode.length === 1) {
      return {
        status: "EXACT_BARCODE",
        suggestedProductId: byCodeOnBarcode[0].id,
        candidates: [toCandidate(byCodeOnBarcode[0], 1)],
      };
    }
  }

  // 3. Exact barcode.
  if (lineBarcode) {
    const byBarcode = indexed.filter(
      (p) => p._barcode && p._barcode === lineBarcode,
    );
    if (byBarcode.length === 1) {
      return {
        status: "EXACT_BARCODE",
        suggestedProductId: byBarcode[0].id,
        candidates: [toCandidate(byBarcode[0], 1)],
      };
    }
    if (byBarcode.length > 1) {
      return {
        status: "REVIEW_REQUIRED",
        suggestedProductId: null,
        candidates: byBarcode
          .slice(0, MAX_CANDIDATES)
          .map((p) => toCandidate(p, 1)),
      };
    }
  }

  // 4. Fall back to whatever the name/description fuzzy search found in
  //    step 1 (too weak or too ambiguous to short-circuit on its own).
  if (nameScored.length === 0) {
    return { status: "NOT_FOUND", suggestedProductId: null, candidates: [] };
  }
  return {
    status: "REVIEW_REQUIRED",
    suggestedProductId: null,
    candidates: nameScored
      .slice(0, MAX_CANDIDATES)
      .map((entry) => toCandidate(entry.product, entry.score)),
  };
}

function toCandidate(product: IndexedProduct, score: number): MatchCandidate {
  return {
    productId: product.id,
    name: product.name,
    sku: product.sku,
    score: Math.round(score * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Supplier matching
// ---------------------------------------------------------------------------

export type SupplierMatch = {
  suggestedSupplierId: string | null;
  candidates: { supplierId: string; name: string; score: number }[];
};

export function matchSupplier(
  extracted: { name?: string | null; phone?: string | null } | null,
  suppliers: SupplierForMatching[],
): SupplierMatch {
  if (!extracted) return { suggestedSupplierId: null, candidates: [] };

  const phone = (extracted.phone ?? "").replace(/[^0-9]/g, "");
  if (phone.length >= 6) {
    const byPhone = suppliers.find(
      (s) => (s.phone ?? "").replace(/[^0-9]/g, "") === phone,
    );
    if (byPhone) {
      return {
        suggestedSupplierId: byPhone.id,
        candidates: [{ supplierId: byPhone.id, name: byPhone.name, score: 1 }],
      };
    }
  }

  const name = stripSupplierNoise(normalizeText(extracted.name));
  if (!name) return { suggestedSupplierId: null, candidates: [] };

  const scored = suppliers
    .map((s) => ({
      s,
      score: textScore(name, stripSupplierNoise(normalizeText(s.name))),
    }))
    .filter((entry) => entry.score >= REVIEW_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  if (scored.length === 0) return { suggestedSupplierId: null, candidates: [] };

  const candidates = scored.map((entry) => ({
    supplierId: entry.s.id,
    name: entry.s.name,
    score: Math.round(entry.score * 100) / 100,
  }));
  const best = scored[0];
  const second = scored[1];
  const clearLead = !second || best.score - second.score >= STRONG_LEAD;
  return {
    suggestedSupplierId:
      best.score >= STRONG_SCORE && clearLead ? best.s.id : null,
    candidates,
  };
}
