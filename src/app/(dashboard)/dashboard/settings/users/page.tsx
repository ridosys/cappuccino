import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { getUsersPage, getUserById, getRoleOptions } from "@/features/users/queries";
import { UsersTable } from "@/features/users/components/users-table";
import { UserFormSheet } from "@/features/users/components/user-form-sheet";
import { auth } from "@/lib/auth";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    new?: string;
    edit?: string;
  }>;
}) {
  await requirePageAccess("USERS_MANAGE");
  const session = await auth();
  if (!session?.user) notFound();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() || undefined;

  const [t, { items, total, pageSize }, editingUser, roleOptions] =
    await Promise.all([
      getDictionary(),
      getUsersPage({ query, page }),
      params.edit ? getUserById(params.edit) : Promise.resolve(null),
      getRoleOptions(),
    ]);

  const isSheetOpen = params.new === "1" || Boolean(params.edit);

  function buildHref(extra: Record<string, string>) {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (page > 1) sp.set("page", String(page));
    for (const [key, value] of Object.entries(extra)) sp.set(key, value);
    return `/dashboard/settings/users?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.users}
        icon={UserCog}
        action={
          <Button nativeButton={false} render={<Link href={buildHref({ new: "1" })} />}>
            <Plus className="size-4" />
            {t.users.addButton}
          </Button>
        }
      />
      <DataTableSearch placeholder={t.users.searchPlaceholder} />
      {items.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={t.users.emptyTitle}
          description={t.users.emptyDescription}
        />
      ) : (
        <>
          <UsersTable data={items} currentUserId={session.user.id} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/dashboard/settings/users"
            searchParams={{ q: query }}
          />
        </>
      )}
      <UserFormSheet
        key={editingUser?.id ?? (params.new ? "new" : "closed")}
        open={isSheetOpen}
        user={editingUser}
        roleOptions={roleOptions}
      />
    </div>
  );
}
