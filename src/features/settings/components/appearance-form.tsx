"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  systemSettingsSchema,
  type SystemSettingsInput,
} from "@/features/settings/schema";
import { updateSystemSettings } from "@/features/settings/actions";
import type { SystemSettingsData } from "@/features/settings/queries";
import { cssColorToHex } from "@/lib/css-color-to-hex";
import { companyConfig } from "@/config/company";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

const COLOR_TOKEN_KEYS = [
  "primary",
  "secondary",
  "sidebar",
  "sidebarForeground",
  "header",
  "background",
  "text",
  "button",
  "accent",
] as const;

export function AppearanceForm({ settings }: { settings: SystemSettingsData }) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<SystemSettingsInput>({
    resolver: zodResolver(systemSettingsSchema),
    // colorsDark is kept in the form's state from the loaded settings and
    // submitted back unchanged — this page only lets an admin see/edit the
    // light palette, but dark mode (OS/user preference) still needs some
    // value to render with, so its current value (or the company.ts
    // default, if never customized) is preserved rather than lost.
    defaultValues: settings,
  });

  useUnsavedChanges(isDirty);

  function onSubmit(values: SystemSettingsInput) {
    startTransition(async () => {
      const result = await updateSystemSettings(values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Re-baseline the form so it's no longer considered "dirty".
      reset(values);
      toast.success(t.settings.toastUpdated);
    });
  }

  // Only fills the form — nothing is persisted until the admin reviews it
  // and hits حفظ themselves, same as any other edit on this page.
  function handleResetAllToDefaults() {
    reset(
      {
        appName: companyConfig.name,
        appShortName: companyConfig.shortName,
        colorsLight: { ...companyConfig.colors.light },
        colorsDark: { ...companyConfig.colors.dark },
      },
      // Keep the saved values as the dirty baseline so the "unsaved changes"
      // indicator shows until the admin actually saves these defaults.
      { keepDefaultValues: true },
    );
    toast.success(t.settings.toastDefaultsLoaded);
  }

  function resetColorToDefault(key: (typeof COLOR_TOKEN_KEYS)[number]) {
    setValue(`colorsLight.${key}`, companyConfig.colors.light[key], {
      shouldDirty: true,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={isPending} className="contents space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-name">{t.settings.appNameLabel}</Label>
            <Input id="app-name" {...register("appName")} />
            {errors.appName && (
              <p className="text-sm text-destructive">
                {errors.appName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-short-name">{t.settings.appShortNameLabel}</Label>
            <Input id="app-short-name" {...register("appShortName")} />
            {errors.appShortName && (
              <p className="text-sm text-destructive">
                {errors.appShortName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">{t.settings.lightThemeTitle}</h3>
            <p className="text-xs text-muted-foreground">
              {t.settings.colorPickerHint}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_TOKEN_KEYS.map((key) => {
              const fieldName = `colorsLight.${key}` as const;
              const value = watch(fieldName);
              return (
                <div key={fieldName} className="space-y-1.5">
                  <Label htmlFor={fieldName}>{t.settings.tokens[key]}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t.settings.tokens[key]}
                      value={cssColorToHex(value)}
                      onChange={(event) =>
                        setValue(fieldName, event.target.value, {
                          shouldDirty: true,
                        })
                      }
                      className="size-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    />
                    <Input id={fieldName} dir="ltr" {...register(fieldName)} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 cursor-pointer"
                      title={t.settings.resetColorButton}
                      onClick={() => resetColorToDefault(key)}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="cursor-pointer" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t.common.saving : t.common.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={isPending}
            onClick={handleResetAllToDefaults}
          >
            <RotateCcw className="size-4" />
            {t.settings.resetAllButton}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
