import type { ExtractedInvoice } from "@/features/purchases/scan-schema";
import type { MatchCandidate, MatchStatus } from "@/features/purchases/matching";

/** One extracted invoice line, paired with its server-computed match. */
export type ScannedLine = {
  /** Stable id for React keys / edits (index-based, assigned server-side). */
  key: string;
  invoice: {
    sku: string | null;
    barcode: string | null;
    name: string | null;
    description: string | null;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    lineTotal: number | null;
  };
  match: {
    status: MatchStatus;
    suggestedProductId: string | null;
    candidates: MatchCandidate[];
  };
};

export type ScanResultPayload = {
  /** Rendered page images (data URLs) for the review-screen preview. */
  pages: string[];
  extracted: ExtractedInvoice;
  lines: ScannedLine[];
  supplierMatch: {
    suggestedSupplierId: string | null;
    candidates: { supplierId: string; name: string; score: number }[];
  };
  /** Present when a purchase order already carries this supplier invoice #. */
  duplicateWarning: { orderId: string; orderNumber: string } | null;
};

export type ScanStreamEvent =
  | { stage: "rendering_pdf"; page: number; pages: number }
  | { stage: "scanning" }
  | { stage: "matching" }
  | { stage: "done"; payload: ScanResultPayload }
  | { stage: "error"; code: ScanErrorCode; message: string };

export type ScanErrorCode =
  | "unsupported_file"
  | "file_too_large"
  | "pdf_render_failed"
  | "deepseek_config"
  | "deepseek_failed"
  | "invalid_ai_json"
  | "no_items"
  | "internal";
