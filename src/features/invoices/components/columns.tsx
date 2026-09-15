"use client";

import Link from "next/link";
import { Eye, Printer } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvoiceDeleteDialog } from "@/features/invoices/components/invoice-delete-dialog";
import { INVOICE_LANGUAGE_LABELS } from "@/features/invoices/schema";
import { PaymentStatusBadge } from "@/features/invoices/components/payment-status-badge";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatSequenceNumber } from "@/lib/sequence-number";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { PaymentStatus } from "@/generated/prisma/client";

export type InvoiceRow = {
  id: string;
  sequenceNumber: number;
  invoiceNumber: string;
  language: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  _count: { items: number };
  balanceEffectApplied: number;
};

export function getInvoiceColumns(
  t: Dictionary,
  locale: Locale,
): ColumnDef<InvoiceRow>[] {
  return [
    {
      accessorKey: "sequenceNumber",
      header: t.invoices.columnSequenceNumber,
      cell: ({ row }) => (
        <span dir="ltr" className="font-medium tabular-nums">
          {formatSequenceNumber(row.original.sequenceNumber)}
        </span>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: t.invoices.columnInvoiceNumber,
      cell: ({ row }) => <span dir="ltr">{row.original.invoiceNumber}</span>,
    },
    {
      accessorKey: "customerName",
      header: t.invoices.columnCustomer,
    },
    {
      id: "customerPhone",
      header: t.invoices.columnPhone,
      cell: ({ row }) => <span dir="ltr">{row.original.customerPhone}</span>,
    },
    {
      id: "itemsCount",
      header: t.invoices.columnItemsCount,
      cell: ({ row }) => row.original._count.items.toLocaleString(locale),
    },
    {
      id: "total",
      header: t.invoices.columnTotal,
      cell: ({ row }) => formatCurrency(row.original.total, locale),
    },
    {
      id: "paymentStatus",
      header: t.invoices.paymentStatus,
      cell: ({ row }) => <PaymentStatusBadge status={row.original.paymentStatus} />,
    },
    {
      id: "language",
      header: t.invoices.columnLanguage,
      cell: ({ row }) => (
        <Badge variant="secondary">
          {INVOICE_LANGUAGE_LABELS[row.original.language] ??
            row.original.language}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: t.invoices.columnDate,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
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
            render={<Link href={`/dashboard/invoices/${row.original.id}`} />}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/dashboard/invoices/${row.original.id}/print?lang=${row.original.language.toLowerCase()}`}
              />
            }
          >
            <Printer className="size-4" />
          </Button>
          <InvoiceDeleteDialog
            invoice={{
              id: row.original.id,
              invoiceNumber: row.original.invoiceNumber,
              customerName: row.original.customerName,
              customerPhone: row.original.customerPhone,
              total: row.original.total,
              paymentStatus: row.original.paymentStatus,
              createdAt: row.original.createdAt,
              balanceEffectApplied: row.original.balanceEffectApplied,
            }}
          />
        </div>
      ),
    },
  ];
}
