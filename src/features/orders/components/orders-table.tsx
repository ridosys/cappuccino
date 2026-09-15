"use client";

import { useMemo, useState } from "react";
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
import { DataTable } from "@/components/data-table/data-table";
import {
  getOrderColumns,
  type OrderRow,
} from "@/features/orders/components/columns";
import { deleteOrders } from "@/features/orders/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

const PAGE_SIZE = 10;
const ALL_STATUSES = "all";

export function OrdersTable({
  data,
  searchable = false,
}: {
  data: OrderRow[];
  searchable?: boolean;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);

  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!searchable) return data;
    return data.filter((order) => {
      const matchesQuery =
        !trimmed || order.orderNumber.toLowerCase().includes(trimmed);
      const matchesStatus = status === ALL_STATUSES || order.status === status;
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

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={t.orders.searchPlaceholderShort}
              className="pe-9"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t.orders.allStatuses}>
                {(value: string) =>
                  value === ALL_STATUSES || !value
                    ? t.orders.allStatuses
                    : t.statusLabels.order[value as keyof typeof t.statusLabels.order]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>{t.orders.allStatuses}</SelectItem>
              {Object.entries(t.statusLabels.order).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <DataTable
        columns={getOrderColumns(t, locale)}
        data={paged}
        onDeleteSelected={deleteOrders}
      />
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
