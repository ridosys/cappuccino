"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  posRegisterSchema,
  type PosRegisterInput,
} from "@/features/pos-registers/schema";
import {
  createPosRegister,
  updatePosRegister,
} from "@/features/pos-registers/actions";
import { useLocale } from "@/i18n/locale-provider";

type Option = { id: string; name: string };
type CustomerOption = Option & { phone: string };

export type PosRegisterFormRecord = {
  id: string;
  name: string;
  isActive: boolean;
  customerId: string;
  categoryIds: string[];
  adminIds: string[];
} | null;

function CheckList({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
      {options.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
        >
          <Checkbox
            checked={value.includes(option.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...value, option.id]
                  : value.filter((id) => id !== option.id),
              )
            }
          />
          {option.name}
        </label>
      ))}
    </div>
  );
}

export function PosRegisterFormSheet({
  open,
  register,
  customers,
  categories,
  admins,
}: {
  open: boolean;
  register?: PosRegisterFormRecord;
  customers: CustomerOption[];
  categories: Option[];
  admins: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register: field,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PosRegisterInput>({
    resolver: zodResolver(posRegisterSchema),
    defaultValues: {
      name: register?.name ?? "",
      customerId: register?.customerId ?? "",
      isActive: register?.isActive ?? true,
      categoryIds: register?.categoryIds ?? [],
      adminIds: register?.adminIds ?? [],
    },
  });

  function close() {
    router.push(pathname);
  }

  function onSubmit(values: PosRegisterInput) {
    startTransition(async () => {
      const result = register
        ? await updatePosRegister(register.id, values)
        : await createPosRegister(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        register ? t.posRegisters.toastUpdated : t.posRegisters.toastCreated,
      );
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={
        register ? t.posRegisters.formTitleEdit : t.posRegisters.formTitleAdd
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4">
        <fieldset disabled={isPending} className="contents space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-name">{t.posRegisters.nameLabel}</Label>
            <Input id="register-name" {...field("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">
                {t.posRegisters.validationError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t.posRegisters.customerLabel}</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field: f }) => (
                <Select
                  value={f.value}
                  onValueChange={(next) => next && f.onChange(next)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.posRegisters.customerPlaceholder}>
                      {(id: string) =>
                        customers.find((c) => c.id === id)?.name ?? id
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.customerId && (
              <p className="text-sm text-destructive">
                {t.posRegisters.validationError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t.posRegisters.categoriesLabel}</Label>
            <Controller
              control={control}
              name="categoryIds"
              render={({ field: f }) => (
                <CheckList
                  options={categories}
                  value={f.value}
                  onChange={f.onChange}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t.posRegisters.categoriesHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t.posRegisters.usersLabel}</Label>
            <Controller
              control={control}
              name="adminIds"
              render={({ field: f }) => (
                <CheckList options={admins} value={f.value} onChange={f.onChange} />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t.posRegisters.usersHint}
            </p>
          </div>

          <Controller
            control={control}
            name="isActive"
            render={({ field: f }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={f.value}
                  onCheckedChange={(checked) => f.onChange(checked)}
                />
                {t.posRegisters.activeLabel}
              </label>
            )}
          />

          <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </fieldset>
      </form>
    </FormSheet>
  );
}
