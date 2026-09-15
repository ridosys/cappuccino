import type { Dictionary } from "@/i18n/dictionaries";
import type { LowStockProduct } from "./queries";

export type LowStockColumn = {
  id: string;
  header: string;
  /** Cell value for the CSV / XLSX / PDF table. Numbers stay numbers so the
   * spreadsheet keeps them numeric. */
  value: (row: LowStockProduct) => string | number;
  /** Right-aligned numeric column in the PDF table. */
  numeric?: boolean;
};

/**
 * The columns of the low-stock report, shared by the export API route (CSV /
 * XLSX) and the client-side PDF builder so both stay in lockstep. Header
 * labels are translated; pass the currency label to suffix the cost column.
 */
export function lowStockReportColumns(
  t: Dictionary,
  currencyLabel: string,
): LowStockColumn[] {
  return [
    { id: "name", header: t.products.columnName, value: (row) => row.name },
    { id: "sku", header: "SKU", value: (row) => row.sku },
    {
      id: "barcode",
      header: t.products.barcodeColumnLabel,
      value: (row) => row.barcode ?? "",
    },
    {
      id: "category",
      header: t.products.columnCategory,
      value: (row) => row.categoryName,
    },
    {
      id: "brand",
      header: t.products.columnBrand,
      value: (row) => row.brandName ?? "",
    },
    {
      id: "quantity",
      header: t.inventory.columnCurrentQuantity,
      value: (row) => row.quantity,
      numeric: true,
    },
    {
      id: "minStock",
      header: t.inventory.columnMinStock,
      value: (row) => row.minStockLevel,
      numeric: true,
    },
    {
      id: "shortage",
      header: t.inventory.lowStockColumnShortage,
      value: (row) => row.shortage,
      numeric: true,
    },
    {
      id: "purchasePrice",
      header: `${t.products.purchasePriceDisplayLabel} (${currencyLabel})`,
      value: (row) => row.purchasePrice,
      numeric: true,
    },
    {
      id: "status",
      header: t.common.status,
      value: (row) => t.statusLabels.productStatus[row.status],
    },
  ];
}
