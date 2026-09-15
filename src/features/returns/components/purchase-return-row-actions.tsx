"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { deletePurchaseReturn } from "@/features/returns/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export function PurchaseReturnRowActions({
  id,
  returnNumber,
}: {
  id: string;
  returnNumber: string;
}) {
  const { t } = useLocale();

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href={`/dashboard/purchase-returns/${id}`} />}
        title={t.returns.viewDetails}
      >
        <Eye className="size-4" />
      </Button>
      <PasswordConfirmDeleteDialog
        action={(password) => deletePurchaseReturn(id, password)}
        description={formatMessage(t.returns.deletePurchaseDescription, {
          number: returnNumber,
        })}
      />
    </div>
  );
}
