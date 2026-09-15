"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import {
  getCategoryColumns,
  type CategoryRow,
} from "@/features/categories/components/columns";
import { deleteCategories } from "@/features/categories/actions";
import { useLocale } from "@/i18n/locale-provider";

export function CategoriesTable({ data }: { data: CategoryRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();

  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("edit", id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <DataTable
      columns={getCategoryColumns(editHref, t, locale)}
      data={data}
      onDeleteSelected={deleteCategories}
    />
  );
}
