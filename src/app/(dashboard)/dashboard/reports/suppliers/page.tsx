import { Truck } from "lucide-react";
import { BackButton } from "@/components/shared/back-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getSuppliersReportPage } from "@/features/reports/queries";
import { ReportExportButtons } from "@/features/reports/components/report-export-buttons";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function SuppliersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAccess("REPORTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, { items: suppliers, total, pageSize }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSuppliersReportPage({ page }),
  ]);

  return (
    <div className="space-y-6" data-report-print>
      <PageHeader
        title={t.reports.suppliersTitle}
        icon={Truck}
        action={
          <BackButton
            fallbackHref="/dashboard/reports"
            className="print:hidden"
          />
        }
      />
      <ReportExportButtons type="suppliers" total={total} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.reports.columnName}</TableHead>
            <TableHead>{t.reports.columnPhone}</TableHead>
            <TableHead>{t.reports.columnEmail}</TableHead>
            <TableHead>{t.reports.columnPurchaseOrdersCount}</TableHead>
            <TableHead>{t.reports.columnTotalPurchasedFromSupplier}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell>
                <span dir="ltr">{supplier.phone ?? "—"}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{supplier.email ?? "—"}</span>
              </TableCell>
              <TableCell>{supplier.ordersCount.toLocaleString(locale)}</TableCell>
              <TableCell>{formatCurrency(supplier.totalPurchased, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="print:hidden">
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/dashboard/reports/suppliers"
          searchParams={{}}
        />
      </div>
    </div>
  );
}
