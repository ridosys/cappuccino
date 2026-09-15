"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, UserCircle, Star } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { deleteCustomer, toggleCustomerFavorite } from "@/features/customers/actions";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isFavorite: boolean;
  imageUrl: string | null;
  _count: { orders: number };
  totalPurchased: number;
  totalPaid: number;
  outstanding: number;
  balance: number;
};

function FavoriteToggle({
  id,
  isFavorite,
  t,
}: {
  id: string;
  isFavorite: boolean;
  t: Dictionary;
}) {
  const [optimistic, setOptimistic] = useState(isFavorite);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const result = await toggleCustomerFavorite(id, next);
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
      disabled={isPending}
      onClick={handleClick}
      title={optimistic ? t.customers.favoriteRemove : t.customers.favoriteAdd}
    >
      <Star
        className={cn(
          "size-4",
          optimistic && "fill-amber-400 text-amber-400",
        )}
      />
    </Button>
  );
}

export function getCustomerColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: Locale,
): ColumnDef<CustomerRow>[] {
  return [
    {
      id: "favorite",
      header: "",
      cell: ({ row }) => (
        <FavoriteToggle
          id={row.original.id}
          isFavorite={row.original.isFavorite}
          t={t}
        />
      ),
    },
    {
      accessorKey: "name",
      header: t.customers.columnName,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <CustomerAvatar
            name={row.original.name}
            imageUrl={row.original.imageUrl}
            seed={row.original.id}
            className="size-8 text-xs"
          />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: t.customers.columnPhone,
      cell: ({ row }) => <span dir="ltr">{row.original.phone}</span>,
    },
    {
      accessorKey: "email",
      header: t.customers.columnEmail,
      cell: ({ row }) => (
        <span dir="ltr">{row.original.email ?? "—"}</span>
      ),
    },
    {
      id: "ordersCount",
      header: t.customers.columnOrdersCount,
      cell: ({ row }) => row.original._count.orders.toLocaleString(locale),
    },
    {
      id: "totalPurchased",
      header: t.customers.totalPurchased,
      cell: ({ row }) => formatCurrency(row.original.totalPurchased, locale),
    },
    {
      id: "totalPaid",
      header: t.customers.totalPaid,
      cell: ({ row }) => formatCurrency(row.original.totalPaid, locale),
    },
    {
      id: "outstanding",
      header: t.customers.outstandingAmount,
      cell: ({ row }) => {
        const outstanding = row.original.outstanding;
        return (
          <span className={outstanding > 0 ? "font-medium text-amber-600 dark:text-amber-400" : undefined}>
            {formatCurrency(outstanding, locale)}
          </span>
        );
      },
    },
    {
      id: "balance",
      header: t.customers.balance,
      cell: ({ row }) => {
        const balance = row.original.balance;
        return (
          <span
            className={
              balance < 0
                ? "text-destructive font-medium"
                : balance > 0
                  ? "text-emerald-600 font-medium dark:text-emerald-400"
                  : undefined
            }
          >
            {formatCurrency(balance, locale)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/dashboard/customers/${row.original.id}`} />}
            title={t.customers.viewProfile}
          >
            <UserCircle className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false} render={<Link href={editHref(row.original.id)} />}
          >
            <Pencil className="size-4" />
          </Button>
          <PasswordConfirmDeleteDialog
            action={(password) => deleteCustomer(row.original.id, password)}
            description={formatMessage(t.customers.deleteDescription, {
              name: row.original.name,
            })}
          />
        </div>
      ),
    },
  ];
}
