import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import {
  getOrdersPage,
  type OrderInvoiceFilter,
} from "@/features/orders/queries";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { OrdersFilterBar } from "@/features/orders/components/orders-filter-bar";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import type { OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_ORDER_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"];
const VALID_INVOICE_FILTERS = ["NO_INVOICE", "HAS_INVOICE"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    invoiceFilter?: string;
  }>;
}) {
  await requirePageAccess("ORDERS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;
  const status = VALID_ORDER_STATUSES.includes(params.status ?? "")
    ? (params.status as OrderStatus)
    : undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;
  const invoiceFilter = VALID_INVOICE_FILTERS.includes(params.invoiceFilter ?? "")
    ? (params.invoiceFilter as OrderInvoiceFilter)
    : undefined;

  const [t, { items, total, pageSize }] = await Promise.all([
    getDictionary(),
    getOrdersPage({ query, status, from, to, invoiceFilter, page }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.orders}
        icon={ShoppingCart}
        action={
          <Button nativeButton={false} render={<Link href="/dashboard/orders/new" />}>
            <Plus className="size-4" />
            {t.orders.addButton}
          </Button>
        }
      />
      <div className="space-y-3">
        <DataTableSearch placeholder={t.orders.searchPlaceholder} />
        <OrdersFilterBar />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t.orders.emptyTitle}
          description={t.orders.emptyDescription}
        />
      ) : (
        <>
          <OrdersTable
            data={items.map((item) => ({ ...item, total: Number(item.total) }))}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/orders"
            searchParams={{
              q: query,
              status: params.status,
              from,
              to,
              invoiceFilter: params.invoiceFilter,
            }}
          />
        </>
      )}
    </div>
  );
}
