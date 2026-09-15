import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import {
  getCustomersPage,
  getCustomerById,
} from "@/features/customers/queries";
import { CustomersTable } from "@/features/customers/components/customers-table";
import { CustomersFilterBar } from "@/features/customers/components/customers-filter-bar";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import type { DebtFilter, CustomerSort } from "@/features/customers/queries";

export const dynamic = "force-dynamic";

const VALID_DEBT_FILTERS = ["HAS_DEBT", "NO_DEBT"];
const VALID_CUSTOMER_SORTS = [
  "newest",
  "totalPurchased_desc",
  "totalPurchased_asc",
  "outstanding_desc",
  "outstanding_asc",
  "balance_desc",
  "balance_asc",
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    new?: string;
    edit?: string;
    debtFilter?: string;
    sort?: string;
  }>;
}) {
  await requirePageAccess("CUSTOMERS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;
  const debtFilter = VALID_DEBT_FILTERS.includes(params.debtFilter ?? "")
    ? (params.debtFilter as DebtFilter)
    : undefined;
  const sort = VALID_CUSTOMER_SORTS.includes(params.sort ?? "")
    ? (params.sort as CustomerSort)
    : undefined;

  const [t, { items, total, pageSize }, editingCustomer] = await Promise.all([
    getDictionary(),
    getCustomersPage({ query, debtFilter, sort, page }),
    params.edit ? getCustomerById(params.edit) : Promise.resolve(null),
  ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (page > 1) sp.set("page", String(page));
    if (params.debtFilter) sp.set("debtFilter", params.debtFilter);
    if (params.sort) sp.set("sort", params.sort);
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/customers?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.customers}
        icon={Users}
        action={
          <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
            <Plus className="size-4" />
            {t.customers.addButton}
          </Button>
        }
      />
      <div className="space-y-3">
        <DataTableSearch placeholder={t.customers.searchPlaceholder} />
        <CustomersFilterBar />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.customers.emptyTitle}
          description={t.customers.emptyDescription}
        />
      ) : (
        <>
          <CustomersTable data={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/customers"
            searchParams={{
              q: query,
              debtFilter: params.debtFilter,
              sort: params.sort,
            }}
          />
        </>
      )}
      <CustomerFormSheet
        key={editingCustomer?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        customer={
          editingCustomer
            ? {
                id: editingCustomer.id,
                name: editingCustomer.name,
                phone: editingCustomer.phone,
                email: editingCustomer.email,
                address: editingCustomer.address,
                notes: editingCustomer.notes,
                isFavorite: editingCustomer.isFavorite,
                imageUrl: editingCustomer.imageUrl,
                imagePublicId: editingCustomer.imagePublicId,
              }
            : null
        }
      />
    </div>
  );
}
