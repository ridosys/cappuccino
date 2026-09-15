import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Boxes, FolderTree, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/shared/back-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getCategoryProfile } from "@/features/categories/queries";
import { ProfileProductsTable } from "@/features/products/components/profile-products-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function CategoryProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ productsPage?: string }>;
}) {
  await requirePageAccess("PRODUCTS_VIEW");

  const { id } = await params;
  const query = await searchParams;
  const productsPage = Math.max(1, Number(query.productsPage) || 1);
  const [t, locale, profile] = await Promise.all([
    getDictionary(),
    getLocale(),
    getCategoryProfile(id, productsPage),
  ]);
  if (!profile) notFound();

  const {
    category,
    productsTotal,
    productsPageSize,
    totalStock,
    lowStockCount,
  } = profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        icon={FolderTree}
        description={t.categories.profileLabel}
        action={
          <div className="flex gap-2">
            <BackButton fallbackHref="/dashboard/categories" />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/categories?edit=${category.id}`} />}
            >
              {t.common.edit}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t.categories.columnProductsCount}
          value={productsTotal}
          icon={Package}
          locale={locale}
        />
        <StatCard
          title={t.categories.totalStockLabel}
          value={totalStock}
          icon={Boxes}
          locale={locale}
        />
        <StatCard
          title={t.categories.lowStockLabel}
          value={lowStockCount}
          icon={AlertTriangle}
          variant={lowStockCount > 0 ? "warning" : undefined}
          locale={locale}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.categories.infoTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          {category.imageSecureUrl && (
            <div className="relative size-28 overflow-hidden rounded-xl border bg-muted">
              <Image
                src={category.imageSecureUrl}
                alt={category.name}
                fill
                className="object-cover"
                sizes="112px"
              />
            </div>
          )}
          <div className="space-y-2">
            <p><span className="text-muted-foreground">{t.categories.columnSlug}: </span><span dir="ltr">{category.slug}</span></p>
            <p><span className="text-muted-foreground">{t.categories.columnParent}: </span>{category.parent?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">{t.categories.childrenLabel}: </span>{category.children.length.toLocaleString(locale)}</p>
            <p><span className="text-muted-foreground">{t.common.createdByLabel}: </span>{category.createdBy?.name ?? t.common.unknownEmployee}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.categories.productsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileProductsTable
            products={category.products}
            emptyTitle={t.categories.noProducts}
            t={t}
            locale={locale}
          />
          {productsTotal > 0 && (
            <DataTablePagination
              page={productsPage}
              pageSize={productsPageSize}
              total={productsTotal}
              basePath={`/dashboard/categories/${category.id}`}
              pageParam="productsPage"
              searchParams={{}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
