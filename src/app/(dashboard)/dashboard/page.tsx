import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  AlertTriangle,
  Wallet,
  Warehouse,
  Receipt,
  TrendingUp,
  UserPlus,
  Truck,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardStats } from "@/features/dashboard/queries";
import {
  getAnalyticsSummary,
  getRevenueTrend,
  getOrderStatusBreakdown,
  getPaymentStatusBreakdown,
  getTopProducts,
  getTopCustomers,
  getSalesByCategory,
  getExpensesByCategory,
} from "@/features/dashboard/analytics-queries";
import { resolveDateRange } from "@/features/dashboard/date-range";
import { AnalyticsFilterBar } from "@/features/dashboard/components/analytics-filter-bar";
import { RevenueTrendChart } from "@/features/dashboard/components/revenue-trend-chart";
import { PaymentStatusChart } from "@/features/dashboard/components/payment-status-chart";
import { CategorySalesChart } from "@/features/dashboard/components/category-sales-chart";
import { OrderStatusChart } from "@/features/dashboard/components/order-status-chart";
import { RankedListCard } from "@/features/dashboard/components/ranked-list-card";
import { ExpensesChart } from "@/features/dashboard/components/expenses-chart";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { hasPermission, getFirstAccessiblePath } from "@/lib/permissions";
import { getLocale, getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  // This is also the page login lands everyone on, so a user without
  // DASHBOARD_VIEW must never dead-end here on the generic access-denied
  // screen — forward them straight to whichever page they actually do have
  // access to instead (same fallback the access-denied page's own "back"
  // link uses).
  if (!(await hasPermission("DASHBOARD_VIEW"))) {
    redirect(await getFirstAccessiblePath());
  }

  const params = await searchParams;
  const range = resolveDateRange(params);

  const [
    locale,
    t,
    stats,
    summary,
    trend,
    orderStatusBreakdown,
    paymentStatusBreakdown,
    topProducts,
    topCustomers,
    categorySales,
    expensesByCategory,
  ] = await Promise.all([
    getLocale(),
    getDictionary(),
    getDashboardStats(),
    getAnalyticsSummary(range),
    getRevenueTrend(range),
    getOrderStatusBreakdown(range),
    getPaymentStatusBreakdown(range),
    getTopProducts(range),
    getTopCustomers(range),
    getSalesByCategory(range),
    getExpensesByCategory(range),
  ]);
  const totalExpenses = expensesByCategory.reduce(
    (sum, expense) => sum + expense.total,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.admin.dashboard}
        description={t.dashboard.description}
        icon={LayoutDashboard}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t.dashboardCards.totalProducts}
          value={stats.totalProducts}
          icon={Package}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.totalCustomers}
          value={stats.totalCustomers}
          icon={Users}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.orders}
          value={stats.activeOrders}
          icon={ShoppingCart}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.lowStockProducts}
          value={stats.lowStockCount}
          icon={AlertTriangle}
          variant="warning"
          locale={locale}
          href="/dashboard/inventory/low-stock"
        />
        <StatCard
          title={t.dashboardCards.totalOwedByCustomers}
          value={stats.totalOwedByCustomers}
          icon={Wallet}
          variant="warning"
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.dashboardCards.totalInventoryPurchaseValue}
          value={stats.totalInventoryPurchaseValue}
          icon={Warehouse}
          formatValue={(value) => formatCurrency(value, locale)}
        />
      </div>

      <AnalyticsFilterBar basePath="/dashboard" range={range} t={t} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t.dashboardCards.periodRevenue}
          value={summary.revenue}
          icon={TrendingUp}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.dashboardCards.periodInvoices}
          value={summary.invoiceCount}
          icon={Receipt}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.periodOrders}
          value={summary.ordersCount}
          icon={ShoppingCart}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.avgInvoice}
          value={summary.avgInvoice}
          icon={Wallet}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.dashboardCards.newCustomers}
          value={summary.newCustomers}
          icon={UserPlus}
          locale={locale}
        />
        <StatCard
          title={t.dashboardCards.periodPurchases}
          value={summary.purchasesTotal}
          icon={Truck}
          formatValue={(value) => formatCurrency(value, locale)}
        />
        <StatCard
          title={t.dashboard.totalExpenses}
          value={totalExpenses}
          icon={Receipt}
          variant="warning"
          formatValue={(value) => formatCurrency(value, locale)}
        />
      </div>

      <RevenueTrendChart data={trend} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RankedListCard
          title={t.dashboard.topSelling}
          icon={Package}
          emptyLabel={t.dashboard.noSalesInPeriod}
          locale={locale}
          items={topProducts.map((product) => ({
            key: product.key,
            label: product.name,
            sublabel: `${product.quantity.toLocaleString(locale)} ${t.dashboard.unitSuffix}`,
            value: product.revenue,
          }))}
        />
        <RankedListCard
          title={t.dashboard.topCustomers}
          icon={Users}
          emptyLabel={t.dashboard.noInvoicesInPeriod}
          locale={locale}
          items={topCustomers.map((customer) => ({
            key: customer.id,
            label: customer.name,
            sublabel: `${customer.invoiceCount.toLocaleString(locale)} ${t.dashboard.invoiceSuffix}`,
            value: customer.total,
            href: `/dashboard/customers/${customer.id}`,
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategorySalesChart data={categorySales} />
        <PaymentStatusChart data={paymentStatusBreakdown} />
        <OrderStatusChart data={orderStatusBreakdown} />
        <ExpensesChart data={expensesByCategory} />
      </div>
    </div>
  );
}
