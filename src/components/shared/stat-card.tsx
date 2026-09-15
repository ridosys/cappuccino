import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  formatValue,
  locale = "ar",
  href,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "balance";
  formatValue?: (value: number) => string;
  locale?: string;
  /** When set, the whole card becomes a link to this path. */
  href?: string;
}) {
  const isWarning = variant === "warning" && value > 0;
  const isNegativeBalance = variant === "balance" && value < 0;
  const isPositiveBalance = variant === "balance" && value > 0;

  const card = (
    <Card
      className={cn(
        "h-full gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md",
        href && "hover:ring-primary/40",
      )}
    >
      <CardContent className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight tabular-nums",
              (isWarning || isNegativeBalance) && "text-destructive",
              isPositiveBalance && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {formatValue ? formatValue(value) : value.toLocaleString(locale)}
          </p>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            isWarning || isNegativeBalance
              ? "bg-destructive/10 text-destructive ring-destructive/15"
              : isPositiveBalance
                ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400"
                : "bg-primary/10 text-primary ring-primary/15",
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
