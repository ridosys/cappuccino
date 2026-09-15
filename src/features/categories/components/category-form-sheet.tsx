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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudinaryUploader } from "@/components/shared/cloudinary-uploader";
import {
  categorySchema,
  type CategoryInput,
} from "@/features/categories/schema";
import { createCategory, updateCategory } from "@/features/categories/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type CategoryOption = { id: string; name: string };
type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imagePublicId: string | null;
  imageSecureUrl: string | null;
} | null;

export function CategoryFormSheet({
  open,
  category,
  categoryOptions,
}: {
  open: boolean;
  category?: CategoryRecord;
  categoryOptions: CategoryOption[];
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
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parentId: category?.parentId ?? null,
      image:
        category?.imagePublicId && category?.imageSecureUrl
          ? {
              publicId: category.imagePublicId,
              secureUrl: category.imageSecureUrl,
            }
          : null,
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

  function onSubmit(values: CategoryInput) {
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, values)
        : await createCategory(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(category ? t.categories.toastUpdated : t.categories.toastCreated);
      close();
    });
  }

  const parentId = watch("parentId");

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={category ? t.categories.formTitleEdit : t.categories.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label>{t.categories.imageLabel}</Label>
          <Controller
            control={control}
            name="image"
            render={({ field }) => (
              <CloudinaryUploader
                value={field.value ? [field.value] : []}
                onChange={(images) => field.onChange(images[0] ?? null)}
                maxImages={1}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-name">{t.categories.nameLabel}</Label>
          <Input id="category-name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-slug">{t.categories.slugLabel}</Label>
          <Input id="category-slug" dir="ltr" {...register("slug")} />
          {errors.slug && (
            <p className="text-sm text-destructive">{errors.slug.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t.categories.parentLabel}</Label>
          <Select
            value={parentId ?? "none"}
            onValueChange={(value) =>
              setValue("parentId", value === "none" ? null : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t.categories.noParentOption}>
                {(value: string) =>
                  value === "none" || !value
                    ? t.categories.noParentOption
                    : (categoryOptions.find((option) => option.id === value)
                        ?.name ?? t.categories.noParentOption)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.categories.noParentOption}</SelectItem>
              {categoryOptions
                .filter((option) => option.id !== category?.id)
                .map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
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
