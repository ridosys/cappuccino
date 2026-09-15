"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deletePurchaseOrder } from "@/features/purchases/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export function DeletePurchaseOrderButton({
  purchaseOrderId,
  orderNumber,
}: {
  purchaseOrderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <ConfirmDeleteDialog
      action={async () => {
        const result = await deletePurchaseOrder(purchaseOrderId);
        if (!result?.error) {
          router.push("/dashboard/purchases");
        }
        return result;
      }}
      description={formatMessage(t.purchases.deleteDescription, {
        number: orderNumber,
      })}
      trigger={
        <Button variant="destructive">
          <Trash2 className="size-4" />
          {t.common.delete}
        </Button>
      }
    />
  );
}
