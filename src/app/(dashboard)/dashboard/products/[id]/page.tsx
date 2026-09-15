import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Package,
  Boxes,
  ShoppingCart,
  AlertTriangle,
  ClipboardPlus,
  Users,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  getProductProfile,
  getProductCustomersPage,
} from "@/features/products/queries";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ProductProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePageAccess("PRODUCTS_VIEW");

  const { id } = await params;
  const sp = await searchParams;
  const customersQuery = sp.q?.trim() || undefined;
  const customersPage = Math.max(1, Number(sp.page) || 1);

  const [t, locale, profile, customers] = await Promise.all([
    getDictionary(),
    getLocale(),
    getProductProfile(id),
    getProductCustomersPage({
      productId: id,
      query: customersQuery,
      page: customersPage,
    }),
  ]);
  if (!profile) notFound();

  const { product, movements, orderItems, totalSold } = profile;
  // product.quantity/minStockLevel are both Prisma.Decimal — a native <=
  // between two Decimal instances silently does a *string* comparison
  // (Decimal.valueOf() returns a string), not a numeric one, and
  // TypeScript doesn't flag same-type object comparisons like this even
  // though it's wrong at runtime. .lessThanOrEqualTo() compares correctly.
  const isLowStock = product.quantity.lessThanOrEqualTo(product.minStockLevel);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        icon={Package}
        description={t.products.profileLabel}
        action={
          <div className="flex gap-2">
            <BackButton fallbackHref="/dashboard/products" />
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/purchases/new?productId=${product.id}`}
                />
              }
            >
              <ClipboardPlus className="size-4" />
              {t.products.createPurchaseOrderButton}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/products?edit=${product.id}`} />}
            >
              {t.common.edit}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t.products.currentStockLabel}
          value={Number(product.quantity)}
          icon={Boxes}
          variant={isLowStock ? "warning" : undefined}
          formatValue={(value) => value.toLocaleString(locale)}
        />
        <StatCard
          title={t.products.totalSoldLabel}
          value={totalSold}
          icon={ShoppingCart}
          formatValue={(value) => value.toLocaleString(locale)}
        />
        <StatCard
          title={t.reports.columnMinStock}
          value={Number(product.minStockLevel)}
          icon={AlertTriangle}
          variant={isLowStock ? "warning" : undefined}
          formatValue={(value) => value.toLocaleString(locale)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.products.productInfoTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">SKU: </span>
              <span dir="ltr">{product.sku}</span>
            </p>
            {product.barcode && (
              <p>
                <span className="text-muted-foreground">{t.products.barcodeColumnLabel}: </span>
                <span dir="ltr">{product.barcode}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t.products.columnCategory}: </span>
              {product.category.name}
            </p>
            <p>
              <span className="text-muted-foreground">{t.products.columnBrand}: </span>
              {product.brand?.name ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{t.products.purchasePriceDisplayLabel}: </span>
              {formatCurrency(Number(product.purchasePrice), locale, false, 4)}
            </p>
            {product.weight != null && (
              <p>
                <span className="text-muted-foreground">{t.products.weightDisplayLabel}: </span>
                <span dir="ltr">{Number(product.weight)}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t.products.statusLabel}: </span>
              <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                {t.statusLabels.productStatus[product.status]}
              </Badge>
            </p>
            {product.description && (
              <p>
                <span className="text-muted-foreground">{t.products.descriptionLabel}: </span>
                {product.description}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t.common.createdByLabel}: </span>
              {product.createdBy?.name ?? t.common.unknownEmployee}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.products.priceTiersTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t.reports.columnPrice1}: </span>
              {formatCurrency(Number(product.price1), locale, false, 4)}
            </p>
            <p>
              <span className="text-muted-foreground">{t.reports.columnPrice2}: </span>
              {formatCurrency(Number(product.price2), locale, false, 4)}
            </p>
            <p>
              <span className="text-muted-foreground">{t.reports.columnPrice3}: </span>
              {formatCurrency(Number(product.price3), locale, false, 4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {product.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.products.imagesLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {product.images.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <Image
                    src={img.secureUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.inventory.movementsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={t.inventory.movementsEmptyTitle}
              description={t.inventory.movementsEmptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.inventory.columnType}</TableHead>
                  <TableHead>{t.inventory.columnQuantity}</TableHead>
                  <TableHead>{t.inventory.columnReason}</TableHead>
                  <TableHead>{t.inventory.columnCustomer}</TableHead>
                  <TableHead>{t.inventory.columnSupplier}</TableHead>
                  <TableHead>{t.inventory.columnDate}</TableHead>
                  <TableHead>{t.common.createdByLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {t.statusLabels.movementType[movement.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{movement.quantity.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.customerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.supplierName ?? "—"}
                    </TableCell>
                    <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.createdBy?.name ?? t.common.unknownEmployee}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.products.ordersContainingTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {orderItems.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={t.products.noOrdersForProduct}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.orders.columnOrderNumber}</TableHead>
                  <TableHead>{t.orders.columnCustomer}</TableHead>
                  <TableHead>{t.purchases.quantityLabel}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.reports.columnDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/orders/${item.order.id}`}
                        className="font-medium text-primary hover:underline"
                        dir="ltr"
                      >
                        {item.order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{item.order.customerName}</TableCell>
                    <TableCell>{item.quantity.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t.statusLabels.order[item.order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.order.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.products.customersTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTableSearch placeholder={t.products.customersSearchPlaceholder} />
          {customers.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t.products.noCustomersForProduct}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.customers.columnName}</TableHead>
                    <TableHead>{t.customers.columnPhone}</TableHead>
                    <TableHead>{t.products.columnQuantityPurchased}</TableHead>
                    <TableHead>{t.customers.columnOrdersCount}</TableHead>
                    <TableHead>{t.products.columnLastPurchase}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.items.map((customer, index) => (
                    <TableRow key={customer.customerId ?? `guest-${index}`}>
                      <TableCell className="font-medium">
                        {customer.customerName}
                      </TableCell>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {customer.customerPhone}
                      </TableCell>
                      <TableCell>
                        {customer.totalQuantity.toLocaleString(locale)}
                      </TableCell>
                      <TableCell>
                        {customer.ordersCount.toLocaleString(locale)}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(customer.lastPurchaseAt)}
                      </TableCell>
                      <TableCell>
                        {customer.customerId && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            nativeButton={false}
                            render={
                              <Link
                                href={`/dashboard/customers/${customer.customerId}`}
                              />
                            }
                            title={t.customers.viewProfile}
                          >
                            <Eye className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataTablePagination
                page={customersPage}
                pageSize={customers.pageSize}
                total={customers.total}
                basePath={`/dashboard/products/${product.id}`}
                searchParams={{ q: customersQuery }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
