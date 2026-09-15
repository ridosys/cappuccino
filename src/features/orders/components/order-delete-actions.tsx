"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import {
  InvoiceDeleteDialog,
  type InvoiceDeleteInfo,
} from "@/features/invoices/components/invoice-delete-dialog";
import { deleteOrder } from "@/features/orders/actions";
import { useT } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

/**
 * Delete controls for the order detail page. While the order has an invoice
 * the only delete offered is "delete invoice" (which reverses its stock and
 * cancels the order); once there's no invoice, "delete order" removes the
 * order and returns to the list.
 */
export function OrderDeleteActions({
  orderId,
  orderNumber,
  invoice,
}: {
  orderId: string;
  orderNumber: string;
  invoice: InvoiceDeleteInfo | null;
}) {
  const t = useT();
  const router = useRouter();

  const triggerButton = (label: string) => (
    <Button
      variant="outline"
      className="w-full cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" />
      {label}
    </Button>
  );

  if (invoice) {
    return (
      <InvoiceDeleteDialog
        invoice={invoice}
        trigger={triggerButton(t.orders.deleteInvoiceButton)}
      />
    );
  }

  return (
    <ConfirmDeleteDialog
      action={async () => {
        const result = await deleteOrder(orderId);
        if (result?.error) return result;
        router.push("/dashboard/orders");
      }}
      description={formatMessage(t.orders.deleteDescription, {
        number: orderNumber,
      })}
      trigger={triggerButton(t.orders.deleteOrderButton)}
    />
  );
}
