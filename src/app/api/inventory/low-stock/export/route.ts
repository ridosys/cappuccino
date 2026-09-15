import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions";
import { buildCsv, buildXlsx } from "@/lib/report-export";
import { getLowStockProducts } from "@/features/products/queries";
import { lowStockReportColumns } from "@/features/products/low-stock-report";
import { getLocale } from "@/i18n/server";
import { dictionaries } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { CURRENCY_LABEL } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const [access, sessionLocale] = await Promise.all([
    requireApiPermission("INVENTORY_VIEW"),
    getLocale(),
  ]);
  if (!access.ok) return access.response;

  // ?lang= (ar/en/fr) overrides the requester's session locale, so the same
  // export can be pulled in any language — matching /api/reports/export.
  const requestedLang = searchParams.get("lang");
  const locale = isLocale(requestedLang) ? requestedLang : sessionLocale;
  const t = dictionaries[locale];
  const currency =
    CURRENCY_LABEL[locale as keyof typeof CURRENCY_LABEL] ?? CURRENCY_LABEL.ar;

  const format = searchParams.get("format") ?? "csv";
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))
    : null;

  const all = await getLowStockProducts();
  const products = ids ? all.filter((product) => ids.has(product.id)) : all;

  const columns = lowStockReportColumns(t, currency);
  const headers = columns.map((column) => column.header);
  const rows = products.map((product) =>
    columns.map((column) => column.value(product)),
  );

  if (format === "json") {
    return NextResponse.json({ headers, rows });
  }

  const fileBaseName = `low-stock-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const buffer = await buildXlsx(t.inventory.lowStockPageTitle, headers, rows);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBaseName}.xlsx"`,
      },
    });
  }

  const csv = buildCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBaseName}.csv"`,
    },
  });
}
