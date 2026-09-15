import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { getProductsPage, getProductById } from "@/features/products/queries";
import { getCategoryOptions } from "@/features/categories/queries";
import { getBrandOptions } from "@/features/brands/queries";
import { ProductsTable } from "@/features/products/components/products-table";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import { ImportProductsDialog } from "@/features/products/components/import-products-dialog";
import { ProductBarcodeLookup } from "@/features/products/components/product-barcode-lookup";
import { ProductsFilterBar } from "@/features/products/components/products-filter-bar";
import type { ProductQuantitySort, ProductStockFilter } from "@/features/products/queries";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    new?: string;
    edit?: string;
    stock?: string;
    sort?: string;
  }>;
}) {
  await requirePageAccess("PRODUCTS_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;
  const stock: ProductStockFilter = ["low", "out", "available"].includes(params.stock ?? "")
    ? (params.stock as ProductStockFilter)
    : "all";
  const sort: ProductQuantitySort = ["quantityAsc", "quantityDesc"].includes(params.sort ?? "")
    ? (params.sort as ProductQuantitySort)
    : "newest";

  const [
    t,
    { items, total, pageSize },
    categoryOptions,
    brandOptions,
    editingProduct,
  ] = await Promise.all([
    getDictionary(),
    getProductsPage({ query, page, stock, sort }),
    getCategoryOptions(),
    getBrandOptions(),
    params.edit ? getProductById(params.edit) : Promise.resolve(null),
  ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (page > 1) sp.set("page", String(page));
    if (stock !== "all") sp.set("stock", stock);
    if (sort !== "newest") sp.set("sort", sort);
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/products?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.products}
        icon={Package}
        action={
          <div className="flex gap-2">
            <ProductBarcodeLookup />
            <ImportProductsDialog />
            <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
              <Plus className="size-4" />
              {t.products.addProduct}
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <DataTableSearch placeholder={t.products.searchPlaceholder} />
        <ProductsFilterBar />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t.products.emptyTitle}
          description={t.products.emptyDescription}
        />
      ) : (
        <>
          <ProductsTable data={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/products"
            searchParams={{
              q: query,
              stock: stock === "all" ? undefined : stock,
              sort: sort === "newest" ? undefined : sort,
            }}
          />
        </>
      )}
      <ProductFormSheet
        key={editingProduct?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        product={
          editingProduct && {
            ...editingProduct,
            quantity: Number(editingProduct.quantity),
            minStockLevel: Number(editingProduct.minStockLevel),
            price1: Number(editingProduct.price1),
            price2: Number(editingProduct.price2),
            price3: Number(editingProduct.price3),
            purchasePrice: Number(editingProduct.purchasePrice),
            weight: Number(editingProduct.weight),
          }
        }
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
      />
    </div>
  );
}
