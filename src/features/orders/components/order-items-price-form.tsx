"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  orderItemsSchema,
  type OrderItemsInput,
  type OrderItemsOutput,
} from "@/features/orders/schema";
import { updateOrderItems } from "@/features/orders/actions";
import {
  ProductDetailsDialog,
  type OrderItemProduct,
} from "@/features/orders/components/product-details-dialog";
import { InvoiceLockedNotice } from "@/features/orders/components/invoice-locked-notice";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import type { Dictionary } from "@/i18n/dictionaries";
import { ProductBarcodeScanner } from "@/components/shared/barcode-scanner";
import type { Locale } from "@/i18n/config";
import { StockAlertDialog, findStockIssue, type StockIssue } from "@/components/shared/stock-alert-dialog";
import { QuickProductAddPanel } from "@/components/shared/quick-product-add-panel";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price1: number;
  price2: number;
  price3: number;
  quantity: number;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
};

type PriceTier = "price1" | "price2" | "price3" | "custom";

function SortableTableRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <button
      type="button"
      className="cursor-grab touch-none text-muted-foreground outline-none hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "relative z-10 opacity-50" : undefined}
    >
      {children(dragHandle)}
    </TableRow>
  );
}

function productLabel(product: ProductOption, none: string) {
  return product.id ? `${product.name} (${product.sku})` : none;
}

function priceTierLabel(
  price: number,
  product: { price1: number; price2: number; price3: number },
): PriceTier {
  if (price === product.price1) return "price1";
  if (price === product.price2) return "price2";
  if (price === product.price3) return "price3";
  return "custom";
}

function PriceTierField({
  price,
  product,
  onChange,
  t,
  locale,
}: {
  price: number;
  product: { price1: number; price2: number; price3: number } | undefined;
  onChange: (price: number) => void;
  t: Dictionary;
  locale: Locale;
}) {
  if (!product) return null;

  const tierLabels: Record<PriceTier, string> = {
    price1: t.reports.columnPrice1,
    price2: t.reports.columnPrice2,
    price3: t.reports.columnPrice3,
    custom: t.orders.customPrice,
  };

  return (
    <Select
      value={priceTierLabel(price, product)}
      onValueChange={(tier) => {
        if (tier === "price1") onChange(product.price1);
        else if (tier === "price2") onChange(product.price2);
        else if (tier === "price3") onChange(product.price3);
      }}
    >
      <SelectTrigger className="w-36">
        <SelectValue>
          {(value: string) => tierLabels[value as PriceTier] ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="price1">
          ({formatCurrency(product.price1, locale)})
        </SelectItem>
        <SelectItem value="price2">
          ({formatCurrency(product.price2, locale)})
        </SelectItem>
        <SelectItem value="price3">
          ({formatCurrency(product.price3, locale)})
        </SelectItem>
        <SelectItem value="custom">{t.orders.customPrice}</SelectItem>
      </SelectContent>
    </Select>
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
    price1: 0,
    price2: 0,
    price3: 0,
    quantity: 0,
    categoryId: "", categoryName: "", brandId: null, brandName: null,
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

export function OrderItemsPriceForm({
  orderId,
  items,
  products,
  locked = false,
  invoiceId,
  invoiceNumber,
}: {
  orderId: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    product: OrderItemProduct;
  }[];
  products: ProductOption[];
  locked?: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
}) {
  const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);
  const [pendingStockValues, setPendingStockValues] = useState<OrderItemsOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<OrderItemsInput, unknown, OrderItemsOutput>({
    resolver: zodResolver(orderItemsSchema),
    defaultValues: {
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
      })),
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
    if (oldIndex !== -1 && newIndex !== -1) {
      move(oldIndex, newIndex);
    }
  }

  const watchedItems = watch("items");
  const productsById = new Map(products.map((product) => [product.id, product]));

  const total = fields.reduce((sum, _field, index) => {
    const price = Number(watchedItems?.[index]?.price ?? 0) || 0;
    const quantity = Number(watchedItems?.[index]?.quantity ?? 0) || 0;
    return sum + price * quantity;
  }, 0);

  useUnsavedChanges(isDirty);

  function submitItems(values: OrderItemsOutput, allowNegativeStock = false) {
    startTransition(async () => {
      const result = await updateOrderItems(orderId, values, { allowNegativeStock });
      if (result?.error) { toast.error(result.error); return; }
      reset(getValues());
      toast.success(t.orders.itemsUpdatedToast);
    });
  }

  function onSubmit(values: OrderItemsOutput) {
    const issue = findStockIssue(values.items, products);
    if (issue) {
      setStockIssue(issue);
      setPendingStockValues(values);
      return;
    }
    submitItems(values);
  }

  if (locked) {
    const lockedTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    return (
      <div className="space-y-4">
        {invoiceId && invoiceNumber && (
          <InvoiceLockedNotice
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            message={t.orders.invoiceLockedItemsMessage}
          />
        )}
        <div className={items.length > 5 ? "max-h-120 overflow-y-auto" : undefined}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.orders.columnProduct}</TableHead>
              <TableHead>{t.orders.columnQuantity}</TableHead>
              <TableHead>{t.orders.columnPrice}</TableHead>
              <TableHead>{t.orders.columnTotal}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatCurrency(item.price, locale)}</TableCell>
                <TableCell>{formatCurrency(item.price * item.quantity, locale)}</TableCell>
                <TableCell>
                  <ProductDetailsDialog product={item.product} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <div className="border-t pt-4">
          <p className="font-medium">{t.orders.grandTotalLabel}: {formatCurrency(lockedTotal, locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <StockAlertDialog
        issue={stockIssue}
        onClose={() => { setStockIssue(null); setPendingStockValues(null); }}
        onConfirm={() => {
          if (pendingStockValues) submitItems(pendingStockValues, true);
          setStockIssue(null);
          setPendingStockValues(null);
        }}
      />
      <fieldset disabled={isPending} className="contents space-y-4">
      <QuickProductAddPanel products={products} onAddProducts={(selected) => selected.forEach((product) => append({ productId: product.id, quantity: 1, price: product.price1 }))} />
      <div className={fields.length > 5 ? "max-h-120 overflow-y-auto" : undefined}>
      <DndContext
        id="order-items-price-dnd"
        sensors={dragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>{t.orders.columnProduct}</TableHead>
            <TableHead>{t.orders.columnQuantity}</TableHead>
            <TableHead>{t.orders.columnPrice}</TableHead>
            <TableHead>{t.orders.columnTotal}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext
            items={fields.map((field) => field.id)}
            strategy={verticalListSortingStrategy}
          >
          {fields.map((field, index) => {
            const existingItem = items[index];
            const isExisting = Boolean(existingItem);
            const price = Number(watchedItems?.[index]?.price ?? 0) || 0;
            const quantity = Number(watchedItems?.[index]?.quantity ?? 0) || 0;
            const selectedProduct = existingItem
              ? existingItem.product
              : productsById.get(watchedItems?.[index]?.productId ?? "");

            return (
              <SortableTableRow key={field.id} id={field.id}>
                {(dragHandle) => (
                  <>
                <TableCell>
                  <div className="flex items-center justify-center">
                    {dragHandle}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {isExisting ? (
                    existingItem.productName
                  ) : (
                    <div className="space-y-1">
                      <Controller
                        control={control}
                        name={`items.${index}.productId`}
                        render={({ field: productField }) => (
                          <ProductPickerField
                            value={productField.value ?? ""}
                            products={products}
                            onChange={(product) => {
                              productField.onChange(product?.id ?? "");
                              if (product?.id) {
                                setValue(`items.${index}.price`, product.price1);
                              }
                            }}
                            t={t}
                          />
                        )}
                      />
                      {errors.items?.[index]?.productId && (
                        <p className="text-sm text-destructive">
                          {errors.items[index]?.productId?.message}
                        </p>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0.001}
                    step="0.001"
                    className={`w-20 ${
                      selectedProduct && quantity > selectedProduct.quantity
                        ? "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
                        : ""
                    }`}
                    {...register(`items.${index}.quantity`)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <PriceTierField
                      price={price}
                      product={selectedProduct}
                      onChange={(nextPrice) =>
                        setValue(`items.${index}.price`, nextPrice)
                      }
                      t={t}
                      locale={locale}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      {...register(`items.${index}.price`)}
                    />
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(price * quantity, locale)}</TableCell>
                <TableCell>
                  {isExisting ? (
                    <ProductDetailsDialog product={existingItem.product} />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
                  </>
                )}
              </SortableTableRow>
            );
          })}
          </SortableContext>
        </TableBody>
      </Table>
      </DndContext>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() => append({ productId: "", quantity: 1, price: 0 })}
      >
        <Plus className="size-4" />
        {t.products.addProduct}
      </Button>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="font-medium">{t.orders.grandTotalLabel}: {formatCurrency(total, locale)}</p>
        <Button type="submit" disabled={isPending} className="cursor-pointer">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t.common.saving : t.orders.saveChangesButton}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
