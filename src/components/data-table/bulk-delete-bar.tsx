"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

type DeleteResult = { error?: string } | void;

export function BulkDeleteBar({
  count,
  onConfirm,
  onClearSelection,
  requirePassword = false,
  description,
}: {
  count: number;
  onConfirm: (password?: string) => Promise<DeleteResult>;
  onClearSelection: () => void;
  /** When true, shows a password field and withholds delete until it's
   * filled in — used for entities where deleting in bulk should require
   * the same DELETE_CONFIRM_PASSWORD as single-row deletes. */
  requirePassword?: boolean;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setPassword("");
  }

  function handleConfirm() {
    if (requirePassword && !password) return;
    const pendingPassword = password;
    // Close this dialog before the async work starts (rather than after it
    // succeeds): some selections trigger a second, separate confirmation
    // dialog per invoice (رصيد effect) partway through, and leaving this
    // modal open stacks two modals at once — the still-open one traps focus
    // and blocks any interaction with the one underneath, so the operation
    // looks stuck on "جاري الحذف..." forever.
    setOpen(false);
    setPassword("");
    startTransition(async () => {
      const result = await onConfirm(
        requirePassword ? pendingPassword : undefined,
      );
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-sm font-medium">
        {formatMessage(t.common.itemsSelectedTemplate, {
          count: count.toLocaleString(locale),
        })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={onClearSelection}
        >
          {t.common.clearSelection}
        </Button>
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                {t.common.deleteSelected}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.common.confirmDeleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {description ??
                  formatMessage(t.common.bulkDeleteConfirmDescription, {
                    count: count.toLocaleString(locale),
                  })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {requirePassword && (
              <div className="space-y-2 px-1">
                <Label htmlFor="bulk-delete-password">{t.common.deletePasswordLabel}</Label>
                <Input
                  id="bulk-delete-password"
                  type="password"
                  dir="ltr"
                  autoFocus
                  disabled={isPending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t.common.deletePasswordPlaceholder}
                />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending || (requirePassword && !password)}
                onClick={handleConfirm}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? t.common.deleting : t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
