import { auth } from "@/lib/auth";
import { canAccessDashboard } from "@/lib/permissions";
import { getLocale } from "@/i18n/server";
import { getSystemSettings } from "@/features/settings/queries";
import {
  getPosCategoriesPage,
  getPosCustomerById,
  getPosProducts,
  searchPosCustomers,
} from "@/features/pos/queries";
import { getAdminPosRegister } from "@/features/pos-registers/queries";
import { PosWorkspace } from "@/features/pos/components/pos-workspace";

export const dynamic = "force-dynamic";

export default async function CaissePage() {
  const session = await auth();
  // An admin assigned to a configured caisse is locked to its customer and
  // categories; everyone else gets the regular unrestricted caisse.
  const register = session?.user
    ? await getAdminPosRegister(session.user.id)
    : null;
  const allowedCategoryIds = register?.categoryIds;

  const [settings, locale, canDashboard, categories, products, customers, fixedCustomer] =
    await Promise.all([
      getSystemSettings(),
      getLocale(),
      canAccessDashboard(),
      getPosCategoriesPage({ allowedCategoryIds }),
      getPosProducts({ allowedCategoryIds }),
      register
        ? Promise.resolve({ items: [], hasMore: false })
        : searchPosCustomers({ q: "" }),
      register ? getPosCustomerById(register.customerId) : Promise.resolve(null),
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
      fixedCustomer={fixedCustomer}
    />
  );
}
