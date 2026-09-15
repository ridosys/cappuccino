"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { deleteSalesReturn } from "@/features/returns/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export function DeleteSalesReturnButton({
  id,
  returnNumber,
}: {
  id: string;
  returnNumber: string;
}) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <PasswordConfirmDeleteDialog
      action={async (password) => {
        const result = await deleteSalesReturn(id, password);
        if (!result?.error) {
          router.push("/dashboard/sales-returns");
        }
        return result;
      }}
      description={formatMessage(t.returns.deleteSalesDescription, {
        number: returnNumber,
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
