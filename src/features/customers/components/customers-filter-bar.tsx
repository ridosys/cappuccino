"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";

const ALL_STATUSES = "all";
const DEFAULT_SORT = "newest";

const DEBT_STATUS_VALUES = ["HAS_DEBT", "NO_DEBT"] as const;
const CUSTOMER_SORT_VALUES = [
  "newest",
  "totalPurchased_desc",
  "totalPurchased_asc",
  "outstanding_desc",
  "outstanding_asc",
  "balance_desc",
  "balance_asc",
] as const;

export function CustomersFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t.customers.debtFilterLabel}
        </Label>
        <Select
          value={searchParams.get("debtFilter") ?? ALL_STATUSES}
          disabled={isPending}
          onValueChange={(value) => {
            if (!value) return;
            updateParam("debtFilter", value === ALL_STATUSES ? "" : value);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t.customers.debtFilterAll}>
              {(value: string) =>
                value === ALL_STATUSES || !value
                  ? t.customers.debtFilterAll
                  : t.statusLabels.debtStatus[
                      value as keyof typeof t.statusLabels.debtStatus
                    ]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t.customers.debtFilterAll}</SelectItem>
            {DEBT_STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t.statusLabels.debtStatus[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t.customers.sortLabel}
        </Label>
        <Select
          value={searchParams.get("sort") ?? DEFAULT_SORT}
          disabled={isPending}
          onValueChange={(value) => {
            if (!value) return;
            updateParam("sort", value === DEFAULT_SORT ? "" : value);
          }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder={t.statusLabels.customerSort.newest}>
              {(value: string) =>
                t.statusLabels.customerSort[
                  value as keyof typeof t.statusLabels.customerSort
                ] ?? t.statusLabels.customerSort.newest
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_SORT_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t.statusLabels.customerSort[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isPending && (
        <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />
      )}
    </div>
  );
}
