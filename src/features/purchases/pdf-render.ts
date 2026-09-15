import "server-only";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

/**
 * Server-side rasterization for the AI purchase-invoice scanner.
 *
 * DeepSeek Vision only accepts images, so a PDF supplier invoice has to be
 * turned into page images first. We use Mozilla's pdf.js (Apache-2.0); when
 * it runs under Node it renders onto @napi-rs/canvas (MIT) on its own. Both
 * are permissively licensed and work on any Node host without shelling out
 * to poppler/ghostscript.
 *
 * Everything stays in memory (Buffers/data URLs) — no temp files are written,
 * so there is nothing to clean up afterward.
 */

/** Longest edge of a rendered page/image, in pixels. High enough that small
 * SKU / quantity / price text stays legible to the vision model; DeepSeek
 * downscales anything larger than ~1300px on its side anyway. */
const MAX_EDGE = 1600;

/** Hard caps so a pathological upload can't exhaust memory or the DeepSeek
 * per-request image budget. */
export const MAX_PDF_PAGES = 15;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type RenderedPage = {
  /** `data:image/jpeg;base64,...` — ready to hand to DeepSeek as an image_url. */
  dataUrl: string;
};

export class PdfRenderError extends Error {}

const require = createRequire(import.meta.url);

/** Directory pdf.js loads its Helvetica/Times/etc. metrics from, so a PDF that
 * references the 14 standard fonts without embedding them still renders.
 *
 * Resolved from `process.cwd()` rather than `require.resolve()` — in a
 * Turbopack production build, `require.resolve()` on a `serverExternalPackages`
 * entry doesn't return a real filesystem path but a Turbopack-internal module
 * id (a number), which crashes `path.dirname()`/`path.join()` with
 * "The 'path' argument must be of type string. Received type number". Both
 * `next build`/`next start` and the dev server run with the project root as
 * cwd, so `node_modules/pdfjs-dist` is reliably there relative to it. */
function standardFontDataUrl(): string {
  return (
    path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/") +
    path.sep
  );
}

async function toJpegDataUrl(png: Buffer): Promise<string> {
  const jpeg = await sharp(png)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/**
 * Render every page of a PDF to a JPEG data URL, in page order. `onProgress`
 * is called after each page so the route handler can stream progress.
 */
export async function renderPdfToImages(
  pdf: Buffer,
  onProgress?: (page: number, pages: number) => void,
): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdf),
    standardFontDataUrl: standardFontDataUrl(),
    disableFontFace: true,
  });

  let doc: Awaited<typeof loadingTask.promise>;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    throw new PdfRenderError(
      error instanceof Error ? error.message : "PDF could not be opened",
    );
  }

  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      throw new PdfRenderError(
        `PDF has ${doc.numPages} pages (limit ${MAX_PDF_PAGES})`,
      );
    }

    const pages: RenderedPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(4, MAX_EDGE / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        const context = canvas.getContext("2d");
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const png = canvas.toBuffer("image/png");
        canvas.width = 0;
        canvas.height = 0;
        pages.push({ dataUrl: await toJpegDataUrl(png) });
        onProgress?.(i, doc.numPages);
      } catch (error) {
        if (error instanceof PdfRenderError) throw error;
        throw new PdfRenderError(
          error instanceof Error
            ? `page ${i}: ${error.message}`
            : `page ${i} failed to render`,
        );
      } finally {
        page.cleanup();
      }
    }
    return pages;
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

/**
 * Normalize a single uploaded image (JPG/PNG/WebP) to a JPEG data URL:
 * honours EXIF orientation, strips metadata, and constrains the resolution.
 */
export async function renderImageToDataUrl(image: Buffer): Promise<RenderedPage> {
  try {
    const jpeg = await sharp(image)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
  } catch (error) {
    throw new PdfRenderError(
      error instanceof Error ? error.message : "Image could not be processed",
    );
  }
}
