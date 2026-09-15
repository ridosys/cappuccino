"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/users/schema";
import { resetUserPassword } from "@/features/users/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

export function ResetPasswordDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function onSubmit(values: ResetPasswordInput) {
    startTransition(async () => {
      const result = await resetUserPassword(userId, values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.users.toastPasswordReset);
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset on open and close: the form outlives the dialog content, so a
        // typed-then-cancelled password must not keep the page flagged dirty.
        reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            title={t.users.resetPasswordButton}
          >
            <KeyRound className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.users.resetPasswordTitle}</DialogTitle>
          <DialogDescription>
            {t.users.resetPasswordDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={isPending} className="contents space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password-new">
                {t.users.newPasswordLabel}
              </Label>
              <Input
                id="reset-password-new"
                type="password"
                dir="ltr"
                autoFocus
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? t.common.saving : t.common.save}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
