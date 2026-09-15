"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { formatCurrency } from "@/lib/currency";
import type { UploadedAttachment } from "@/components/shared/file-attachment-uploader";
import type { MatchStatus } from "@/features/purchases/matching";
import type { ScanResultPayload } from "@/features/purchases/scan-types";
import {
  confirmScannedPurchase,
  quickCreateSupplier,
} from "@/features/purchases/scan-actions";

export type ScanProductOption = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  purchasePrice: number;
  price1: number;
};

type SupplierOption = { id: string; name: string };
type IdNameOption = { id: string; name: string };

type NewProductDraft = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brandId: string;
  price1: string;
};

const EMPTY_NEW_PRODUCT: NewProductDraft = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  brandId: "",
  price1: "",
};

type LineState = {
  key: string;
  include: boolean;
  invoice: ScanResultPayload["lines"][number]["invoice"];
  status: MatchStatus;
  candidateIds: string[];
  /** "existing" (default — pick a matched system product) or "new" (create
   * a product from this line instead, admin-filled and pre-seeded from the
   * invoice text). */
  mode: "existing" | "new";
  productId: string;
  newProduct: NewProductDraft;
  quantity: string;
  unitCost: string;
  /** price1 for the *matched* product (mode "existing" only) — a new
   * product's price1 lives on newProduct.price1 instead. */
  price1: string;
  updatePrice: boolean;
  /** true for a line the admin added by hand — not detected on the invoice. */
  manual: boolean;
};

const EMPTY_INVOICE_LINE: ScanResultPayload["lines"][number]["invoice"] = {
  sku: null,
  barcode: null,
  name: null,
  description: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  lineTotal: null,
};

const NONE_PRODUCT: ScanProductOption = {
  id: "",
  name: "",
  sku: "",
  barcode: null,
  purchasePrice: 0,
  price1: 0,
};

/** Marks a field's <Label> as required — paired with resolveLinesHint's
 * "(*)" text below the line list. */
function Req() {
  return (
    <span className="text-destructive" aria-hidden>
      {" "}
      *
    </span>
  );
}

function toInput(value: number | null): string {
  return value == null ? "" : String(value);
}

export function ScanReview({
  payload,
  attachment,
  suppliers: initialSuppliers,
  products,
  categories,
  brands,
  canManageSuppliers,
  canManageProducts,
  onScanAnother,
}: {
  payload: ScanResultPayload;
  attachment: UploadedAttachment | null;
  suppliers: SupplierOption[];
  products: ScanProductOption[];
  categories: IdNameOption[];
  brands: IdNameOption[];
  canManageSuppliers: boolean;
  canManageProducts: boolean;
  onScanAnother: () => void;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittedRef = useRef(false);
  // Lazily initialised once (ref pattern) so a re-render / double-click of
  // Confirm reuses the same key and the server treats the retry as a no-op.
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  // Same as the per-line product picker: pre-select the best-ranked
  // candidate even when the match wasn't strong enough to auto-confirm, so
  // the admin edits/clears it instead of picking a supplier from scratch.
  const [supplierId, setSupplierId] = useState(
    payload.supplierMatch.suggestedSupplierId ??
      payload.supplierMatch.candidates[0]?.supplierId ??
      "",
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    payload.extracted.invoiceNumber ?? "",
  );
  const [invoiceDate, setInvoiceDate] = useState(
    normalizeDate(payload.extracted.invoiceDate),
  );
  const [language, setLanguage] = useState<"AR" | "EN" | "FR">("AR");
  const [receiveNow, setReceiveNow] = useState(true);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState(
    payload.extracted.supplier?.name ?? "",
  );
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const [lines, setLines] = useState<LineState[]>(() =>
    payload.lines.map((line) => {
      // Pre-select the best candidate even when the match wasn't strong
      // enough to auto-confirm (REVIEW_REQUIRED) — the admin still sees and
      // can change/clear it in the picker below, this just saves them from
      // re-picking the top suggestion by hand on every ambiguous line.
      const suggested =
        line.match.suggestedProductId ??
        line.match.candidates[0]?.productId ??
        "";
      const product = suggested ? productById.get(suggested) : undefined;
      // Price 1 defaults to the unit cost, same as a fresh line — the admin
      // can still override it, but there's no reason to guess the product's
      // current price1 here.
      const unitCost =
        line.invoice.unitPrice != null
          ? String(line.invoice.unitPrice)
          : product
            ? String(product.purchasePrice)
            : "";
      return {
        key: line.key,
        include: line.match.status !== "NOT_FOUND",
        invoice: line.invoice,
        status: line.match.status,
        candidateIds: line.match.candidates.map((c) => c.productId),
        mode: "existing",
        productId: suggested,
        newProduct: {
          ...EMPTY_NEW_PRODUCT,
          name: line.invoice.name ?? "",
          sku: line.invoice.sku ?? "",
          barcode: line.invoice.barcode ?? "",
        },
        quantity: toInput(line.invoice.quantity),
        unitCost,
        price1: unitCost,
        updatePrice: true,
        manual: false,
      };
    }),
  );

  function patchLine(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }
  function addManualLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `manual-${crypto.randomUUID()}`,
        include: true,
        invoice: EMPTY_INVOICE_LINE,
        status: "NOT_FOUND",
        candidateIds: [],
        mode: "existing",
        productId: "",
        newProduct: EMPTY_NEW_PRODUCT,
        quantity: "",
        unitCost: "",
        price1: "",
        updatePrice: true,
        manual: true,
      },
    ]);
  }

  const includedLines = lines.filter((line) => line.include);
  const computedTotal = includedLines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const cost = Number(line.unitCost);
    return sum + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(cost) ? cost : 0);
  }, 0);

  const lineIsValid = (line: LineState) => {
    const productReady =
      line.mode === "existing"
        ? line.productId !== ""
        : line.newProduct.name.trim().length >= 2 &&
          line.newProduct.sku.trim() !== "" &&
          line.newProduct.categoryId !== "";
    return (
      productReady &&
      Number(line.quantity) > 0 &&
      line.unitCost !== "" &&
      Number(line.unitCost) >= 0
    );
  };

  const canConfirm =
    supplierId !== "" &&
    includedLines.length > 0 &&
    includedLines.every(lineIsValid) &&
    !isPending;

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (name.length < 2) return;
    setCreatingSupplier(true);
    try {
      const result = await quickCreateSupplier({
        name,
        phone: payload.extracted.supplier?.phone ?? "",
      });
      if (result.error || !result.supplier) {
        toast.error(result.error ?? t.suppliers.validationError);
        return;
      }
      setSuppliers((prev) =>
        [...prev, result.supplier!].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSupplierId(result.supplier.id);
      setShowNewSupplier(false);
      toast.success(t.purchaseScan.supplierCreatedToast);
    } finally {
      setCreatingSupplier(false);
    }
  }

  function handleConfirm() {
    if (!canConfirm || submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      const result = await confirmScannedPurchase({
        supplierId,
        supplierInvoiceNumber: invoiceNumber.trim() || undefined,
        supplierInvoiceDate: invoiceDate || undefined,
        language,
        receiveNow,
        idempotencyKey: idempotencyKeyRef.current,
        attachments: attachment ? [attachment] : [],
        lines: includedLines.map((line) =>
          line.mode === "existing"
            ? {
                productId: line.productId,
                quantity: Number(line.quantity),
                unitCost: Number(line.unitCost),
                price1: line.price1 === "" ? 0 : Number(line.price1),
                updateProductPurchasePrice: line.updatePrice,
              }
            : {
                newProduct: {
                  name: line.newProduct.name.trim(),
                  sku: line.newProduct.sku.trim(),
                  barcode: line.newProduct.barcode.trim() || undefined,
                  categoryId: line.newProduct.categoryId,
                  brandId: line.newProduct.brandId || undefined,
                  price1:
                    line.newProduct.price1 === ""
                      ? 0
                      : Number(line.newProduct.price1),
                },
                quantity: Number(line.quantity),
                unitCost: Number(line.unitCost),
                updateProductPurchasePrice: true,
              },
        ),
      });
      if ("error" in result) {
        submittedRef.current = false;
        toast.error(result.error);
        return;
      }
      toast.success(
        result.alreadyExists
          ? t.purchaseScan.alreadyCreatedToast
          : t.purchaseScan.createdToast,
      );
      router.push(`/dashboard/purchases/${result.orderId}`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {payload.duplicateWarning && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {formatMessage(t.purchaseScan.duplicateWarning, {
              number: payload.duplicateWarning.orderNumber,
            })}
          </p>
        )}

        {/* Header fields */}
        <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t.purchases.columnSupplier}</Label>
            <OptionPicker
              options={suppliers}
              value={supplierId}
              onChange={setSupplierId}
              placeholder={t.purchases.selectSupplierPlaceholder}
              searchPlaceholder={t.purchases.supplierSearchPlaceholder}
              noResults={t.common.noResults}
            />
            {canManageSuppliers && !showNewSupplier && (
              <button
                type="button"
                onClick={() => setShowNewSupplier(true)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="size-3" />
                {t.purchaseScan.addSupplier}
              </button>
            )}
            {canManageSuppliers && showNewSupplier && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder={t.suppliers.nameLabel}
                  className="h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateSupplier}
                  disabled={creatingSupplier || newSupplierName.trim().length < 2}
                >
                  {creatingSupplier ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewSupplier(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t.purchaseScan.supplierInvoiceNumberLabel}</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.purchaseScan.supplierInvoiceDateLabel}</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.purchases.purchaseInvoiceLanguageLabel}</Label>
            <Select
              items={{ AR: "AR", EN: "EN", FR: "FR" }}
              value={language}
              onValueChange={(v) => setLanguage(v as "AR" | "EN" | "FR")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AR">العربية</SelectItem>
                <SelectItem value="EN">English</SelectItem>
                <SelectItem value="FR">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <Checkbox
              checked={receiveNow}
              onCheckedChange={(c) => setReceiveNow(c === true)}
            />
            <span>{t.purchaseScan.receiveNowLabel}</span>
          </label>
        </div>

        {/* Lines */}
        <div className="space-y-3">
          {lines.length === 0 && (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {t.purchaseScan.noLinesLeft}
            </p>
          )}
          {lines.map((line) => {
            const product = line.productId
              ? productById.get(line.productId)
              : undefined;
            const candidates = line.candidateIds
              .map((id) => productById.get(id))
              .filter((p): p is ScanProductOption => Boolean(p));
            const lineTotal =
              (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
            const mismatch =
              line.invoice.lineTotal != null &&
              Math.abs(line.invoice.lineTotal - lineTotal) > 0.01;
            return (
              <div
                key={line.key}
                className={
                  "space-y-3 rounded-xl border p-3 " +
                  (line.include ? "" : "opacity-60")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={line.include}
                      onCheckedChange={(c) =>
                        patchLine(line.key, { include: c === true })
                      }
                    />
                    <span className="truncate">
                      {line.manual
                        ? (product?.name ?? t.purchaseScan.manualLineLabel)
                        : line.invoice.name || t.purchaseScan.unnamedLine}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {line.mode === "new" ? (
                      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400">
                        {t.purchaseScan.newProductToggle}
                      </Badge>
                    ) : line.manual ? (
                      <Badge variant="secondary">
                        {t.purchaseScan.manualBadge}
                      </Badge>
                    ) : (
                      <StatusBadge status={line.status} t={t} />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {!line.manual && (
                  <p className="text-xs text-muted-foreground">
                    {t.purchaseScan.invoiceSkuLabel}:{" "}
                    <span dir="ltr">{line.invoice.sku || "—"}</span>
                    {line.invoice.description
                      ? ` · ${line.invoice.description}`
                      : ""}
                  </p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">
                      {t.purchaseScan.matchedProductLabel}
                      <Req />
                    </Label>
                    {canManageProducts && (
                      <div className="inline-flex overflow-hidden rounded-md border text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            patchLine(line.key, {
                              mode: "existing",
                              price1: line.price1 === "" ? line.unitCost : line.price1,
                            })
                          }
                          className={
                            "px-2 py-1 transition-colors " +
                            (line.mode === "existing"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted")
                          }
                        >
                          {t.purchaseScan.existingProductToggle}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchLine(line.key, {
                              mode: "new",
                              newProduct:
                                line.newProduct.price1 === ""
                                  ? { ...line.newProduct, price1: line.unitCost }
                                  : line.newProduct,
                            })
                          }
                          className={
                            "border-s px-2 py-1 transition-colors " +
                            (line.mode === "new"
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted")
                          }
                        >
                          {t.purchaseScan.newProductToggle}
                        </button>
                      </div>
                    )}
                  </div>

                  {line.mode === "existing" ? (
                    <>
                      <ProductPicker
                        products={products}
                        candidates={candidates}
                        value={line.productId}
                        onChange={(id) => {
                          const picked = id ? productById.get(id) : undefined;
                          const nextUnitCost =
                            line.unitCost === "" && picked
                              ? String(picked.purchasePrice)
                              : line.unitCost;
                          // Price 1 mirrors the unit cost until the admin
                          // edits it by hand (tracked by "still equal to the
                          // unit cost, or never set").
                          const mirroring =
                            line.price1 === "" || line.price1 === line.unitCost;
                          patchLine(line.key, {
                            productId: id,
                            unitCost: nextUnitCost,
                            price1: mirroring ? nextUnitCost : line.price1,
                          });
                        }}
                        searchPlaceholder={t.inventory.productSearchPlaceholder}
                        noResults={t.common.noResults}
                        candidatesLabel={t.purchaseScan.suggestionsLabel}
                        allLabel={t.purchaseScan.allProductsLabel}
                      />
                      {!line.manual &&
                        line.status === "NOT_FOUND" &&
                        !line.productId && (
                          <p className="text-xs text-destructive">
                            {t.purchaseScan.notFoundHint}
                          </p>
                        )}
                    </>
                  ) : (
                    <div className="grid gap-2 rounded-lg border bg-muted/30 p-2.5 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">
                          {t.products.nameLabel}
                          <Req />
                        </Label>
                        <Input
                          value={line.newProduct.name}
                          onChange={(e) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, name: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.products.skuLabel}
                          <Req />
                        </Label>
                        <Input
                          dir="ltr"
                          value={line.newProduct.sku}
                          onChange={(e) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, sku: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t.products.barcodeLabel}</Label>
                        <Input
                          dir="ltr"
                          value={line.newProduct.barcode}
                          onChange={(e) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, barcode: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t.products.categoryLabel}
                          <Req />
                        </Label>
                        <OptionPicker
                          options={categories}
                          value={line.newProduct.categoryId}
                          onChange={(id) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, categoryId: id },
                            })
                          }
                          placeholder={t.products.categoryPlaceholder}
                          searchPlaceholder={t.products.searchOptionsPlaceholder}
                          noResults={t.products.noOptionsResults}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t.products.brandLabel}</Label>
                        <OptionPicker
                          options={brands}
                          value={line.newProduct.brandId}
                          onChange={(id) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, brandId: id },
                            })
                          }
                          placeholder={t.products.noBrandOption}
                          searchPlaceholder={t.products.searchOptionsPlaceholder}
                          noResults={t.products.noOptionsResults}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t.products.price1Label}</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={line.newProduct.price1}
                          onChange={(e) =>
                            patchLine(line.key, {
                              newProduct: { ...line.newProduct, price1: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-start gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t.purchases.quantityLabel}
                      <Req />
                    </Label>
                    <Input
                      type="number"
                      min={0.001}
                      step="0.001"
                      inputMode="decimal"
                      className="w-24"
                      value={line.quantity}
                      onChange={(e) =>
                        patchLine(line.key, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t.purchases.unitCostLabel}
                      <Req />
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      inputMode="decimal"
                      className="w-28"
                      value={line.unitCost}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (line.mode === "existing") {
                          const mirroring =
                            line.price1 === "" || line.price1 === line.unitCost;
                          patchLine(line.key, {
                            unitCost: value,
                            price1: mirroring ? value : line.price1,
                          });
                        } else {
                          const mirroring =
                            line.newProduct.price1 === "" ||
                            line.newProduct.price1 === line.unitCost;
                          patchLine(line.key, {
                            unitCost: value,
                            newProduct: mirroring
                              ? { ...line.newProduct, price1: value }
                              : line.newProduct,
                          });
                        }
                      }}
                    />
                    {line.mode === "existing" && product && (
                      <p className="text-[11px] text-muted-foreground">
                        {t.purchaseScan.currentPurchasePrice}:{" "}
                        {formatCurrency(product.purchasePrice, locale)}
                      </p>
                    )}
                  </div>
                  {line.mode === "existing" && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t.products.price1Label}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        inputMode="decimal"
                        className="w-28"
                        value={line.price1}
                        onChange={(e) =>
                          patchLine(line.key, { price1: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">{t.purchases.totalLabel}</Label>
                    <p className="pt-2 text-sm font-medium">
                      {formatCurrency(lineTotal, locale)}
                    </p>
                  </div>
                </div>

                {line.mode === "existing" && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={line.updatePrice}
                      onCheckedChange={(c) =>
                        patchLine(line.key, { updatePrice: c === true })
                      }
                    />
                    <span>{t.purchases.updateProductPurchasePriceLabel}</span>
                  </label>
                )}

                {(mismatch ||
                  !line.quantity ||
                  !line.unitCost) && (
                  <ul className="space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                    {!line.quantity && <li>• {t.purchaseScan.warnings.missingQuantity}</li>}
                    {!line.unitCost && <li>• {t.purchaseScan.warnings.missingPrice}</li>}
                    {mismatch && (
                      <li>
                        •{" "}
                        {formatMessage(t.purchaseScan.warnings.totalMismatch, {
                          invoice: formatCurrency(
                            line.invoice.lineTotal ?? 0,
                            locale,
                          ),
                        })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addManualLine}>
            <Plus className="size-4" />
            {t.purchaseScan.addProductButton}
          </Button>
        </div>

        {/* Totals + actions */}
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t.purchaseScan.aiTotalLabel}
            </span>
            <span>
              {payload.extracted.total != null
                ? formatCurrency(payload.extracted.total, locale)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>{t.purchaseScan.computedTotalLabel}</span>
            <span>{formatCurrency(computedTotal, locale)}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t.purchaseScan.confirmButton}
            </Button>
            <Button variant="outline" onClick={onScanAnother} disabled={isPending}>
              {t.purchaseScan.scanAnother}
            </Button>
          </div>
          {!canConfirm && !isPending && (
            <p className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              {supplierId === ""
                ? t.purchaseScan.pickSupplierHint
                : t.purchaseScan.resolveLinesHint}
            </p>
          )}
        </div>
      </div>

      {/* Preview */}
      <aside className="space-y-2 lg:sticky lg:top-20">
        <button
          type="button"
          onClick={() => setPreviewIndex(0)}
          className="text-sm font-medium hover:underline"
        >
          {t.purchaseScan.originalLabel}
        </button>
        <div className="max-h-[75vh] space-y-2 overflow-y-auto rounded-xl border p-2">
          {payload.pages.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPreviewIndex(i)}
              className="block w-full cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL preview, not a hosted asset */}
              <img
                src={src}
                alt={`page ${i + 1}`}
                className="h-auto w-full rounded-md border"
              />
            </button>
          ))}
        </div>
      </aside>

      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => !open && setPreviewIndex(null)}
      >
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          <DialogTitle className="flex items-center justify-between gap-2 pe-8">
            <span>{t.purchaseScan.originalLabel}</span>
            {previewIndex !== null && payload.pages.length > 1 && (
              <span className="text-xs font-normal text-muted-foreground">
                {formatMessage(t.purchaseScan.stages.renderingPage, {
                  page: previewIndex + 1,
                  pages: payload.pages.length,
                })}
              </span>
            )}
          </DialogTitle>
          {previewIndex !== null && (
            <div className="relative">
              <div className="max-h-[75vh] overflow-y-auto rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL preview, not a hosted asset */}
                <img
                  src={payload.pages[previewIndex]}
                  alt={`page ${previewIndex + 1}`}
                  className="h-auto w-full"
                />
              </div>
              {payload.pages.length > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={previewIndex === 0}
                    onClick={() =>
                      setPreviewIndex((i) => (i !== null ? i - 1 : i))
                    }
                  >
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={previewIndex === payload.pages.length - 1}
                    onClick={() =>
                      setPreviewIndex((i) => (i !== null ? i + 1 : i))
                    }
                  >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeDate(raw: string | null): string {
  if (!raw) return "";
  const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

function StatusBadge({
  status,
  t,
}: {
  status: MatchStatus;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const label = t.purchaseScan.matchStatus[status];
  if (status === "EXACT_SKU" || status === "EXACT_BARCODE") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        {label}
      </Badge>
    );
  }
  if (status === "NOT_FOUND") {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
      {label}
    </Badge>
  );
}

/** Generic id/name combobox — used for supplier, category and brand
 * pickers, all of which are the same "search and pick one" shape. */
function OptionPicker({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResults,
}: {
  options: IdNameOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResults: string;
}) {
  const { contains } = useComboboxFilter();
  const none: IdNameOption = { id: "", name: placeholder };
  const items = [none, ...options];
  const selected = items.find((o) => o.id === value) ?? none;
  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(o: IdNameOption | null) => onChange(o?.id ?? "")}
      isItemEqualToValue={(a: IdNameOption, b: IdNameOption) => a.id === b.id}
      itemToStringValue={(o: IdNameOption) => o.id}
      itemToStringLabel={(o: IdNameOption) => o.name}
      filter={contains}
    >
      <ComboboxTrigger className="w-full">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder={searchPlaceholder} />
        <ComboboxEmpty>{noResults}</ComboboxEmpty>
        <ComboboxList>
          {(o: IdNameOption) => (
            <ComboboxItem key={o.id} value={o}>
              {o.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function ProductPicker({
  products,
  candidates,
  value,
  onChange,
  searchPlaceholder,
  noResults,
  candidatesLabel,
  allLabel,
}: {
  products: ScanProductOption[];
  candidates: ScanProductOption[];
  value: string;
  onChange: (id: string) => void;
  searchPlaceholder: string;
  noResults: string;
  candidatesLabel: string;
  allLabel: string;
}) {
  const { contains } = useComboboxFilter();
  const none: ScanProductOption = { ...NONE_PRODUCT, name: "—" };
  const candidateIds = new Set(candidates.map((c) => c.id));
  const rest = products.filter((p) => !candidateIds.has(p.id));
  const items = [none, ...candidates, ...rest];
  const selected = items.find((p) => p.id === value) ?? none;
  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(p: ScanProductOption | null) => onChange(p?.id ?? "")}
      isItemEqualToValue={(a: ScanProductOption, b: ScanProductOption) =>
        a.id === b.id
      }
      itemToStringValue={(p: ScanProductOption) => p.id}
      itemToStringLabel={(p: ScanProductOption) =>
        p.id ? `${p.name} ${p.sku}` : "—"
      }
      filter={contains}
    >
      <ComboboxTrigger className="w-full">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder={searchPlaceholder} />
        <ComboboxEmpty>{noResults}</ComboboxEmpty>
        <ComboboxList>
          {(p: ScanProductOption) => (
            <ComboboxItem key={p.id || "none"} value={p}>
              {p.id ? (
                <span className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {p.sku}
                    {candidateIds.has(p.id) ? ` · ${candidatesLabel}` : ""}
                  </span>
                </span>
              ) : (
                allLabel
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
