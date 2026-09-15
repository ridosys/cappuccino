import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Printer, UserCircle, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { getPurchaseOrderById } from "@/features/purchases/queries";
import { getProductPickerOptions } from "@/features/products/queries";
import { getSupplierOptions } from "@/features/suppliers/queries";
import { PurchaseOrderSupplierSelect } from "@/features/purchases/components/purchase-order-supplier-select";
import { PurchaseOrderStatusSelect } from "@/features/purchases/components/purchase-order-status-select";
import { PurchaseOrderLanguageSelect } from "@/features/purchases/components/purchase-order-language-select";
import { PurchaseOrderDateField } from "@/features/purchases/components/purchase-order-date-field";
import { DeletePurchaseOrderButton } from "@/features/purchases/components/delete-purchase-order-button";
import { PurchaseOrderItemsForm } from "@/features/purchases/components/purchase-order-items-form";
import { PurchaseAttachmentsCard } from "@/features/purchases/components/purchase-attachments-card";
import { RecordSupplierPaymentDialog } from "@/features/purchases/components/record-supplier-payment-dialog";
import { SupplierPaymentHistory } from "@/features/purchases/components/supplier-payment-history";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess, hasPermission } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("PURCHASES_VIEW");

  const { id } = await params;
  const [t, locale, order, productRows, suppliers, canManageOrder] =
    await Promise.all([
      getDictionary(),
      getLocale(),
      getPurchaseOrderById(id),
      getProductPickerOptions(),
      getSupplierOptions(),
      hasPermission("PURCHASES_MANAGE"),
    ]);
  if (!order) notFound();

  const products = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    price1: Number(product.price1),
    price2: Number(product.price2),
    price3: Number(product.price3),
    purchasePrice: Number(product.purchasePrice),
  }));

  const orderTotal = Number(order.total);
  const paidAmount = Number(order.paidAmount);
  const remaining = Math.max(0, orderTotal - paidAmount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMessage(t.purchases.detailTitle, { number: order.orderNumber })}
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap gap-2">
            {order.status === "RECEIVED" && <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/purchase-returns/new?purchaseId=${order.id}`} />}><Undo2 className="size-4" />{t.returns.newReturn}</Button>}
            <DeletePurchaseOrderButton
              purchaseOrderId={order.id}
              orderNumber={order.orderNumber}
            />
            <BackButton fallbackHref="/dashboard/purchases" />
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">
        {t.common.createdByLabel}:{" "}
        <span className="font-medium text-foreground">
          {order.createdBy?.name ?? t.common.unknownEmployee}
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.purchases.itemsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.status === "RECEIVED" && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-400">
                  {t.purchases.receivedNotice}
                </p>
              )}
              <PurchaseOrderItemsForm
                purchaseOrderId={order.id}
                items={order.items.map((item) => ({
                  productId: item.productId,
                  productName: item.product.name,
                  quantity: Number(item.quantity),
                  unitCost: Number(item.unitCost),
                }))}
                products={products}
                locked={order.status === "RECEIVED"}
              />
            </CardContent>
          </Card>

          <PurchaseAttachmentsCard
            purchaseOrderId={order.id}
            attachments={order.attachments.map((attachment) => ({
              id: attachment.id,
              secureUrl: attachment.secureUrl,
              fileName: attachment.fileName,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
              createdAt: attachment.createdAt,
              uploadedByName: attachment.uploadedBy?.name ?? null,
            }))}
          />

          <SupplierPaymentHistory
            payments={order.payments.map((payment) => ({
              ...payment,
              amount: Number(payment.amount),
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t.returns.returnHistory}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.returns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.returns.noReturns}
                </p>
              ) : (
                <div className="space-y-2">
                  {order.returns.map((r) => (
                    <Link
                      key={r.id}
                      href={`/dashboard/purchase-returns/${r.id}`}
                      className="flex justify-between rounded-md border p-3 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{r.returnNumber}</span>
                      <span>
                        {r.items.reduce((s, i) => s + i.quantity.toNumber(), 0)}{" "}
                        {t.returns.piece}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t.purchases.supplierInfoCardTitle}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto cursor-pointer gap-1 px-2 py-1 text-xs"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/suppliers/${order.supplierId}`} />
                }
              >
                <UserCircle className="size-3.5" />
                {t.purchases.goToSupplierPage}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {canManageOrder ? (
                <div className="space-y-1.5">
                  <span className="text-muted-foreground">{t.suppliers.nameLabel}: </span>
                  <PurchaseOrderSupplierSelect
                    purchaseOrderId={order.id}
                    supplierId={order.supplierId}
                    suppliers={suppliers}
                  />
                </div>
              ) : (
                <p>
                  <span className="text-muted-foreground">{t.suppliers.nameLabel}: </span>
                  {order.supplier.name}
                </p>
              )}
              {order.supplier.phone && (
                <p>
                  <span className="text-muted-foreground">{t.orders.phoneLabel}: </span>
                  <span dir="ltr">{order.supplier.phone}</span>
                </p>
              )}
              <PurchaseOrderDateField
                purchaseOrderId={order.id}
                date={order.createdAt}
              />
              {order.supplierInvoiceNumber && (
                <p>
                  <span className="text-muted-foreground">
                    {t.purchaseScan.supplierInvoiceNumberLabel}:{" "}
                  </span>
                  <span dir="ltr">{order.supplierInvoiceNumber}</span>
                  {order.supplierInvoiceDate && (
                    <span className="text-muted-foreground">
                      {" "}
                      ·{" "}
                      {new Date(order.supplierInvoiceDate).toLocaleDateString(
                        "fr-FR",
                      )}
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.purchases.statusCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PurchaseOrderStatusSelect
                purchaseOrderId={order.id}
                status={order.status}
              />
              {order.receivedAt && (
                <p className="text-xs text-muted-foreground">
                  {t.purchases.receivedAtLabel}{" "}
                  {new Date(order.receivedAt).toLocaleDateString("fr-FR")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.purchases.printCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t.purchases.purchaseInvoiceLanguageLabel}</Label>
                <PurchaseOrderLanguageSelect
                  purchaseOrderId={order.id}
                  language={order.language}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/purchases/${order.id}/print`} />
                }
              >
                <Printer className="size-4" />
                {t.purchases.printButton}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.purchases.paymentStatusCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t.purchases.paidAmountLabel}: </span>
                <span className="font-medium">{formatCurrency(paidAmount, locale)}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">{t.purchases.remainingAmountLabel}: </span>
                <span className="font-medium">{formatCurrency(remaining, locale)}</span>
              </p>
              {remaining > 0 && (
                <RecordSupplierPaymentDialog
                  purchaseOrderId={order.id}
                  remaining={remaining}
                  supplierBalance={Number(order.supplier.balance)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
