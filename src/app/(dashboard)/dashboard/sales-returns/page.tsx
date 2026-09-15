import Link from "next/link";
import { RotateCcw, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getSalesReturnsPage } from "@/features/returns/queries";
import { SalesReturnsTable } from "@/features/returns/components/sales-returns-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requirePageAccess("RETURNS_VIEW");
  const p = await searchParams; const page = Math.max(1, Number(p.page) || 1); const query = p.q?.trim();
  const [{ items, total, pageSize },t,locale] = await Promise.all([getSalesReturnsPage({ query, page }),getDictionary(),getLocale()]);
  return <div className="space-y-6"><PageHeader title={t.returns.salesTitle} description={t.returns.salesDescription} icon={RotateCcw} action={<Button nativeButton={false} render={<Link href="/dashboard/sales-returns/new" />}><Plus className="size-4" />{t.returns.newReturn}</Button>} /><DataTableSearch placeholder={t.returns.salesSearch} />
    <SalesReturnsTable
      data={items.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        invoiceNumber: r.invoice.invoiceNumber,
        customerName: r.invoice.customerName,
        createdAt: r.createdAt,
        itemsCount: r._count.items,
        refundAmount: Number(r.refundAmount),
        refundStatus: r.refundStatus,
        employeeName: r.createdBy.name,
      }))}
      t={t}
      locale={locale}
    />
    <DataTablePagination page={page} pageSize={pageSize} total={total} basePath="/dashboard/sales-returns" searchParams={{q:query}} /></div>;
}
