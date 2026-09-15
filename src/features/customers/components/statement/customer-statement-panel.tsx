import { CalendarX2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatementFilterBar } from "@/features/customers/components/statement/statement-filter-bar";
import { StatementProductsChart } from "@/features/customers/components/statement/statement-products-chart";
import { StatementProductsTable } from "@/features/customers/components/statement/statement-products-table";
import { getCustomerProductAnalysis } from "@/features/customers/statement-queries";
import type { ResolvedRange } from "@/features/dashboard/date-range";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export async function CustomerStatementPanel({
  customerId,
  range,
  basePath,
  t,
  locale,
}: {
  customerId: string;
  range: ResolvedRange;
  basePath: string;
  t: Dictionary;
  locale: Locale;
}) {
  const products = await getCustomerProductAnalysis(customerId, range);
  const hasActivity = products.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t.customerStatement.description}</p>
      </div>

      <StatementFilterBar basePath={basePath} range={range} customerId={customerId} t={t} />

      {hasActivity ? (
        <>
          <StatementProductsChart products={products} t={t} locale={locale} />
          <StatementProductsTable products={products} t={t} locale={locale} />
        </>
      ) : (
        <EmptyState
          icon={CalendarX2}
          title={t.customerStatement.emptyTitle}
          description={t.customerStatement.emptyDescription}
        />
      )}
    </div>
  );
}
