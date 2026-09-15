import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { getInvoicesPage } from "@/features/invoices/queries";
import { InvoicesTable } from "@/features/invoices/components/invoices-table";
import { InvoicesFilterBar } from "@/features/invoices/components/invoices-filter-bar";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import type { PaymentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; paymentStatus?: string }>;
}) {
  await requirePageAccess("INVOICES_VIEW");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;
  const paymentStatus = VALID_PAYMENT_STATUSES.includes(params.paymentStatus ?? "")
    ? (params.paymentStatus as PaymentStatus)
    : undefined;

  const [t, { items, total, pageSize }] = await Promise.all([
    getDictionary(),
    getInvoicesPage({ query, paymentStatus, page }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.invoices}
        icon={FileText}
        description={t.invoices.pageDescription}
        action={
          <Button nativeButton={false} render={<Link href="/dashboard/invoices/new" />}>
            <Plus className="size-4" />
            {t.invoices.addButton}
          </Button>
        }
      />
      <div className="space-y-3">
        <DataTableSearch placeholder={t.invoices.searchPlaceholder} />
        <InvoicesFilterBar />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t.invoices.emptyTitle}
          description={t.invoices.emptyDescription}
        />
      ) : (
        <>
          <InvoicesTable
            data={items.map((item) => ({
              id: item.id,
              sequenceNumber: item.sequenceNumber,
              invoiceNumber: item.invoiceNumber,
              language: item.language,
              customerName: item.customerName,
              customerPhone: item.customerPhone,
              total: Number(item.total),
              paymentStatus: item.paymentStatus,
              createdAt: item.createdAt,
              _count: item._count,
              balanceEffectApplied: Number(item.balanceEffectApplied),
            }))}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/invoices"
            searchParams={{ q: query, paymentStatus: params.paymentStatus }}
          />
        </>
      )}
    </div>
  );
}
