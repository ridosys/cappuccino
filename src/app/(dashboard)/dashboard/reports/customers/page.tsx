import { Users } from "lucide-react";
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
import { getCustomersReportPage } from "@/features/reports/queries";
import { ReportExportButtons } from "@/features/reports/components/report-export-buttons";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAccess("REPORTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, { items: customers, total, pageSize }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getCustomersReportPage({ page }),
  ]);

  return (
    <div className="space-y-6" data-report-print>
      <PageHeader
        title={t.reports.customersTitle}
        icon={Users}
        action={
          <BackButton
            fallbackHref="/dashboard/reports"
            className="print:hidden"
          />
        }
      />
      <ReportExportButtons type="customers" total={total} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.reports.columnName}</TableHead>
            <TableHead>{t.reports.columnPhone}</TableHead>
            <TableHead>{t.reports.columnEmail}</TableHead>
            <TableHead>{t.reports.columnOrdersCount}</TableHead>
            <TableHead>{t.reports.columnTotalPurchases}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>
                <span dir="ltr">{customer.phone}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{customer.email ?? "—"}</span>
              </TableCell>
              <TableCell>{customer.ordersCount.toLocaleString(locale)}</TableCell>
              <TableCell>{formatCurrency(customer.totalSpent, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="print:hidden">
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/dashboard/reports/customers"
          searchParams={{}}
        />
      </div>
    </div>
  );
}
