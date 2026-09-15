import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Printer, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import {
  getInvoiceById,
  getCustomerOutstandingInvoices,
} from "@/features/invoices/queries";
import { getProductPickerOptions } from "@/features/products/queries";
import { getCustomerOptions } from "@/features/customers/queries";
import { getCategoryOptions } from "@/features/categories/queries";
import { getBrandOptions } from "@/features/brands/queries";
import { InvoiceForm } from "@/features/invoices/components/invoice-form";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import { RecordPaymentDialog } from "@/features/invoices/components/record-payment-dialog";
import { formatCurrency } from "@/lib/currency";
import { formatSequenceNumber } from "@/lib/sequence-number";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function InvoiceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("INVOICES_VIEW");

  const { id } = await params;
  const [t, locale, invoice, productRows, customers, categories, brands] = await Promise.all([
    getDictionary(),
    getLocale(),
    getInvoiceById(id),
    getProductPickerOptions(),
    getCustomerOptions(),
    getCategoryOptions(),
    getBrandOptions(),
  ]);

  if (!invoice) notFound();

  const outstandingInvoices = invoice.customerId
    ? await getCustomerOutstandingInvoices(invoice.customerId)
    : [];

  const products = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    quantity: Number(product.quantity),
    price1: Number(product.price1),
    price2: Number(product.price2),
    price3: Number(product.price3),
    categoryId: product.categoryId,
    brandId: product.brandId,
  }));

  const total = Number(invoice.total);
  const paidAmount = Number(invoice.paidAmount);
  const remaining = Math.max(0, total - paidAmount);
  const customerBalance =
    customers.find((customer) => customer.id === invoice.customerId)?.balance ??
    0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMessage(t.invoices.detailTitle, { number: invoice.invoiceNumber })}
        icon={FileText}
        action={
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/sales-returns/new?invoiceId=${invoice.id}`} />}><RotateCcw className="size-4" />{t.returns.newReturn}</Button>
            <BackButton fallbackHref="/dashboard/invoices" />
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/invoices/${invoice.id}/print?lang=${invoice.language.toLowerCase()}`}
                />
              }
            >
              <Printer className="size-4" />
              {t.invoices.viewPrintButton}
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">
        {t.common.createdByLabel}:{" "}
        <span className="font-medium text-foreground">
          {invoice.createdBy?.name ?? t.common.unknownEmployee}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
        <PaymentStatusBadge status={invoice.paymentStatus} />
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t.invoices.sequenceNumberLabel}:{" "}
          </span>
          <span dir="ltr" className="font-medium tabular-nums">
            {formatSequenceNumber(invoice.sequenceNumber)}
          </span>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t.invoices.remainingBalance}:{" "}
          </span>
          <span className="font-medium">{formatCurrency(remaining, locale)}</span>
        </p>
        {remaining > 0 && (
          <RecordPaymentDialog
            invoiceId={invoice.id}
            remaining={remaining}
            customerBalance={customerBalance}
            hasCustomer={Boolean(invoice.customerId)}
            customerId={invoice.customerId}
            outstandingInvoices={outstandingInvoices.map((row) => ({
              ...row,
              total: Number(row.total),
              paidAmount: Number(row.paidAmount),
            }))}
          />
        )}
      </div>

      {invoice.returns.length > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-400">
          {t.invoices.cannotEditReturnedError}
        </p>
      )}

      <InvoiceForm
          invoice={{
            id: invoice.id,
            language: invoice.language,
            createdAt: invoice.createdAt,
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            customerPhone: invoice.customerPhone,
            customerEmail: invoice.customerEmail,
            notes: invoice.notes,
            orderId: invoice.orderId,
            items: invoice.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          }}
          products={products}
          customers={customers}
          categories={categories}
          brands={brands}
          payments={invoice.payments.map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
          }))}
      />
      <Card><CardHeader><CardTitle>{t.returns.returnHistory}</CardTitle></CardHeader><CardContent>{invoice.returns.length === 0 ? <p className="text-sm text-muted-foreground">{t.returns.noInvoiceReturns}</p> : <div className="space-y-2">{invoice.returns.map((r) => <Link key={r.id} href={`/dashboard/sales-returns/${r.id}`} className="flex justify-between rounded-md border p-3 text-sm hover:bg-muted"><span className="font-medium">{r.returnNumber}</span><span>{r.items.reduce((s,i)=>s+i.quantity.toNumber(),0)} {t.returns.piece} — {formatCurrency(Number(r.refundAmount),locale)}</span></Link>)}</div>}</CardContent></Card>
    </div>
  );
}
