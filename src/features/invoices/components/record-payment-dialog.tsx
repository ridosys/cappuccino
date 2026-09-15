"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import { recordPayment, recordPaymentAcrossInvoices } from "@/features/invoices/actions";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";
import { BalanceConfirmDialog } from "@/features/invoices/components/balance-confirm-dialog";
import {
  checkMultiInvoicePaymentConfirmation,
  type BalanceConfirmRequest,
} from "@/features/invoices/balance-resolution";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "BALANCE",
  "OTHER",
];

export type OutstandingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
};

export function RecordPaymentDialog({
  invoiceId,
  remaining,
  customerBalance = 0,
  hasCustomer = false,
  customerId = null,
  outstandingInvoices = [],
}: {
  invoiceId: string;
  remaining: number;
  customerBalance?: number;
  hasCustomer?: boolean;
  /** Needed to distribute the payment across the customer's other
   * outstanding invoices — null for invoices with no linked customer. */
  customerId?: string | null;
  /** All of this customer's UNPAID/PARTIALLY_PAID invoices, current one
   * included. Empty when there's no linked customer. */
  outstandingInvoices?: OutstandingInvoiceRow[];
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        outstandingInvoices.length > 0
          ? outstandingInvoices.map((inv) => inv.id)
          : [invoiceId],
      ),
  );
  const [amount, setAmount] = useState(() =>
    outstandingInvoices.length > 0
      ? outstandingInvoices.reduce(
          (sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount),
          0,
        )
      : remaining,
  );
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const canDistribute = Boolean(customerId) && outstandingInvoices.length > 0;

  const selectedInvoices = outstandingInvoices.filter((inv) =>
    selectedIds.has(inv.id),
  );
  const selectedTotal = selectedInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const selectedPaidSoFar = selectedInvoices.reduce(
    (sum, inv) => sum + inv.paidAmount,
    0,
  );
  const selectedRemaining = selectedInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount),
    0,
  );
  const allSelected =
    outstandingInvoices.length > 0 &&
    selectedIds.size === outstandingInvoices.length;

  function applySelection(nextIds: Set<string>) {
    setSelectedIds(nextIds);
    const nextRemaining = outstandingInvoices
      .filter((inv) => nextIds.has(inv.id))
      .reduce((sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount), 0);
    setAmount(nextRemaining);
  }

  function toggleInvoice(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applySelection(next);
  }

  function toggleSelectAll() {
    if (allSelected) {
      applySelection(new Set());
    } else {
      applySelection(new Set(outstandingInvoices.map((inv) => inv.id)));
    }
  }

  function handleMethodChange(value: string | null) {
    if (!value) return;
    const nextMethod = value as PaymentMethod;
    setMethod(nextMethod);
    if (nextMethod === "BALANCE") {
      const cappedByRemaining = canDistribute ? selectedRemaining : remaining;
      setAmount(Math.min(customerBalance, cappedByRemaining));
    }
  }

  const [confirmRequest, setConfirmRequest] = useState<BalanceConfirmRequest | null>(
    null,
  );
  const [pending, setPending] = useState<{
    invoiceIds: string[];
    amount: number;
    method: PaymentMethod;
    note: string;
  } | null>(null);

  function submitPayment(
    invoiceIds: string[],
    paidAmount: number,
    paidMethod: PaymentMethod,
    note: string,
    options?: {
      excessToBalance?: boolean;
      allowNegativeBalance?: boolean;
      thenAlsoBalance?: number;
    },
  ) {
    startTransition(async () => {
      if (!customerId) {
        const result = await recordPayment(invoiceId, {
          amount: paidAmount,
          method: paidMethod,
          note,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(t.purchases.paymentRecordedToast);
        setOpen(false);
        return;
      }

      const result = await recordPaymentAcrossInvoices(customerId, {
        invoiceIds,
        amount: paidAmount,
        method: paidMethod,
        note,
        excessToBalance: options?.excessToBalance,
        allowNegativeBalance: options?.allowNegativeBalance,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (options?.thenAlsoBalance && options.thenAlsoBalance > 0) {
        const second = await recordPaymentAcrossInvoices(customerId, {
          invoiceIds,
          amount: options.thenAlsoBalance,
          method: "BALANCE",
        });
        if (second.error) {
          toast.error(second.error);
          return;
        }
      }

      toast.success(t.purchases.paymentRecordedToast);
      setOpen(false);
    });
  }

  function handleSubmit(formData: FormData) {
    const note = String(formData.get("note") ?? "").trim();

    if (canDistribute && selectedIds.size === 0) {
      toast.error(t.invoices.selectAtLeastOneInvoice);
      return;
    }

    if (!(amount > 0)) {
      toast.error(t.invoices.invalidAmount);
      return;
    }

    if (method === "BALANCE" && !hasCustomer) {
      toast.error(t.invoices.noCustomerForBalance);
      return;
    }

    const invoiceIds = canDistribute ? Array.from(selectedIds) : [invoiceId];

    if (!canDistribute) {
      // No linked customer (or no other outstanding invoices to pick from):
      // fall back to the simple single-invoice flow, capped at its own
      // remaining — there's no رصيد to route an excess into.
      if (amount > remaining + 0.005) {
        toast.error(t.invoices.invalidAmount);
        return;
      }
      submitPayment(invoiceIds, amount, method, note);
      return;
    }

    const request = checkMultiInvoicePaymentConfirmation({
      selectedRemaining,
      method,
      amount,
      customerBalance,
    });
    if (request) {
      setPending({ invoiceIds, amount, method, note });
      setConfirmRequest(request);
      return;
    }

    submitPayment(invoiceIds, amount, method, note);
  }

  function cancelConfirm() {
    setConfirmRequest(null);
    setPending(null);
  }

  function resolveUseAvailable() {
    if (!pending || confirmRequest?.kind !== "insufficient") return;
    setConfirmRequest(null);
    submitPayment(
      pending.invoiceIds,
      confirmRequest.availableBalance,
      "BALANCE",
      pending.note,
    );
  }

  function resolveGoNegative() {
    if (!pending) return;
    setConfirmRequest(null);
    submitPayment(pending.invoiceIds, pending.amount, pending.method, pending.note, {
      allowNegativeBalance: true,
    });
  }

  function resolveUseBalance() {
    if (!pending || confirmRequest?.kind !== "offer-balance") return;
    const balanceAmount = Math.min(
      confirmRequest.remaining,
      confirmRequest.availableBalance,
    );
    setConfirmRequest(null);
    submitPayment(pending.invoiceIds, pending.amount, pending.method, pending.note, {
      thenAlsoBalance: balanceAmount,
    });
  }

  function resolveDecline() {
    if (!pending) return;
    setConfirmRequest(null);
    submitPayment(pending.invoiceIds, pending.amount, pending.method, pending.note);
  }

  function resolveAddExcessToBalance() {
    if (!pending) return;
    setConfirmRequest(null);
    submitPayment(pending.invoiceIds, pending.amount, pending.method, pending.note, {
      excessToBalance: true,
    });
  }

  function resolveDiscardExcess() {
    if (!pending) return;
    setConfirmRequest(null);
    submitPayment(pending.invoiceIds, pending.amount, pending.method, pending.note, {
      excessToBalance: false,
    });
  }

  const remainingAfterPayment = Math.max(0, selectedRemaining - amount);
  const excessFromPayment = Math.max(0, amount - selectedRemaining);

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="cursor-pointer" size="sm">
            <Wallet className="size-4" />
            {t.invoices.recordPayment}
          </Button>
        }
      />
      <DialogContent className={canDistribute ? "sm:max-w-lg" : undefined}>
        <DialogHeader>
          <DialogTitle>{t.invoices.recordPayment}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
        <fieldset disabled={isPending} className="contents space-y-4">
          {canDistribute && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t.invoices.selectInvoicesToPayTitle}</Label>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                  onClick={toggleSelectAll}
                >
                  {t.invoices.selectAllInvoices}
                </button>
              </div>
              <div
                className={cn(
                  "space-y-1.5 rounded-lg border p-2",
                  outstandingInvoices.length > 4 && "max-h-56 overflow-y-auto",
                )}
              >
                {outstandingInvoices.map((invoice) => {
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
                            {new Date(invoice.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </span>
                          <span>
                            {t.invoices.invoiceTotalLabel}:{" "}
                            {formatCurrency(invoice.total, locale)}
                          </span>
                          <span>
                            {t.invoices.totalPaidLabel}:{" "}
                            {formatCurrency(invoice.paidAmount, locale)}
                          </span>
                          <span className="font-medium text-foreground">
                            {t.invoices.remainingBalance}:{" "}
                            {formatCurrency(invoiceRemaining, locale)}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-2.5 text-center text-xs">
                <div>
                  <p className="text-muted-foreground">
                    {t.invoices.selectedInvoicesTotal}
                  </p>
                  <p className="font-medium">{formatCurrency(selectedTotal, locale)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t.invoices.selectedInvoicesPaidSoFar}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(selectedPaidSoFar, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t.invoices.selectedInvoicesRemaining}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(selectedRemaining, locale)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t.invoices.amountPaid}</Label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.valueAsNumber || 0)}
              required
            />
            {canDistribute ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {t.invoices.currentPaymentAmount}: {formatCurrency(amount, locale)}
                </span>
                {excessFromPayment > 0.005 ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {t.invoices.excessFromThisPayment}:{" "}
                    {formatCurrency(excessFromPayment, locale)}
                  </span>
                ) : (
                  <span>
                    {t.invoices.remainingAfterThisPayment}:{" "}
                    {formatCurrency(remainingAfterPayment, locale)}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.invoices.remainingBalance}: {formatCurrency(remaining, locale)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t.invoices.paymentMethod}</Label>
            <Select value={method} onValueChange={handleMethodChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    t.statusLabels.paymentMethod[
                      value as keyof typeof t.statusLabels.paymentMethod
                    ] ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.statusLabels.paymentMethod[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {method === "BALANCE" && (
              <p
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs",
                  !hasCustomer
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
                )}
              >
                {!hasCustomer
                  ? t.invoices.noCustomerForBalance
                  : `${t.invoices.availableBalance}: ${formatCurrency(customerBalance, locale)}`}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-note">
              {t.customers.notesOptionalLabel}
            </Label>
            <Textarea id="payment-note" name="note" rows={2} />
          </div>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </fieldset>
        </form>
      </DialogContent>
    </Dialog>

    <BalanceConfirmDialog
      request={confirmRequest}
      onCancel={cancelConfirm}
      onUseAvailable={resolveUseAvailable}
      onGoNegative={resolveGoNegative}
      onUseBalance={resolveUseBalance}
      onDecline={resolveDecline}
      onAddExcessToBalance={resolveAddExcessToBalance}
      onDiscardExcess={resolveDiscardExcess}
    />
    </>
  );
}
