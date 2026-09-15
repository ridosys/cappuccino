"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePurchaseOrderLanguage } from "@/features/purchases/actions";
import { INVOICE_LANGUAGE_LABELS } from "@/features/invoices/schema";
import { useLocale } from "@/i18n/locale-provider";
import type { InvoiceLanguage } from "@/generated/prisma/client";

/** Edits the language a purchase order prints in, straight from its detail
 * page — the single "print" button and the table's print shortcut both use
 * this saved value. */
export function PurchaseOrderLanguageSelect({
  purchaseOrderId,
  language,
}: {
  purchaseOrderId: string;
  language: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  function handleChange(value: string | null) {
    if (!value || value === language) return;
    startTransition(async () => {
      const result = await updatePurchaseOrderLanguage(
        purchaseOrderId,
        value as InvoiceLanguage,
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.purchases.languageUpdatedToast);
    });
  }

  return (
    <Select value={language} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {(value: string) => INVOICE_LANGUAGE_LABELS[value] ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(INVOICE_LANGUAGE_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
