import Link from "next/link";
import { Undo2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getPurchaseReturnsPage } from "@/features/returns/queries";
import { PurchaseReturnsTable } from "@/features/returns/components/purchase-returns-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requirePageAccess("RETURNS_VIEW");
  const p = await searchParams; const page = Math.max(1, Number(p.page) || 1); const query = p.q?.trim(); const [{ items, total, pageSize },t,locale] = await Promise.all([getPurchaseReturnsPage({ query, page }),getDictionary(),getLocale()]);
  return <div className="space-y-6"><PageHeader title={t.returns.purchaseTitle} description={t.returns.purchaseDescription} icon={Undo2} action={<Button nativeButton={false} render={<Link href="/dashboard/purchase-returns/new" />}><Plus className="size-4" />{t.returns.newReturn}</Button>} /><DataTableSearch placeholder={t.returns.purchaseSearch} />
  <PurchaseReturnsTable
    data={items.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      purchaseOrderNumber: r.purchase.orderNumber,
      supplierName: r.supplier.name,
      createdAt: r.createdAt,
      itemsCount: r._count.items,
      refundAmount: Number(r.refundAmount),
      refundStatus: r.refundStatus,
      employeeName: r.createdBy.name,
    }))}
    t={t}
    locale={locale}
  />
  <DataTablePagination page={page} pageSize={pageSize} total={total} basePath="/dashboard/purchase-returns" searchParams={{q:query}} /></div>;
}
