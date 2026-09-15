import { ShoppingCart } from "lucide-react";
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
import { getOrdersReportPage } from "@/features/reports/queries";
import { ReportExportButtons } from "@/features/reports/components/report-export-buttons";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function OrdersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAccess("REPORTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, { items: orders, total, pageSize }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getOrdersReportPage({ page }),
  ]);

  return (
    <div className="space-y-6" data-report-print>
      <PageHeader
        title={t.reports.ordersTitle}
        icon={ShoppingCart}
        action={
          <BackButton
            fallbackHref="/dashboard/reports"
            className="print:hidden"
          />
        }
      />
      <ReportExportButtons type="orders" total={total} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.reports.columnOrderNumber}</TableHead>
            <TableHead>{t.reports.columnCustomer}</TableHead>
            <TableHead>{t.reports.columnPhone}</TableHead>
            <TableHead>{t.reports.columnTotal}</TableHead>
            <TableHead>{t.common.status}</TableHead>
            <TableHead>{t.reports.columnDate}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <span dir="ltr">{order.orderNumber}</span>
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>
                <span dir="ltr">{order.customerPhone}</span>
              </TableCell>
              <TableCell>{formatCurrency(Number(order.total), locale)}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {t.statusLabels.order[order.status]}
                </Badge>
              </TableCell>
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
          basePath="/dashboard/reports/orders"
          searchParams={{}}
        />
      </div>
    </div>
  );
}
