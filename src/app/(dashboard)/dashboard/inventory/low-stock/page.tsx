import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getLowStockProductsFeed,
  getLowStockProductIds,
} from "@/features/products/queries";
import { getSystemSettings } from "@/features/settings/queries";
import { LowStockExportTable } from "@/features/products/components/low-stock-export-table";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function LowStockProductsPage() {
  await requirePageAccess("INVENTORY_VIEW");

  const [t, feed, allIds, settings] = await Promise.all([
    getDictionary(),
    getLowStockProductsFeed(),
    getLowStockProductIds(),
    getSystemSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.inventory.lowStockPageTitle}
        description={t.inventory.lowStockPageDescription}
        icon={AlertTriangle}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/inventory" />}
          >
            <ArrowRight className="size-4 rtl:rotate-180" />
            {t.admin.inventory}
          </Button>
        }
      />

      {feed.total === 0 ? (
        <EmptyState
          icon={Boxes}
          title={t.inventory.lowStockEmpty}
          description={t.inventory.lowStockEmptyDescription}
        />
      ) : (
        <LowStockExportTable
          initial={feed}
          allIds={allIds}
          logoUrl={settings.logoUrl}
          appName={settings.appName}
        />
      )}
    </div>
  );
}
