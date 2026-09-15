"use client";

import Image from "next/image";
import { Minus, Plus, X, Trash2, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { formatCurrency } from "@/lib/currency";
import type { PosCustomer } from "@/features/pos/queries";
import type { CartLine } from "./types";

export function CartPanel({
  customer,
  lines,
  isPending,
  onChangeCustomer,
  onClearCustomer,
  onSetQuantity,
  onRemove,
  onClearCart,
  onHold,
  onPay,
}: {
  customer: PosCustomer;
  lines: CartLine[];
  isPending: boolean;
  onChangeCustomer: () => void;
  onClearCustomer: () => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClearCart: () => void;
  onHold: () => void;
  onPay: () => void;
}) {
  const { locale, t } = useLocale();

  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.product.price1,
    0,
  );

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      {/* Customer */}
      <div className="flex items-start gap-2 border-b p-3">
        <CustomerAvatar name={customer.name} imageUrl={customer.imageUrl} seed={customer.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{customer.name}</p>
          <p dir="ltr" className="truncate text-start text-xs text-muted-foreground">
            {customer.phone}
          </p>
        </div>
        <Button type="button" variant="outline" size="xs" onClick={onChangeCustomer}>
          {t.pos.changeCustomer}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClearCustomer}
          aria-label={t.pos.changeCustomer}
        >
          <X />
        </Button>
      </div>

      {/* Cart header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">
          {formatMessage(t.pos.cartTitleTemplate, { count: lines.length })}
        </span>
        {lines.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-destructive"
            onClick={onClearCart}
          >
            <Trash2 />
            {t.pos.clearCart}
          </Button>
        )}
      </div>

      {/* Lines */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t.pos.emptyCart}
          </p>
        ) : (
          <ul className="space-y-2 pb-2">
            {lines.map((line) => (
              <li
                key={line.product.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                  {line.product.image ? (
                    <Image
                      src={line.product.image}
                      alt={line.product.name}
                      fill
                      sizes="40px"
                      className="object-contain p-0.5"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageOff className="size-4" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={line.product.name}>
                    {line.product.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(line.product.price1, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() =>
                      onSetQuantity(line.product.id, line.quantity - 1)
                    }
                    aria-label="-"
                  >
                    <Minus />
                  </Button>
                  <Input
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isNaN(next)) onSetQuantity(line.product.id, next);
                    }}
                    className="h-7 w-12 px-1 text-center text-xs"
                  />
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() =>
                      onSetQuantity(line.product.id, line.quantity + 1)
                    }
                    aria-label="+"
                  >
                    <Plus />
                  </Button>
                </div>
                <span className="w-16 shrink-0 text-end text-xs font-semibold tabular-nums">
                  {formatCurrency(
                    line.quantity * line.product.price1,
                    locale,
                    true,
                  )}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onRemove(line.product.id)}
                  aria-label={t.pos.removeItem}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + payment */}
      <div className="space-y-3 border-t p-3">
        <div className="flex justify-between text-base font-bold">
          <span>{t.pos.total}</span>
          <span className="tabular-nums">{formatCurrency(total, locale)}</span>
        </div>

        <Button
          type="button"
          onClick={onPay}
          disabled={isPending || lines.length === 0}
          className="h-12 w-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-600/90"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t.pos.processing}
            </>
          ) : (
            <>
              {t.pos.payButton} · {formatCurrency(total, locale)}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onHold}
          disabled={isPending || lines.length === 0}
          className="w-full"
        >
          {t.pos.holdCurrentSale}
        </Button>
      </div>
    </aside>
  );
}
