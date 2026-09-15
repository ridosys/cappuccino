import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import {
  getBrandsPage,
  getBrandById,
} from "@/features/brands/queries";
import { BrandsTable } from "@/features/brands/components/brands-table";
import { BrandFormSheet } from "@/features/brands/components/brand-form-sheet";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    new?: string;
    edit?: string;
  }>;
}) {
  await requirePageAccess("PRODUCTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;

  const [t, { items, total, pageSize }, editingBrand] = await Promise.all([
    getDictionary(),
    getBrandsPage({ query, page }),
    params.edit ? getBrandById(params.edit) : Promise.resolve(null),
  ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (page > 1) sp.set("page", String(page));
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/brands?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.brands}
        icon={Tags}
        action={
          <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
            <Plus className="size-4" />
            {t.brands.addButton}
          </Button>
        }
      />
      <DataTableSearch placeholder={t.brands.searchPlaceholder} />
      {items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={t.brands.emptyTitle}
          description={t.brands.emptyDescription}
        />
      ) : (
        <>
          <BrandsTable data={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/brands"
            searchParams={{ q: query }}
          />
        </>
      )}
      <BrandFormSheet
        key={editingBrand?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        brand={editingBrand}
      />
    </div>
  );
}
