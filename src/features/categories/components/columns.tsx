"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, Pencil, FolderTree } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteCategory } from "@/features/categories/actions";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  imageSecureUrl: string | null;
  parent: { name: string } | null;
  _count: { products: number; children: number };
};

export function getCategoryColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: Locale,
): ColumnDef<CategoryRow>[] {
  return [
    {
      id: "image",
      header: "",
      cell: ({ row }) =>
        row.original.imageSecureUrl ? (
          <div className="relative size-10 overflow-hidden rounded-md border">
            <Image
              src={row.original.imageSecureUrl}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <FolderTree className="size-4 text-muted-foreground" />
          </div>
        ),
    },
    { accessorKey: "name", header: t.categories.columnName },
    {
      accessorKey: "slug",
      header: t.categories.columnSlug,
      cell: ({ row }) => (
        <span dir="ltr" className="text-muted-foreground">
          {row.original.slug}
        </span>
      ),
    },
    {
      id: "parent",
      header: t.categories.columnParent,
      cell: ({ row }) => row.original.parent?.name ?? "—",
    },
    {
      id: "productsCount",
      header: t.categories.columnProductsCount,
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
            render={<Link href={`/dashboard/categories/${row.original.id}`} />}
            title={t.categories.viewProfile}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={editHref(row.original.id)} />}
          >
            <Pencil className="size-4" />
          </Button>
          <ConfirmDeleteDialog
            action={() => deleteCategory(row.original.id)}
            description={formatMessage(t.categories.deleteDescription, {
              name: row.original.name,
            })}
          />
        </div>
      ),
    },
  ];
}
