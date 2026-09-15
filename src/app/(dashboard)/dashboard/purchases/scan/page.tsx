import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { getSupplierOptions } from "@/features/suppliers/queries";
import { getProductPickerOptions } from "@/features/products/queries";
import { getCategoryOptions } from "@/features/categories/queries";
import { getBrandOptions } from "@/features/brands/queries";
import { ScanInvoiceWorkspace } from "@/features/purchases/components/scan-invoice-workspace";
import { requirePageAccess, hasPermission } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ScanPurchaseInvoicePage() {
  await requirePageAccess("PURCHASES_MANAGE");

  const [
    t,
    suppliers,
    productRows,
    categories,
    brands,
    canManageSuppliers,
    canManageProducts,
  ] = await Promise.all([
    getDictionary(),
    getSupplierOptions(),
    getProductPickerOptions(),
    getCategoryOptions(),
    getBrandOptions(),
    hasPermission("SUPPLIERS_MANAGE"),
    hasPermission("PRODUCTS_MANAGE"),
  ]);

  const products = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    purchasePrice: Number(product.purchasePrice),
    price1: Number(product.price1),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.purchaseScan.pageTitle}
        description={t.purchaseScan.pageDescription}
        icon={ScanLine}
        action={<BackButton fallbackHref="/dashboard/purchases" />}
      />
      <ScanInvoiceWorkspace
        suppliers={suppliers}
        products={products}
        categories={categories}
        brands={brands}
        canManageSuppliers={canManageSuppliers}
        canManageProducts={canManageProducts}
      />
    </div>
  );
}
