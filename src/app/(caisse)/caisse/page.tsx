import { auth } from "@/lib/auth";
import { canAccessDashboard } from "@/lib/permissions";
import { getLocale } from "@/i18n/server";
import { getSystemSettings } from "@/features/settings/queries";
import {
  getPosCategoriesPage,
  getPosProducts,
  searchPosCustomers,
} from "@/features/pos/queries";
import { PosWorkspace } from "@/features/pos/components/pos-workspace";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  const [session, settings, locale, canDashboard, categories, products, customers] =
    await Promise.all([
      auth(),
      getSystemSettings(),
      getLocale(),
      canAccessDashboard(),
      getPosCategoriesPage(),
      getPosProducts({}),
      searchPosCustomers({ q: "" }),
    ]);

  return (
    <PosWorkspace
      adminName={session?.user?.name ?? ""}
      logoUrl={settings.logoUrl}
      locale={locale}
      canDashboard={canDashboard}
      initialCategories={categories}
      initialProducts={products}
      initialCustomers={customers}
    />
  );
}
