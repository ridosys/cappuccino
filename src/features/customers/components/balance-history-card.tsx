"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

const PAGE_SIZE = 10;

type BalanceHistoryRow = {
  id: string;
  invoiceNumber: string | null;
  previousBalance: number;
  change: number;
  newBalance: number;
  reason: string;
  note: string | null;
  createdAt: Date;
};

export function BalanceHistoryCard({ entries }: { entries: BalanceHistoryRow[] }) {
  const [page, setPage] = useState(1);
  const { t, locale } = useLocale();

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = entries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.customers.balanceHistory}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.customers.noBalanceHistory}
          </p>
        ) : (
          <>
            <ul className="space-y-3 text-sm">
              {paged.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {t.statusLabels.balanceChangeReason[
                          entry.reason as keyof typeof t.statusLabels.balanceChangeReason
                        ] ?? entry.reason}
                      </Badge>
                      {entry.invoiceNumber && (
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {entry.invoiceNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.customers.previousBalance}: {formatCurrency(entry.previousBalance, locale)}
                      {" · "}
                      {t.customers.newBalance}: {formatCurrency(entry.newBalance, locale)}
                    </p>
                    {entry.note && (
                      <p className="text-xs text-muted-foreground">{entry.note}</p>
                    )}
                  </div>
                  <div className="text-end">
                    <p
                      className={
                        entry.change < 0
                          ? "font-medium text-destructive"
                          : "font-medium text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {entry.change > 0 ? "+" : ""}
                      {formatCurrency(entry.change, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {pageCount > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {formatMessage(t.common.paginationSummary, {
                    total: entries.length.toLocaleString(locale),
                    page: currentPage.toLocaleString(locale),
                    pageCount: pageCount.toLocaleString(locale),
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                    {t.common.previous}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    {t.common.next}
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
