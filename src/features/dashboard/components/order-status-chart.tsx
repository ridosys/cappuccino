"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { StatusBreakdown } from "@/features/dashboard/analytics-queries";
import { useLocale } from "@/i18n/locale-provider";

const COLORS: Record<string, string> = {
  PENDING: "var(--chart-3)",
  PROCESSING: "var(--chart-2)",
  COMPLETED: "var(--chart-5)",
  CANCELLED: "var(--destructive)",
};

export function OrderStatusChart({ data }: { data: StatusBreakdown[] }) {
  const { locale, t } = useLocale();
  const orderStatusLabels: Record<string, string> = t.statusLabels.order;

  const chartData = data.map((d) => ({
    status: d.status,
    label: orderStatusLabels[d.status] ?? d.status,
    count: d.count,
  }));

  const chartConfig = {
    count: { label: t.dashboard.orderCount },
  } satisfies ChartConfig;

  const hasData = chartData.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground" />
          {t.dashboard.ordersByStatus}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => value.toLocaleString(locale)}
              />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{item.payload.label}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {Number(value).toLocaleString(locale)} {t.dashboard.orderSuffix}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={4}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={COLORS[entry.status] ?? "var(--chart-2)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t.dashboard.noOrdersInPeriod}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
