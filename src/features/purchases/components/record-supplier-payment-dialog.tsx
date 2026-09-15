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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordSupplierPayment } from "@/features/purchases/actions";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import type { PaymentMethod } from "@/generated/prisma/client";

const PAYMENT_METHODS_NO_BALANCE: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "OTHER",
  "BALANCE",
];

export function RecordSupplierPaymentDialog({
  purchaseOrderId,
  remaining,
  supplierBalance,
}: {
  purchaseOrderId: string;
  remaining: number;
  supplierBalance: number;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(remaining);
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setAmount(remaining);
  }

  function handleMethodChange(value: string | null) {
    if (!value) return;
    setMethod(value as PaymentMethod);
  }

  function handleSubmit(formData: FormData) {
    const note = String(formData.get("note") ?? "").trim();

    if (!(amount > 0)) {
      toast.error(t.purchases.invalidAmountToast);
      return;
    }
    if (amount > remaining + 0.005) {
      toast.error(t.purchases.amountExceedsRemainingToast);
      return;
    }
    if (method === "BALANCE" && amount > supplierBalance + 0.005) {
      toast.error(t.suppliers.insufficientBalance);
      return;
    }

    startTransition(async () => {
      const result = await recordSupplierPayment(purchaseOrderId, {
        amount,
        method,
        note,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.purchases.paymentRecordedToast);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="cursor-pointer" size="sm">
            <Wallet className="size-4" />
            {t.purchases.recordPaymentButton}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.purchases.recordPaymentDialogTitle}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <fieldset disabled={isPending} className="contents space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-amount">{t.purchases.paymentAmountLabel}</Label>
              <Input
                id="supplier-payment-amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.valueAsNumber || 0)
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                {t.purchases.remainingAmountLabel}: {formatCurrency(remaining, locale)}
              </p>
              {method === "BALANCE" && <p className="text-xs text-muted-foreground">{t.suppliers.availableBalance}: {formatCurrency(supplierBalance, locale)}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t.purchases.paymentMethodLabel}</Label>
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
                  {PAYMENT_METHODS_NO_BALANCE.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t.statusLabels.paymentMethod[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-note">{t.purchases.noteOptionalLabel}</Label>
              <Textarea id="supplier-payment-note" name="note" rows={2} />
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
  );
}
