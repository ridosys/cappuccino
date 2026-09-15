import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export default async function ReportsPage() {
  await requirePageAccess("REPORTS_VIEW");
  const t = await getDictionary();

  const REPORTS = [
    {
      href: "/dashboard/reports/products",
      icon: Package,
      title: t.reports.productsTitle,
      description: t.reports.productsDescription,
    },
    {
      href: "/dashboard/reports/inventory",
      icon: Boxes,
      title: t.reports.inventoryTitle,
      description: t.reports.inventoryDescription,
    },
    {
      href: "/dashboard/reports/orders",
      icon: ShoppingCart,
      title: t.reports.ordersTitle,
      description: t.reports.ordersDescription,
    },
    {
      href: "/dashboard/reports/customers",
      icon: Users,
      title: t.reports.customersTitle,
      description: t.reports.customersDescription,
    },
    {
      href: "/dashboard/reports/purchases",
      icon: Warehouse,
      title: t.reports.purchasesTitle,
      description: t.reports.purchasesDescription,
    },
    {
      href: "/dashboard/reports/suppliers",
      icon: Truck,
      title: t.reports.suppliersTitle,
      description: t.reports.suppliersDescription,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t.admin.reports} icon={BarChart3} />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <report.icon className="size-5" />
            </span>
            <div className="flex-1 space-y-0.5">
              <p className="font-medium">{report.title}</p>
              <p className="text-sm text-muted-foreground">
                {report.description}
              </p>
            </div>
            <ChevronLeft className="size-4 shrink-0 self-center text-muted-foreground/50 transition-transform group-hover:-translate-x-1 group-hover:text-primary rtl:rotate-180 rtl:group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
