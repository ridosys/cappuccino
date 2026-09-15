"use client";

import { useMemo, useState } from "react";
import { Package, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/currency";
import { formatMessage } from "@/i18n/format";
import type { SupplierDeliveredProduct } from "@/features/suppliers/queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

const PAGE_SIZE = 10;

export function SupplierProductsTable({
  products,
  t,
  locale,
}: {
  products: SupplierDeliveredProduct[];
  t: Dictionary;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      trimmed
        ? products.filter((product) => product.name.toLowerCase().includes(trimmed))
        : products,
    [products, trimmed],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          {t.suppliers.productsDeliveredTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.length === 0 ? (
          <EmptyState icon={Package} title={t.suppliers.noProductsDelivered} />
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder={t.suppliers.productsSearchPlaceholder}
                className="pe-9"
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.suppliers.columnProduct}</TableHead>
                    <TableHead>{t.suppliers.columnQuantity}</TableHead>
                    <TableHead>{t.suppliers.columnDeliveries}</TableHead>
                    <TableHead>{t.suppliers.columnTotalCost}</TableHead>
                    <TableHead>{t.suppliers.columnAvgCost}</TableHead>
                    <TableHead>{t.suppliers.columnLatestCost}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {t.common.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                  {paged.map((product) => (
                    <TableRow key={product.key}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="tabular-nums">
                        {product.quantity.toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {product.deliveries.toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatCurrency(product.totalCost, locale)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatCurrency(product.avgCost, locale, false, 4)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatCurrency(product.latestCost, locale, false, 4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtered.length > PAGE_SIZE && (
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
