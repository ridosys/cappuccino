"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/features/customers/components/customer-picker";
import { OrderCustomerEditSheet } from "@/features/orders/components/order-customer-edit-sheet";
import { InvoiceLockedNotice } from "@/features/orders/components/invoice-locked-notice";
import { reassignOrderCustomer } from "@/features/orders/actions";
import { useLocale } from "@/i18n/locale-provider";

type OrderCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
} | null;

export function OrderCustomerCard({
  orderId,
  customers,
  currentCustomer,
  snapshot,
  createdAt,
  notes,
  locked = false,
  invoiceId,
  invoiceNumber,
}: {
  orderId: string;
  customers: CustomerOption[];
  currentCustomer: OrderCustomer;
  snapshot: { name: string; phone: string; email: string | null };
  createdAt: Date;
  notes: string | null;
  locked?: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  function handleReassign(customer: CustomerOption | null) {
    if (!customer) return;
    startTransition(async () => {
      const result = await reassignOrderCustomer(orderId, {
        customerId: customer.id,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.orders.customerChangedToast);
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t.orders.customerInfoTitle}</CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={() => setEditOpen(true)}
            title={t.customers.editCustomerInfo}
          >
            <Pencil className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t.orders.nameLabel}: </span>
            {snapshot.name}
          </p>
          <p>
            <span className="text-muted-foreground">{t.orders.phoneLabel}: </span>
            <span dir="ltr">{snapshot.phone}</span>
          </p>
          {snapshot.email && (
            <p>
              <span className="text-muted-foreground">{t.orders.emailLabel}: </span>
              <span dir="ltr">{snapshot.email}</span>
            </p>
          )}
          <p>
            <span className="text-muted-foreground">{t.orders.orderDateLabel}: </span>
            {new Date(createdAt).toLocaleDateString("fr-FR")}
          </p>
          {notes && (
            <p>
              <span className="text-muted-foreground">{t.orders.notesLabel}: </span>
              {notes}
            </p>
          )}

          <div className="space-y-1.5 border-t pt-3">
            {locked && invoiceId && invoiceNumber ? (
              <InvoiceLockedNotice
                invoiceId={invoiceId}
                invoiceNumber={invoiceNumber}
                message={t.orders.invoiceLockedCustomerMessage}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t.customers.changeCustomer}
                </p>
                <fieldset disabled={isPending} className="contents">
                  <CustomerPicker
                    customers={customers}
                    value={currentCustomer?.id ?? ""}
                    onChange={handleReassign}
                  />
                </fieldset>
                {isPending && (
                  <p className="text-xs text-muted-foreground">
                    {t.common.updating}
                  </p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <OrderCustomerEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        orderId={orderId}
        customer={currentCustomer}
        snapshot={snapshot}
      />
    </>
  );
}
