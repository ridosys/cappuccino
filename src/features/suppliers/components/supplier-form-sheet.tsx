"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  supplierSchema,
  type SupplierInput,
} from "@/features/suppliers/schema";
import { createSupplier, updateSupplier } from "@/features/suppliers/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type SupplierRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
} | null;

export function SupplierFormSheet({
  open,
  supplier,
}: {
  open: boolean;
  supplier?: SupplierRecord;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(values: SupplierInput) {
    startTransition(async () => {
      const result = supplier
        ? await updateSupplier(supplier.id, values)
        : await createSupplier(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(supplier ? t.suppliers.toastUpdated : t.suppliers.toastCreated);
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={supplier ? t.suppliers.editSupplierInfo : t.suppliers.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supplier-name">{t.suppliers.nameLabel}</Label>
          <Input id="supplier-name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-phone">{t.suppliers.phoneOptionalLabel}</Label>
          <Input id="supplier-phone" dir="ltr" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-email">{t.customers.emailOptionalLabel}</Label>
          <Input id="supplier-email" dir="ltr" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-address">{t.customers.addressOptionalLabel}</Label>
          <Input id="supplier-address" {...register("address")} />
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
