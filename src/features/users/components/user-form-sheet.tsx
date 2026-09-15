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
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/features/users/schema";
import { createUser, updateUser } from "@/features/users/actions";
import { useLocale } from "@/i18n/locale-provider";
import { useUnsavedChanges } from "@/components/shared/unsaved-changes";

type RoleOption = { id: string; name: string; isFullAccess: boolean };

type UserRecord = {
  id: string;
  name: string;
  email: string;
  roleId: string;
} | null;

function RolePickerField({
  value,
  onChange,
  roleOptions,
}: {
  value: string;
  onChange: (value: string) => void;
  roleOptions: RoleOption[];
}) {
  const { t } = useLocale();
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t.users.selectRolePlaceholder}>
          {(id: string) =>
            roleOptions.find((role) => role.id === id)?.name ?? id
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateUserForm({
  roleOptions,
  onDone,
}: {
  roleOptions: RoleOption[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", roleId: "" },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function onSubmit(values: CreateUserInput) {
    startTransition(async () => {
      const result = await createUser(values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.users.toastCreated);
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-name">{t.users.nameLabel}</Label>
          <Input id="user-name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">{t.users.emailLabel}</Label>
          <Input id="user-email" type="email" dir="ltr" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-password">{t.users.passwordLabel}</Label>
          <Input
            id="user-password"
            type="password"
            dir="ltr"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t.users.roleLabel}</Label>
          <Controller
            control={control}
            name="roleId"
            render={({ field }) => (
              <RolePickerField
                value={field.value}
                onChange={field.onChange}
                roleOptions={roleOptions}
              />
            )}
          />
          {errors.roleId && (
            <p className="text-sm text-destructive">{errors.roleId.message}</p>
          )}
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
  );
}

function EditUserForm({
  user,
  roleOptions,
  onDone,
}: {
  user: NonNullable<UserRecord>;
  roleOptions: RoleOption[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLocale();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      roleId: user.roleId,
    },
  });

  useUnsavedChanges(isDirty, { guardHistory: false });

  function onSubmit(values: UpdateUserInput) {
    startTransition(async () => {
      const result = await updateUser(user.id, values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.users.toastUpdated);
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset disabled={isPending} className="contents space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-edit-name">{t.users.nameLabel}</Label>
          <Input id="user-edit-name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-edit-email">{t.users.emailLabel}</Label>
          <Input
            id="user-edit-email"
            type="email"
            dir="ltr"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t.users.roleLabel}</Label>
          <Controller
            control={control}
            name="roleId"
            render={({ field }) => (
              <RolePickerField
                value={field.value}
                onChange={field.onChange}
                roleOptions={roleOptions}
              />
            )}
          />
          {errors.roleId && (
            <p className="text-sm text-destructive">{errors.roleId.message}</p>
          )}
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
  );
}

export function UserFormSheet({
  open,
  user,
  roleOptions,
}: {
  open: boolean;
  user?: UserRecord;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("edit");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={user ? t.users.formTitleEdit : t.users.formTitleAdd}
    >
      {user ? (
        <EditUserForm user={user} roleOptions={roleOptions} onDone={close} />
      ) : (
        <CreateUserForm roleOptions={roleOptions} onDone={close} />
      )}
    </FormSheet>
  );
}
