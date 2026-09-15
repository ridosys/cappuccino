"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, UserCircle, Globe } from "lucide-react";
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
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  invoiceSchema,
  type InvoiceInput,
  type InvoiceOutput,
  INVOICE_LANGUAGE_LABELS,
} from "@/features/invoices/schema";
import {
  createInvoice,
  updateInvoice,
  recordPaymentAcrossInvoices,
  fetchCustomerOutstandingInvoices,
  checkInvoiceStockAvailability,
} from "@/features/invoices/actions";
import { formatCurrency } from "@/lib/currency";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/features/customers/components/customer-picker";
import { PaymentFieldsSection } from "@/features/invoices/components/payment-fields";
import { PaymentHistory } from "@/features/invoices/components/payment-history";
import { BalanceConfirmDialog } from "@/features/invoices/components/balance-confirm-dialog";
import {
  DistributeExcessDialog,
  type OutstandingInvoiceRow,
} from "@/features/invoices/components/distribute-excess-dialog";
import {
  checkBalanceConfirmation,
  capBalanceLines,
  capPaymentLinesToTotal,
  type BalanceConfirmRequest,
} from "@/features/invoices/balance-resolution";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import {
  StockAlertDialog,
  type StockIssue,
} from "@/components/shared/stock-alert-dialog";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { ProductBarcodeScanner } from "@/components/shared/barcode-scanner";

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
  brandId: string | null;
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
    name: t.invoices.noProductSelected,
    sku: "",
    barcode: null,
    price1: 0,
    price2: 0,
    price3: 0,
    quantity: 0,
    categoryId: "",
    brandId: null,
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
        productLabel(item, t.invoices.noProductSelected)
      }
      filter={contains}
    >
      <div className="flex gap-2">
        <ComboboxTrigger className="w-full">
          <ComboboxValue />
        </ComboboxTrigger>
        <ProductBarcodeScanner products={products} onSelect={onChange} />
      </div>
      <ComboboxContent>
        <ComboboxInput placeholder={t.inventory.productSearchPlaceholder} />
        <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
        <ComboboxList>
          {(item: ProductOption) => (
            <ComboboxItem key={item.id} value={item}>
              {productLabel(item, t.invoices.noProductSelected)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

type CategoryOption = { id: string; name: string };

function CategoryQuickAddPanel({
  categories,
  brands,
  products,
  onAddProducts,
  t,
  locale,
}: {
  categories: CategoryOption[];
  brands: CategoryOption[];
  products: ProductOption[];
  onAddProducts: (products: ProductOption[]) => void;
  t: Dictionary;
  locale: Locale;
}) {
  const { contains } = useComboboxFilter();
  const NONE_CATEGORY: CategoryOption = {
    id: "",
    name: t.invoices.selectCategoryPlaceholder,
  };
  const NONE_BRAND: CategoryOption = {
    id: "",
    name: t.invoices.selectBrandPlaceholder,
  };
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoryItems = [NONE_CATEGORY, ...categories];
  const selectedCategory =
    categoryItems.find((item) => item.id === categoryId) ?? NONE_CATEGORY;

  const brandItems = [NONE_BRAND, ...brands];
  const selectedBrand =
    brandItems.find((item) => item.id === brandId) ?? NONE_BRAND;

  const hasFilter = Boolean(categoryId) || Boolean(brandId);
  const trimmedQuery = productQuery.trim().toLowerCase();
  const filteredProducts = hasFilter
    ? products
        .filter((product) => !categoryId || product.categoryId === categoryId)
        .filter((product) => !brandId || product.brandId === brandId)
        .filter(
          (product) =>
            !trimmedQuery ||
            product.name.toLowerCase().includes(trimmedQuery) ||
            product.sku.toLowerCase().includes(trimmedQuery),
        )
    : [];

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const toAdd = filteredProducts.filter((product) =>
      selectedIds.has(product.id),
    );
    if (toAdd.length === 0) return;
    onAddProducts(toAdd);
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label>{t.invoices.quickAddTitle}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Combobox
          items={categoryItems}
          value={selectedCategory}
          onValueChange={(category: CategoryOption | null) => {
            setCategoryId(category?.id ?? "");
            setSelectedIds(new Set());
          }}
          isItemEqualToValue={(a: CategoryOption, b: CategoryOption) =>
            a.id === b.id
          }
          itemToStringValue={(item: CategoryOption) => item.id}
          itemToStringLabel={(item: CategoryOption) => item.name}
          filter={contains}
        >
          <ComboboxTrigger className="w-full">
            <ComboboxValue />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder={t.categories.searchPlaceholder} />
            <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
            <ComboboxList>
              {(item: CategoryOption) => (
                <ComboboxItem key={item.id} value={item}>
                  {item.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Combobox
          items={brandItems}
          value={selectedBrand}
          onValueChange={(brand: CategoryOption | null) => {
            setBrandId(brand?.id ?? "");
            setSelectedIds(new Set());
          }}
          isItemEqualToValue={(a: CategoryOption, b: CategoryOption) =>
            a.id === b.id
          }
          itemToStringValue={(item: CategoryOption) => item.id}
          itemToStringLabel={(item: CategoryOption) => item.name}
          filter={contains}
        >
          <ComboboxTrigger className="w-full">
            <ComboboxValue />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder={t.brands.searchPlaceholder} />
            <ComboboxEmpty>{t.common.noResults}</ComboboxEmpty>
            <ComboboxList>
              {(item: CategoryOption) => (
                <ComboboxItem key={item.id} value={item}>
                  {item.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {hasFilter && (
        <>
          <Input
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder={t.inventory.productSearchPlaceholder}
          />
          {filteredProducts.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              {t.invoices.noMatchingProducts}
            </p>
          ) : (
            <>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-background p-1.5">
                {filteredProducts.map((product) => (
                  <label
                    key={product.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggle(product.id)}
                    />
                    <span className="flex-1 truncate">{product.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatCurrency(product.price1, locale)}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full cursor-pointer"
                disabled={selectedIds.size === 0}
                onClick={handleAdd}
              >
                <Plus className="size-4" />
                {formatMessage(t.invoices.addSelectedToInvoice, {
                  count: selectedIds.size.toLocaleString(locale),
                })}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** A Date -> "YYYY-MM-DD" for <input type="date">, using local calendar
 * parts so the value shown matches how it's read back on save (noon local). */
function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

type InvoiceRecord = {
  id: string;
  language: string;
  createdAt: Date;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  orderId: string | null;
  items: {
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
} | null;

export function InvoiceForm({
  invoice,
  products,
  customers,
  categories,
  brands,
  orderId,
  payments,
}: {
  invoice?: InvoiceRecord;
  products: ProductOption[];
  customers: CustomerOption[];
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  orderId?: string;
  payments?: {
    id: string;
    amount: number;
    method: string;
    note: string | null;
    createdAt: Date;
    invoiceNumber?: string;
  }[];
}) {
  const [isPending, startTransition] = useTransition();
  const { t, locale } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<InvoiceInput, unknown, InvoiceOutput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      language: (invoice?.language as InvoiceOutput["language"]) ?? "AR",
      issueDate: invoice?.createdAt ? toDateInputValue(invoice.createdAt) : "",
      customerId: invoice?.customerId ?? "",
      customerName: invoice?.customerName ?? "",
      customerPhone: invoice?.customerPhone ?? "",
      customerEmail: invoice?.customerEmail ?? "",
      notes: invoice?.notes ?? "",
      orderId: invoice?.orderId ?? orderId ?? "",
      payments: [],
      items: invoice?.items.length
        ? invoice.items.map((item) => ({
            productId: item.productId ?? "",
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : [{ productId: "", name: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const customerId = watch("customerId");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerBalance = selectedCustomer?.balance ?? 0;
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const existingQuantityByProduct = new Map<string, number>();
  invoice?.items.forEach((item) => {
    if (!item.productId) return;
    existingQuantityByProduct.set(
      item.productId,
      (existingQuantityByProduct.get(item.productId) ?? 0) + item.quantity,
    );
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
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  function handleAddFromCategory(selected: ProductOption[]) {
    const isOnlyEmptyRow =
      fields.length === 1 && !items?.[0]?.productId && !items?.[0]?.name;

    selected.forEach((product, index) => {
      if (index === 0 && isOnlyEmptyRow) {
        setValue("items.0.productId", product.id);
        setValue("items.0.name", product.name);
        setValue("items.0.quantity", 1);
        setValue("items.0.unitPrice", product.price1);
        return;
      }
      append({
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price1,
      });
    });

    toast.success(
      formatMessage(t.invoices.addedProductsToast, {
        count: selected.length.toLocaleString(locale),
      }),
    );
  }

  const [pendingValues, setPendingValues] = useState<InvoiceOutput | null>(
    null,
  );
  const [confirmRequest, setConfirmRequest] =
    useState<BalanceConfirmRequest | null>(null);
  const [distributeState, setDistributeState] = useState<{
    excessAmount: number;
    invoices: OutstandingInvoiceRow[];
  } | null>(null);
  const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);
  const [pendingStockValues, setPendingStockValues] =
    useState<InvoiceOutput | null>(null);
  const allowNegativeStockRef = useRef(false);

  function submitInvoice(values: InvoiceOutput, excessToBalance?: boolean) {
    startTransition(async () => {
      const result = invoice
        ? await updateInvoice(invoice.id, values, {
            allowNegativeStock: allowNegativeStockRef.current,
          })
        : await createInvoice(values, {
            excessToBalance,
            allowNegativeStock: allowNegativeStockRef.current,
          });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      allowNegativeStockRef.current = false;

      if (invoice) {
        // Editing stays on the page — re-baseline so it's no longer "dirty".
        reset(getValues());
        toast.success(t.invoices.updateToast);
      }
      // Creating redirects away, so nothing to reset there.
    });
  }

  async function onSubmit(values: InvoiceOutput) {
    const issue = await checkInvoiceStockAvailability(
      values.items,
      invoice?.id,
    );
    if (issue && !allowNegativeStockRef.current) {
      setStockIssue(issue);
      setPendingStockValues(values);
      return;
    }
    if (invoice) {
      submitInvoice(values);
      return;
    }

    const request = checkBalanceConfirmation({
      total,
      customerBalance,
      hasCustomer: Boolean(values.customerId),
      lines: values.payments,
    });
    if (request) {
      setPendingValues(values);

      // An overpayment on a brand-new invoice can pay off this customer's
      // other outstanding invoices instead of just becoming رصيد — offer
      // that first when there's actually something to pay off.
      if (request.kind === "excess-payment" && values.customerId) {
        const outstanding = await fetchCustomerOutstandingInvoices(
          values.customerId,
        );
        if (outstanding.length > 0) {
          setDistributeState({
            excessAmount: request.excessAmount,
            invoices: outstanding.map((row) => ({
              ...row,
              total: Number(row.total),
              paidAmount: Number(row.paidAmount),
            })),
          });
          return;
        }
      }

      setConfirmRequest(request);
      return;
    }
    submitInvoice(values);
  }

  function cancelConfirm() {
    setConfirmRequest(null);
    setPendingValues(null);
  }

  function handleDistributeConfirm(invoiceIds: string[]) {
    if (!pendingValues || !distributeState || !pendingValues.customerId) return;
    const method = pendingValues.payments[0]?.method ?? "CASH";
    const cappedPayments = capPaymentLinesToTotal(
      pendingValues.payments,
      total,
    );
    const customerId = pendingValues.customerId;
    const excessAmount = distributeState.excessAmount;
    const values = pendingValues;
    setDistributeState(null);
    setPendingValues(null);

    startTransition(async () => {
      const distributed = await recordPaymentAcrossInvoices(customerId, {
        invoiceIds,
        amount: excessAmount,
        method,
        note: t.invoices.excessDistributionNote,
        excessToBalance: true,
      });
      if (distributed.error) {
        toast.error(distributed.error);
        return;
      }

      const result = await createInvoice(
        { ...values, payments: cappedPayments },
        {
          batchId: distributed.batchId,
          allowNegativeStock: allowNegativeStockRef.current,
        },
      );
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  function handleDistributeSkip() {
    if (!distributeState) return;
    setConfirmRequest({
      kind: "excess-payment",
      excessAmount: distributeState.excessAmount,
    });
    setDistributeState(null);
  }

  function resolveUseAvailable() {
    if (!pendingValues || confirmRequest?.kind !== "insufficient") return;
    const payments = capBalanceLines(
      pendingValues.payments,
      confirmRequest.availableBalance,
    );
    setConfirmRequest(null);
    submitInvoice({ ...pendingValues, payments });
  }

  function resolveGoNegative() {
    if (!pendingValues) return;
    setConfirmRequest(null);
    submitInvoice(pendingValues);
  }

  function resolveUseBalance() {
    if (!pendingValues || confirmRequest?.kind !== "offer-balance") return;
    const amount = Math.min(
      confirmRequest.remaining,
      confirmRequest.availableBalance,
    );
    const payments = [
      ...pendingValues.payments,
      { method: "BALANCE" as const, amount },
    ];
    setConfirmRequest(null);
    submitInvoice({ ...pendingValues, payments });
  }

  function resolveDecline() {
    if (!pendingValues) return;
    setConfirmRequest(null);
    submitInvoice(pendingValues);
  }

  function resolveAddExcessToBalance() {
    if (!pendingValues) return;
    setConfirmRequest(null);
    submitInvoice(pendingValues, true);
  }

  function resolveDiscardExcess() {
    if (!pendingValues) return;
    setConfirmRequest(null);
    submitInvoice(pendingValues, false);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="min-w-0 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <StockAlertDialog
            issue={stockIssue}
            onClose={() => {
              setStockIssue(null);
              setPendingStockValues(null);
            }}
            onConfirm={() => {
              const values = pendingStockValues;
              allowNegativeStockRef.current = true;
              setStockIssue(null);
              setPendingStockValues(null);
              if (values) void onSubmit(values);
            }}
          />
          <fieldset disabled={isPending} className="contents space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>{t.invoices.customerLabel}</Label>
                  {customerId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto cursor-pointer gap-1 px-2 py-1 text-xs"
                      nativeButton={false}
                      render={
                        <Link href={`/dashboard/customers/${customerId}`} />
                      }
                    >
                      <UserCircle className="size-3.5" />
                      {t.invoices.goToCustomerPage}
                    </Button>
                  )}
                </div>
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <CustomerPicker
                      customers={customers}
                      value={field.value}
                      onChange={(customer) => {
                        field.onChange(customer?.id ?? "");
                        setValue("customerName", customer?.name ?? "");
                        setValue("customerPhone", customer?.phone ?? "");
                        setValue("customerEmail", customer?.email ?? "");
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
              <div className="space-y-2">
                <Label>{t.orders.invoiceLanguageLabel}</Label>
                <Controller
                  control={control}
                  name="language"
                  render={({ field }) => (
                    <Select
                      items={INVOICE_LANGUAGE_LABELS}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full" icon={Globe}>
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
              {invoice && (
                <div className="space-y-2">
                  <Label htmlFor="invoice-issue-date">
                    {t.invoices.issueDateLabel}
                  </Label>
                  <Input
                    id="invoice-issue-date"
                    type="date"
                    className="w-full"
                    {...register("issueDate")}
                  />
                  {errors.issueDate && (
                    <p className="text-sm text-destructive">
                      {errors.issueDate.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!invoice && (
              <PaymentFieldsSection
                control={control}
                errors={errors}
                total={total}
                customerBalance={customerBalance}
                hasCustomer={Boolean(customerId)}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="invoice-notes">
                {t.customers.notesOptionalLabel}
              </Label>
              <Textarea id="invoice-notes" rows={2} {...register("notes")} />
            </div>

            <div className="space-y-3">
              <Label>
                {formatMessage(t.invoices.productsCountLabel, {
                  count: fields.length,
                })}
              </Label>

              <DndContext
                id="invoice-items-dnd"
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
                        className="grid grid-cols-1 items-start gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]"
                      >
                        {(dragHandle) => (
                          <>
                            <div className="flex items-center justify-center pt-1 sm:pt-6">
                              {dragHandle}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {t.invoices.selectFromProductsLabel}
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
                                      if (product?.id) {
                                        setValue(
                                          `items.${index}.name`,
                                          product.name,
                                        );
                                        setValue(
                                          `items.${index}.unitPrice`,
                                          product.price1,
                                        );
                                      }
                                    }}
                                    t={t}
                                  />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {t.invoices.productNameInInvoiceLabel}
                              </Label>
                              <Input {...register(`items.${index}.name`)} />
                              {errors.items?.[index]?.name && (
                                <p className="text-sm text-destructive">
                                  {errors.items[index]?.name?.message}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {t.purchases.quantityLabel}
                              </Label>
                              <Input
                                type="number"
                                min={0.001}
                                step="0.001"
                                className={`w-20 ${(() => {
                                  const product = productsById.get(
                                    items?.[index]?.productId ?? "",
                                  );
                                  return product &&
                                    (Number(items?.[index]?.quantity) || 0) >
                                      product.quantity +
                                        (existingQuantityByProduct.get(product.id) ?? 0)
                                    ? "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
                                    : "";
                                })()}`}
                                {...register(`items.${index}.quantity`)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {t.orders.columnPrice}
                              </Label>
                              <div className="flex flex-col gap-1.5">
                                <PriceTierField
                                  price={Number(items?.[index]?.unitPrice) || 0}
                                  product={productsById.get(
                                    items?.[index]?.productId ?? "",
                                  )}
                                  onChange={(price) =>
                                    setValue(`items.${index}.unitPrice`, price)
                                  }
                                  t={t}
                                  locale={locale}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="w-24"
                                  {...register(`items.${index}.unitPrice`)}
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
                  append({
                    productId: "",
                    name: "",
                    quantity: 1,
                    unitPrice: 0,
                  })
                }
              >
                <Plus className="size-4" />
                {t.products.addProduct}
              </Button>
            </div>

            <div className="space-y-2 lg:hidden">
              <CategoryQuickAddPanel
                categories={categories}
                brands={brands}
                products={products}
                onAddProducts={handleAddFromCategory}
                t={t}
                locale={locale}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <p className="font-medium">
                {t.purchases.totalLabel}: {formatCurrency(total, locale)}
              </p>
              <Button
                type="submit"
                disabled={isPending}
                className="cursor-pointer"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending
                  ? t.common.saving
                  : invoice
                    ? t.purchases.saveChangesButton
                    : t.orders.generateInvoiceDialogTitle}
              </Button>
            </div>
          </fieldset>

          <BalanceConfirmDialog
            request={confirmRequest}
            onCancel={cancelConfirm}
            onUseAvailable={resolveUseAvailable}
            onGoNegative={resolveGoNegative}
            onUseBalance={resolveUseBalance}
            onDecline={resolveDecline}
            onAddExcessToBalance={resolveAddExcessToBalance}
            onDiscardExcess={resolveDiscardExcess}
          />

          {distributeState && (
            <DistributeExcessDialog
              open
              excessAmount={distributeState.excessAmount}
              invoices={distributeState.invoices}
              onConfirm={handleDistributeConfirm}
              onSkip={handleDistributeSkip}
            />
          )}
        </form>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20">
        {invoice ? (
          <>
            <div className="space-y-6">
              <PaymentHistory payments={payments ?? []} />
            </div>
            <div className="space-y-6 hidden lg:block">
              <CategoryQuickAddPanel
                categories={categories}
                brands={brands}
                products={products}
                onAddProducts={handleAddFromCategory}
                t={t}
                locale={locale}
              />
            </div>
          </>
        ) : (
          <div className="space-y-6 hidden lg:block">
            <CategoryQuickAddPanel
              categories={categories}
              brands={brands}
              products={products}
              onAddProducts={handleAddFromCategory}
              t={t}
              locale={locale}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
