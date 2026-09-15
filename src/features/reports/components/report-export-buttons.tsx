"use client";

import { useState } from "react";
import {
  Check,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { locales, localeLabels, localeDirection, type Locale } from "@/i18n/config";

const PRESET_LIMITS = [50, 100, 250, 500];

/**
 * Rows per html2canvas capture. Large tables (hundreds/thousands of rows)
 * produce a canvas taller than what browsers can reliably rasterize —
 * html2canvas silently returns a blank canvas once you're past that
 * ceiling instead of throwing, which is why a single giant capture for
 * the whole table came back as pages of plain white. Capturing in small,
 * per-chunk tables (each with its own header, each well under any canvas
 * size limit) avoids that ceiling entirely and happens to repeat the
 * header on every PDF page as a side benefit.
 */
const ROWS_PER_CHUNK = 30;

type ExportFormat = "csv" | "xlsx" | "pdf" | "print";

const TABLE_Z_INDEX = 2147483000;
const OVERLAY_Z_INDEX = 2147483001;

function buildChunkTable(
  headers: string[],
  rows: (string | number)[][],
  dir: "rtl" | "ltr",
) {
  const container = document.createElement("div");
  // Fixed + pinned to the viewport origin so html2canvas can render it
  // consistently. It stays one layer below the loading overlay: the user
  // sees progress throughout generation, while html2canvas renders this
  // element directly rather than taking a screenshot of the viewport.
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.zIndex = String(TABLE_Z_INDEX);
  container.style.width = "1400px";
  container.style.background = "#ffffff";
  container.style.padding = "16px";
  container.dir = dir;

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.fontSize = "13px";
  table.style.fontFamily = "inherit";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((headerLabel) => {
    const th = document.createElement("th");
    th.textContent = headerLabel;
    th.style.border = "1px solid #d4d4d8";
    th.style.padding = "8px 10px";
    th.style.background = "#f4f4f5";
    th.style.fontWeight = "700";
    th.style.textAlign = dir === "rtl" ? "right" : "left";
    th.style.whiteSpace = "nowrap";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.style.border = "1px solid #e4e4e7";
      td.style.padding = "7px 10px";
      td.style.textAlign = dir === "rtl" ? "right" : "left";

      const value = String(cell ?? "");
      const imageUrls = value
        .split(",")
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url));

      if (imageUrls.length > 0) {
        const images = document.createElement("div");
        images.style.display = "flex";
        images.style.flexWrap = "wrap";
        images.style.gap = "4px";
        imageUrls.forEach((url) => {
          const image = document.createElement("img");
          image.src = url;
          image.crossOrigin = "anonymous";
          image.alt = "";
          image.style.width = "44px";
          image.style.height = "44px";
          image.style.objectFit = "cover";
          image.style.borderRadius = "3px";
          images.appendChild(image);
        });
        td.appendChild(images);
      } else {
        td.textContent = value;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  document.body.appendChild(container);
  return container;
}

async function waitForTableImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

function buildLoadingOverlay(message: string) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = String(OVERLAY_Z_INDEX);
  overlay.style.background = "#ffffff";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.gap = "12px";
  overlay.style.fontFamily = "inherit";

  const spinner = document.createElement("div");
  spinner.style.width = "28px";
  spinner.style.height = "28px";
  spinner.style.borderRadius = "9999px";
  spinner.style.border = "3px solid #e4e4e7";
  spinner.style.borderTopColor = "#3f3f46";
  spinner.style.animation = "spin 0.8s linear infinite";

  const styleTag = document.createElement("style");
  styleTag.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";

  const text = document.createElement("p");
  text.textContent = message;
  text.style.fontSize = "14px";
  text.style.color = "#3f3f46";

  overlay.appendChild(styleTag);
  overlay.appendChild(spinner);
  overlay.appendChild(text);
  document.body.appendChild(overlay);

  return {
    element: overlay,
    setMessage: (nextMessage: string) => {
      text.textContent = nextMessage;
    },
  };
}

function applyExtraParams(
  params: URLSearchParams,
  extraParams: Record<string, string> | undefined,
) {
  if (!extraParams) return;
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, value);
  }
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export function ReportExportButtons({
  type,
  total,
  extraParams,
  fileSuffix,
}: {
  type: string;
  total: number;
  /** Extra query params appended to every export request — e.g. a report's
   * active filters (an "as of" date, a supplier id, a search query) — so
   * the exported file always matches exactly what's shown on screen. */
  extraParams?: Record<string, string>;
  /** Appended to the pdf/print download filename so an export taken under
   * a specific filter is identifiable from its filename alone, e.g.
   * "inventory-2026-08-15". CSV/XLSX filenames are named server-side from
   * the same extraParams instead, since those downloads go straight to the
   * API route rather than through client-side file-saving code. */
  fileSuffix?: string;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  // Independent of the admin's own UI language — lets the exported file be
  // requested in any supported language regardless of what's currently
  // displayed on screen. Defaults to the current UI locale.
  const [lang, setLang] = useState<Locale>(locale);
  const [limit, setLimit] = useState<number | "all">("all");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  const availablePresets = PRESET_LIMITS.filter((preset) => preset < total);
  const formatLabel =
    format === "xlsx"
      ? t.reports.exportExcel
      : format === "pdf"
        ? t.reports.exportPdf
        : format === "print"
          ? t.reports.exportPrint
        : t.reports.exportCsv;

  async function fetchColumns(forLang: Locale) {
    setIsLoadingColumns(true);
    try {
      const params = new URLSearchParams({
        type,
        format: "json",
        limit: "1",
        lang: forLang,
      });
      applyExtraParams(params, extraParams);
      const response = await fetch(`/api/reports/export?${params.toString()}`);
      if (!response.ok) throw new Error("column request failed");
      const payload = (await response.json()) as { headers: string[] };
      setColumns(payload.headers);
      setSelectedColumns(payload.headers.map((_, index) => index));
    } catch (error) {
      console.error(error);
      setOpen(false);
      toast.error(t.common.pdfError);
    } finally {
      setIsLoadingColumns(false);
    }
  }

  async function openDialog(nextFormat: ExportFormat) {
    setFormat(nextFormat);
    setLimit("all");
    setLang(locale);
    setOpen(true);
    await fetchColumns(locale);
  }

  function handleLangChange(value: string | null) {
    if (!value) return;
    const nextLang = value as Locale;
    setLang(nextLang);
    // Column headers are language-dependent, so the selection checkboxes
    // need refreshed labels — re-selects everything since column *count*
    // never changes between languages, only the label text.
    void fetchColumns(nextLang);
  }

  async function generatePdf(
    chosenLimit: number | "all",
    chosenColumns: number[],
  ) {
    setIsGeneratingPdf(true);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const loading = buildLoadingOverlay(t.reports.exportPreparingMessage);
    try {
      // Let the browser paint the loader before fetching data and doing the
      // CPU-heavy canvas/PDF work.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const params = new URLSearchParams({ type, format: "json", lang });
      if (chosenLimit !== "all") params.set("limit", String(chosenLimit));
      params.set("columns", chosenColumns.join(","));
      applyExtraParams(params, extraParams);
      const response = await fetch(`/api/reports/export?${params.toString()}`);
      if (!response.ok) throw new Error("export request failed");
      const { headers, rows } = (await response.json()) as {
        headers: string[];
        rows: (string | number)[][];
      };

      if (rows.length === 0) throw new Error("no rows to export");

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const dir = localeDirection[locale];
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      let addedAnyPage = false;
      const chunks = chunkRows(rows, type === "products" ? 12 : ROWS_PER_CHUNK);
      let chunkIndex = 0;

      for (const chunk of chunks) {
        chunkIndex += 1;
        loading.setMessage(
          formatMessage(t.reports.exportPreparingProgressTemplate, {
            current: chunkIndex,
            total: chunks.length,
          }),
        );

        const container = buildChunkTable(headers, chunk, dir);
        let canvas: HTMLCanvasElement;
        try {
          await waitForTableImages(container);
          canvas = await html2canvas(container, {
            // Kept modest on purpose: at scale 2 with PNG output, a large
            // "All" export (hundreds of pages) produces enough combined
            // base64 image data that jsPDF's internal string-join step
            // throws "Invalid string length". Lower resolution + JPEG
            // keeps each page's data small enough to scale to thousands
            // of rows while staying legible.
            scale: 1.5,
            useCORS: true,
            backgroundColor: "#ffffff",
          });
        } finally {
          document.body.removeChild(container);
        }

        if (canvas.width === 0 || canvas.height === 0) continue;

        // Fit the complete chunk on one page. Scaling against both axes is
        // important: slicing a tall canvas by pixels can cut a table row in
        // half at the page boundary. Each chunk contains a small fixed number
        // of rows, so fitting it as one image keeps every row intact.
        const ratio = Math.min(
          usableWidth / canvas.width,
          usableHeight / canvas.height,
        );
        const renderedWidth = canvas.width * ratio;
        const renderedHeight = canvas.height * ratio;

        if (addedAnyPage) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.85),
          "JPEG",
          margin + (usableWidth - renderedWidth) / 2,
          margin,
          renderedWidth,
          renderedHeight,
        );
        addedAnyPage = true;
      }

      if (!addedAnyPage) throw new Error("no pages were rendered");

      loading.setMessage(t.reports.exportFinalizingMessage);
      const fileBaseName = fileSuffix ? `${type}-${fileSuffix}` : type;
      pdf.setProperties({ title: `${fileBaseName}.pdf` });
      const blobUrl = pdf.output("bloburl") as unknown as string;
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${fileBaseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      toast.error(t.common.pdfError);
    } finally {
      document.body.removeChild(loading.element);
      document.documentElement.style.overflow = previousOverflow;
      setIsGeneratingPdf(false);
    }
  }

  async function printAllItems(
    chosenLimit: number | "all",
    chosenColumns: number[],
  ) {
    setIsPreparingPrint(true);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const loading = buildLoadingOverlay(t.reports.exportPreparingMessage);
    let printTable: HTMLDivElement | null = null;
    let printPageStyle: HTMLStyleElement | null = null;

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const params = new URLSearchParams({ type, format: "json", lang });
      if (chosenLimit !== "all") params.set("limit", String(chosenLimit));
      params.set("columns", chosenColumns.join(","));
      applyExtraParams(params, extraParams);
      const response = await fetch(`/api/reports/export?${params.toString()}`);
      if (!response.ok) throw new Error("print request failed");

      const { headers, rows } = (await response.json()) as {
        headers: string[];
        rows: (string | number)[][];
      };
      if (rows.length === 0) throw new Error("no rows to print");

      printTable = buildChunkTable(headers, rows, localeDirection[locale]);
      printTable.dataset.exportPrintTable = "";
      printTable.style.position = "static";
      printTable.style.width = "100%";
      printTable.style.padding = "0";
      printTable.style.zIndex = "auto";
      const table = printTable.querySelector("table");
      if (table) {
        table.style.tableLayout = "fixed";
        table.style.fontSize = "8px";
      }
      printTable.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
        cell.style.padding = "3px";
        cell.style.whiteSpace = "normal";
        cell.style.overflowWrap = "anywhere";
      });

      await waitForTableImages(printTable);

      printPageStyle = document.createElement("style");
      printPageStyle.textContent = "@page { size: A4 landscape; margin: 8mm; }";
      document.head.appendChild(printPageStyle);

      document.body.classList.add("report-export-printing");
      loading.element.remove();
      document.documentElement.style.overflow = previousOverflow;

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      window.print();
    } catch (error) {
      console.error(error);
      toast.error(t.common.pdfError);
    } finally {
      loading.element.remove();
      printTable?.remove();
      printPageStyle?.remove();
      document.body.classList.remove("report-export-printing");
      document.documentElement.style.overflow = previousOverflow;
      setIsPreparingPrint(false);
    }
  }

  function handleConfirm() {
    const chosenLimit = limit;
    const chosenColumns = selectedColumns;
    if (chosenColumns.length === 0) return;
    setOpen(false);
    if (format === "pdf") {
      void generatePdf(chosenLimit, chosenColumns);
      return;
    }
    if (format === "print") {
      void printAllItems(chosenLimit, chosenColumns);
      return;
    }
    const params = new URLSearchParams({ type, format, lang });
    if (chosenLimit !== "all") params.set("limit", String(chosenLimit));
    params.set("columns", chosenColumns.join(","));
    applyExtraParams(params, extraParams);
    window.location.href = `/api/reports/export?${params.toString()}`;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void openDialog("csv")}
        >
          <FileText className="size-4" />
          {t.reports.exportCsv}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void openDialog("xlsx")}
        >
          <FileSpreadsheet className="size-4" />
          {t.reports.exportExcel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void openDialog("pdf")}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" />
          )}
          {t.reports.exportPdf}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void openDialog("print")}
          disabled={isPreparingPrint}
        >
          {isPreparingPrint ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          {t.reports.exportPrint}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{formatLabel}</DialogTitle>
            <DialogDescription>{t.reports.exportCountDescription}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pe-1">
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">{t.reports.exportLanguageLabel}</span>
            <Select
              items={localeLabels}
              value={lang}
              onValueChange={(value) => handleLangChange(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: Locale) => localeLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locales.map((option) => (
                  <SelectItem key={option} value={option}>
                    {localeLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setLimit("all")}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-lg border px-3.5 py-2.5 text-start text-sm transition-colors",
                limit === "all"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {limit === "all" && <Check className="size-4 text-primary" />}
                {t.reports.exportAllOption}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                {total.toLocaleString(locale)}
              </span>
            </button>

            {availablePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLimit(preset)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 text-start text-sm font-medium transition-colors",
                  limit === preset
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:bg-muted/50",
                )}
              >
                {limit === preset && <Check className="size-4 text-primary" />}
                {formatMessage(t.reports.exportFirstNTemplate, { count: preset })}
              </button>
            ))}
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t.reports.exportColumnsLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto cursor-pointer px-2 py-1 text-xs"
                disabled={isLoadingColumns}
                onClick={() =>
                  setSelectedColumns(
                    selectedColumns.length === columns.length
                      ? []
                      : columns.map((_, index) => index),
                  )
                }
              >
                {selectedColumns.length === columns.length
                  ? t.reports.exportDeselectAll
                  : t.reports.exportSelectAll}
              </Button>
            </div>
            {isLoadingColumns ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t.reports.exportPreparingMessage}
              </div>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {columns.map((column, index) => (
                  <label
                    key={`${index}-${column}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selectedColumns.includes(index)}
                      onChange={() =>
                        setSelectedColumns((current) =>
                          current.includes(index)
                            ? current.filter((value) => value !== index)
                            : [...current, index].sort((a, b) => a - b),
                        )
                      }
                    />
                    <span>{column}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleConfirm}
              disabled={isLoadingColumns || selectedColumns.length === 0}
            >
              <Download className="size-4" />
              {t.reports.exportConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
