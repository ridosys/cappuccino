import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Mirrors PageHeader's title/description/action row so route loading
 * states don't shift layout once the real header replaces it. */
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {withAction && <Skeleton className="h-8 w-28" />}
    </div>
  );
}

/** Matches the sm:grid-cols-N StatCard rows used on dashboard/report pages. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="gap-3">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Mirrors AnalyticsFilterBar's preset pills + custom date-range row. */
export function AnalyticsFilterBarSkeleton({ presets = 5 }: { presets?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-1">
        {Array.from({ length: presets }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-16" />
        ))}
      </div>
      <div className="mx-1 h-6 w-px bg-border" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-16" />
    </div>
  );
}

/** A chart-card skeleton: title row + a block matching the chart's height. */
export function ChartCardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className={cn("w-full", height)} />
      </CardContent>
    </Card>
  );
}

/** Mirrors RankedListCard: title row + N ranked rows with a progress bar each. */
export function RankedListCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** A table-shaped skeleton: header bar + N placeholder rows, same row
 * height as real table rows so the swap-in doesn't shift the page. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-4 border-b bg-muted/60 px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Search bar + filter row skeleton, shown above list-page tables. */
export function FilterBarSkeleton({ filters = 2 }: { filters?: number }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Skeleton className="h-8 w-full max-w-sm" />
      {Array.from({ length: filters }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full sm:w-40" />
      ))}
    </div>
  );
}

/** A labeled-field stack for new/edit form pages. */
export function FormFieldsSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

/** A generic bordered section card (title bar + body lines), for detail
 * pages built from several stacked Cards. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full max-w-sm" />
        ))}
      </CardContent>
    </Card>
  );
}
