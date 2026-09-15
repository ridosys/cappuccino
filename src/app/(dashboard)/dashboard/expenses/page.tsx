import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getExpensesPage, getExpenseById } from "@/features/expenses/queries";
import { ExpensesTable } from "@/features/expenses/components/expenses-table";
import { ExpenseFormSheet } from "@/features/expenses/components/expense-form-sheet";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
import { formatCurrency } from "@/lib/currency";
import type { ExpenseCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    category?: string;
    new?: string;
    edit?: string;
  }>;
}) {
  await requirePageAccess("EXPENSES_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const category = params.category as ExpenseCategory | undefined;

  const [t, locale, { items, total, pageSize, totalAmount }, editingExpense] =
    await Promise.all([
      getDictionary(),
      getLocale(),
      getExpensesPage({ category, page }),
      params.edit ? getExpenseById(params.edit) : Promise.resolve(null),
    ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (page > 1) sp.set("page", String(page));
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/expenses?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.expenses}
        icon={Receipt}
        description={`${t.expenses.totalLabel}: ${formatCurrency(Number(totalAmount), locale)}`}
        action={
          <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
            <Plus className="size-4" />
            {t.expenses.addButton}
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t.expenses.emptyTitle}
          description={t.expenses.emptyDescription}
        />
      ) : (
        <>
          <ExpensesTable
            data={items.map((item) => ({
              id: item.id,
              category: item.category,
              amount: Number(item.amount),
              description: item.description,
              date: item.date,
              createdByName: item.createdBy?.name ?? null,
            }))}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/expenses"
            searchParams={{}}
          />
        </>
      )}
      <ExpenseFormSheet
        key={editingExpense?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        expense={
          editingExpense
            ? { ...editingExpense, amount: Number(editingExpense.amount) }
            : null
        }
      />
    </div>
  );
}
