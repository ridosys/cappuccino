"use client";

import Link from "next/link";
import Image from "next/image";
import { Pencil, Package, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordConfirmDeleteDialog } from "@/components/shared/password-confirm-delete-dialog";
import { deleteProduct } from "@/features/products/actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMessage } from "@/i18n/format";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minStockLevel: number;
  status: "ACTIVE" | "INACTIVE";
  category: { name: string };
  brand: { name: string } | null;
  images: { secureUrl: string }[];
};

export function getProductColumns(
  editHref: (id: string) => string,
  t: Dictionary,
  locale: string,
): ColumnDef<ProductRow>[] {
  return [
    {
      id: "image",
      header: "",
      cell: ({ row }) => {
        const image = row.original.images[0];
        return image ? (
          <div className="relative size-10 overflow-hidden rounded-md border">
            <Image
              src={image.secureUrl}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <Package className="size-4 text-muted-foreground" />
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: t.products.columnName,
      cell: ({ row }) => <p className="font-medium">{row.original.name}</p>,
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span dir="ltr" className="text-muted-foreground">
          {row.original.sku}
        </span>
      ),
    },
    {
      id: "category",
      header: t.products.columnCategory,
      cell: ({ row }) => row.original.category.name,
    },
    {
      id: "brand",
      header: t.products.columnBrand,
      cell: ({ row }) => row.original.brand?.name ?? "—",
    },
    {
      id: "quantity",
      header: t.products.columnQuantity,
      cell: ({ row }) => {
        const isLow = row.original.quantity <= row.original.minStockLevel;
        return (
          <span className={isLow ? "font-medium text-destructive" : ""}>
            {row.original.quantity.toLocaleString(locale)}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t.common.status,
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "ACTIVE" ? "default" : "secondary"}
        >
          {t.statusLabels.productStatus[row.original.status]}
        </Badge>
      ),
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
            render={<Link href={`/dashboard/products/${row.original.id}`} />}
            title={t.customers.viewProfile}
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
          <PasswordConfirmDeleteDialog
            action={(password) => deleteProduct(row.original.id, password)}
            description={formatMessage(t.products.deleteDescription, {
              name: row.original.name,
            })}
          />
        </div>
      ),
    },
  ];
}
