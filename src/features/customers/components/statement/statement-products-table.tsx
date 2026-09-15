"use client";

import { useMemo, useState } from "react";
import { Package, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceComparison } from "@/components/shared/price-comparison";
import { computePriceChange } from "@/lib/price-change";
import type { CustomerProductAnalysis } from "@/features/customers/statement-queries";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

const PAGE_SIZE = 10;

export function StatementProductsTable({
  products,
  t,
  locale,
}: {
  products: CustomerProductAnalysis[];
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
          {t.customerStatement.productsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.length === 0 ? (
          <EmptyState icon={Package} title={t.customerStatement.noProducts} />
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder={t.customerStatement.productsSearchPlaceholder}
                className="pe-9"
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.customerStatement.columnProduct}</TableHead>
                    <TableHead>{t.customerStatement.columnQuantity}</TableHead>
                    <TableHead>{t.customerStatement.columnPurchases}</TableHead>
                    <TableHead>{t.customerStatement.columnTotalSpent}</TableHead>
                    <TableHead>{t.customerStatement.columnPriceVsCurrent}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {t.common.noResults}
                      </TableCell>
                    </TableRow>
                  )}
                  {paged.map((product) => {
                    const change =
                      product.currentPrice !== null
                        ? computePriceChange(product.purchasedPrice, product.currentPrice)
                        : null;
                    return (
                      <TableRow key={product.key}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="tabular-nums">
                          {product.quantity.toLocaleString(locale)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {product.purchases.toLocaleString(locale)}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatCurrency(product.totalSpent, locale)}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button type="button" className="cursor-default text-start" />
                              }
                            >
                              {product.currentPrice !== null ? (
                                <PriceComparison
                                  before={product.purchasedPrice}
                                  after={product.currentPrice}
                                  locale={locale}
                                  beforeLabel={t.customerStatement.tooltipPriceBefore}
                                  afterLabel={t.customerStatement.tooltipPriceAfter}
                                  notAvailableLabel={t.customerStatement.priceNotAvailable}
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {t.customerStatement.priceNotAvailable}
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-64">
                              <div className="space-y-1 py-0.5">
                                <p className="font-semibold">{product.name}</p>
                                <p>
                                  {t.customerStatement.tooltipPurchased}:{" "}
                                  {product.purchasedQuantity.toLocaleString(locale)}
                                </p>
                                <p>
                                  {t.customerStatement.tooltipDate}:{" "}
                                  {formatDateTime(product.purchasedDate)}
                                </p>
                                <p>
                                  {t.customerStatement.tooltipPriceBefore}:{" "}
                                  {formatCurrency(product.purchasedPrice, locale)}
                                </p>
                                {change ? (
                                  <>
                                    <p>
                                      {t.customerStatement.tooltipPriceAfter}:{" "}
                                      {formatCurrency(product.currentPrice as number, locale)}
                                    </p>
                                    <p>
                                      {t.customerStatement.tooltipDifference}:{" "}
                                      {change.direction === "up" ? "+" : change.direction === "down" ? "-" : ""}
                                      {formatCurrency(Math.abs(change.diff), locale)}
                                    </p>
                                    <p>
                                      {t.customerStatement.tooltipChange}:{" "}
                                      {change.direction === "up" ? "+" : change.direction === "down" ? "-" : ""}
                                      {Math.abs(change.percent).toFixed(1)}%
                                    </p>
                                  </>
                                ) : product.currentPrice !== null ? (
                                  <p>
                                    {t.customerStatement.tooltipPriceAfter}:{" "}
                                    {formatCurrency(product.currentPrice, locale)}
                                  </p>
                                ) : null}
                                <p>
                                  {t.customerStatement.tooltipTotal}:{" "}
                                  {formatCurrency(
                                    product.purchasedQuantity * product.purchasedPrice,
                                    locale,
                                  )}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
