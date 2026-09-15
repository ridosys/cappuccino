"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  createOrderSchema,
  type CreateOrderInput,
  type CreateOrderOutput,
} from "@/features/orders/schema";
import { createOrder } from "@/features/orders/actions";
import { formatCurrency } from "@/lib/currency";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/features/customers/components/customer-picker";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
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

function productLabel(product: ProductOption, none: string) {
  return product.id ? `${product.name} (${product.sku})` : none;
}

function priceTierLabel(price: number, product: ProductOption): PriceTier {
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
  product: ProductOption | undefined;
  onChange: (price: number) => void;
  t: Dictionary;
  locale: Locale;
}) {
  if (!product?.id) return null;

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
      <SelectTrigger className="w-full">
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

export function OrderForm({
  products,
  customers,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);
  const [pendingStockValues, setPendingStockValues] = useState<CreateOrderOutput | null>(null);
  const { t, locale } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateOrderInput, unknown, CreateOrderOutput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: "",
      notes: "",
      items: [{ productId: "", quantity: 1, price: 0 }],
    },
  });

  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  useUnsavedChanges(isDirty);

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
      sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0,
  );

  function submitOrder(values: CreateOrderOutput, allowNegativeStock = false) {
    startTransition(async () => {
      const result = await createOrder(values, { allowNegativeStock });
      if (result?.error) toast.error(result.error);
    });
  }

  function onSubmit(values: CreateOrderOutput) {
    const issue = findStockIssue(values.items, products);
    if (issue) {
      setStockIssue(issue);
      setPendingStockValues(values);
      return;
    }
    submitOrder(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <StockAlertDialog
        issue={stockIssue}
        onClose={() => { setStockIssue(null); setPendingStockValues(null); }}
        onConfirm={() => {
          if (pendingStockValues) submitOrder(pendingStockValues, true);
          setStockIssue(null);
          setPendingStockValues(null);
        }}
      />
      <fieldset disabled={isPending} className="contents">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.orders.itemsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-notes">{t.customers.notesOptionalLabel}</Label>
                <Textarea id="order-notes" rows={2} {...register("notes")} />
              </div>

              <Label>{t.orders.productsLabel}</Label>
              <QuickProductAddPanel products={products} onAddProducts={(selected) => selected.forEach((product) => append({ productId: product.id, quantity: 1, price: product.price1 }))} />

              <DndContext
                id="order-items-dnd"
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
                        className="grid grid-cols-1 items-start gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto_auto]"
                      >
                        {(dragHandle) => (
                          <>
                            <div className="flex items-center justify-center pt-1 sm:pt-6">
                              {dragHandle}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t.invoices.selectFromProductsLabel}</Label>
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
                                        setValue(
                                          `items.${index}.price`,
                                          product.price1,
                                        );
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
                            <div className="space-y-1">
                              <Label className="text-xs">{t.purchases.quantityLabel}</Label>
                              <Input
                                type="number"
                                min={0.001}
                                step="0.001"
                                className={`w-20 ${(() => {
                                  const product = productsById.get(items?.[index]?.productId ?? "");
                                  return product && (Number(items?.[index]?.quantity) || 0) > product.quantity
                                    ? "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
                                    : "";
                                })()}`}
                                {...register(`items.${index}.quantity`)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t.orders.columnPrice}</Label>
                              <div className="flex flex-col gap-1.5">
                                <PriceTierField
                                  price={Number(items?.[index]?.price) || 0}
                                  product={productsById.get(
                                    items?.[index]?.productId ?? "",
                                  )}
                                  onChange={(price) =>
                                    setValue(`items.${index}.price`, price)
                                  }
                                  t={t}
                                  locale={locale}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="w-24"
                                  {...register(`items.${index}.price`)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="hidden text-xs sm:block">
                                &nbsp;
                              </Label>
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
                <p className="text-sm text-destructive">
                  {errors.items.message}
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  append({ productId: "", quantity: 1, price: 0 })
                }
              >
                <Plus className="size-4" />
                {t.products.addProduct}
              </Button>

              <div className="flex items-center justify-between border-t pt-4">
                <p className="font-medium">{t.purchases.totalLabel}: {formatCurrency(total, locale)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.orders.actionsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full cursor-pointer"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? t.orders.creatingOrder : t.orders.createOrderButton}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t.orders.customerInfoTitle}</CardTitle>
              {selectedCustomer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  onClick={() => setEditCustomerOpen(true)}
                  title={t.customers.editCustomerInfo}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t.orders.selectOrCreateCustomerLabel}
                </Label>
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <CustomerPicker
                      customers={customers}
                      value={field.value}
                      onChange={(customer) => {
                        field.onChange(customer?.id ?? "");
                        setSelectedCustomer(customer);
                      }}
                    />
                  )}
                />
                {errors.customerId && (
                  <p className="text-sm text-destructive">
                    {errors.customerId.message}
                  </p>
                )}
              </div>

              {selectedCustomer ? (
                <div className="space-y-2 border-t pt-3">
                  <p>
                    <span className="text-muted-foreground">{t.orders.nameLabel}: </span>
                    {selectedCustomer.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t.orders.phoneLabel}: </span>
                    <span dir="ltr">{selectedCustomer.phone}</span>
                  </p>
                  {selectedCustomer.email && (
                    <p>
                      <span className="text-muted-foreground">
                        {t.orders.emailLabel}:{" "}
                      </span>
                      <span dir="ltr">{selectedCustomer.email}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="border-t pt-3 text-muted-foreground">
                  {t.orders.noCustomerSelectedYet}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.orders.statusCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge variant="secondary">{t.statusLabels.order.PENDING}</Badge>
              <p className="text-xs text-muted-foreground">
                {t.orders.newOrderStatusNote}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </fieldset>

      {selectedCustomer && (
        <CustomerFormSheet
          open={editCustomerOpen}
          customer={{
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email ?? null,
            address: selectedCustomer.address ?? null,
            notes: selectedCustomer.notes ?? null,
            isFavorite: selectedCustomer.isFavorite ?? false,
            imageUrl: selectedCustomer.imageUrl ?? null,
            imagePublicId: selectedCustomer.imagePublicId ?? null,
          }}
          onOpenChange={(open) => {
            setEditCustomerOpen(open);
          }}
        />
      )}
    </form>
  );
}
