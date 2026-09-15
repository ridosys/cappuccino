"use client";

import { toast } from "sonner";
import { useTransition } from "react";
import {
  Combobox,
  useComboboxFilter,
  ComboboxValue,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { updatePurchaseOrderSupplier } from "@/features/purchases/actions";
import { useLocale } from "@/i18n/locale-provider";

type SupplierOption = { id: string; name: string };

/** Reassigns which supplier a purchase order was placed with, straight from
 * its detail page. */
export function PurchaseOrderSupplierSelect({
  purchaseOrderId,
  supplierId,
  suppliers,
}: {
  purchaseOrderId: string;
  supplierId: string;
  suppliers: SupplierOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();
  const { contains } = useComboboxFilter();

  const selected =
    suppliers.find((s) => s.id === supplierId) ??
    ({ id: supplierId, name: supplierId } satisfies SupplierOption);

  function handleChange(option: SupplierOption | null) {
    if (!option || option.id === supplierId) return;
    startTransition(async () => {
      const result = await updatePurchaseOrderSupplier(
        purchaseOrderId,
        option.id,
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.purchases.supplierUpdatedToast);
    });
  }

  return (
    <Combobox
      items={suppliers}
      value={selected}
      onValueChange={handleChange}
      isItemEqualToValue={(a: SupplierOption, b: SupplierOption) => a.id === b.id}
      itemToStringValue={(s: SupplierOption) => s.id}
      itemToStringLabel={(s: SupplierOption) => s.name}
      filter={contains}
      disabled={isPending}
    >
      <ComboboxTrigger className="w-full">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder={t.purchases.supplierSearchPlaceholder} />
        <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
        <ComboboxList>
          {(s: SupplierOption) => (
            <ComboboxItem key={s.id} value={s}>
              {s.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
