"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import {
  getCustomerColumns,
  type CustomerRow,
} from "@/features/customers/components/columns";
import { deleteCustomers } from "@/features/customers/actions";
import { useLocale } from "@/i18n/locale-provider";

export function CustomersTable({ data }: { data: CustomerRow[] }) {
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
      columns={getCustomerColumns(editHref, t, locale)}
      data={data}
      onDeleteSelected={deleteCustomers}
      requireDeletePassword
    />
  );
}
