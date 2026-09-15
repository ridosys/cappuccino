"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  FileDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { formatCurrency } from "@/lib/currency";
import { localeDirection } from "@/i18n/config";
import type { LowStockFeed, LowStockProduct } from "@/features/products/queries";

const PDF_ROWS_PER_PAGE = 22;

export function LowStockExportTable({
  initial,
  allIds,
  logoUrl,
  appName,
}: {
  initial: LowStockFeed;
  allIds: string[];
  logoUrl: string | null;
  appName: string;
}) {
  const { t, locale } = useLocale();

  const [items, setItems] = useState<LowStockProduct[]>(initial.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const seenRef = useRef<Set<string>>(new Set(initial.items.map((p) => p.id)));
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const total = initial.total;

  const loadMore = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inventory/low-stock?offset=${offset}`);
        if (!res.ok) return;
        const data = (await res.json()) as LowStockFeed;
        const fresh = data.items.filter((p) => !seenRef.current.has(p.id));
        fresh.forEach((p) => seenRef.current.add(p.id));
        setItems((prev) => [...prev, ...fresh]);
        setNextOffset(data.nextOffset);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Infinite scroll — load the next page once the sentinel row nears the
  // viewport, so a long list streams in as it's scrolled instead of all at
  // once.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || nextOffset === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          void loadMore(nextOffset);
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextOffset, loading, loadMore]);

  const selectedCount = selected.size;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  const exportParams = useMemo(() => {
    const params = new URLSearchParams({ lang: locale });
    if (!allSelected) params.set("ids", [...selected].join(","));
    return params;
  }, [locale, allSelected, selected]);

  function exportExcel() {
    if (selectedCount === 0) return;
    const params = new URLSearchParams(exportParams);
    params.set("format", "xlsx");
    window.location.href = `/api/inventory/low-stock/export?${params.toString()}`;
  }

  async function exportPdf() {
    if (selectedCount === 0) return;
    setIsGeneratingPdf(true);
    try {
      const params = new URLSearchParams(exportParams);
      params.set("format", "json");
      const res = await fetch(
        `/api/inventory/low-stock/export?${params.toString()}`,
      );
      if (!res.ok) throw new Error("export request failed");
      const { headers, rows } = (await res.json()) as {
        headers: string[];
        rows: (string | number)[][];
      };
      if (rows.length === 0) throw new Error("no rows");

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const dir = localeDirection[locale];
      const generatedAt = new Date().toLocaleString(locale);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const chunks: (string | number)[][][] = [];
      for (let i = 0; i < rows.length; i += PDF_ROWS_PER_PAGE) {
        chunks.push(rows.slice(i, i + PDF_ROWS_PER_PAGE));
      }

      let addedPage = false;
      for (const chunk of chunks) {
        const container = buildPdfPage({
          dir,
          logoUrl,
          appName,
          title: t.inventory.lowStockPageTitle,
          generatedAtLabel: formatMessage(t.inventory.lowStockGeneratedAt, {
            date: generatedAt,
          }),
          countLabel: formatMessage(t.inventory.lowStockSelectedCount, {
            count: rows.length,
          }),
          headers,
          rows: chunk,
        });
        document.body.appendChild(container);
        try {
          await waitForImages(container);
          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          });
          if (canvas.width === 0 || canvas.height === 0) continue;
          const ratio = Math.min(
            usableWidth / canvas.width,
            usableHeight / canvas.height,
          );
          const renderedWidth = canvas.width * ratio;
          const renderedHeight = canvas.height * ratio;
          if (addedPage) pdf.addPage();
          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.9),
            "JPEG",
            margin + (usableWidth - renderedWidth) / 2,
            margin,
            renderedWidth,
            renderedHeight,
          );
          addedPage = true;
        } finally {
          document.body.removeChild(container);
        }
      }

      if (!addedPage) throw new Error("no pages rendered");

      const fileName = `low-stock-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.setProperties({ title: fileName });
      const blobUrl = pdf.output("bloburl") as unknown as string;
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      toast.error(t.common.pdfError);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="secondary" className="tabular-nums">
          {formatMessage(t.inventory.lowStockSelectedOfTotal, {
            selected: selectedCount,
            total,
          })}
        </Badge>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={exportExcel}
            disabled={selectedCount === 0}
          >
            <FileSpreadsheet className="size-4" />
            {t.reports.exportExcel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={exportPdf}
            disabled={selectedCount === 0 || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {t.reports.exportPdf}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && selectedCount > 0}
                  onCheckedChange={toggleAll}
                  aria-label={t.reports.exportSelectAll}
                />
              </TableHead>
              <TableHead>{t.products.columnName}</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>{t.products.columnCategory}</TableHead>
              <TableHead className="text-end">
                {t.inventory.columnCurrentQuantity}
              </TableHead>
              <TableHead className="text-end">
                {t.inventory.columnMinStock}
              </TableHead>
              <TableHead className="text-end">
                {t.inventory.lowStockColumnShortage}
              </TableHead>
              <TableHead className="text-end">
                {t.products.purchasePriceDisplayLabel}
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product) => {
              const isSelected = selected.has(product.id);
              return (
                <TableRow
                  key={product.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => toggle(product.id)}
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(product.id)}
                      aria-label={product.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span dir="ltr">{product.sku}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.categoryName}
                  </TableCell>
                  <TableCell className="text-end font-medium text-destructive tabular-nums">
                    {product.quantity.toLocaleString(locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {product.minStockLevel.toLocaleString(locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {product.shortage.toLocaleString(locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(product.purchasePrice, locale, false, 4)}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link href={`/dashboard/products/${product.id}`} />}
                      title={t.customers.viewProfile}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {nextOffset !== null &&
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TableCell colSpan={9} className="p-2">
                    {index === 0 && (
                      <span ref={sentinelRef} className="block h-px w-full" />
                    )}
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

function buildPdfPage({
  dir,
  logoUrl,
  appName,
  title,
  generatedAtLabel,
  countLabel,
  headers,
  rows,
}: {
  dir: "rtl" | "ltr";
  logoUrl: string | null;
  appName: string;
  title: string;
  generatedAtLabel: string;
  countLabel: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const start = dir === "rtl" ? "right" : "left";
  const end = dir === "rtl" ? "left" : "right";

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.zIndex = "-1";
  container.style.width = "1400px";
  container.style.background = "#ffffff";
  container.style.padding = "28px";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.color = "#18181b";
  container.dir = dir;

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "flex-start";
  header.style.justifyContent = "space-between";
  header.style.borderBottom = "2px solid #d4d4d8";
  header.style.paddingBottom = "12px";
  header.style.marginBottom = "16px";

  const brand = document.createElement("div");
  if (logoUrl) {
    const logo = document.createElement("img");
    logo.src = logoUrl;
    logo.crossOrigin = "anonymous";
    logo.alt = appName;
    logo.style.height = "44px";
    logo.style.maxWidth = "220px";
    logo.style.objectFit = "contain";
    brand.appendChild(logo);
  } else {
    const name = document.createElement("div");
    name.textContent = appName;
    name.style.fontSize = "22px";
    name.style.fontWeight = "700";
    brand.appendChild(name);
  }

  const meta = document.createElement("div");
  meta.style.textAlign = end;
  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  titleEl.style.fontSize = "18px";
  titleEl.style.fontWeight = "700";
  const countEl = document.createElement("div");
  countEl.textContent = countLabel;
  countEl.style.fontSize = "12px";
  countEl.style.color = "#3f3f46";
  countEl.style.marginTop = "2px";
  const dateEl = document.createElement("div");
  dateEl.textContent = generatedAtLabel;
  dateEl.style.fontSize = "11px";
  dateEl.style.color = "#71717a";
  meta.append(titleEl, countEl, dateEl);

  header.append(brand, meta);
  container.appendChild(header);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.fontSize = "12px";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label, index) => {
    const th = document.createElement("th");
    th.textContent = label;
    th.style.border = "1px solid #d4d4d8";
    th.style.padding = "7px 9px";
    th.style.background = "#f4f4f5";
    th.style.fontWeight = "700";
    th.style.whiteSpace = "nowrap";
    th.style.textAlign =
      typeof rows[0]?.[index] === "number" ? end : start;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      const isNumber = typeof cell === "number";
      td.textContent = isNumber
        ? cell.toLocaleString(dir === "rtl" ? "ar" : "en")
        : String(cell ?? "");
      td.style.border = "1px solid #e4e4e7";
      td.style.padding = "6px 9px";
      td.style.textAlign = isNumber ? end : start;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
