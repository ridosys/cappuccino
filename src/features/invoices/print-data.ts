import "server-only";
import {
  getInvoiceById,
  getOtherOutstandingInvoices,
} from "@/features/invoices/queries";
import { getSystemSettings } from "@/features/settings/queries";

/** Everything the shared <InvoicePrintView> needs, with Decimals already
 * converted to numbers. Used by both the dashboard and La Caisse print
 * routes so a POS cashier can reprint without dashboard access. */
export async function loadInvoicePrintData(id: string) {
  const [invoice, settings] = await Promise.all([
    getInvoiceById(id),
    getSystemSettings(),
  ]);
  if (!invoice) return null;

  const otherRaw = invoice.customerId
    ? await getOtherOutstandingInvoices(invoice.customerId, invoice.id)
    : [];

  const otherOutstandingInvoices = otherRaw.map((other) => ({
    id: other.id,
    invoiceNumber: other.invoiceNumber,
    total: Number(other.total),
    paidAmount: Number(other.paidAmount),
    paymentStatus: other.paymentStatus,
    createdAt: other.createdAt,
    items: other.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  }));

  return { invoice, settings, otherOutstandingInvoices };
}
