import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  Users,
  ShoppingCart,
  Boxes,
  Truck,
  ClipboardList,
  Receipt,
  BarChart3,
  FileText,
  RotateCcw,
  Undo2,
  UserCog,
  ShieldCheck,
  Palette,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PermissionKey } from "@/lib/permission-modules";

export type AdminNavBadgeKey = "pendingOrders" | "lowStock" | "unpaidInvoices";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: AdminNavBadgeKey;
  /** Nav item is only shown when the current admin holds this permission
   * (or has full access). Omitted entirely means always visible — only the
   * dashboard overview link itself has no gate. */
  permission?: PermissionKey;
};

export type AdminNavGroup = {
  label?: string;
  items: AdminNavItem[];
};

function canSee(
  permissions: PermissionKey[] | "full",
  permission?: PermissionKey,
): boolean {
  if (!permission) return true;
  return permissions === "full" || permissions.includes(permission);
}

export function getAdminNavGroups(
  t: Dictionary,
  permissions: PermissionKey[] | "full",
): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [
    {
      items: [
        {
          href: "/dashboard",
          label: t.admin.dashboard,
          icon: LayoutDashboard,
          permission: "DASHBOARD_VIEW",
        },
      ],
    },
    {
      label: t.admin.groups.catalog,
      items: [
        {
          href: "/dashboard/products",
          label: t.admin.products,
          icon: Package,
          permission: "PRODUCTS_VIEW",
        },
        {
          href: "/dashboard/categories",
          label: t.admin.categories,
          icon: FolderTree,
          permission: "PRODUCTS_VIEW",
        },
        {
          href: "/dashboard/brands",
          label: t.admin.brands,
          icon: Tags,
          permission: "PRODUCTS_VIEW",
        },
      ],
    },
    {
      label: t.admin.groups.sales,
      items: [
        {
          href: "/dashboard/customers",
          label: t.admin.customers,
          icon: Users,
          permission: "CUSTOMERS_VIEW",
        },
        {
          href: "/dashboard/orders",
          label: t.admin.orders,
          icon: ShoppingCart,
          badgeKey: "pendingOrders",
          permission: "ORDERS_VIEW",
        },
        {
          href: "/dashboard/invoices",
          label: t.admin.invoices,
          icon: FileText,
          badgeKey: "unpaidInvoices",
          permission: "INVOICES_VIEW",
        },
        {
          href: "/dashboard/sales-returns",
          label: t.returns.salesTitle,
          icon: RotateCcw,
          permission: "RETURNS_VIEW",
        },
      ],
    },
    {
      label: t.admin.groups.inventory,
      items: [
        {
          href: "/dashboard/inventory",
          label: t.admin.inventory,
          icon: Boxes,
          badgeKey: "lowStock",
          permission: "INVENTORY_VIEW",
        },
        {
          href: "/dashboard/suppliers",
          label: t.admin.suppliers,
          icon: Truck,
          permission: "SUPPLIERS_VIEW",
        },
        {
          href: "/dashboard/purchases",
          label: t.admin.purchases,
          icon: ClipboardList,
          permission: "PURCHASES_VIEW",
        },
        {
          href: "/dashboard/purchase-returns",
          label: t.returns.purchaseTitle,
          icon: Undo2,
          permission: "RETURNS_VIEW",
        },
      ],
    },
    {
      label: t.admin.groups.finance,
      items: [
        {
          href: "/dashboard/expenses",
          label: t.admin.expenses,
          icon: Receipt,
          permission: "EXPENSES_VIEW",
        },
        {
          href: "/dashboard/reports",
          label: t.admin.reports,
          icon: BarChart3,
          permission: "REPORTS_VIEW",
        },
      ],
    },
    {
      label: t.admin.groups.settings,
      items: [
        {
          href: "/dashboard/settings/users",
          label: t.admin.users,
          icon: UserCog,
          permission: "USERS_MANAGE",
        },
        {
          href: "/dashboard/settings/roles",
          label: t.admin.roles,
          icon: ShieldCheck,
          permission: "USERS_MANAGE",
        },
        {
          href: "/dashboard/settings/appearance",
          label: t.admin.appearance,
          icon: Palette,
          permission: "SETTINGS_MANAGE",
        },
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSee(permissions, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

/** The first page this admin can actually reach, in the same priority
 * order as the sidebar itself — used wherever the app would otherwise
 * blindly send someone to `/dashboard` regardless of whether they can see
 * it (post-login redirect, the access-denied page's "back" link). Returns
 * `null` only for a role with no permissions granted at all, in which case
 * the caller should fall back to the access-denied page — there's
 * genuinely nowhere else to send them. */
export function getFirstAccessibleHref(
  t: Dictionary,
  permissions: PermissionKey[] | "full",
): string | null {
  const groups = getAdminNavGroups(t, permissions);
  const firstDashboardHref = groups[0]?.items[0]?.href;
  if (firstDashboardHref) return firstDashboardHref;
  // La Caisse is intentionally absent from the sidebar, but a POS-only role
  // still needs somewhere to land instead of the access-denied dead end.
  if (canSee(permissions, "POS_VIEW")) return "/caisse";
  return null;
}
