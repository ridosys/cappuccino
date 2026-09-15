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
  purchaseOrderSchema,
  type PurchaseOrderInput,
  type PurchaseOrderOutput,
} from "@/features/purchases/schema";
import { INVOICE_LANGUAGE_LABELS } from "@/features/invoices/schema";
import { createPurchaseOrder } from "@/features/purchases/actions";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/dictionaries";
import { ProductBarcodeScanner } from "@/components/shared/barcode-scanner";
import { QuickProductAddPanel } from "@/components/shared/quick-product-add-panel";
import { FileAttachmentUploader } from "@/components/shared/file-attachment-uploader";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";
import type { InvoiceLanguage } from "@/generated/prisma/client";

type Option = { id: string; name: string };
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

function SupplierPickerField({
  value,
  onChange,
  suppliers,
  t,
}: {
  value: string;
  onChange: (supplier: Option | null) => void;
  suppliers: Option[];
  t: Dictionary;
}) {
  const { contains } = useComboboxFilter();
  const noneSupplier: Option = { id: "", name: t.purchases.selectSupplierPlaceholder };
  const items = [noneSupplier, ...suppliers];
  const selected = items.find((item) => item.id === value) ?? noneSupplier;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(supplier: Option | null) => onChange(supplier)}
      isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      itemToStringValue={(item: Option) => item.id}
      itemToStringLabel={(item: Option) => item.name}
      filter={contains}
    >
      <ComboboxTrigger className="w-full sm:w-80">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder={t.purchases.supplierSearchPlaceholder} />
        <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
        <ComboboxList>
          {(item: Option) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
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

export function PurchaseOrderForm({
  suppliers,
  products,
  defaultProductId,
}: {
  suppliers: Option[];
  products: ProductOption[];
  defaultProductId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const defaultProduct = products.find(
    (product) => product.id === defaultProductId,
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<PurchaseOrderInput, unknown, PurchaseOrderOutput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: "",
      language: "AR",
      attachments: [],
      items: [
        {
          productId: defaultProduct?.id ?? "",
          quantity: 1,
          unitCost: defaultProduct?.purchasePrice ?? 0,
          price1: defaultProduct?.price1 ?? 0,
          updateProductPurchasePrice: true,
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });
  useUnsavedChanges(isDirty);
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
  const items = watch("items");
  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    0,
  );

  function onSubmit(values: PurchaseOrderOutput) {
    startTransition(async () => {
      const result = await createPurchaseOrder(values);
      if (result?.error) {
        toast.error(result.error);
      }
    });
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

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
    <div className="min-w-0 space-y-6">
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
    <fieldset disabled={isPending} className="contents space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.purchases.columnSupplier}</Label>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <SupplierPickerField
                value={field.value ?? ""}
                suppliers={suppliers}
                onChange={(supplier) => field.onChange(supplier?.id ?? "")}
                t={t}
              />
            )}
          />
          {errors.supplierId && (
            <p className="text-sm text-destructive">
              {errors.supplierId.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t.purchases.purchaseInvoiceLanguageLabel}</Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                items={INVOICE_LANGUAGE_LABELS}
                value={field.value}
                onValueChange={(value) =>
                  field.onChange(value as InvoiceLanguage)
                }
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVOICE_LANGUAGE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.purchases.attachmentsLabel}</Label>
        <Controller
          control={control}
          name="attachments"
          render={({ field }) => (
            <FileAttachmentUploader
              value={field.value ?? []}
              onChange={field.onChange}
              signEndpoint="/api/cloudinary/sign-purchase-attachment"
            />
          )}
        />
      </div>

      <div className="space-y-3">
        <Label>{t.purchases.itemsLabel}</Label>
        <div className="lg:hidden">
          <QuickProductAddPanel products={products} onAddProducts={handleQuickAdd} />
        </div>
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
          {t.purchases.updateProductPurchasePriceHelp}
        </p>

        <DndContext
          id="purchase-items-dnd"
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
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="font-medium">{t.purchases.totalLabel}: {formatCurrency(total, locale)}</p>
        <Button type="submit" className="cursor-pointer" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t.common.saving : t.purchases.createButton}
        </Button>
      </div>
      </fieldset>
    </form>
    </div>
    <aside className="hidden space-y-6 lg:sticky lg:top-20 lg:block">
      <QuickProductAddPanel products={products} onAddProducts={handleQuickAdd} />
    </aside>
    </div>
  );
}
