"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  expenseSchema,
  type ExpenseInput,
  type ExpenseOutput,
} from "@/features/expenses/schema";
import { createExpense, updateExpense } from "@/features/expenses/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type ExpenseRecord = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  date: Date;
} | null;

const EXPENSE_CATEGORIES = [
  "RENT",
  "SALARIES",
  "TRANSPORTATION",
  "UTILITIES",
  "OTHER",
] as const;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ExpenseFormSheet({
  open,
  expense,
}: {
  open: boolean;
  expense?: ExpenseRecord;
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
    formState: { errors, isDirty },
  } = useForm<ExpenseInput, unknown, ExpenseOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: (expense?.category as ExpenseOutput["category"]) ?? "OTHER",
      amount: expense?.amount ? Number(expense.amount) : 0,
      description: expense?.description ?? "",
      date: expense
        ? toDateInputValue(new Date(expense.date))
        : toDateInputValue(new Date()),
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

  function onSubmit(values: ExpenseOutput) {
    startTransition(async () => {
      const result = expense
        ? await updateExpense(expense.id, values)
        : await createExpense(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(expense ? t.expenses.toastUpdated : t.expenses.toastCreated);
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={expense ? t.expenses.formTitleEdit : t.expenses.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label>{t.expenses.categoryLabel}</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (!value) return;
                  field.onChange(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      t.statusLabels.expenseCategory[
                        value as keyof typeof t.statusLabels.expenseCategory
                      ] ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t.statusLabels.expenseCategory[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-amount">{t.expenses.amountLabel}</Label>
          <Input
            id="expense-amount"
            type="number"
            min={0}
            step="0.01"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date">{t.expenses.dateLabel}</Label>
          <Input id="expense-date" type="date" {...register("date")} />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-description">{t.expenses.descriptionLabel}</Label>
          <Textarea
            id="expense-description"
            rows={3}
            {...register("description")}
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
  );
}
