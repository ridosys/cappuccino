"use client";

import Link from "next/link";
import { Eye, Printer } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deletePurchaseOrder } from "@/features/purchases/actions";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import { formatCurrency } from "@/lib/currency";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { PaymentStatus } from "@/generated/prisma/client";

export type PurchaseOrderRow = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  supplier: { name: string };
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    PENDING: "secondary",
    RECEIVED: "default",
    CANCELLED: "destructive",
  };

export function getPurchaseOrderColumns(
  t: Dictionary,
  locale: Locale,
): ColumnDef<PurchaseOrderRow>[] {
  return [
    {
      accessorKey: "orderNumber",
      header: t.purchases.columnOrderNumber,
      cell: ({ row }) => <span dir="ltr">{row.original.orderNumber}</span>,
    },
    {
      id: "supplier",
      header: t.purchases.columnSupplier,
      cell: ({ row }) => row.original.supplier.name,
    },
    {
      id: "total",
      header: t.purchases.columnTotal,
      cell: ({ row }) => formatCurrency(row.original.total, locale),
    },
    {
      id: "status",
      header: t.purchases.columnStatus,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
          {t.statusLabels.purchaseOrder[
            row.original.status as keyof typeof t.statusLabels.purchaseOrder
          ] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: "paymentStatus",
      header: t.purchases.columnPaymentStatus,
      cell: ({ row }) => (
        <PaymentStatusBadge status={row.original.paymentStatus} />
      ),
    },
    {
      id: "createdAt",
      header: t.purchases.columnDate,
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
            title={t.purchases.printButton}
            nativeButton={false}
            render={
              <Link href={`/dashboard/purchases/${row.original.id}/print`} />
            }
          >
            <Printer className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/dashboard/purchases/${row.original.id}`} />}
          >
            <Eye className="size-4" />
          </Button>
          <ConfirmDeleteDialog
            action={() => deletePurchaseOrder(row.original.id)}
            description={formatMessage(t.purchases.deleteDescription, {
              number: row.original.orderNumber,
            })}
          />
        </div>
      ),
    },
  ];
}
