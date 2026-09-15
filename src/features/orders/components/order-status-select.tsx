"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus } from "@/features/orders/actions";
import { GenerateInvoiceDialog } from "@/features/orders/components/generate-invoice-dialog";
import { useLocale } from "@/i18n/locale-provider";
import type { OrderStatus } from "@/generated/prisma/client";

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
];

export function OrderStatusSelect({
  orderId,
  status,
  hasInvoice,
  orderTotal,
  customerBalance = 0,
  hasCustomer = false,
}: {
  orderId: string;
  status: string;
  hasInvoice: boolean;
  orderTotal: number;
  customerBalance?: number;
  hasCustomer?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const { t } = useLocale();

  function handleChange(value: string | null) {
    if (!value || value === status) return;

    // Completing an order means issuing its invoice — open the Generate
    // Invoice dialog instead of flipping the status directly. Confirming it
    // creates the invoice, books the stock OUT and marks the order COMPLETED.
    if (value === "COMPLETED") {
      if (hasInvoice) {
        toast.error(t.orders.cannotChangeStatusInvoicedError);
        return;
      }
      setInvoiceDialogOpen(true);
      return;
    }

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, value as OrderStatus);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.orders.statusUpdatedToast);
    });
  }

  return (
    <>
      <GenerateInvoiceDialog
        orderId={orderId}
        orderTotal={orderTotal}
        customerBalance={customerBalance}
        hasCustomer={hasCustomer}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        hideTrigger
      />
      <Select value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue>
            {(value: string) =>
              t.statusLabels.order[value as keyof typeof t.statusLabels.order] ??
              value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t.statusLabels.order[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
