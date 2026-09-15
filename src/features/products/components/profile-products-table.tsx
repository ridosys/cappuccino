import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type ProfileProduct = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minStockLevel: number;
  status: "ACTIVE" | "INACTIVE";
};

export function ProfileProductsTable({
  products,
  emptyTitle,
  t,
  locale,
}: {
  products: ProfileProduct[];
  emptyTitle: string;
  t: Dictionary;
  locale: Locale;
}) {
  if (products.length === 0) {
    return <EmptyState icon={Package} title={emptyTitle} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.products.columnName}</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>{t.products.columnQuantity}</TableHead>
          <TableHead>{t.common.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const isLowStock = product.quantity <= product.minStockLevel;
          return (
            <TableRow key={product.id}>
              <TableCell>
                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {product.name}
                </Link>
              </TableCell>
              <TableCell dir="ltr">{product.sku}</TableCell>
              <TableCell
                className={isLowStock ? "font-medium text-destructive" : ""}
              >
                {product.quantity.toLocaleString(locale)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={product.status === "ACTIVE" ? "default" : "secondary"}
                >
                  {t.statusLabels.productStatus[product.status]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
