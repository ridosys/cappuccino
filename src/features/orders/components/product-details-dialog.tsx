"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export type OrderItemProduct = {
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  quantity: number;
  price1: number;
  price2: number;
  price3: number;
  category: { name: string };
  brand: { name: string } | null;
  images: { secureUrl: string }[];
};

export function ProductDetailsDialog({
  product,
}: {
  product: OrderItemProduct;
}) {
  const [open, setOpen] = useState(false);
  const { t, locale } = useLocale();
  const image = product.images[0];
  const outOfStock = product.quantity <= 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <Info className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{t.products.detailsDialogTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {image ? (
              <Image
                src={image.secureUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Package className="size-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">SKU</dt>
            <dd dir="ltr" className="text-start">
              {product.sku}
            </dd>
            {product.barcode && (
              <>
                <dt className="text-muted-foreground">{t.products.barcodeColumnLabel}</dt>
                <dd dir="ltr" className="text-start">
                  {product.barcode}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t.products.columnCategory}</dt>
            <dd className="text-start">{product.category.name}</dd>
            {product.brand && (
              <>
                <dt className="text-muted-foreground">{t.products.columnBrand}</dt>
                <dd className="text-start">{product.brand.name}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t.reports.columnPrice1}</dt>
            <dd className="text-start">{formatCurrency(product.price1, locale)}</dd>
            <dt className="text-muted-foreground">{t.reports.columnPrice2}</dt>
            <dd className="text-start">{formatCurrency(product.price2, locale)}</dd>
            <dt className="text-muted-foreground">{t.reports.columnPrice3}</dt>
            <dd className="text-start">{formatCurrency(product.price3, locale)}</dd>
            <dt className="text-muted-foreground">{t.products.stockLabel}</dt>
            <dd className="text-start">
              <Badge variant={outOfStock ? "destructive" : "secondary"}>
                {outOfStock
                  ? t.products.outOfStock
                  : formatMessage(t.products.inStockTemplate, {
                      quantity: product.quantity.toLocaleString(locale),
                    })}
              </Badge>
            </dd>
          </dl>
        </div>
        {product.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
