"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/shared/barcode-scanner";
import { findProductIdByBarcode } from "@/features/products/actions";
import { useLocale } from "@/i18n/locale-provider";

export function ProductBarcodeLookup() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <BarcodeScanner
      showLabel
      onScan={async (barcode) => {
        const product = await findProductIdByBarcode(barcode);
        if (!product) {
          toast.error(t.common.barcodeProductNotFound);
          return;
        }
        router.push(`/dashboard/products/${product.id}`);
      }}
    />
  );
}
