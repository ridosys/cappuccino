"use client";

import { useState } from "react";
import { Check, X, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import type { PaymentStatus } from "@/generated/prisma/client";

export type OtherOutstandingInvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OtherOutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  items: OtherOutstandingInvoiceItem[];
};

/**
 * Renders the totals block of an invoice print page, with a print:hidden
 * control letting the admin decide on the spot whether الحساب القديم (the
 * customer's other outstanding invoices) should count toward this
 * printout's الإجمالي الكلي — some customers want it included, some don't,
 * and that's a per-print judgment call, not something the app should
 * hardcode either way. Clicking "تضمين الحساب القديم" opens a checklist
 * (same pattern as the "تسجيل دفعة" dialog) so the admin can include only
 * specific old invoices instead of all-or-nothing; everything is selected
 * by default.
 */
export function InvoicePrintTotals({
  lang,
  labels,
  itemsTotal,
  previousPayment,
  showPreviousPayment,
  otherOutstandingInvoices,
}: {
  lang: "ar" | "en" | "fr";
  labels: {
    total: string;
    previousPayment: string;
    previousDebts: string;
    grandTotal: string;
    oldAccountPrompt: string;
    includeOldAccount: string;
    excludeOldAccount: string;
    selectInvoicesTitle: string;
    selectAllInvoices: string;
    invoiceTotal: string;
    totalPaid: string;
    remaining: string;
    done: string;
  };
  itemsTotal: number;
  previousPayment: number;
  showPreviousPayment: boolean;
  otherOutstandingInvoices: OtherOutstandingInvoice[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(otherOutstandingInvoices.map((invoice) => invoice.id)),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasOldAccount = otherOutstandingInvoices.length > 0;
  const previousDebtsTotal = otherOutstandingInvoices.reduce(
    (sum, other) => sum + Math.max(0, other.total - other.paidAmount),
    0,
  );
  const selectedDebtsTotal = otherOutstandingInvoices
    .filter((invoice) => selectedIds.has(invoice.id))
    .reduce((sum, other) => sum + Math.max(0, other.total - other.paidAmount), 0);
  const includesOldAccount = selectedIds.size > 0;
  const allSelected = selectedIds.size === otherOutstandingInvoices.length;
  const effectiveOldAccount = includesOldAccount ? selectedDebtsTotal : 0;
  const grandTotal = Math.max(0, itemsTotal - previousPayment) + effectiveOldAccount;

  function toggleInvoice(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(otherOutstandingInvoices.map((invoice) => invoice.id)),
    );
  }

  return (
    <>
      {hasOldAccount && (
        <div className="mt-3 space-y-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 print:hidden">
          <p className="text-xs font-medium text-foreground">
            {labels.oldAccountPrompt}{" "}
            <span className="font-bold" dir="ltr">
              {formatCurrency(previousDebtsTotal, lang, false)}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={includesOldAccount ? "default" : "outline"}
              className={cn(
                "flex-1 cursor-pointer",
                includesOldAccount && "ring-2 ring-primary/30",
              )}
              onClick={() =>
                setSelectedIds(
                  new Set(otherOutstandingInvoices.map((invoice) => invoice.id)),
                )
              }
            >
              <Check className="size-4" />
              {labels.includeOldAccount}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!includesOldAccount ? "default" : "outline"}
              className={cn(
                "flex-1 cursor-pointer",
                !includesOldAccount && "ring-2 ring-primary/30",
              )}
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-4" />
              {labels.excludeOldAccount}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 cursor-pointer"
              onClick={() => setDialogOpen(true)}
              title={labels.selectInvoicesTitle}
            >
              <ListChecks className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg print:hidden">
          <DialogHeader>
            <DialogTitle>{labels.selectInvoicesTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="cursor-pointer text-xs font-medium text-primary hover:underline"
                onClick={toggleSelectAll}
              >
                {labels.selectAllInvoices}
              </button>
              <span className="text-xs font-medium text-muted-foreground">
                {labels.previousDebts}
              </span>
            </div>
            <div
              className={cn(
                "space-y-1.5 rounded-lg border p-2",
                otherOutstandingInvoices.length > 4 && "max-h-72 overflow-y-auto",
              )}
            >
              {otherOutstandingInvoices.map((invoice) => {
                const invoiceRemaining = Math.max(
                  0,
                  invoice.total - invoice.paidAmount,
                );
                return (
                  <label
                    key={invoice.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(invoice.id)}
                      onCheckedChange={() => toggleInvoice(invoice.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium" dir="ltr">
                          {invoice.invoiceNumber}
                        </span>
                        <PaymentStatusBadge status={invoice.paymentStatus} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {new Date(invoice.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                        <span>
                          {labels.invoiceTotal}: {formatCurrency(invoice.total, lang, false)}
                        </span>
                        <span>
                          {labels.totalPaid}:{" "}
                          {formatCurrency(invoice.paidAmount, lang, false)}
                        </span>
                        <span className="font-medium text-foreground">
                          {labels.remaining}:{" "}
                          {formatCurrency(invoiceRemaining, lang, false)}
                        </span>
                      </div>
                      {invoice.items.length > 0 && (
                        <ul className="mt-1 space-y-0.5 rounded-md bg-muted/40 p-1.5 text-xs">
                          {invoice.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate text-foreground">
                                {item.name}{" "}
                                <span className="text-muted-foreground">
                                  × {item.quantity}
                                </span>
                              </span>
                              <span className="shrink-0 text-muted-foreground" dir="ltr">
                                {formatCurrency(item.unitPrice, lang, false)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5 text-sm">
              <span className="text-muted-foreground">{labels.previousDebts}</span>
              <span className="font-medium" dir="ltr">
                {formatCurrency(selectedDebtsTotal, lang, false)}
              </span>
            </div>
            <Button
              type="button"
              className="w-full cursor-pointer"
              onClick={() => setDialogOpen(false)}
            >
              {labels.done}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-2 flex flex-col gap-1 text-sm font-semibold text-foreground print:text-xs">
        <p>
          {labels.total}: {formatCurrency(itemsTotal, lang, false)}
        </p>
        {showPreviousPayment && (
          <p>
            {labels.previousPayment}:{" "}
            {formatCurrency(previousPayment, lang, false)}
          </p>
        )}
        {includesOldAccount && hasOldAccount && (
          <p>
            {labels.previousDebts}:{" "}
            {formatCurrency(selectedDebtsTotal, lang, false)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 print:mt-2 print:py-1.5 print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
        <p className="text-base font-bold print:text-sm">{labels.grandTotal}</p>
        <p className="text-lg font-bold print:text-base">
          {formatCurrency(grandTotal, lang, false)}
        </p>
      </div>
    </>
  );
}
