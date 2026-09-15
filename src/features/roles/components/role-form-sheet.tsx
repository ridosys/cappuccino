"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PermissionMatrix } from "@/features/roles/components/permission-matrix";
import { DASHBOARD_TAB_PERMISSIONS } from "@/lib/permission-modules";
import { roleSchema, type RoleInput } from "@/features/roles/schema";
import { createRole, updateRole } from "@/features/roles/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";
import type { PermissionKey } from "@/lib/permission-modules";

type RoleRecord = {
  id: string;
  name: string;
  isSystem: boolean;
  isFullAccess: boolean;
  permissions: { permission: PermissionKey }[];
} | null;

export function RoleFormSheet({
  open,
  role,
}: {
  open: boolean;
  role?: RoleRecord;
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
    watch,
    formState: { errors, isDirty },
  } = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? "",
      isFullAccess: role?.isFullAccess ?? false,
      permissions: role?.permissions.map((p) => p.permission) ?? [],
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  const isFullAccess = watch("isFullAccess");
  const isSystem = role?.isSystem ?? false;

  const [dashboardOpen, setDashboardOpen] = useState(() =>
    (role?.permissions ?? []).some((p) =>
      DASHBOARD_TAB_PERMISSIONS.includes(p.permission),
    ),
  );

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(values: RoleInput) {
    if (
      !values.isFullAccess &&
      dashboardOpen &&
      !values.permissions.some((p) => DASHBOARD_TAB_PERMISSIONS.includes(p))
    ) {
      toast.error(t.roles.dashboardNeedsOneError);
      return;
    }
    startTransition(async () => {
      const result = role
        ? await updateRole(role.id, values)
        : await createRole(values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(role ? t.roles.toastUpdated : t.roles.toastCreated);
      close();
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={role ? t.roles.formTitleEdit : t.roles.formTitleAdd}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <fieldset disabled={isPending} className="contents space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">{t.roles.nameLabel}</Label>
            <Input id="role-name" disabled={isSystem} {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <Controller
            control={control}
            name="isFullAccess"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  disabled={isSystem}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                {t.roles.isFullAccessLabel}
              </label>
            )}
          />
          <div className="space-y-2">
            <Label>{t.roles.permissionsLabel}</Label>
            <Controller
              control={control}
              name="permissions"
              render={({ field }) => (
                <PermissionMatrix
                  value={field.value}
                  onChange={field.onChange}
                  fullAccess={isFullAccess}
                  dashboardOpen={dashboardOpen}
                  onDashboardOpenChange={setDashboardOpen}
                />
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
