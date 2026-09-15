"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export function DataTablePagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
  pageParam = "page",
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  /** Query key to write the page number under — override when a page hosts
   * more than one independently-paginated table. */
  pageParam?: string;
}) {
  const { locale, t } = useLocale();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function hrefForPage(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set(pageParam, String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {formatMessage(t.common.paginationSummary, {
          total: total.toLocaleString(locale),
          page: page.toLocaleString(locale),
          pageCount: pageCount.toLocaleString(locale),
        })}
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false} render={<Link href={hrefForPage(page - 1)} />}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {t.common.previous}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {t.common.previous}
          </Button>
        )}
        {hasNext ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false} render={<Link href={hrefForPage(page + 1)} />}
          >
            {t.common.next}
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t.common.next}
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}
