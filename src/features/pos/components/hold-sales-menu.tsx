"use client";

import { ListChecks, Trash2, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import type { HeldSale } from "./types";

export function HoldSalesMenu({
  heldSales,
  onResume,
  onDelete,
}: {
  heldSales: HeldSale[];
  onResume: (sale: HeldSale) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <ListChecks className="size-4" />
            {t.pos.holdSales}
            {heldSales.length > 0 && (
              <span className="ms-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {heldSales.length}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        {heldSales.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t.pos.noHeldSales}
          </p>
        ) : (
          <ul className="space-y-1">
            {heldSales.map((sale) => (
              <li
                key={sale.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {sale.customer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMessage(t.pos.heldSaleItemsTemplate, {
                      count: sale.lines.length,
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={() => onResume(sale)}
                  aria-label={t.pos.resumeSale}
                >
                  <RotateCcw />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onDelete(sale.id)}
                  aria-label={t.pos.deleteHeldSale}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
