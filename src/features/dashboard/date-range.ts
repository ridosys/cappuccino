import type { Dictionary } from "@/i18n/dictionaries";

export type RangePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "lastMonth"
  | "year"
  | "all"
  | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يوماً" },
  { value: "90d", label: "آخر 90 يوماً" },
  { value: "month", label: "هذا الشهر" },
  { value: "lastMonth", label: "الشهر الماضي" },
  { value: "year", label: "هذه السنة" },
  { value: "all", label: "كل الوقت" },
];

/** Locale-aware preset labels for rendering; RANGE_PRESETS above stays
 * Arabic-only since resolveDateRange only ever matches on `.value`. */
export function getRangePresetOptions(
  t: Dictionary,
): { value: RangePreset; label: string }[] {
  return [
    { value: "today", label: t.dateRangePresets.today },
    { value: "7d", label: t.dateRangePresets["7d"] },
    { value: "30d", label: t.dateRangePresets["30d"] },
    { value: "90d", label: t.dateRangePresets["90d"] },
    { value: "month", label: t.dateRangePresets.month },
    { value: "lastMonth", label: t.dateRangePresets.lastMonth },
    { value: "year", label: t.dateRangePresets.year },
    { value: "all", label: t.dateRangePresets.all },
  ];
}

export type ResolvedRange = {
  from: Date | null;
  to: Date;
  preset: RangePreset;
  /** Bucket size to use when grouping time-series data over this range. */
  granularity: "hour" | "day" | "month";
};

function daysAgo(n: number, from: Date) {
  const date = new Date(from);
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function granularityFor(preset: RangePreset, from: Date | null, to: Date) {
  if (preset === "today") return "hour" as const;
  if (!from) return "month" as const;
  const spanDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > 90) return "month" as const;
  return "day" as const;
}

export function resolveDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): ResolvedRange {
  const now = new Date();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const preset: RangePreset =
    params.range === "custom" && params.from
      ? "custom"
      : (RANGE_PRESETS.find((p) => p.value === params.range)?.value ?? "30d");

  let from: Date | null;
  let to: Date = endOfToday;

  switch (preset) {
    case "custom": {
      from = new Date(`${params.from}T00:00:00`);
      to = params.to ? new Date(`${params.to}T23:59:59.999`) : endOfToday;
      break;
    }
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = daysAgo(7, now);
      break;
    case "90d":
      from = daysAgo(90, now);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth": {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfPrevMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
      );
      to = new Date(
        lastDayOfPrevMonth.getFullYear(),
        lastDayOfPrevMonth.getMonth(),
        lastDayOfPrevMonth.getDate(),
        23,
        59,
        59,
        999,
      );
      break;
    }
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
      from = null;
      break;
    case "30d":
    default:
      from = daysAgo(30, now);
      break;
  }

  return { from, to, preset, granularity: granularityFor(preset, from, to) };
}

export function rangeToSearchParams(range: ResolvedRange) {
  if (range.preset === "custom" && range.from) {
    return {
      range: "custom",
      from: toDateInputValue(range.from),
      to: toDateInputValue(range.to),
    };
  }
  return { range: range.preset };
}
