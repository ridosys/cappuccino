import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getRolesPage, getRoleById } from "@/features/roles/queries";
import { RolesTable } from "@/features/roles/components/roles-table";
import { RoleFormSheet } from "@/features/roles/components/role-form-sheet";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; new?: string; edit?: string }>;
}) {
  await requirePageAccess("USERS_MANAGE");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [t, { items, total, pageSize }, editingRole] = await Promise.all([
    getDictionary(),
    getRolesPage({ page }),
    params.edit ? getRoleById(params.edit) : Promise.resolve(null),
  ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (page > 1) sp.set("page", String(page));
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/settings/roles?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.roles}
        icon={ShieldCheck}
        action={
          <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
            <Plus className="size-4" />
            {t.roles.addButton}
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t.roles.emptyTitle} />
      ) : (
        <>
          <RolesTable data={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/settings/roles"
            searchParams={{}}
          />
        </>
      )}
      <RoleFormSheet
        key={editingRole?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        role={editingRole}
      />
    </div>
  );
}
