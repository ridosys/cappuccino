import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { computePriceChange } from "@/lib/price-change";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

/**
 * Compact before/after price comparison, reused in the products-purchased
 * table and its hover tooltip. Deliberately does NOT force dir="ltr" or use
 * a left-to-right arrow glyph — formatCurrency already bidi-isolates each
 * number internally, so the labeled lines can flow with the page's own
 * direction (RTL here) instead of fighting it, which is what made the old
 * single-line "before → after" version look reversed/misaligned in Arabic.
 * Never colors the change by hue alone — an icon + sign always accompanies
 * it (accessibility requirement).
 */
export function PriceComparison({
  before,
  after,
  locale,
  beforeLabel,
  afterLabel,
  notAvailableLabel,
  className,
}: {
  before: number | null;
  after: number;
  locale: Locale;
  beforeLabel: string;
  afterLabel: string;
  notAvailableLabel: string;
  className?: string;
}) {
  const change = computePriceChange(before, after);

  if (!change) {
    return (
      <div className={cn("space-y-0.5", className)}>
        <p className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(after, locale)}
        </p>
        <p className="text-xs text-muted-foreground">{notAvailableLabel}</p>
      </div>
    );
  }

  const { diff, percent, direction } = change;
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const colorClass =
    direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";

  // `change` being non-null already guarantees `before` is a positive
  // number (see computePriceChange), TS just can't narrow across the two
  // separate variables.
  const beforeValue = before as number;

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">
        {beforeLabel}: <span className="font-mono tabular-nums text-foreground">{formatCurrency(beforeValue, locale)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {afterLabel}: <span className="font-mono tabular-nums text-foreground">{formatCurrency(after, locale)}</span>
      </p>
      <p className={cn("flex items-center gap-1 text-xs font-medium tabular-nums", colorClass)}>
        <Icon className="size-3" />
        {sign}
        {formatCurrency(Math.abs(diff), locale)} · {sign}
        {Math.abs(percent).toFixed(1)}%
      </p>
    </div>
  );
}
