import "server-only";
import type { Prisma, BalanceChangeReason } from "@/generated/prisma/client";

type PaymentLike = { amount: number | string | { toString(): string }; method: string };

export function sumBalancePayments(payments: PaymentLike[]) {
  return payments
    .filter((payment) => payment.method === "BALANCE")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function sumAllPayments(payments: PaymentLike[]) {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

/**
 * The single source of truth for how an invoice's payments translate into a
 * رصيد change: من الرصيد draws money straight out of the account (negative),
 * any amount paid beyond the invoice's total becomes credit (positive), and
 * real cash that merely settles the total never touches رصيد at all.
 *
 * Always fed the FULL, already-resolved set of payments for an invoice (not
 * just the newest one), so callers only need to diff the result against
 * whatever was applied last time — see adjustCustomerBalance callers.
 */
export function computeBalanceEffect(total: number, payments: PaymentLike[]) {
  const balanceSum = sumBalancePayments(payments);
  const paidAmount = sumAllPayments(payments);
  return Math.max(0, paidAmount - total) - balanceSum;
}

export async function adjustCustomerBalance(
  tx: Prisma.TransactionClient,
  customerId: string,
  delta: number,
  context: {
    reason: BalanceChangeReason;
    invoiceId?: string;
    invoiceNumber?: string;
    note?: string;
  },
) {
  if (Math.abs(delta) < 0.005) return;

  const updated = await tx.customer.update({
    where: { id: customerId },
    data: { balance: { increment: delta } },
    select: { balance: true },
  });
  const newBalance = Number(updated.balance);
  const previousBalance = newBalance - delta;

  await tx.customerBalanceHistory.create({
    data: {
      customerId,
      invoiceId: context.invoiceId,
      invoiceNumber: context.invoiceNumber,
      previousBalance,
      change: delta,
      newBalance,
      reason: context.reason,
      note: context.note || null,
    },
  });
}
