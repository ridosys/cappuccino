import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/shared/back-button";
import { InvoicePrintButton } from "@/features/invoices/components/invoice-print-button";
import { InvoicePdfButton } from "@/features/invoices/components/invoice-pdf-button";
import { getCustomerStatement } from "@/features/customers/queries";
import { getSystemSettings } from "@/features/settings/queries";
import { DocumentLogo } from "@/components/shared/document-logo";
import { formatCurrency } from "@/lib/currency";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function formatStatementDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePageAccess("CUSTOMERS_VIEW");

  const { id } = await params;
  const requested = await searchParams;
  const from = validDate(requested.from);
  const to = validDate(requested.to);
  const [statement, t, locale, settings] = await Promise.all([
    getCustomerStatement(id, from, to),
    getDictionary(),
    getLocale(),
    getSystemSettings(),
  ]);
  if (!statement) notFound();

  const totalInvoices = statement.invoices.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );
  const totalPaid = statement.invoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.paymentStatus === "PAID"
        ? invoice.total
        : invoice.paymentStatus === "PARTIALLY_PAID"
          ? invoice.paidAmount
          : 0),
    0,
  );
  const totalRemaining = statement.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.total - invoice.paidAmount),
    0,
  );
  const displayPeriodDate = (value: string | undefined) =>
    value ? formatStatementDate(value) : "…";
  const period =
    from || to
      ? `${displayPeriodDate(from)} — ${displayPeriodDate(to)}`
      : t.customers.allPeriodsLabel;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 print:max-w-none print:p-0">
      <style>{`
        @page { size: A5 portrait; margin: 8mm; }
        @media print {
          html, body { background: white !important; }
          #customer-statement { width: 100%; min-height: 0; }
          #customer-statement table { font-size: 10px; }
          #customer-statement a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <BackButton fallbackHref={`/dashboard/customers/${id}`} />
        <div className="flex gap-2">
          <InvoicePdfButton
            targetId="customer-statement"
            fileName={`${t.customers.statementFileName}-${statement.customer.name}.pdf`}
            label={t.common.openPdf}
          />
          <InvoicePrintButton label={t.common.printSavePdf} />
        </div>
      </div>

      <section
        id="customer-statement"
        className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]"
      >
        <header className="flex flex-col justify-between gap-5 border-b pb-5 sm:flex-row">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-6 text-primary print:hidden" />
              <h1 className="text-2xl font-bold">
                {t.customers.statementTitle}
              </h1>
            </div>
            <DocumentLogo
              logoUrl={settings.logoUrl}
              name={settings.appName}
              nameClassName="font-semibold"
              imgClassName="h-10 w-auto max-w-[180px] object-contain"
            />
          </div>
          <div className="space-y-1 text-sm sm:text-end">
            <p>
              <span className="text-muted-foreground">
                {t.customers.statementCustomerLabel}:{" "}
              </span>
              <strong>{statement.customer.name}</strong>
            </p>
            <p dir="ltr" className="sm:ms-auto">
              {statement.customer.phone}
            </p>
            {statement.customer.email && (
              <p dir="ltr" className="sm:ms-auto">
                {statement.customer.email}
              </p>
            )}
            {statement.customer.address && <p>{statement.customer.address}</p>}
            <p>
              <span className="text-muted-foreground">
                {t.customers.statementPeriodLabel}:{" "}
              </span>
              <span dir="ltr">{period}</span>
            </p>
          </div>
        </header>

        <div className="mt-6 overflow-hidden rounded-xl border print:mt-4 print:rounded-none">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th
                  colSpan={2}
                  className="border-e px-4 py-3 text-start print:py-2"
                >
                  {t.customers.statementInvoicesLabel}
                </th>
                <th colSpan={2} className="px-4 py-3 text-start print:py-2">
                  {t.customers.statementPaymentsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {statement.invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {t.customers.statementNoInvoices}
                  </td>
                </tr>
              ) : (
                statement.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="px-4 py-3 font-medium print:py-2" dir="ltr">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="hover:text-primary hover:underline print:text-foreground print:no-underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <span
                        dir="ltr"
                        className="mt-0.5 block text-xs font-normal text-muted-foreground [unicode-bidi:isolate] print:text-[9px]"
                      >
                        {formatStatementDate(invoice.createdAt)}
                      </span>
                    </td>
                    <td className="border-e px-4 py-3 font-medium print:py-2">
                      {formatCurrency(invoice.total, locale)}
                    </td>
                    <td className="px-4 py-3 font-medium print:py-2">
                      {formatCurrency(
                        invoice.paymentStatus === "PAID"
                          ? invoice.total
                          : invoice.paidAmount,
                        locale,
                      )}
                    </td>
                    <td className="px-4 py-3 text-end print:py-2">
                      <Badge
                        variant={
                          invoice.paymentStatus === "PAID"
                            ? "default"
                            : invoice.paymentStatus === "PARTIALLY_PAID"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {t.statusLabels.paymentStatus[invoice.paymentStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 print:mt-4 print:gap-2">
          <div className="rounded-xl border p-4 text-center print:rounded-lg print:p-2.5">
            <p className="text-sm text-muted-foreground">
              {t.customers.statementInvoicesTotal}
            </p>
            <p className="mt-1 text-lg font-bold">
              {formatCurrency(totalInvoices, locale)}
            </p>
          </div>
          <div className="rounded-xl border p-4 text-center print:rounded-lg print:p-2.5">
            <p className="text-sm text-muted-foreground">
              {t.customers.statementPaymentsTotal}
            </p>
            <p className="mt-1 text-lg font-bold">
              {formatCurrency(totalPaid, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center print:rounded-lg print:p-2.5">
            <p className="text-sm text-muted-foreground">
              {t.customers.statementRemainingTotal}
            </p>
            <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(totalRemaining, locale)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
