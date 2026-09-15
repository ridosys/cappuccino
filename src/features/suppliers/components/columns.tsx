"use client";

import Link from "next/link";
import { Pencil, UserCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteSupplier } from "@/features/suppliers/actions";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  _count: { purchaseOrders: number };
};

export function getSupplierColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: Locale,
): ColumnDef<SupplierRow>[] {
  return [
    { accessorKey: "name", header: t.suppliers.columnName },
    {
      accessorKey: "phone",
      header: t.suppliers.columnPhone,
      cell: ({ row }) => <span dir="ltr">{row.original.phone ?? "—"}</span>,
    },
    {
      accessorKey: "email",
      header: t.suppliers.columnEmail,
      cell: ({ row }) => <span dir="ltr">{row.original.email ?? "—"}</span>,
    },
    {
      id: "purchaseOrdersCount",
      header: t.suppliers.columnPurchaseOrdersCount,
      cell: ({ row }) =>
        row.original._count.purchaseOrders.toLocaleString(locale),
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
            render={<Link href={`/dashboard/suppliers/${row.original.id}`} />}
            title={t.suppliers.viewProfile}
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
          <ConfirmDeleteDialog
            action={() => deleteSupplier(row.original.id)}
            description={formatMessage(t.suppliers.deleteDescription, {
              name: row.original.name,
            })}
          />
        </div>
      ),
    },
  ];
}
