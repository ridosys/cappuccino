"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  inventoryMovementSchema,
  type InventoryMovementInput,
  type InventoryMovementOutput,
} from "@/features/inventory/schema";
import { recordInventoryMovement } from "@/features/inventory/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";
import type { Dictionary } from "@/i18n/dictionaries";
import { ProductBarcodeScanner } from "@/components/shared/barcode-scanner";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
};

function productLabel(product: ProductOption, none: string) {
  return product.id ? `${product.name} (${product.sku})` : none;
}

function ProductPickerField({
  value,
  onChange,
  products,
  t,
}: {
  value: string;
  onChange: (product: ProductOption | null) => void;
  products: ProductOption[];
  t: Dictionary;
}) {
  const { contains } = useComboboxFilter();
  const noneProduct: ProductOption = {
    id: "",
    name: t.inventory.productPickerPlaceholder,
    sku: "",
    barcode: null,
    quantity: 0,
  };
  const items = [noneProduct, ...products];
  const selected = items.find((item) => item.id === value) ?? noneProduct;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(product: ProductOption | null) => onChange(product)}
      isItemEqualToValue={(a: ProductOption, b: ProductOption) => a.id === b.id}
      itemToStringValue={(item: ProductOption) => item.id}
      itemToStringLabel={(item: ProductOption) =>
        productLabel(item, t.inventory.productPickerPlaceholder)
      }
      filter={contains}
    >
      <div className="flex gap-2">
        <ComboboxTrigger className="w-full"><ComboboxValue /></ComboboxTrigger>
        <ProductBarcodeScanner products={products} onSelect={onChange} />
      </div>
      <ComboboxContent>
        <ComboboxInput placeholder={t.inventory.productSearchPlaceholder} />
        <ComboboxEmpty>{t.inventory.noResults}</ComboboxEmpty>
        <ComboboxList>
          {(item: ProductOption) => (
            <ComboboxItem key={item.id} value={item}>
              {productLabel(item, t.inventory.productPickerPlaceholder)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;

export function RecordMovementDialog({
  products,
  defaultProductId,
  compact,
}: {
  products: ProductOption[];
  defaultProductId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const getDefaultValues = () => ({
    productId: defaultProductId ?? "",
    type: "IN" as const,
    quantity: 0,
    reason: "",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<InventoryMovementInput, unknown, InventoryMovementOutput>({
    resolver: zodResolver(inventoryMovementSchema),
    defaultValues: getDefaultValues(),
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  const selectedProductId = watch("productId");
  const selectedType = watch("type");
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );

  function onSubmit(values: InventoryMovementOutput) {
    startTransition(async () => {
      const result = await recordInventoryMovement(values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.inventory.toastRecorded);
      reset(getDefaultValues());
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        // Reset on both open and close: this form lives outside the dialog
        // content so it stays mounted, and a half-filled-then-cancelled form
        // must not keep flagging "unsaved changes" on the page behind it.
        reset(getDefaultValues());
      }}
    >
      <DialogTrigger
        render={
          compact ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              title={t.inventory.recordMovementButton}
            >
              <ArrowLeftRight className="size-4" />
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" />
              {t.inventory.recordMovementButton}
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.inventory.recordMovementButton}</DialogTitle>
          <DialogDescription>
            {t.inventory.recordMovementDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <fieldset disabled={isPending} className="contents space-y-4">
          <div className="space-y-2">
            <Label>{t.inventory.productLabel}</Label>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <ProductPickerField
                  value={field.value ?? ""}
                  products={products}
                  onChange={(product) => field.onChange(product?.id ?? "")}
                  t={t}
                />
              )}
            />
            {errors.productId && (
              <p className="text-sm text-destructive">
                {errors.productId.message}
              </p>
            )}
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                {t.inventory.currentQuantityPrefix}{" "}
                {selectedProduct.quantity.toLocaleString(locale)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t.inventory.movementTypeLabel}</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (!value) return;
                    field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        t.statusLabels.movementType[
                          value as keyof typeof t.statusLabels.movementType
                        ] ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t.statusLabels.movementType[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-quantity">
              {selectedType === "ADJUSTMENT"
                ? t.inventory.newQuantityLabel
                : t.inventory.quantityLabel}
            </Label>
            <Input
              id="movement-quantity"
              type="number"
              min={0}
              step="0.001"
              {...register("quantity")}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">
                {errors.quantity.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-reason">{t.inventory.reasonLabel}</Label>
            <Input id="movement-reason" {...register("reason")} />
          </div>

          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
