"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updatePurchaseOrderDate } from "@/features/purchases/actions";
import { useLocale } from "@/i18n/locale-provider";

/** A Date -> "YYYY-MM-DD" for <input type="date">, using local calendar
 * parts so the shown value matches how it's saved back (noon local). */
function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Inline editor for a purchase order's date (createdAt) — saves on change. */
export function PurchaseOrderDateField({
  purchaseOrderId,
  date,
}: {
  purchaseOrderId: string;
  date: Date;
}) {
  const { t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(() => toDateInputValue(date));

  function handleChange(next: string) {
    if (!next || next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updatePurchaseOrderDate(purchaseOrderId, next);
      if (result?.error) {
        toast.error(result.error);
        setValue(previous);
        return;
      }
      toast.success(t.purchases.dateUpdatedToast);
    });
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">
        {t.reports.columnDate}
      </span>
      <Input
        type="date"
        value={value}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full"
      />
    </div>
  );
}
