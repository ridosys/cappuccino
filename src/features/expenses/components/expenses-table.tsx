"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import {
  getExpenseColumns,
  type ExpenseRow,
} from "@/features/expenses/components/columns";
import { deleteExpenses } from "@/features/expenses/actions";
import { useLocale } from "@/i18n/locale-provider";

export function ExpensesTable({ data }: { data: ExpenseRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();

  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("edit", id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <DataTable
      columns={getExpenseColumns(editHref, t, locale)}
      data={data}
      onDeleteSelected={deleteExpenses}
    />
  );
}
