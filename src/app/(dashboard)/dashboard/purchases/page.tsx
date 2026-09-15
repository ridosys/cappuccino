import Link from "next/link";
import { Plus, ClipboardList, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { getPurchaseOrdersPage } from "@/features/purchases/queries";
import { PurchaseOrdersTable } from "@/features/purchases/components/purchase-orders-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requirePageAccess("PURCHASES_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;

  const [t, { items, total, pageSize }] = await Promise.all([
    getDictionary(),
    getPurchaseOrdersPage({ query, page }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.purchases}
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/purchases/scan" />}
            >
              <ScanLine className="size-4" />
              {t.purchaseScan.actionButton}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/purchases/new" />}
            >
              <Plus className="size-4" />
              {t.purchases.addButton}
            </Button>
          </div>
        }
      />
      <DataTableSearch placeholder={t.purchases.searchPlaceholder} />
      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t.purchases.emptyTitle}
          description={t.purchases.emptyDescription}
        />
      ) : (
        <>
          <PurchaseOrdersTable
            data={items.map((item) => ({
              ...item,
              total: Number(item.total),
              paidAmount: Number(item.paidAmount),
            }))}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/purchases"
            searchParams={{ q: query }}
          />
        </>
      )}
    </div>
  );
}
