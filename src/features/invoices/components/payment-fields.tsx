"use client";

import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type InvoiceInput,
  type InvoiceOutput,
} from "@/features/invoices/schema";
import { formatCurrency } from "@/lib/currency";
import { computePaymentStatus } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import type { PaymentMethod } from "@/generated/prisma/client";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "BALANCE",
  "OTHER",
];

export function PaymentFieldsSection({
  control,
  errors,
  total,
  customerBalance,
  hasCustomer,
}: {
  control: Control<InvoiceInput, unknown, InvoiceOutput>;
  errors?: FieldErrors<InvoiceInput>;
  total: number;
  customerBalance: number;
  hasCustomer: boolean;
}) {
  const { t, locale } = useLocale();
  const { fields, append, remove } = useFieldArray({ control, name: "payments" });
  const payments = useWatch({ control, name: "payments" }) ?? [];

  const canOfferBalanceShortcut = hasCustomer && customerBalance > 0.005;

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p?.amount) || 0),
    0,
  );
  const remaining = total - totalPaid;
  const previewStatus = computePaymentStatus(total, totalPaid);

  function addBalanceLine() {
    const amount = Math.max(0, Math.min(customerBalance, remaining)) || total;
    append({ method: "BALANCE", amount });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{t.invoices.payments}</Label>
        <div className="flex gap-2">
          {canOfferBalanceShortcut && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={addBalanceLine}
            >
              {t.invoices.availableBalance}: {formatCurrency(customerBalance, locale)}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => append({ method: "CASH", amount: 0 })}
          >
            <Plus className="size-4" />
            {t.invoices.addPayment}
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t.invoices.noPaymentLines}
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const lineMethod = payments[index]?.method;
            return (
              <div
                key={field.id}
                className="grid grid-cols-1 items-start gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <Label className="text-xs">{t.invoices.paymentMethod}</Label>
                  <Controller
                    control={control}
                    name={`payments.${index}.method`}
                    render={({ field: methodField }) => (
                      <Select
                        value={methodField.value}
                        onValueChange={methodField.onChange}
                      >
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
                    )}
                  />
                  {lineMethod === "BALANCE" && (
                    <p
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
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
                <div className="space-y-1">
                  <Label className="text-xs">{t.invoices.amountPaid}</Label>
                  <Controller
                    control={control}
                    name={`payments.${index}.amount`}
                    render={({ field: amountField }) => (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={Number(amountField.value ?? 0)}
                        onChange={(event) =>
                          amountField.onChange(event.target.valueAsNumber)
                        }
                      />
                    )}
                  />
                  {errors?.payments?.[index]?.amount && (
                    <p className="text-sm text-destructive">
                      {errors.payments[index]?.amount?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="hidden text-xs sm:block">&nbsp;</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <PaymentStatusBadge status={previewStatus} />
        <span>
          {t.invoices.totalPaidLabel}: {formatCurrency(totalPaid, locale)}
        </span>
        {remaining > 0.005 && (
          <span className="text-muted-foreground">
            {t.invoices.remainingAfterPayments}: {formatCurrency(remaining, locale)}
          </span>
        )}
        {remaining < -0.005 && (
          <Badge variant="secondary">{t.invoices.overpaidWillBecomeCredit}</Badge>
        )}
      </div>
    </div>
  );
}
