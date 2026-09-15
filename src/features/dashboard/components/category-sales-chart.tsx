"use client";

import { Cell, Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CategorySales } from "@/features/dashboard/analytics-queries";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function CategorySalesChart({ data }: { data: CategorySales[] }) {
  const { locale, t } = useLocale();
  const top = data.slice(0, 5);
  const rest = data.slice(5);
  const restTotal = rest.reduce((sum, d) => sum + d.revenue, 0);
  const chartData =
    restTotal > 0 ? [...top, { category: t.dashboard.otherCategory, revenue: restTotal }] : top;

  const chartConfig = Object.fromEntries(
    chartData.map((d, i) => [
      d.category,
      { label: d.category, color: PALETTE[i % PALETTE.length] },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="size-4 text-muted-foreground" />
          {t.dashboard.salesByCategory}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="mx-auto h-64 w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="category"
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatCurrency(Number(value), locale)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="revenue"
                nameKey="category"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={2}
              >
                {chartData.map((entry, i) => (
                  <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="category" />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t.dashboard.noSalesInPeriod}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
