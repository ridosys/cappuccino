"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
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
import { updatePayment } from "@/features/invoices/actions";
import { useLocale } from "@/i18n/locale-provider";
import type { PaymentMethod } from "@/generated/prisma/client";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "BALANCE",
  "OTHER",
];

export function EditPaymentDialog({
  paymentId,
  initialAmount,
  initialMethod,
  initialNote,
}: {
  paymentId: string;
  initialAmount: number;
  initialMethod: string;
  initialNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(initialAmount);
  const [method, setMethod] = useState<PaymentMethod>(
    initialMethod as PaymentMethod,
  );
  const [note, setNote] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount(initialAmount);
      setMethod(initialMethod as PaymentMethod);
      setNote(initialNote ?? "");
    }
  }

  function handleMethodChange(value: string | null) {
    if (!value) return;
    setMethod(value as PaymentMethod);
  }

  function handleSubmit() {
    if (!(amount > 0)) {
      toast.error(t.invoices.invalidAmount);
      return;
    }
    startTransition(async () => {
      const result = await updatePayment(paymentId, {
        amount,
        method,
        note: note.trim() || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.invoices.paymentUpdatedToast);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.invoices.editPaymentTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset disabled={isPending} className="contents space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-payment-amount">
                {t.invoices.amountPaid}
              </Label>
              <Input
                id="edit-payment-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.valueAsNumber || 0)
                }
                required
              />
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-note">
                {t.customers.notesOptionalLabel}
              </Label>
              <Textarea
                id="edit-payment-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-full cursor-pointer"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? t.common.saving : t.common.save}
            </Button>
          </fieldset>
        </div>
      </DialogContent>
    </Dialog>
  );
}
