"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { SalesReturnRowActions } from "@/features/returns/components/sales-return-row-actions";
import { deleteSalesReturns } from "@/features/returns/actions";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type SalesReturnRow = {
  id: string;
  returnNumber: string;
  invoiceNumber: string;
  customerName: string;
  createdAt: Date;
  itemsCount: number;
  refundAmount: number;
  refundStatus: string;
  employeeName: string;
};

function getColumns(t: Dictionary, locale: Locale): ColumnDef<SalesReturnRow>[] {
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
          href={`/dashboard/sales-returns/${row.original.id}`}
        >
          {row.original.returnNumber}
        </Link>
      ),
    },
    { accessorKey: "invoiceNumber", header: t.returns.invoice },
    { accessorKey: "customerName", header: t.returns.customer },
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
        <SalesReturnRowActions
          id={row.original.id}
          returnNumber={row.original.returnNumber}
        />
      ),
    },
  ];
}

export function SalesReturnsTable({
  data,
  t,
  locale,
}: {
  data: SalesReturnRow[];
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <DataTable
      columns={getColumns(t, locale)}
      data={data}
      onDeleteSelected={deleteSalesReturns}
      requireDeletePassword
      bulkDeleteDescription={t.returns.bulkDeleteSalesDescription}
    />
  );
}
