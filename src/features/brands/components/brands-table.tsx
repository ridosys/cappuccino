"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import {
  getBrandColumns,
  type BrandRow,
} from "@/features/brands/components/columns";
import { deleteBrands } from "@/features/brands/actions";
import { useLocale } from "@/i18n/locale-provider";

export function BrandsTable({ data }: { data: BrandRow[] }) {
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
      columns={getBrandColumns(editHref, t, locale)}
      data={data}
      onDeleteSelected={deleteBrands}
    />
  );
}
