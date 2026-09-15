import { Warehouse } from "lucide-react";
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
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getPurchasesReportPage } from "@/features/reports/queries";
import { ReportExportButtons } from "@/features/reports/components/report-export-buttons";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function PurchasesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAccess("REPORTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, { items: purchases, total, pageSize }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getPurchasesReportPage({ page }),
  ]);

  return (
    <div className="space-y-6" data-report-print>
      <PageHeader
        title={t.reports.purchasesTitle}
        icon={Warehouse}
        action={
          <BackButton
            fallbackHref="/dashboard/reports"
            className="print:hidden"
          />
        }
      />
      <ReportExportButtons type="purchases" total={total} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.reports.columnPurchaseOrderNumber}</TableHead>
            <TableHead>{t.reports.columnSupplier}</TableHead>
            <TableHead>{t.common.status}</TableHead>
            <TableHead>{t.reports.columnTotal}</TableHead>
            <TableHead>{t.reports.columnCreatedDate}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                <span dir="ltr">{order.orderNumber}</span>
              </TableCell>
              <TableCell>{order.supplier.name}</TableCell>
              <TableCell>
                <Badge
                  variant={order.status === "RECEIVED" ? "default" : "secondary"}
                >
                  {t.statusLabels.purchaseOrder[order.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatCurrency(Number(order.total), locale)}</TableCell>
              <TableCell>
                {new Date(order.createdAt).toLocaleDateString("fr-FR")}
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
          basePath="/dashboard/reports/purchases"
          searchParams={{}}
        />
      </div>
    </div>
  );
}
