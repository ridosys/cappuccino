"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import {
  getProductColumns,
  type ProductRow,
} from "@/features/products/components/columns";
import { deleteProducts } from "@/features/products/actions";
import { useLocale } from "@/i18n/locale-provider";

export function ProductsTable({ data }: { data: ProductRow[] }) {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("edit", id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <DataTable
      columns={getProductColumns(editHref, t, locale)}
      data={data}
      onDeleteSelected={deleteProducts}
      requireDeletePassword
      bulkDeleteDescription={t.products.bulkDeleteDescription}
    />
  );
}
