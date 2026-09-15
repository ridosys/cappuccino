import { notFound } from "next/navigation";
import {
  InvoicePrintView,
  resolveInvoiceLang,
} from "@/features/invoices/components/invoice-print-view";
import { loadInvoicePrintData } from "@/features/invoices/print-data";
import { requirePageAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; auto?: string }>;
}) {
  await requirePageAccess("INVOICES_VIEW");

  const { id } = await params;
  const { lang: langParam, auto } = await searchParams;

  const data = await loadInvoicePrintData(id);
  if (!data) notFound();

  const lang = resolveInvoiceLang(langParam, data.invoice.language);

  return (
    <InvoicePrintView
      invoice={data.invoice}
      settings={data.settings}
      otherOutstandingInvoices={data.otherOutstandingInvoices}
      lang={lang}
      auto={auto}
      backHref={`/dashboard/invoices/${data.invoice.id}`}
    />
  );
}
