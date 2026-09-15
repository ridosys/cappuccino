"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, LabelList } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { computePriceChange } from "@/lib/price-change";
import { formatCurrency } from "@/lib/currency";
import type { CustomerProductAnalysis } from "@/features/customers/statement-queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

const UP_COLOR = "var(--color-up)";
const DOWN_COLOR = "var(--color-down)";
const FLAT_COLOR = "var(--color-flat)";

function truncateName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * A real bar chart (Recharts, matching the rest of the dashboard's charts):
 * for each product, one bar for the price at purchase and one for the
 * product's current live price (Product.price1) — so an admin price edit
 * made after the sale is directly visible, even on a single purchase. The
 * "current price" bar is colored by direction, and its label always carries
 * the +/- sign as text (not color alone). Horizontal layout keeps long
 * Arabic product names fully readable without rotated axis labels.
 */
export function StatementProductsChart({
  products,
  t,
  locale,
}: {
  products: CustomerProductAnalysis[];
  t: Dictionary;
  locale: Locale;
}) {
  const chartData = products.map((product) => {
    const change =
      product.currentPrice !== null
        ? computePriceChange(product.purchasedPrice, product.currentPrice)
        : null;
    const direction = change?.direction ?? "none";
    const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";
    return {
      key: product.key,
      name: truncateName(product.name),
      fullName: product.name,
      purchasedPrice: product.purchasedPrice,
      currentPrice: product.currentPrice,
      changeLabel: change ? `${sign}${Math.abs(change.percent).toFixed(0)}%` : "—",
      direction,
    };
  });

  const chartConfig = {
    purchasedPrice: { label: t.customerStatement.tooltipPriceBefore, color: "var(--chart-2)" },
    currentPrice: { label: t.customerStatement.tooltipPriceAfter, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const height = Math.max(280, products.length * 56);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          {t.customerStatement.priceTrendChartTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {t.customerStatement.noProducts}
          </div>
        ) : (
          <div
            // Recharts has no RTL awareness — its wrapper divs inherit
            // dir="rtl" from the page and that confuses its own internal
            // sizing/positioning math (not just visual order), which is
            // what caused bars and labels to overlap. Forcing this
            // subtree back to ltr fixes Recharts' layout; the Arabic tick
            // labels still render correctly since Arabic is a strong-RTL
            // script and shapes right-to-left regardless of the ambient
            // `dir` — only weak/neutral characters follow it.
            dir="ltr"
            style={{
              height,
              // Semantic colors for the current-price bar direction, scoped
              // to this chart via CSS vars so Cell fills below can read them.
              ["--color-up" as string]: "oklch(0.72 0.19 155)",
              ["--color-down" as string]: "var(--destructive)",
              ["--color-flat" as string]: "var(--chart-1)",
            }}
          >
            <ChartContainer
              config={chartConfig}
              className="h-full w-full"
              style={{ aspectRatio: "auto" }}
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 36, left: 0, bottom: 5 }}
                barCategoryGap="30%"
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: number) => value.toLocaleString(locale)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={130}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelKey="fullName"
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {name === "purchasedPrice"
                              ? t.customerStatement.tooltipPriceBefore
                              : t.customerStatement.tooltipPriceAfter}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatCurrency(Number(value), locale)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="purchasedPrice" fill="var(--color-purchasedPrice)" radius={3} barSize={11} />
                <Bar dataKey="currentPrice" radius={3} barSize={11}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        entry.direction === "up"
                          ? UP_COLOR
                          : entry.direction === "down"
                            ? DOWN_COLOR
                            : FLAT_COLOR
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="changeLabel"
                    position="right"
                    className="fill-foreground text-[11px] font-medium"
                  />
                </Bar>
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
