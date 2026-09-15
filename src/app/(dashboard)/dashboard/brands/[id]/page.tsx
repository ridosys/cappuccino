import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Boxes, Package, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/shared/back-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getBrandProfile } from "@/features/brands/queries";
import { ProfileProductsTable } from "@/features/products/components/profile-products-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function BrandProfilePage({
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
    getBrandProfile(id, productsPage),
  ]);
  if (!profile) notFound();

  const {
    brand,
    productsTotal,
    productsPageSize,
    totalStock,
    lowStockCount,
  } = profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={brand.name}
        icon={Tags}
        description={t.brands.profileLabel}
        action={
          <div className="flex gap-2">
            <BackButton fallbackHref="/dashboard/brands" />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/brands?edit=${brand.id}`} />}
            >
              {t.common.edit}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t.brands.columnProductsCount} value={productsTotal} icon={Package} locale={locale} />
        <StatCard title={t.brands.totalStockLabel} value={totalStock} icon={Boxes} locale={locale} />
        <StatCard title={t.brands.lowStockLabel} value={lowStockCount} icon={AlertTriangle} variant={lowStockCount > 0 ? "warning" : undefined} locale={locale} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.brands.infoTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 text-sm">
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided URL
            <img src={brand.logoUrl} alt={brand.name} className="size-28 rounded-xl border object-contain p-2" />
          )}
          <p><span className="text-muted-foreground">{t.brands.columnSlug}: </span><span dir="ltr">{brand.slug}</span></p>
          <p><span className="text-muted-foreground">{t.common.createdByLabel}: </span>{brand.createdBy?.name ?? t.common.unknownEmployee}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.brands.productsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileProductsTable products={brand.products} emptyTitle={t.brands.noProducts} t={t} locale={locale} />
          {productsTotal > 0 && (
            <DataTablePagination
              page={productsPage}
              pageSize={productsPageSize}
              total={productsTotal}
              basePath={`/dashboard/brands/${brand.id}`}
              pageParam="productsPage"
              searchParams={{}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
