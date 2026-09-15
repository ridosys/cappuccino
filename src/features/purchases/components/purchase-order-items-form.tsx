"use client";

import { useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SortableItem } from "@/components/shared/sortable-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  purchaseOrderItemsSchema,
  type PurchaseOrderItemsInput,
  type PurchaseOrderItemsOutput,
} from "@/features/purchases/schema";
import { updatePurchaseOrderItems } from "@/features/purchases/actions";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/dictionaries";
import { ProductBarcodeScanner } from "@/components/shared/barcode-scanner";
import { QuickProductAddPanel } from "@/components/shared/quick-product-add-panel";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  price1: number;
  price2: number;
  price3: number;
  purchasePrice: number;
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
    name: t.orders.selectProductPlaceholder,
    sku: "",
    barcode: null,
    categoryId: "", categoryName: "", brandId: null, brandName: null,
    price1: 0,
    price2: 0,
    price3: 0,
    purchasePrice: 0,
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
        productLabel(item, t.orders.selectProductPlaceholder)
      }
      filter={contains}
    >
      <div className="flex gap-2">
        <ComboboxTrigger className="w-full"><ComboboxValue /></ComboboxTrigger>
        <ProductBarcodeScanner products={products} onSelect={onChange} />
      </div>
      <ComboboxContent>
        <ComboboxInput placeholder={t.inventory.productSearchPlaceholder} />
        <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
        <ComboboxList>
          {(item: ProductOption) => (
            <ComboboxItem key={item.id} value={item}>
              {productLabel(item, t.orders.selectProductPlaceholder)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function PurchaseOrderItemsForm({
  purchaseOrderId,
  items,
  products,
  locked = false,
}: {
  purchaseOrderId: string;
  items: {
    productId: string;
    productName?: string;
    quantity: number;
    unitCost: number;
  }[];
  products: ProductOption[];
  locked?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<PurchaseOrderItemsInput, unknown, PurchaseOrderItemsOutput>({
    resolver: zodResolver(purchaseOrderItemsSchema),
    defaultValues: {
      items: items.length
        ? items.map(({ productId, quantity, unitCost }) => ({
            productId,
            quantity,
            unitCost,
            price1: products.find((p) => p.id === productId)?.price1 ?? 0,
            updateProductPurchasePrice: true,
          }))
        : [
            {
              productId: "",
              quantity: 1,
              unitCost: 0,
              price1: 0,
              updateProductPurchasePrice: true,
            },
          ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  }
  function handleQuickAdd(selected: ProductOption[]) {
    if (selected.length === 0) return;
    selected.forEach((product) =>
      append({
        productId: product.id,
        quantity: 1,
        unitCost: product.purchasePrice,
        price1: product.price1,
        updateProductPurchasePrice: true,
      }),
    );
    // Drop the leftover placeholder rows (no product picked) now that real
    // lines have been added, so the quick-add doesn't leave an empty "اختر
    // منتجاً" row hanging above the added products.
    const emptyIndexes = getValues("items")
      .map((item, index) => (item.productId ? -1 : index))
      .filter((index) => index !== -1);
    if (emptyIndexes.length) remove(emptyIndexes);
  }
  const watchedItems = watch("items");
  const total = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0,
  );

  useUnsavedChanges(isDirty && !locked);

  if (locked) {
    const lockedTotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );
    return (
      <div className="space-y-4">
        <div className={items.length > 5 ? "max-h-120 overflow-y-auto" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.purchases.productLabel}</TableHead>
                <TableHead>{t.purchases.quantityLabel}</TableHead>
                <TableHead>{t.purchases.unitCostLabel}</TableHead>
                <TableHead>{t.purchases.totalLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.productId}-${index}`}>
                  <TableCell className="font-medium">
                    {item.productName ?? item.productId}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {formatCurrency(item.unitCost, locale, false, 4)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.quantity * item.unitCost, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t pt-4">
          <p className="font-medium">
            {t.purchases.totalLabel}: {formatCurrency(lockedTotal, locale)}
          </p>
        </div>
      </div>
    );
  }

  function onSubmit(values: PurchaseOrderItemsOutput) {
    startTransition(async () => {
      const result = await updatePurchaseOrderItems(purchaseOrderId, values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      reset(getValues());
      toast.success(t.purchases.itemsUpdatedToast);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <Label>{t.purchases.itemsLabel}</Label>
        <QuickProductAddPanel products={products} onAddProducts={handleQuickAdd} />
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
          {t.purchases.updateProductPurchasePriceHelp}
        </p>

        <DndContext
          id="purchase-items-edit-dnd"
          sensors={dragSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((field) => field.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              className={
                fields.length > 5
                  ? "max-h-120 space-y-3 overflow-y-auto pe-1"
                  : "space-y-3"
              }
            >
              {fields.map((field, index) => (
                <SortableItem
                  key={field.id}
                  id={field.id}
                  className="grid grid-cols-1 items-start gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto_auto_auto]"
                >
                  {(dragHandle) => (
                    <>
                      <div className="flex items-center justify-center pt-1 sm:pt-6">
                        {dragHandle}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.purchases.productLabel}
                        </Label>
                        <Controller
                          control={control}
                          name={`items.${index}.productId`}
                          render={({ field: productField }) => (
                            <ProductPickerField
                              value={productField.value ?? ""}
                              products={products}
                              onChange={(product) => {
                                productField.onChange(product?.id ?? "");
                                setValue(
                                  `items.${index}.unitCost`,
                                  product?.purchasePrice ?? 0,
                                );
                                setValue(
                                  `items.${index}.price1`,
                                  product?.price1 ?? 0,
                                );
                              }}
                              t={t}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.purchases.quantityLabel}
                        </Label>
                        <Input
                          type="number"
                          min={0.001}
                          step="0.001"
                          className="w-24"
                          {...register(`items.${index}.quantity`)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.purchases.unitCostLabel}
                        </Label>
                        <div className="w-32">
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            inputMode="decimal"
                            {...register(`items.${index}.unitCost`)}
                          />
                        </div>
                        <Controller
                          control={control}
                          name={`items.${index}.updateProductPurchasePrice`}
                          render={({ field }) => (
                            <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked === true)
                                }
                              />
                              <span>
                                {t.purchases.updateProductPurchasePriceLabel}
                              </span>
                            </label>
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.products.price1Label}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          inputMode="decimal"
                          className="w-28"
                          {...register(`items.${index}.price1`)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="hidden text-xs sm:block">&nbsp;</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {errors.items?.message && (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() =>
            append({
              productId: "",
              quantity: 1,
              unitCost: 0,
              price1: 0,
              updateProductPurchasePrice: true,
            })
          }
        >
          <Plus className="size-4" />
          {t.purchases.addItemButton}
        </Button>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="font-medium">{t.purchases.totalLabel}: {formatCurrency(total, locale)}</p>
          <Button type="submit" className="cursor-pointer" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.saving : t.purchases.saveChangesButton}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
