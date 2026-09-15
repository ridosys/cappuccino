"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { PurchaseReturnRowActions } from "@/features/returns/components/purchase-return-row-actions";
import { deletePurchaseReturns } from "@/features/returns/actions";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type PurchaseReturnRow = {
  id: string;
  returnNumber: string;
  purchaseOrderNumber: string;
  supplierName: string;
  createdAt: Date;
  itemsCount: number;
  refundAmount: number;
  refundStatus: string;
  employeeName: string;
};

function getColumns(t: Dictionary, locale: Locale): ColumnDef<PurchaseReturnRow>[] {
  const statuses: Record<string, string> = {
    PENDING: t.returns.pending,
    COMPLETED: t.returns.completed,
    CREDITED: t.returns.credited,
    NOT_REQUIRED: t.returns.notRequired,
  };

  return [
    {
      accessorKey: "returnNumber",
      header: t.returns.returnNumber,
      cell: ({ row }) => (
        <Link
          className="font-medium hover:underline"
          href={`/dashboard/purchase-returns/${row.original.id}`}
        >
          {row.original.returnNumber}
        </Link>
      ),
    },
    { accessorKey: "purchaseOrderNumber", header: t.returns.purchaseInvoice },
    { accessorKey: "supplierName", header: t.returns.supplier },
    {
      id: "date",
      header: t.returns.date,
      cell: ({ row }) => row.original.createdAt.toLocaleDateString(locale),
    },
    { accessorKey: "itemsCount", header: t.returns.items },
    {
      id: "amount",
      header: t.returns.amount,
      cell: ({ row }) => formatCurrency(row.original.refundAmount, locale),
    },
    {
      id: "status",
      header: t.returns.status,
      cell: ({ row }) => (
        <Badge>{statuses[row.original.refundStatus] ?? row.original.refundStatus}</Badge>
      ),
    },
    { accessorKey: "employeeName", header: t.returns.employee },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <PurchaseReturnRowActions
          id={row.original.id}
          returnNumber={row.original.returnNumber}
        />
      ),
    },
  ];
}

export function PurchaseReturnsTable({
  data,
  t,
  locale,
}: {
  data: PurchaseReturnRow[];
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <DataTable
      columns={getColumns(t, locale)}
      data={data}
      onDeleteSelected={deletePurchaseReturns}
      requireDeletePassword
      bulkDeleteDescription={t.returns.bulkDeletePurchaseDescription}
    />
  );
}
