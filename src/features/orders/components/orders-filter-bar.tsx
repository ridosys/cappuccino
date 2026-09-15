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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/locale-provider";

const ALL_STATUSES = "all";
const ALL_INVOICE_FILTER = "all";

export function OrdersFilterBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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

  const invoiceFilterLabels: Record<string, string> = {
    NO_INVOICE: t.orders.invoiceFilterNone,
    HAS_INVOICE: t.orders.invoiceFilterHas,
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end lg:flex-nowrap lg:items-center justify-center items-center">
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-44 sm:shrink-0">
        <Label className="text-xs text-muted-foreground">{t.common.status}</Label>
        <Select
          value={searchParams.get("status") ?? ALL_STATUSES}
          disabled={isPending}
          onValueChange={(value) => {
            if (!value) return;
            updateParam("status", value === ALL_STATUSES ? "" : value);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.orders.allStatuses}>
              {(value: string) =>
                value === ALL_STATUSES || !value
                  ? t.orders.allStatuses
                  : t.statusLabels.order[value as keyof typeof t.statusLabels.order]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t.orders.allStatuses}</SelectItem>
            {Object.entries(t.statusLabels.order).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-40 sm:shrink-0">
        <Label className="text-xs text-muted-foreground">{t.common.from}</Label>
        <Input
          type="date"
          className="w-full"
          disabled={isPending}
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(event) => updateParam("from", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-40 sm:shrink-0">
        <Label className="text-xs text-muted-foreground">{t.common.to}</Label>
        <Input
          type="date"
          className="w-full"
          disabled={isPending}
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(event) => updateParam("to", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-40 sm:shrink-0">
        <Label className="text-xs text-muted-foreground">
          {t.orders.invoiceFilterLabel}
        </Label>
        <Select
          value={searchParams.get("invoiceFilter") ?? ALL_INVOICE_FILTER}
          disabled={isPending}
          onValueChange={(value) => {
            if (!value) return;
            updateParam(
              "invoiceFilter",
              value === ALL_INVOICE_FILTER ? "" : value,
            );
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.orders.allInvoiceFilter}>
              {(value: string) =>
                value === ALL_INVOICE_FILTER || !value
                  ? t.orders.allInvoiceFilter
                  : invoiceFilterLabels[value]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_INVOICE_FILTER}>
              {t.orders.allInvoiceFilter}
            </SelectItem>
            {Object.entries(invoiceFilterLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
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
