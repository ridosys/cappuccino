"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
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
  createCustomer,
  updateCustomer,
  findCustomerByPhoneAction,
  findCustomerByNameAction,
} from "@/features/customers/actions";
import { CustomerImageUploader } from "@/features/customers/components/customer-image-uploader";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type MatchingCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  isFavorite: boolean;
  imageUrl: string | null;
  imagePublicId: string | null;
} | null;

export function CustomerFormSheet({
  open,
  customer,
  onOpenChange,
}: {
  open: boolean;
  customer?: CustomerRecord;
  /** Overrides the default URL-param-driven close behavior (used on the customers list page). */
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
      isFavorite: customer?.isFavorite ?? false,
      image:
        customer?.imageUrl && customer?.imagePublicId
          ? { publicId: customer.imagePublicId, secureUrl: customer.imageUrl }
          : null,
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  const phoneValue = watch("phone");
  const nameValue = watch("name");
  const [matchingCustomers, setMatchingCustomers] = useState<MatchingCustomer[]>(
    [],
  );
  const [nameMatches, setNameMatches] = useState<MatchingCustomer[]>([]);

  useEffect(() => {
    if (!phoneValue || phoneValue.trim().length < 6) {
      setMatchingCustomers([]);
      return;
    }
    const timeout = setTimeout(() => {
      findCustomerByPhoneAction(phoneValue, customer?.id).then(
        setMatchingCustomers,
      );
    }, 400);
    return () => clearTimeout(timeout);
  }, [phoneValue, customer?.id]);

  useEffect(() => {
    if (!nameValue || nameValue.trim().length < 2) {
      setNameMatches([]);
      return;
    }
    const timeout = setTimeout(() => {
      findCustomerByNameAction(nameValue, customer?.id).then(setNameMatches);
    }, 400);
    return () => clearTimeout(timeout);
  }, [nameValue, customer?.id]);

  function close() {
    if (onOpenChange) {
      onOpenChange(false);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(values: CustomerInput) {
    startTransition(async () => {
      const result = customer
        ? await updateCustomer(customer.id, values)
        : await createCustomer(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(customer ? t.customers.toastUpdated : t.customers.toastCreated);
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={customer ? t.customers.formTitleEdit : t.customers.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <Controller
          control={control}
          name="image"
          render={({ field }) => (
            <CustomerImageUploader
              value={field.value ?? null}
              onChange={field.onChange}
              name={nameValue}
              disabled={isPending}
            />
          )}
        />
        <div className="space-y-2">
          <Label htmlFor="customer-name">{t.customers.nameLabel}</Label>
          <Input
            id="customer-name"
            placeholder={t.customers.namePlaceholder}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
          {nameMatches.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
              <p className="mb-1 font-medium">{t.customers.matchingNameHint}</p>
              <ul className="space-y-1">
                {nameMatches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        const params = new URLSearchParams(
                          searchParams.toString(),
                        );
                        params.delete("new");
                        params.set("edit", match.id);
                        router.push(`${pathname}?${params.toString()}`);
                      }}
                    >
                      {match.name}
                      {match.phone ? ` — ${match.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Controller
          control={control}
          name="isFavorite"
          render={({ field }) => (
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              aria-pressed={field.value}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                field.value
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-input hover:bg-muted/50",
              )}
            >
              <Star
                className={cn(
                  "size-5 shrink-0 transition-colors",
                  field.value
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
              <div>
                <p className="text-sm font-medium">{t.customers.favoriteToggleTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {t.customers.favoriteToggleDescription}
                </p>
              </div>
            </button>
          )}
        />
        <div className="space-y-2">
          <Label htmlFor="customer-phone">{t.customers.phoneOptionalLabel}</Label>
          <Input id="customer-phone" dir="ltr" {...register("phone")} />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
          {matchingCustomers.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
              <p className="mb-1 font-medium">
                {t.customers.matchingPhoneHint}
              </p>
              <ul className="space-y-1">
                {matchingCustomers.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        const params = new URLSearchParams(
                          searchParams.toString(),
                        );
                        params.delete("new");
                        params.set("edit", match.id);
                        router.push(`${pathname}?${params.toString()}`);
                      }}
                    >
                      {match.name} — {match.phone}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-email">{t.customers.emailOptionalLabel}</Label>
          <Input id="customer-email" dir="ltr" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-address">{t.customers.addressOptionalLabel}</Label>
          <Input id="customer-address" {...register("address")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-notes">{t.customers.notesOptionalLabel}</Label>
          <Textarea id="customer-notes" rows={3} {...register("notes")} />
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
  );
}
