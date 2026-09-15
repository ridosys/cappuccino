import { Boxes, Hash, Layers, Wallet } from "lucide-react";
import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { getInventoryReportPage } from "@/features/reports/queries";
import { getSupplierOptions } from "@/features/suppliers/queries";
import { ReportExportButtons } from "@/features/reports/components/report-export-buttons";
import { InventoryReportFilters } from "@/features/reports/components/inventory-report-filters";
import { formatCurrency } from "@/lib/currency";
import { formatMessage } from "@/i18n/format";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    asOf?: string;
    supplierId?: string;
    q?: string;
  }>;
}) {
  await requirePageAccess("REPORTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const asOf =
    params.asOf && /^\d{4}-\d{2}-\d{2}$/.test(params.asOf)
      ? params.asOf
      : new Date().toISOString().slice(0, 10);
  // The selected date is treated as the end of that day — a movement
  // recorded at any time on the selected day still counts, only movements
  // strictly after it are excluded.
  const asOfDate = new Date(`${asOf}T23:59:59.999`);
  const supplierId = params.supplierId || undefined;
  const query = params.q?.trim() || undefined;

  const [t, locale, { items: products, total, pageSize, totals }, supplierOptions] =
    await Promise.all([
      getDictionary(),
      getLocale(),
      getInventoryReportPage({ page, asOfDate, supplierId, query }),
      getSupplierOptions(),
    ]);

  return (
    <div className="space-y-6" data-report-print>
      <PageHeader
        title={t.reports.inventoryTitle}
        icon={Boxes}
        description={formatMessage(t.reports.inventoryAsOfDescriptionTemplate, {
          date: asOfDate.toLocaleDateString("fr-FR"),
        })}
        action={
          <BackButton
            fallbackHref="/dashboard/reports"
            className="print:hidden"
          />
        }
      />
      <InventoryReportFilters
        asOf={asOf}
        supplierId={supplierId ?? "all"}
        supplierOptions={supplierOptions}
      />
      <div className="grid gap-4 sm:grid-cols-3 print:hidden">
        <StatCard
          title={t.reports.totalProductsLabel}
          value={total}
          icon={Hash}
          locale={locale}
        />
        <StatCard
          title={t.reports.totalQuantityLabel}
          value={totals.quantity}
          icon={Layers}
          locale={locale}
        />
        <StatCard
          title={t.reports.totalValueLabel}
          value={totals.value}
          icon={Wallet}
          formatValue={(value) => formatCurrency(value, locale)}
          locale={locale}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <DataTableSearch placeholder={t.reports.inventorySearchPlaceholder} />
        <ReportExportButtons
          type="inventory"
          total={total}
          extraParams={{
            asOf,
            ...(supplierId ? { supplierId } : {}),
            ...(query ? { q: query } : {}),
          }}
          fileSuffix={asOf}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.products.columnName}</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>{t.products.columnCategory}</TableHead>
            <TableHead>{t.products.columnBrand}</TableHead>
            <TableHead>{t.reports.columnSupplier}</TableHead>
            <TableHead>{t.products.columnQuantity}</TableHead>
            <TableHead>{t.reports.columnMinStock}</TableHead>
            <TableHead>{t.products.purchasePriceDisplayLabel}</TableHead>
            <TableHead>{t.reports.columnValue}</TableHead>
            <TableHead>{t.common.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">
                <span dir="ltr">{product.sku}</span>
              </TableCell>
              <TableCell>{product.categoryName}</TableCell>
              <TableCell>{product.brandName ?? "—"}</TableCell>
              <TableCell>{product.supplierName ?? "—"}</TableCell>
              <TableCell
                className={
                  product.quantity <= product.minStockLevel
                    ? "font-medium text-destructive"
                    : ""
                }
              >
                {product.quantity.toLocaleString(locale)}
              </TableCell>
              <TableCell>
                {product.minStockLevel.toLocaleString(locale)}
              </TableCell>
              <TableCell>
                {formatCurrency(product.purchasePrice, locale)}
                {product.priceIsEstimated && (
                  <span className="text-muted-foreground"> *</span>
                )}
              </TableCell>
              <TableCell>
                {formatCurrency(product.value, locale)}
                {product.priceIsEstimated && (
                  <span className="text-muted-foreground"> *</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                  {t.statusLabels.productStatus[product.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="print:hidden">
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/dashboard/reports/inventory"
          searchParams={{ asOf, supplierId, q: query }}
        />
      </div>
    </div>
  );
}
