import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/permissions";
import {
  renderPdfToImages,
  renderImageToDataUrl,
  PdfRenderError,
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
} from "@/features/purchases/pdf-render";
import {
  extractInvoiceFromImages,
  DeepSeekError,
} from "@/features/purchases/deepseek";
import {
  getProductsForMatching,
  getSuppliersForMatching,
  findPurchaseOrderBySupplierInvoice,
} from "@/features/purchases/scan-queries";
import {
  indexProducts,
  matchInvoiceLine,
  matchSupplier,
} from "@/features/purchases/matching";
import type {
  ScanErrorCode,
  ScanStreamEvent,
  ScannedLine,
} from "@/features/purchases/scan-types";

export const runtime = "nodejs";
export const maxDuration = 300;

const PDF_TYPES = new Set(["application/pdf"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

function line(event: ScanStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("PURCHASES_MANAGE");
  if (!access.ok) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("unsupported_file", "Invalid upload");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return badRequest("unsupported_file", "No file provided");
  }

  const name = file.name.toLowerCase();
  const isPdf = PDF_TYPES.has(file.type) || name.endsWith(".pdf");
  const isImage = IMAGE_TYPES.has(file.type) || IMAGE_EXT.test(name);
  if (!isPdf && !isImage) {
    return badRequest(
      "unsupported_file",
      "Only PDF, JPG, PNG or WebP files are supported",
    );
  }
  const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return badRequest("file_too_large", "File is too large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanStreamEvent) =>
        controller.enqueue(encoder.encode(line(event)));
      try {
        // 1. Rasterize.
        let pages: string[];
        if (isPdf) {
          const rendered = await renderPdfToImages(buffer, (page, total) =>
            send({ stage: "rendering_pdf", page, pages: total }),
          );
          pages = rendered.map((p) => p.dataUrl);
        } else {
          const rendered = await renderImageToDataUrl(buffer);
          pages = [rendered.dataUrl];
        }

        // 2. Extract with DeepSeek Vision.
        send({ stage: "scanning" });
        const extracted = await extractInvoiceFromImages(pages);
        if (extracted.items.length === 0) {
          send({
            stage: "error",
            code: "no_items",
            message: "No line items detected on the invoice",
          });
          return;
        }

        // 3. Match against existing products / suppliers (our code, not AI).
        send({ stage: "matching" });
        const [products, suppliers] = await Promise.all([
          getProductsForMatching(),
          getSuppliersForMatching(),
        ]);
        const indexed = indexProducts(products);
        const lines: ScannedLine[] = extracted.items.map((item, i) => ({
          key: String(i),
          invoice: {
            sku: item.sku,
            barcode: item.barcode,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          },
          match: matchInvoiceLine(item, indexed),
        }));

        const supplierMatch = matchSupplier(
          extracted.supplier ?? null,
          suppliers,
        );

        let duplicateWarning = null as {
          orderId: string;
          orderNumber: string;
        } | null;
        if (extracted.invoiceNumber && supplierMatch.suggestedSupplierId) {
          const dup = await findPurchaseOrderBySupplierInvoice(
            supplierMatch.suggestedSupplierId,
            extracted.invoiceNumber,
          );
          if (dup) {
            duplicateWarning = {
              orderId: dup.id,
              orderNumber: dup.orderNumber,
            };
          }
        }

        send({
          stage: "done",
          payload: { pages, extracted, lines, supplierMatch, duplicateWarning },
        });
      } catch (error) {
        // The client only shows a fixed, translated message per error code
        // (see errorMessage() in scan-invoice-workspace.tsx) — the real
        // cause is only visible here, in the server logs.
        console.error("[purchases/scan] failed", error);
        if (error instanceof PdfRenderError) {
          send({
            stage: "error",
            code: "pdf_render_failed",
            message: error.message,
          });
        } else if (error instanceof DeepSeekError) {
          const code: ScanErrorCode =
            error.code === "config"
              ? "deepseek_config"
              : error.code === "invalid_json" || error.code === "empty"
                ? "invalid_ai_json"
                : "deepseek_failed";
          send({ stage: "error", code, message: error.message });
        } else {
          send({
            stage: "error",
            code: "internal",
            message:
              error instanceof Error ? error.message : "Unexpected error",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function badRequest(code: ScanErrorCode, message: string) {
  return new Response(line({ stage: "error", code, message }), {
    status: 400,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
