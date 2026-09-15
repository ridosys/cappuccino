"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getRangePresetOptions,
  type RangePreset,
  type ResolvedRange,
} from "@/features/dashboard/date-range";
import type { Dictionary } from "@/i18n/dictionaries";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function AnalyticsFilterBar({
  basePath,
  range,
  t,
}: {
  basePath: string;
  range: ResolvedRange;
  t: Dictionary;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const presets = getRangePresetOptions(t);

  function navigate(params: URLSearchParams) {
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`, { scroll: false });
    });
  }

  function selectPreset(preset: RangePreset) {
    const params = new URLSearchParams();
    params.set("range", preset);
    navigate(params);
  }

  function updateCustomDate(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    navigate(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 ring-1 ring-foreground/10 print:hidden">
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            size="sm"
            variant={range.preset === preset.value ? "default" : "ghost"}
            disabled={isPending}
            onClick={() => selectPreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Separator />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="size-3.5" />
          <span className="text-xs">{t.common.from}</span>
        </div>
        <input
          key={`from-${range.preset}-${range.from?.toISOString() ?? ""}`}
          type="date"
          name="from"
          disabled={isPending}
          defaultValue={
            range.preset === "custom" && range.from
              ? toDateInputValue(range.from)
              : undefined
          }
          onChange={(event) => updateCustomDate("from", event.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="text-xs text-muted-foreground">{t.common.to}</span>
        <input
          key={`to-${range.preset}-${range.to.toISOString()}`}
          type="date"
          name="to"
          disabled={isPending}
          defaultValue={
            range.preset === "custom" ? toDateInputValue(range.to) : undefined
          }
          onChange={(event) => updateCustomDate("to", event.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {isPending && (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-label={t.common.loading}
          />
        )}
      </div>
    </div>
  );
}

function Separator() {
  return <div className={cn("mx-1 h-6 w-px bg-border")} />;
}
