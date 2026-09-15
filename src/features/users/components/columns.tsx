"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import { deleteUser, toggleUserActive } from "@/features/users/actions";
import { formatMessage } from "@/i18n/format";
import { formatDateTime } from "@/lib/date";
import type { Dictionary } from "@/i18n/dictionaries";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  role: { id: string; name: string; isFullAccess: boolean };
};

function ActiveToggle({
  id,
  isActive,
  disabled,
  t,
}: {
  id: string;
  isActive: boolean;
  disabled: boolean;
  t: Dictionary;
}) {
  const [optimistic, setOptimistic] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const result = await toggleUserActive(id, next);
      if (result?.error) {
        setOptimistic(!next);
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="cursor-pointer"
      disabled={disabled || isPending}
      onClick={handleClick}
      title={optimistic ? t.users.deactivateButton : t.users.activateButton}
    >
      {optimistic ? (
        <PowerOff className="size-4" />
      ) : (
        <Power className="size-4" />
      )}
    </Button>
  );
}

export function getUserColumns(
  editHref: (id: string) => string,
  currentUserId: string,
  t: Dictionary,
): ColumnDef<UserRow>[] {
  return [
    { accessorKey: "name", header: t.users.columnName },
    {
      accessorKey: "email",
      header: t.users.columnEmail,
      cell: ({ row }) => <span dir="ltr">{row.original.email}</span>,
    },
    {
      id: "role",
      header: t.users.columnRole,
      cell: ({ row }) => (
        <Badge variant={row.original.role.isFullAccess ? "default" : "secondary"}>
          {row.original.role.name}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.users.columnStatus,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "destructive"}>
          {row.original.isActive
            ? t.statusLabels.productStatus.ACTIVE
            : t.statusLabels.productStatus.INACTIVE}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: t.users.columnCreatedAt,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={editHref(row.original.id)} />}
            >
              <Pencil className="size-4" />
            </Button>
            <ResetPasswordDialog userId={row.original.id} />
            <ActiveToggle
              id={row.original.id}
              isActive={row.original.isActive}
              disabled={isSelf}
              t={t}
            />
            <PasswordConfirmDeleteDialog
              action={(password) => deleteUser(row.original.id, password)}
              description={formatMessage(t.users.deleteDescription, {
                name: row.original.name,
              })}
              trigger={
                <Button variant="ghost" size="icon-sm" disabled={isSelf}>
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </div>
        );
      },
    },
  ];
}
