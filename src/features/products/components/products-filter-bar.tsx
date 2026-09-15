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

export function ProductsFilterBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    startTransition(() => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label={t.products.stockFilterLabel}
        value={searchParams.get("stock") ?? "all"}
        disabled={isPending}
        onChange={(value) => updateParam("stock", value, "all")}
        options={[
          ["all", t.products.allStockOption],
          ["low", t.products.lowStockOnlyOption],
          ["out", t.products.outOfStockOnlyOption],
          ["available", t.products.availableStockOnlyOption],
        ]}
      />
      <FilterSelect
        label={t.products.quantitySortLabel}
        value={searchParams.get("sort") ?? "newest"}
        disabled={isPending}
        onChange={(value) => updateParam("sort", value, "newest")}
        options={[
          ["newest", t.products.newestSortOption],
          ["quantityAsc", t.products.quantityLowToHighOption],
          ["quantityDesc", t.products.quantityHighToLowOption],
        ]}
      />
      {isPending && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const currentLabel = options.find(([option]) => option === value)?.[1];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="w-full sm:w-52">
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
