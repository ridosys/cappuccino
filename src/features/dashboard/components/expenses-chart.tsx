"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ExpenseBreakdown } from "@/features/dashboard/analytics-queries";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";

export function ExpensesChart({ data }: { data: ExpenseBreakdown[] }) {
  const { locale, t } = useLocale();
  const totalExpenses = data.reduce((sum, item) => sum + item.total, 0);
  const chartData = data.map((item) => ({
    ...item,
    label: t.statusLabels.expenseCategory[item.category],
    percentage: totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0,
  }));
  const chartConfig = {
    total: { label: t.dashboard.expenses, color: "var(--chart-3)" },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground" />
          {t.dashboard.expensesByCategory}
        </CardTitle>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t.dashboard.totalExpenses}</p>
          <p className="font-semibold tabular-nums">
            {formatCurrency(totalExpenses, locale)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => value.toLocaleString(locale)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="flex w-full flex-col gap-1">
                        <span className="font-medium">{item.payload.label}</span>
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-muted-foreground">
                            {item.payload.count.toLocaleString(locale)} {t.dashboard.expenseSuffix}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatCurrency(Number(value), locale)} ({item.payload.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t.dashboard.noExpensesInPeriod}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
