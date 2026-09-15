"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/locale-provider";

const ALL = "all";
const DEFAULT_SORT = "newest";

export function SuppliersFilterBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label={t.suppliers.ordersFilterLabel}
        value={searchParams.get("orders") ?? ALL}
        disabled={isPending}
        onChange={(value) => updateParam("orders", value === ALL ? "" : value)}
        options={[
          [ALL, t.suppliers.allSuppliers],
          ["withOrders", t.suppliers.withOrders],
          ["withoutOrders", t.suppliers.withoutOrders],
        ]}
      />
      <FilterSelect
        label={t.suppliers.balanceFilterLabel}
        value={searchParams.get("balance") ?? ALL}
        disabled={isPending}
        onChange={(value) => updateParam("balance", value === ALL ? "" : value)}
        options={[
          [ALL, t.suppliers.allBalances],
          ["outstanding", t.suppliers.withOutstanding],
          ["paid", t.suppliers.fullyPaid],
        ]}
      />
      <FilterSelect
        label={t.suppliers.sortLabel}
        value={searchParams.get("sort") ?? DEFAULT_SORT}
        disabled={isPending}
        onChange={(value) => updateParam("sort", value === DEFAULT_SORT ? "" : value)}
        wide
        options={[
          [DEFAULT_SORT, t.suppliers.sortNewest],
          ["name", t.suppliers.sortName],
          ["orders", t.suppliers.sortOrders],
        ]}
      />
      {isPending && (
        <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  disabled,
  onChange,
  options,
  wide = false,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  options: [string, string][];
  wide?: boolean;
}) {
  const currentLabel = options.find(([option]) => option === value)?.[1];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className={wide ? "w-full sm:w-52" : "w-full sm:w-44"}>
          <SelectValue>{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, optionLabel]) => (
            <SelectItem key={option} value={option}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
