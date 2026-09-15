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
import { useT } from "@/i18n/locale-provider";

type DeleteResult = { error?: string } | void;

export function ConfirmDeleteDialog({
  action,
  description,
  trigger,
}: {
  action: () => Promise<DeleteResult>;
  description?: string;
  trigger?: React.ReactElement;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="icon-sm">
              <Trash2 className="size-4" />
            </Button>
          )
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.common.confirmDeleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t.common.confirmDeleteDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.deleting : t.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
