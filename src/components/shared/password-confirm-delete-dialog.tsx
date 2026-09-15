"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
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
import { useT } from "@/i18n/locale-provider";

type DeleteResult = { error?: string } | void;

export function PasswordConfirmDeleteDialog({
  action,
  description,
  trigger,
}: {
  action: (password: string) => Promise<DeleteResult>;
  description?: string;
  trigger?: React.ReactElement;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setPassword("");
  }

  function handleConfirm() {
    if (!password) return;
    startTransition(async () => {
      const result = await action(password);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setPassword("");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            {t.common.confirmDeleteTitle}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {description ?? t.common.confirmDeleteDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-1">
          <Label htmlFor="delete-confirm-password">{t.common.deletePasswordLabel}</Label>
          <Input
            id="delete-confirm-password"
            type="password"
            dir="ltr"
            autoFocus
            disabled={isPending}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleConfirm();
              }
            }}
            placeholder={t.common.deletePasswordPlaceholder}
          />
        </div>
        <AlertDialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending || !password}
            onClick={handleConfirm}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.deleting : t.common.delete}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
