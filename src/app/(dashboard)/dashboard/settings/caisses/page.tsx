import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  getPosRegisters,
  getPosRegisterFormOptions,
} from "@/features/pos-registers/queries";
import { PosRegistersTable } from "@/features/pos-registers/components/pos-registers-table";
import { PosRegisterFormSheet } from "@/features/pos-registers/components/pos-register-form-sheet";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function PosRegistersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  await requirePageAccess("POS_CONFIGURE");

  const params = await searchParams;
  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  const [t, registers, options] = await Promise.all([
    getDictionary(),
    getPosRegisters(),
    // Customers/categories/users are only needed while the sheet is open.
    isSheetOpen ? getPosRegisterFormOptions() : Promise.resolve(null),
  ]);

  const editing = params.edit
    ? registers.find((r) => r.id === params.edit)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.posRegisters}
        icon={Store}
        action={
          <Button
            nativeButton={false}
            render={
              <Link prefetch={false} href="/dashboard/settings/caisses?new=1" />
            }
          >
            <Plus className="size-4" />
            {t.posRegisters.addButton}
          </Button>
        }
      />
      {registers.length === 0 ? (
        <EmptyState icon={Store} title={t.posRegisters.emptyTitle} />
      ) : (
        <PosRegistersTable data={registers} />
      )}
      {options && (
        <PosRegisterFormSheet
          key={editing?.id ?? "new"}
          open={isSheetOpen}
          register={
            editing && {
              id: editing.id,
              name: editing.name,
              isActive: editing.isActive,
              customerId: editing.customer.id,
              categoryIds: editing.categories.map((c) => c.id),
              adminIds: editing.admins.map((a) => a.id),
            }
          }
          customers={options.customers}
          categories={options.categories}
          admins={options.admins}
        />
      )}
    </div>
  );
}
