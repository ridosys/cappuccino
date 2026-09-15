"use client";

import { useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";

export function BarcodeScanner({
  onScan,
  disabled,
  showLabel = false,
}: {
  onScan: (barcode: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const preventReopenUntil = useRef(0);

  function closeScanner() {
    preventReopenUntil.current = Date.now() + 500;
    setOpen(false);
    setManualBarcode("");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={showLabel ? "default" : "icon"}
        title={t.common.scanBarcode}
        aria-label={t.common.scanBarcode}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (Date.now() < preventReopenUntil.current) return;
          setOpen(true);
        }}
      >
        <ScanBarcode className="size-4" />
        {showLabel && t.common.scanBarcode}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeScanner();
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={false}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader><DialogTitle>{t.common.scanBarcode}</DialogTitle></DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const barcode = manualBarcode.trim();
              if (!barcode) return;
              onScan(barcode);
              closeScanner();
            }}
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={manualBarcode}
              placeholder={t.common.barcodeInputPlaceholder}
              onChange={(event) => setManualBarcode(event.target.value)}
            />
            <Button type="submit" disabled={!manualBarcode.trim()}>
              {t.common.confirm}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeScanner();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <X className="size-4" /> {t.common.cancel}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductBarcodeScanner<T extends { barcode: string | null }>({
  products,
  onSelect,
}: {
  products: T[];
  onSelect: (product: T) => void;
}) {
  const { t } = useLocale();
  return (
    <BarcodeScanner
      onScan={(barcode) => {
        const product = products.find((item) => item.barcode === barcode);
        if (!product) {
          toast.error(t.common.barcodeProductNotFound);
          return;
        }
        onSelect(product);
      }}
    />
  );
}
