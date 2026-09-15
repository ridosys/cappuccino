"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  customerSchema,
  type CustomerInput,
} from "@/features/customers/schema";
import {
  saveOrderCustomerInfo,
  type ConflictCustomer,
} from "@/features/orders/actions";
import { PhoneConflictDialog } from "@/features/orders/components/phone-conflict-dialog";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function OrderCustomerEditSheet({
  open,
  onOpenChange,
  orderId,
  customer,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  /** The order's currently linked customer, or null if it has none yet. */
  customer: CustomerRecord | null;
  /** The order's own captured name/phone/email, used as defaults when
   * there's no linked customer to prefill from. */
  snapshot: { name: string; phone: string; email: string | null };
}) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();
  const [conflict, setConflict] = useState<{
    existing: ConflictCustomer;
    values: CustomerInput;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? snapshot.name,
      phone: customer?.phone ?? snapshot.phone,
      email: customer?.email ?? snapshot.email ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
      isFavorite: false,
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function submit(
    values: CustomerInput,
    resolution?: Parameters<typeof saveOrderCustomerInfo>[3],
  ) {
    startTransition(async () => {
      const result = await saveOrderCustomerInfo(
        orderId,
        customer?.id ?? null,
        values,
        resolution,
      );

      if (result.conflict) {
        // Close this sheet before opening the conflict dialog: two modal
        // popups open at once trap focus and block each other's clicks.
        onOpenChange(false);
        setConflict({ existing: result.conflict, values });
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(customer ? t.customers.toastUpdated : t.customers.toastCreated);
      reset(values);
      onOpenChange(false);
    });
  }

  function onSubmit(values: CustomerInput) {
    submit(values);
  }

  function resolveConflict(
    action: "update_existing" | "keep_existing" | "force_save",
  ) {
    if (!conflict) return;
    submit(conflict.values, {
      action,
      existingCustomerId: conflict.existing.id,
    });
    setConflict(null);
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(next) => {
          // This sheet isn't remounted on close, and the form lives outside
          // the sheet content — reset so a cancelled edit stops flagging the
          // order page as having unsaved changes.
          if (!next) reset();
          onOpenChange(next);
        }}
        title={customer ? t.orders.editCustomerInfoTitle : t.customers.addCustomerInfoTitle}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={isPending} className="contents space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order-customer-name">{t.customers.nameLabel}</Label>
              <Input
                id="order-customer-name"
                placeholder={t.customers.namePlaceholder}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-customer-phone">{t.customers.phoneOptionalLabel}</Label>
              <Input
                id="order-customer-phone"
                dir="ltr"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-customer-email">
                {t.customers.emailOptionalLabel}
              </Label>
              <Input
                id="order-customer-email"
                dir="ltr"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-customer-address">{t.customers.addressOptionalLabel}</Label>
              <Input id="order-customer-address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-customer-notes">{t.customers.notesOptionalLabel}</Label>
              <Textarea
                id="order-customer-notes"
                rows={3}
                {...register("notes")}
              />
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
      </FormSheet>

      {conflict && (
        <PhoneConflictDialog
          existing={conflict.existing}
          incoming={conflict.values}
          onUpdateExisting={() => resolveConflict("update_existing")}
          onKeepExisting={() => resolveConflict("keep_existing")}
          onCreateNew={() => resolveConflict("force_save")}
          onCancel={() => setConflict(null)}
        />
      )}
    </>
  );
}
