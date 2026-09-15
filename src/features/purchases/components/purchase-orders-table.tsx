"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import {
  getPurchaseOrderColumns,
  type PurchaseOrderRow,
} from "@/features/purchases/components/columns";
import { deletePurchaseOrders } from "@/features/purchases/actions";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

const PAGE_SIZE = 10;

export function PurchaseOrdersTable({
  data,
  searchable = false,
}: {
  data: PurchaseOrderRow[];
  searchable?: boolean;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!searchable) return data;
    if (!trimmed) return data;
    return data.filter((order) => order.orderNumber.toLowerCase().includes(trimmed));
  }, [data, searchable, trimmed]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = searchable
    ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : filtered;

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={t.purchases.searchPlaceholder}
            className="pe-9"
          />
        </div>
      )}
      <DataTable
        columns={getPurchaseOrderColumns(t, locale)}
        data={paged}
        onDeleteSelected={deletePurchaseOrders}
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
