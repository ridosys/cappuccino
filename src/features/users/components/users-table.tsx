"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { getUserColumns, type UserRow } from "@/features/users/components/columns";
import { deleteUsers } from "@/features/users/actions";
import { useLocale } from "@/i18n/locale-provider";

export function UsersTable({
  data,
  currentUserId,
}: {
  data: UserRow[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("edit", id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <DataTable
      columns={getUserColumns(editHref, currentUserId, t)}
      data={data}
      onDeleteSelected={deleteUsers}
      requireDeletePassword
    />
  );
}
