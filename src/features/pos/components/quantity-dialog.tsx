"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/i18n/locale-provider";
import { formatCurrency } from "@/lib/currency";
import type { PosProduct } from "@/features/pos/queries";

export function QuantityDialog({
  product,
  initialQuantity = 1,
  onConfirm,
  onClose,
}: {
  product: PosProduct;
  initialQuantity?: number;
  onConfirm: (quantity: number) => void;
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  const [quantity, setQuantity] = useState(() => String(initialQuantity));

  const qtyNumber = Number(quantity) || 0;
  const canConfirm = qtyNumber > 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t.pos.unitPriceLabel}</span>
            <span className="tabular-nums">
              {formatCurrency(product.price1, locale)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-qty">{t.pos.quantityLabel}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setQuantity((q) => String(Math.max(0, (Number(q) || 0) - 1)))
                }
              >
                −
              </Button>
              <Input
                id="pos-qty"
                autoFocus
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQuantity((q) => String((Number(q) || 0) + 1))}
              >
                +
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>{t.pos.total}</span>
            <span className="tabular-nums">
              {formatCurrency(qtyNumber * product.price1, locale)}
            </span>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!canConfirm}
            onClick={() => onConfirm(qtyNumber)}
          >
            {t.pos.addLineButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
