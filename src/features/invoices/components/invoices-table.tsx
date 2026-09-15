"use client";

import { useMemo, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import {
  getInvoiceColumns,
  type InvoiceRow,
} from "@/features/invoices/components/columns";
import { InvoiceBalanceDeleteContent } from "@/features/invoices/components/invoice-delete-dialog";
import { deleteInvoices } from "@/features/invoices/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

const PAGE_SIZE = 10;
const ALL_STATUSES = "all";

export function InvoicesTable({
  data,
  searchable = false,
}: {
  data: InvoiceRow[];
  searchable?: boolean;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);

  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!searchable) return data;
    return data.filter((invoice) => {
      const matchesQuery =
        !trimmed || invoice.invoiceNumber.toLowerCase().includes(trimmed);
      const matchesStatus = status === ALL_STATUSES || invoice.paymentStatus === status;
      return matchesQuery && matchesStatus;
    });
  }, [data, searchable, trimmed, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = searchable
    ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : filtered;

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusChange(value: string | null) {
    if (!value) return;
    setStatus(value);
    setPage(1);
  }

  // Bulk delete must ask about كل فاتورة تغيّر رصيد العميل on its own —
  // never apply one answer to the whole selection. This queues the
  // invoices that need a decision and resolves them one dialog at a time.
  const [queueInvoice, setQueueInvoice] = useState<InvoiceRow | null>(null);
  const resolverRef = useRef<((applyBalanceChange: boolean) => void) | null>(null);

  function askApplyBalanceChange(invoice: InvoiceRow): Promise<boolean> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setQueueInvoice(invoice);
    });
  }

  function answerQueue(applyBalanceChange: boolean) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setQueueInvoice(null);
    resolve?.(applyBalanceChange);
  }

  async function handleBulkDelete(ids: string[], password?: string) {
    const decisions: { id: string; applyBalanceChange?: boolean }[] = [];
    for (const id of ids) {
      const invoice = data.find((row) => row.id === id);
      if (invoice && Math.abs(invoice.balanceEffectApplied) > 0.005) {
        const applyBalanceChange = await askApplyBalanceChange(invoice);
        decisions.push({ id, applyBalanceChange });
      } else {
        decisions.push({ id });
      }
    }
    return deleteInvoices(decisions, password);
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={t.invoices.searchPlaceholder}
              className="pe-9"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t.invoices.allStatuses}>
                {(value: string) =>
                  value === ALL_STATUSES || !value
                    ? t.invoices.allStatuses
                    : t.statusLabels.paymentStatus[
                        value as keyof typeof t.statusLabels.paymentStatus
                      ]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>{t.invoices.allStatuses}</SelectItem>
              {Object.entries(t.statusLabels.paymentStatus).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <DataTable
        columns={getInvoiceColumns(t, locale)}
        data={paged}
        onDeleteSelected={handleBulkDelete}
        requireDeletePassword
      />
      <AlertDialog
        open={Boolean(queueInvoice)}
        onOpenChange={(open) => {
          if (!open) answerQueue(false);
        }}
      >
        <AlertDialogContent>
          {queueInvoice && (
            <InvoiceBalanceDeleteContent
              invoice={queueInvoice}
              onConfirm={(applyBalanceChange) => answerQueue(applyBalanceChange)}
              onCancel={() => answerQueue(false)}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
      {searchable && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {formatMessage(t.common.paginationSummary, {
              total: filtered.length.toLocaleString(locale),
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
              <ChevronLeft className="size-4 rtl:rotate-180" />
              {t.common.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {t.common.next}
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
