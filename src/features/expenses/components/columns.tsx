"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteExpense } from "@/features/expenses/actions";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  date: Date;
  createdByName: string | null;
};

export function getExpenseColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: Locale,
): ColumnDef<ExpenseRow>[] {
  return [
    {
      id: "category",
      header: t.expenses.columnCategory,
      cell: ({ row }) => (
        <Badge variant="secondary">
          {t.statusLabels.expenseCategory[
            row.original.category as keyof typeof t.statusLabels.expenseCategory
          ] ?? row.original.category}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: t.expenses.columnAmount,
      cell: ({ row }) => formatCurrency(row.original.amount, locale),
    },
    {
      id: "description",
      header: t.expenses.columnDescription,
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      id: "date",
      header: t.expenses.columnDate,
      cell: ({ row }) =>
        new Date(row.original.date).toLocaleDateString("fr-FR"),
    },
    {
      id: "createdBy",
      header: t.common.createdByLabel,
      cell: ({ row }) => row.original.createdByName ?? t.common.unknownEmployee,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={editHref(row.original.id)} />}
          >
            <Pencil className="size-4" />
          </Button>
          <ConfirmDeleteDialog
            action={() => deleteExpense(row.original.id)}
            description={t.expenses.deleteDescription}
          />
        </div>
      ),
    },
  ];
}
