import { InvoicePrintButton } from "@/features/invoices/components/invoice-print-button";
import { InvoicePdfButton } from "@/features/invoices/components/invoice-pdf-button";
import { InvoicePrintTotals } from "@/features/invoices/components/invoice-print-totals";
import { BackButton } from "@/components/shared/back-button";
import { DocumentLogo } from "@/components/shared/document-logo";
import type { getInvoiceById } from "@/features/invoices/queries";
import type { getSystemSettings } from "@/features/settings/queries";
import { getDictionary } from "@/i18n/server";
import { CURRENCY_LABEL, formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";

export type Lang = "ar" | "en" | "fr";

export function resolveInvoiceLang(
  param: string | undefined,
  fallback: string,
): Lang {
  const requested = param ?? fallback.toLowerCase();
  return requested === "en" || requested === "fr" ? requested : "ar";
}

const LABELS: Record<
  Lang,
  {
    title: string;
    invoiceNumber: string;
    date: string;
    billTo: string;
    phone: string;
    product: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    total: string;
    previousPayment: string;
    previousDebts: string;
    oldAccountPrompt: string;
    includeOldAccount: string;
    excludeOldAccount: string;
    selectInvoicesTitle: string;
    selectAllInvoices: string;
    invoiceTotal: string;
    totalPaid: string;
    remaining: string;
    done: string;
    grandTotal: string;
    itemsCount: string;
    totalWeight: string;
    thankYou: string;
  }
> = {
  ar: {
    title: "فاتورة",
    invoiceNumber: "رقم الفاتورة",
    date: "التاريخ",
    billTo: "فاتورة إلى",
    phone: "الهاتف",
    product: "نوع البضاعة",
    quantity: "العدد",
    unitPrice: "التمن",
    lineTotal: "الإجمالي",
    total: "إجمالي المنتجات",
    previousPayment: "الدفع السابق",
    previousDebts: "الحساب القديم",
    oldAccountPrompt: "يوجد على هذا العميل حساب قديم بقيمة",
    includeOldAccount: "تضمين الحساب القديم",
    excludeOldAccount: "بدون الحساب القديم",
    selectInvoicesTitle: "اختر الفواتير القديمة المضمَّنة",
    selectAllInvoices: "تحديد الكل",
    invoiceTotal: "الإجمالي",
    totalPaid: "المدفوع",
    remaining: "المتبقي",
    done: "تم",
    grandTotal: "الإجمالي الكلي",
    itemsCount: "عدد المنتجات",
    totalWeight: "الوزن الإجمالي (kg)",
    thankYou: "شكراً لتعاملكم معنا",
  },
  fr: {
    title: "Facture",
    invoiceNumber: "Numéro de facture",
    date: "Date",
    billTo: "Facturé à",
    phone: "Téléphone",
    product: "Produit",
    quantity: "Quantité",
    unitPrice: "Prix unitaire",
    lineTotal: "Sous-total",
    total: "Total des produits",
    previousPayment: "Paiement précédent",
    previousDebts: "Ancien compte",
    oldAccountPrompt: "Ce client a un ancien compte de",
    includeOldAccount: "Inclure l'ancien compte",
    excludeOldAccount: "Sans l'ancien compte",
    selectInvoicesTitle: "Choisir les anciennes factures incluses",
    selectAllInvoices: "Tout sélectionner",
    invoiceTotal: "Total",
    totalPaid: "Payé",
    remaining: "Restant",
    done: "Terminé",
    grandTotal: "Total général",
    itemsCount: "Nombre de produits",
    totalWeight: "Poids total (kg)",
    thankYou: "Merci pour votre confiance",
  },
  en: {
    title: "Invoice",
    invoiceNumber: "Invoice number",
    date: "Date",
    billTo: "Bill to",
    phone: "Phone",
    product: "Product",
    quantity: "Quantity",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    total: "Products total",
    previousPayment: "Previous payment",
    previousDebts: "Previous balance",
    oldAccountPrompt: "This customer has a previous balance of",
    includeOldAccount: "Include previous balance",
    excludeOldAccount: "Exclude previous balance",
    selectInvoicesTitle: "Select previous invoices to include",
    selectAllInvoices: "Select all",
    invoiceTotal: "Total",
    totalPaid: "Paid",
    remaining: "Remaining",
    done: "Done",
    grandTotal: "Grand total",
    itemsCount: "Number of products",
    totalWeight: "Total weight (kg)",
    thankYou: "Thank you for your business",
  },
};

type InvoiceData = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>;
type Settings = Awaited<ReturnType<typeof getSystemSettings>>;

type OutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  paymentStatus: InvoiceData["paymentStatus"];
  createdAt: Date;
  items: { id: string; name: string; quantity: number; unitPrice: number }[];
};

export async function InvoicePrintView({
  invoice,
  settings,
  lang,
  auto,
  backHref,
  otherOutstandingInvoices,
}: {
  invoice: InvoiceData;
  settings: Settings;
  lang: Lang;
  auto?: string;
  backHref: string;
  otherOutstandingInvoices: OutstandingInvoice[];
}) {
  const uiT = await getDictionary();
  const t = LABELS[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const itemsTotal = invoice.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
    0,
  );
  const itemsCount = invoice.items.length;
  const totalWeight = invoice.items.reduce(
    (sum, item) =>
      sum + Number(item.product?.weight ?? 0) * Number(item.quantity),
    0,
  );

  const isPartiallyPaid = invoice.paymentStatus === "PARTIALLY_PAID";
  const previousPayment = isPartiallyPaid ? Number(invoice.paidAmount) : 0;

  return (
    <div
      dir={dir}
      className="mx-auto max-w-2xl space-y-6 p-6 print:max-w-none print:p-0"
    >
      <style>{"@page { size: A5; margin: 5mm; }"}</style>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <BackButton fallbackHref={backHref} />
        <div className="flex gap-2">
          <InvoicePdfButton
            targetId="invoice-card"
            fileName={`${invoice.invoiceNumber}.pdf`}
            label={uiT.common.openPdf}
            autoOpen={auto === "pdf"}
          />
          <InvoicePrintButton label={uiT.common.printSavePdf} />
        </div>
      </div>

      <div
        id="invoice-card"
        className="rounded-xl border bg-card p-8 print:rounded-none print:border-none print:p-0"
      >
        <table className="w-full table-fixed border-collapse text-sm print:text-xs">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[72%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr>
              <th
                colSpan={4}
                className="border-none p-0 pb-6 text-start font-normal print:pb-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <DocumentLogo
                      logoUrl={settings.logoUrl}
                      name={settings.appName}
                    />
                  </div>
                  <div className="text-end">
                    <h2 className="text-xl font-bold print:text-base">
                      {t.title}
                    </h2>
                    <p className="text-sm font-semibold text-foreground print:text-xs">
                      {t.invoiceNumber}:{" "}
                      <span dir="ltr">{invoice.invoiceNumber}</span>
                    </p>
                    <p className="text-sm font-semibold text-foreground print:text-xs">
                      {t.date}: {formatDateTime(invoice.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 print:mt-4">
                  <p className="text-sm font-semibold text-foreground print:text-xs">
                    {t.billTo}:
                    <span className="font-bold mx-1.5">
                      {invoice.customerName}
                    </span>
                  </p>

                  <p className="text-sm font-semibold text-foreground print:text-xs">
                    {t.phone}: <span dir="ltr">{invoice.customerPhone}</span>
                  </p>
                </div>
              </th>
            </tr>
            <tr className="border-b text-start">
              <th className="px-3 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate">{t.quantity}</span>
              </th>
              <th className="px-3 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate">{t.product}</span>
              </th>
              <th className="px-2 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block leading-tight whitespace-normal wrap-break-word">
                  {t.unitPrice} {`(${CURRENCY_LABEL["fr"]})`}
                </span>
              </th>
              <th className="px-2 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block leading-tight whitespace-normal wrap-break-word">
                  {t.lineTotal} {`(${CURRENCY_LABEL["fr"]})`}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr
                key={item.id}
                className="border-b font-semibold text-foreground"
              >
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate">
                    {Number(item.quantity)}
                  </span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate">{item.name}</span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate">
                    {formatCurrency(Number(item.unitPrice), lang, true)}
                  </span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate">
                    {formatCurrency(
                      Number(item.unitPrice) * Number(item.quantity),
                      lang,
                      true,
                    )}
                  </span>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="border-none p-0 pt-5 print:pt-3">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-gray-400 pt-3 text-sm font-semibold text-foreground print:pt-2 print:text-xs">
                  <p>
                    {t.itemsCount}:{" "}
                    <span className="font-bold">{itemsCount}</span>
                  </p>
                  <p>
                    {t.totalWeight}:{" "}
                    <span className="font-bold" dir="ltr">
                      {totalWeight.toFixed(2)} kg
                    </span>
                  </p>
                </div>

                <InvoicePrintTotals
                  lang={lang}
                  labels={{
                    total: t.total,
                    previousPayment: t.previousPayment,
                    previousDebts: t.previousDebts,
                    oldAccountPrompt: t.oldAccountPrompt,
                    includeOldAccount: t.includeOldAccount,
                    excludeOldAccount: t.excludeOldAccount,
                    selectInvoicesTitle: t.selectInvoicesTitle,
                    selectAllInvoices: t.selectAllInvoices,
                    invoiceTotal: t.invoiceTotal,
                    totalPaid: t.totalPaid,
                    remaining: t.remaining,
                    done: t.done,
                    grandTotal: t.grandTotal,
                  }}
                  itemsTotal={itemsTotal}
                  previousPayment={previousPayment}
                  showPreviousPayment={isPartiallyPaid}
                  otherOutstandingInvoices={otherOutstandingInvoices}
                />

                {invoice.notes && (
                  <p className="mt-4 text-sm font-semibold text-foreground print:text-xs">
                    {invoice.notes}
                  </p>
                )}

                <p className="mt-4 text-center text-sm font-semibold text-foreground print:text-xs">
                  {t.thankYou}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
