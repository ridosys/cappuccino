"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CloudinaryUploader,
  type UploadedImage,
} from "@/components/shared/cloudinary-uploader";
import {
  productSchema,
  type ProductInput,
  type ProductOutput,
} from "@/features/products/schema";
import { createProduct, updateProduct } from "@/features/products/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";
import type { Dictionary } from "@/i18n/dictionaries";

type Option = { id: string; name: string };

const NONE_OPTION: Option = { id: "", name: "" };

/** Searchable name-based picker for category/brand — a plain Select here
 * would only ever be able to display the raw id as its value, since there's
 * no small fixed label map for these (unlike status/method enums). */
function OptionPickerField({
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  t,
}: {
  value: string;
  onChange: (option: Option | null) => void;
  options: Option[];
  placeholder: string;
  /** When provided, adds a leading "no selection" item with this label. */
  noneLabel?: string;
  t: Dictionary;
}) {
  const { contains } = useComboboxFilter();
  const noneItem = { ...NONE_OPTION, name: noneLabel ?? placeholder };
  const items = noneLabel ? [noneItem, ...options] : options;
  const selected = items.find((item) => item.id === value) ?? noneItem;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(option: Option | null) =>
        onChange(option && option.id ? option : null)
      }
      isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      itemToStringValue={(item: Option) => item.id}
      itemToStringLabel={(item: Option) => item.name || placeholder}
      filter={contains}
    >
      <ComboboxTrigger className="w-full">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder={t.products.searchOptionsPlaceholder} />
        <ComboboxEmpty>{t.products.noOptionsResults}</ComboboxEmpty>
        <ComboboxList>
          {(item: Option) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name || placeholder}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: string;
  brandId: string | null;
  quantity: number;
  minStockLevel: number;
  price1: number;
  price2: number;
  price3: number;
  purchasePrice: number;
  weight: number;
  status: "ACTIVE" | "INACTIVE";
  images: UploadedImage[];
} | null;

export function ProductFormSheet({
  open,
  product,
  categoryOptions,
  brandOptions,
}: {
  open: boolean;
  product?: ProductRecord;
  categoryOptions: Option[];
  brandOptions: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProductInput, unknown, ProductOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      brandId: product?.brandId ?? null,
      quantity: product?.quantity ?? 1,
      minStockLevel: product?.minStockLevel ?? 0,
      price1: product?.price1 ?? 0,
      price2: product?.price2 ?? 0,
      price3: product?.price3 ?? 0,
      purchasePrice: product?.purchasePrice ?? 0,
      weight: product?.weight ?? 0,
      status: product?.status ?? "ACTIVE",
      images: product?.images ?? [],
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(values: ProductOutput) {
    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, values)
        : await createProduct(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(product ? t.products.toastUpdated : t.products.toastCreated);
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={product ? t.products.formTitleEdit : t.products.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label>{t.products.imagesLabel}</Label>
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <CloudinaryUploader
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-name">{t.products.nameLabel}</Label>
          <Input id="product-name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="product-slug">{t.products.slugLabel}</Label>
            <Input id="product-slug" dir="ltr" {...register("slug")} />
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-sku">{t.products.skuLabel}</Label>
            <Input id="product-sku" dir="ltr" {...register("sku")} />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-barcode">{t.products.barcodeLabel}</Label>
          <Input id="product-barcode" dir="ltr" {...register("barcode")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-description">{t.products.descriptionLabel}</Label>
          <Textarea
            id="product-description"
            rows={3}
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t.products.categoryLabel}</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <OptionPickerField
                  value={field.value ?? ""}
                  options={categoryOptions}
                  placeholder={t.products.categoryPlaceholder}
                  onChange={(option) => field.onChange(option?.id ?? "")}
                  t={t}
                />
              )}
            />
            {errors.categoryId && (
              <p className="text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t.products.brandLabel}</Label>
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <OptionPickerField
                  value={field.value ?? ""}
                  options={brandOptions}
                  placeholder={t.products.noBrandOption}
                  noneLabel={t.products.noBrandOption}
                  onChange={(option) => field.onChange(option?.id ?? null)}
                  t={t}
                />
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="product-quantity">{t.products.quantityLabel}</Label>
            <Input
              id="product-quantity"
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
            <Label htmlFor="product-min-stock">{t.products.minStockLabel}</Label>
            <Input
              id="product-min-stock"
              type="number"
              min={0}
              step="0.001"
              {...register("minStockLevel")}
            />
            {errors.minStockLevel && (
              <p className="text-sm text-destructive">
                {errors.minStockLevel.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-purchase-price">
            {t.products.purchasePriceLabel}
          </Label>
          <Input
            id="product-purchase-price"
            type="number"
            min={0}
            step="0.0001"
            {...register("purchasePrice")}
          />
          {errors.purchasePrice && (
            <p className="text-sm text-destructive">
              {errors.purchasePrice.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-weight">{t.products.weightLabel}</Label>
          <Input
            id="product-weight"
            type="number"
            min={0}
            step="0.001"
            {...register("weight")}
          />
          {errors.weight && (
            <p className="text-sm text-destructive">{errors.weight.message}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="product-price1">{t.products.price1Label}</Label>
            <Input
              id="product-price1"
              type="number"
              min={0}
              step="0.0001"
              {...register("price1")}
            />
            {errors.price1 && (
              <p className="text-sm text-destructive">
                {errors.price1.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-price2">{t.products.price2Label}</Label>
            <Input
              id="product-price2"
              type="number"
              min={0}
              step="0.0001"
              {...register("price2")}
            />
            {errors.price2 && (
              <p className="text-sm text-destructive">
                {errors.price2.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-price3">{t.products.price3Label}</Label>
            <Input
              id="product-price3"
              type="number"
              min={0}
              step="0.0001"
              {...register("price3")}
            />
            {errors.price3 && (
              <p className="text-sm text-destructive">
                {errors.price3.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t.products.statusLabel}</Label>
          <Controller
            control={control}
            name="status"
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
                      t.statusLabels.productStatus[
                        value as keyof typeof t.statusLabels.productStatus
                      ] ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t.statusLabels.productStatus[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
    </FormSheet>
  );
}
