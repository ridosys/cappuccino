"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteOrder } from "@/features/orders/actions";
import { formatCurrency } from "@/lib/currency";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type OrderRow = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: Date;
  customerName: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    PENDING: "secondary",
    PROCESSING: "default",
    COMPLETED: "default",
    CANCELLED: "destructive",
  };

export function getOrderColumns(t: Dictionary, locale: Locale): ColumnDef<OrderRow>[] {
  const statusLabels: Record<string, string> = t.statusLabels.order;

  return [
    {
      accessorKey: "orderNumber",
      header: t.orders.columnOrderNumber,
      cell: ({ row }) => <span dir="ltr">{row.original.orderNumber}</span>,
    },
    {
      id: "customer",
      header: t.orders.columnCustomer,
      cell: ({ row }) => row.original.customerName,
    },
    {
      id: "total",
      header: t.orders.columnTotal,
      cell: ({ row }) => formatCurrency(row.original.total, locale),
    },
    {
      id: "status",
      header: t.common.status,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
          {statusLabels[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: t.orders.columnDate,
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("fr-FR"),
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
            render={<Link href={`/dashboard/orders/${row.original.id}`} />}
          >
            <Eye className="size-4" />
          </Button>
          <ConfirmDeleteDialog
            action={() => deleteOrder(row.original.id)}
            description={formatMessage(t.orders.deleteDescription, {
              number: row.original.orderNumber,
            })}
          />
        </div>
      ),
    },
  ];
}
