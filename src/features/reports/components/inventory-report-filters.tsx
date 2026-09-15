"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/i18n/locale-provider";

/**
 * Drives the inventory report's `asOf` (historical date) and `supplierId`
 * filters via URL search params, same as the rest of this app's filter
 * bars — the server page re-reads them on every navigation and recomputes
 * the report, so there's no client-side report state to keep in sync.
 */
export function InventoryReportFilters({
  asOf,
  supplierId,
  supplierOptions,
}: {
  asOf: string;
  supplierId: string;
  supplierOptions: { id: string; name: string }[];
}) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    startTransition(() => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  const supplierLabel =
    supplierId === "all"
      ? t.reports.allSuppliersOption
      : (supplierOptions.find((s) => s.id === supplierId)?.name ??
        t.reports.allSuppliersOption);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 ring-1 ring-foreground/10 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label className="h-4 gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {t.reports.inventoryAsOfDateLabel}
        </Label>
        <Input
          type="date"
          value={asOf}
          max={new Date().toISOString().slice(0, 10)}
          disabled={isPending}
          onChange={(event) => updateParam("asOf", event.target.value)}
          className="w-full sm:w-44"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="h-4 text-xs text-muted-foreground">
          {t.reports.columnSupplier}
        </Label>
        <Select
          value={supplierId}
          disabled={isPending}
          onValueChange={(next) => next && updateParam("supplierId", next)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue>{supplierLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="max-h-72 overflow-y-auto"
          >
            <SelectItem value="all">{t.reports.allSuppliersOption}</SelectItem>
            {supplierOptions.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
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
