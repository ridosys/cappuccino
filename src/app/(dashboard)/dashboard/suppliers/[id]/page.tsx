import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Wallet,
  ClipboardList,
  Receipt,
  CircleDollarSign,
  FileClock,
  FileX2,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getSupplierProfile, getSupplierProductsDelivered } from "@/features/suppliers/queries";
import { PurchaseOrdersTable } from "@/features/purchases/components/purchase-orders-table";
import { SupplierPaymentHistory } from "@/features/purchases/components/supplier-payment-history";
import { AdjustSupplierBalanceDialog } from "@/features/suppliers/components/adjust-supplier-balance-dialog";
import { SupplierProductsTable } from "@/features/suppliers/components/supplier-products-table";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function SupplierProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("SUPPLIERS_VIEW");

  const { id } = await params;
  const [t, locale, profile, deliveredProducts] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSupplierProfile(id),
    getSupplierProductsDelivered(id),
  ]);
  if (!profile) notFound();

  const { supplier, purchaseOrders, payments, totals } = profile;

  const partiallyPaidOrders = purchaseOrders.filter(
    (order) => order.paymentStatus === "PARTIALLY_PAID",
  );
  const unpaidOrders = purchaseOrders.filter(
    (order) => order.paymentStatus === "UNPAID",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        icon={Truck}
        description={t.suppliers.profileLabel}
        action={<BackButton fallbackHref="/dashboard/suppliers" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.customers.totalPurchased}
          value={totals.totalPurchased}
          icon={ClipboardList}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.suppliers.creditBalance}
          value={Number(supplier.balance)}
          icon={Wallet}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.customers.totalPaid}
          value={totals.totalPaid}
          icon={Wallet}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.customers.totalRemainingLabel}
          value={totals.totalOutstanding}
          icon={Receipt}
          variant="warning"
          formatValue={(value) => formatCurrency(value, locale)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.suppliers.outstandingOrdersTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title={t.suppliers.partiallyPaidOrdersLabel}
              value={partiallyPaidOrders.length}
              icon={FileClock}
              variant="warning"
            />
            <StatCard
              title={t.suppliers.unpaidOrdersLabel}
              value={unpaidOrders.length}
              icon={FileX2}
              variant="warning"
            />
            <StatCard
              title={t.customers.totalRemainingLabel}
              value={totals.totalOutstanding}
              icon={CircleDollarSign}
              variant="warning"
              formatValue={(value) => formatCurrency(value, locale)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.suppliers.supplierInfoTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">{t.suppliers.nameLabel}: </span>
            {supplier.name}
          </p>
          {supplier.phone && (
            <p>
              <span className="text-muted-foreground">{t.orders.phoneLabel}: </span>
              <span dir="ltr">{supplier.phone}</span>
            </p>
          )}
          {supplier.email && (
            <p>
              <span className="text-muted-foreground">{t.orders.emailLabel}: </span>
              <span dir="ltr">{supplier.email}</span>
            </p>
          )}
          {supplier.address && (
            <p>
              <span className="text-muted-foreground">{t.customers.addressLabel}: </span>
              {supplier.address}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">{t.customers.registeredAtLabel}: </span>
            {new Date(supplier.createdAt).toLocaleDateString("fr-FR")}
          </p>
          <p>
            <span className="text-muted-foreground">{t.common.createdByLabel}: </span>
            {supplier.createdBy?.name ?? t.common.unknownEmployee}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/suppliers?edit=${supplier.id}`} />}
            >
              {t.suppliers.editSupplierInfo}
            </Button>
            <AdjustSupplierBalanceDialog supplierId={supplier.id} currentBalance={Number(supplier.balance)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.suppliers.purchaseOrdersHistoryTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t.suppliers.noPurchaseOrdersTitle}
            />
          ) : (
            <PurchaseOrdersTable
              searchable
              data={purchaseOrders.map((order) => ({
                id: order.id,
                orderNumber: order.orderNumber,
                total: Number(order.total),
                status: order.status,
                paymentStatus: order.paymentStatus,
                createdAt: order.createdAt,
                supplier: { name: supplier.name },
              }))}
            />
          )}
        </CardContent>
      </Card>

      <SupplierProductsTable products={deliveredProducts} t={t} locale={locale} />

      <SupplierPaymentHistory
        payments={payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
        }))}
      />
      <Card>
        <CardHeader><CardTitle>{t.suppliers.balanceHistory}</CardTitle></CardHeader>
        <CardContent>
          {supplier.balanceHistory.length === 0 ? <p className="text-sm text-muted-foreground">{t.suppliers.noBalanceHistory}</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b">{[t.suppliers.previousBalance,t.suppliers.balanceChange,t.suppliers.newBalance,t.suppliers.balanceReason,t.suppliers.balanceDate].map((label)=><th key={label} className="p-3 text-start font-medium">{label}</th>)}</tr></thead><tbody>{supplier.balanceHistory.map((row)=><tr key={row.id} className="border-b last:border-0"><td className="p-3">{formatCurrency(Number(row.previousBalance),locale)}</td><td className={`p-3 font-medium ${Number(row.change)>=0?"text-emerald-600":"text-destructive"}`}>{Number(row.change)>=0?"+":""}{formatCurrency(Number(row.change),locale)}</td><td className="p-3">{formatCurrency(Number(row.newBalance),locale)}</td><td className="p-3">{row.note??row.reason}</td><td className="p-3">{row.createdAt.toLocaleDateString(locale)}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
