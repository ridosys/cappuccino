import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { getProductPickerOptions } from "@/features/products/queries";
import { getCustomerOptions } from "@/features/customers/queries";
import { OrderForm } from "@/features/orders/components/order-form";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requirePageAccess("ORDERS_MANAGE");

  const [t, productRows, customers] = await Promise.all([
    getDictionary(),
    getProductPickerOptions(),
    getCustomerOptions(),
  ]);
  const products = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    quantity: Number(product.quantity),
    categoryId: product.categoryId,
    categoryName: product.category.name,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    price1: Number(product.price1),
    price2: Number(product.price2),
    price3: Number(product.price3),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.orders.newOrderTitle}
        icon={ShoppingCart}
        action={<BackButton fallbackHref="/dashboard/orders" />}
      />
      <OrderForm products={products} customers={customers} />
    </div>
  );
}
