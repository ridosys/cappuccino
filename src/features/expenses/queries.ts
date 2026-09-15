import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExpenseCategory } from "@/generated/prisma/client";

export const EXPENSES_PAGE_SIZE = 10;

export async function getExpensesPage({
  category,
  page,
}: {
  category?: ExpenseCategory;
  page: number;
}) {
  const where = category ? { category } : {};

  const [items, total, totalAmountResult] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * EXPENSES_PAGE_SIZE,
      take: EXPENSES_PAGE_SIZE,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    items,
    total,
    pageSize: EXPENSES_PAGE_SIZE,
    totalAmount: totalAmountResult._sum.amount ?? 0,
  };
}

export async function getExpenseById(id: string) {
  return prisma.expense.findUnique({ where: { id } });
}
