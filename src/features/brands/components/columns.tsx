"use client";

import Link from "next/link";
import { Eye, Pencil, Tags } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteBrand } from "@/features/brands/actions";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  _count: { products: number };
};

export function getBrandColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: Locale,
): ColumnDef<BrandRow>[] {
  return [
    {
      id: "logo",
      header: "",
      cell: ({ row }) =>
        row.original.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-pasted URL, not covered by next/image remotePatterns
          <img
            src={row.original.logoUrl}
            alt={row.original.name}
            width={32}
            height={32}
            className="size-8 rounded object-contain"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded bg-muted">
            <Tags className="size-4 text-muted-foreground" />
          </div>
        ),
    },
    { accessorKey: "name", header: t.brands.columnName },
    {
      accessorKey: "slug",
      header: t.brands.columnSlug,
      cell: ({ row }) => (
        <span dir="ltr" className="text-muted-foreground">
          {row.original.slug}
        </span>
      ),
    },
    {
      id: "productsCount",
      header: t.brands.columnProductsCount,
      cell: ({ row }) => row.original._count.products.toLocaleString(locale),
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
            render={<Link href={`/dashboard/brands/${row.original.id}`} />}
            title={t.brands.viewProfile}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false} render={<Link href={editHref(row.original.id)} />}
          >
            <Pencil className="size-4" />
          </Button>
          <ConfirmDeleteDialog
            action={() => deleteBrand(row.original.id)}
            description={formatMessage(t.brands.deleteDescription, {
              name: row.original.name,
            })}
          />
        </div>
      ),
    },
  ];
}
