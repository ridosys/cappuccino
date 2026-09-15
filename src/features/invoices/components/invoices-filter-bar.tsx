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
import { useT } from "@/i18n/locale-provider";

const ALL_STATUSES = "all";

export function InvoicesFilterBar() {
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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t.invoices.statusFilterLabel}
        </Label>
        <Select
          value={searchParams.get("paymentStatus") ?? ALL_STATUSES}
          disabled={isPending}
          onValueChange={(value) => {
            if (!value) return;
            updateParam("paymentStatus", value === ALL_STATUSES ? "" : value);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t.invoices.allStatuses}>
              {(value: string) =>
                value === ALL_STATUSES || !value
                  ? t.invoices.allStatuses
                  : t.statusLabels.paymentStatus[
                      value as keyof typeof t.statusLabels.paymentStatus
                    ]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t.invoices.allStatuses}</SelectItem>
            {Object.entries(t.statusLabels.paymentStatus).map(([value, label]) => (
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
