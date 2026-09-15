import { notFound } from "next/navigation";
import { getPurchaseOrderById } from "@/features/purchases/queries";
import { InvoicePrintButton } from "@/features/invoices/components/invoice-print-button";
import { InvoicePdfButton } from "@/features/invoices/components/invoice-pdf-button";
import { BackButton } from "@/components/shared/back-button";
import { DocumentLogo } from "@/components/shared/document-logo";
import { getSystemSettings } from "@/features/settings/queries";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import { CURRENCY_LABEL, formatCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";

type Lang = "ar" | "en" | "fr";

const LABELS: Record<
  Lang,
  {
    title: string;
    orderNumber: string;
    date: string;
    supplier: string;
    phone: string;
    product: string;
    quantity: string;
    unitCost: string;
    lineTotal: string;
    total: string;
    itemsCount: string;
    totalWeight: string;
    supplierSignature: string;
  }
> = {
  ar: {
    title: "فاتورة شراء",
    orderNumber: "رقم أمر الشراء",
    date: "التاريخ",
    supplier: "المورد",
    phone: "الهاتف",
    product: "نوع البضاعة",
    quantity: "العدد",
    unitCost: "التمن",
    lineTotal: "الإجمالي",
    total: "الإجمالي الكلي",
    itemsCount: "عدد المنتجات",
    totalWeight: "الوزن الإجمالي (kg)",
    supplierSignature: "توقيع المورد",
  },
  fr: {
    title: "Facture d'achat",
    orderNumber: "Numéro de commande",
    date: "Date",
    supplier: "Fournisseur",
    phone: "Téléphone",
    product: "Produit",
    quantity: "Quantité",
    unitCost: "Prix unitaire",
    lineTotal: "Sous-total",
    total: "Total",
    itemsCount: "Nombre de produits",
    totalWeight: "Poids total (kg)",
    supplierSignature: "Signature du fournisseur",
  },
  en: {
    title: "Purchase invoice",
    orderNumber: "Purchase order number",
    date: "Date",
    supplier: "Supplier",
    phone: "Phone",
    product: "Product",
    quantity: "Quantity",
    unitCost: "Unit cost",
    lineTotal: "Line total",
    total: "Grand total",
    itemsCount: "Number of products",
    totalWeight: "Total weight (kg)",
    supplierSignature: "Supplier signature",
  },
};

export default async function PurchaseOrderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  await requirePageAccess("PURCHASES_VIEW");

  const { id } = await params;
  const { lang: langParam } = await searchParams;

  const [order, uiT, settings] = await Promise.all([
    getPurchaseOrderById(id),
    getDictionary(),
    getSystemSettings(),
  ]);
  if (!order) notFound();

  const requestedLang = langParam ?? order.language.toLowerCase();
  const lang: Lang =
    requestedLang === "en" || requestedLang === "fr" ? requestedLang : "ar";
  const t = LABELS[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const grandTotal = order.items.reduce(
    (sum, item) => sum + Number(item.unitCost) * Number(item.quantity),
    0,
  );
  const itemsCount = order.items.length;
  const totalWeight = order.items.reduce(
    (sum, item) => sum + Number(item.product.weight ?? 0) * Number(item.quantity),
    0,
  );

  return (
    <div
      dir={dir}
      className="mx-auto max-w-2xl space-y-6 p-6 print:max-w-none print:p-0"
    >
      <style>{"@page { size: A5; margin: 5mm; }"}</style>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <BackButton fallbackHref={`/dashboard/purchases/${order.id}`} />
        <div className="flex gap-2">
          <InvoicePdfButton
            targetId="purchase-order-card"
            fileName={`${order.orderNumber}.pdf`}
            label={uiT.common.openPdf}
          />
          <InvoicePrintButton label={uiT.common.printSavePdf} />
        </div>
      </div>

      <div
        id="purchase-order-card"
        className="rounded-xl border bg-card p-8 print:rounded-none print:border-none print:p-0"
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th colSpan={4} className="border-none p-0 pb-6 text-start font-normal print:pb-4">
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
                      {t.orderNumber}:{" "}
                      <span dir="ltr">{order.orderNumber}</span>
                    </p>
                    <p className="text-sm font-semibold text-foreground print:text-xs">
                      {t.date}:{" "}
                      {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 print:mt-4">
                  <p className="text-sm font-semibold text-foreground print:text-xs">
                    {t.supplier}:
                    <span className="font-bold mx-1.5">
                      {order.supplier.name}
                    </span>
                  </p>
                  {order.supplier.phone && (
                    <p className="text-sm font-semibold text-foreground print:text-xs">
                      {t.phone}: <span dir="ltr">{order.supplier.phone}</span>
                    </p>
                  )}
                </div>
              </th>
            </tr>
            <tr className="border-b text-start">
              <th className="px-3 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate max-w-[10ch]">
                  {t.quantity}
                </span>
              </th>
              <th className="px-3 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate max-w-[10ch]">{t.product}</span>
              </th>
              <th className="px-2 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate max-w-[15ch]">
                  {t.unitCost} {`(${CURRENCY_LABEL["fr"]})`}
                </span>
              </th>
              <th className="px-2 py-2 text-start font-bold border-2 border-gray-400">
                <span className="block truncate max-w-[18ch]">
                  {t.lineTotal} {`(${CURRENCY_LABEL["fr"]})`}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b font-semibold text-foreground">
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate max-w-[15ch]">
                    {Number(item.quantity)}
                  </span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate max-w-[18ch]">
                    {item.product.name}
                  </span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate max-w-[15ch]">
                    {formatCurrency(Number(item.unitCost), lang, true, 4)}
                  </span>
                </td>
                <td className="px-3 py-2 border-2 border-gray-400">
                  <span className="block truncate max-w-[15ch]">
                    {formatCurrency(
                      Number(item.unitCost) * Number(item.quantity),
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
                    {t.itemsCount}: <span className="font-bold">{itemsCount}</span>
                  </p>
                  <p>
                    {t.totalWeight}:{" "}
                    <span className="font-bold" dir="ltr">
                      {totalWeight.toFixed(2)} kg
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 print:mt-2 print:py-1.5 print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                  <p className="text-base font-bold print:text-sm">
                    {t.total}
                  </p>
                  <p className="text-lg font-bold print:text-base">
                    {formatCurrency(grandTotal, lang, false)}
                  </p>
                </div>

                <div className="flex justify-start pt-8 print:break-inside-avoid">
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-32 rounded-md border border-gray-300" />
                    <p className="text-sm font-semibold text-foreground">
                      {t.supplierSignature}
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
