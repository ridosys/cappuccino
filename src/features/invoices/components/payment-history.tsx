"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { EditPaymentDialog } from "@/features/invoices/components/edit-payment-dialog";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { deletePayment } from "@/features/invoices/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  createdAt: Date;
  invoiceNumber?: string;
};

export function PaymentHistory({ payments }: { payments: PaymentRow[] }) {
  const { t, locale } = useLocale();
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(payments.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visiblePayments = payments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.customers.paymentsHistory}</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.invoices.noPayments}
          </p>
        ) : (
          <div className="space-y-4">
          <ul className="space-y-3 text-sm">
            {visiblePayments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{formatCurrency(payment.amount, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.statusLabels.paymentMethod[
                      payment.method as keyof typeof t.statusLabels.paymentMethod
                    ] ?? payment.method}
                    {payment.invoiceNumber ? ` · ${payment.invoiceNumber}` : ""}
                  </p>
                  {payment.note && (
                    <p className="text-xs text-muted-foreground">
                      {payment.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(payment.createdAt)}
                  </p>
                  <EditPaymentDialog
                    paymentId={payment.id}
                    initialAmount={payment.amount}
                    initialMethod={payment.method}
                    initialNote={payment.note}
                  />
                  <PasswordConfirmDeleteDialog
                    action={(password) => deletePayment(payment.id, password)}
                    description={formatMessage(t.invoices.deletePaymentDescription, {
                      amount: formatCurrency(payment.amount, locale),
                    })}
                  />
                </div>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                {formatMessage(t.common.paginationSummary, {
                  total: payments.length.toLocaleString(locale),
                  page: currentPage.toLocaleString(locale),
                  pageCount: pageCount.toLocaleString(locale),
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronRight className="size-4 rtl:block ltr:hidden" />
                  <ChevronLeft className="size-4 ltr:block rtl:hidden" />
                  {t.common.previous}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t.common.next}
                  <ChevronLeft className="size-4 rtl:block ltr:hidden" />
                  <ChevronRight className="size-4 ltr:block rtl:hidden" />
                </Button>
              </div>
            </div>
          )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
