import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PermissionKey } from "@/lib/permission-modules";
import { getDictionary } from "@/i18n/server";
import { getFirstAccessibleHref } from "@/components/layout/admin-nav-items";

// Re-exported so existing server-side imports of the module-list helpers
// from "@/lib/permissions" keep working — the actual definitions live in
// permission-modules.ts, which has no "server-only" guard so client
// components (the role permission-matrix UI) can import them too.
export {
  PermissionKey,
  PERMISSION_MODULE_KEYS,
  moduleViewPermission,
  moduleManagePermission,
  type PermissionModuleKey,
} from "@/lib/permission-modules";

export const getEffectivePermissions = cache(async function (
  adminId: string,
): Promise<Set<PermissionKey> | "full"> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      isActive: true,
      role: {
        select: {
          isFullAccess: true,
          permissions: { select: { permission: true } },
        },
      },
    },
  });
  if (!admin || !admin.isActive) return new Set();
  if (admin.role.isFullAccess) return "full";
  return new Set(admin.role.permissions.map((p) => p.permission));
});

/** For Server Components deciding what to render (nav items, whole pages). */
export async function hasPermission(
  permission: PermissionKey,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const effective = await getEffectivePermissions(session.user.id);
  return effective === "full" || effective.has(permission);
}

export async function hasAnyPermission(
  permissions: PermissionKey[],
): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const effective = await getEffectivePermissions(session.user.id);
  if (effective === "full") return true;
  return permissions.some((permission) => effective.has(permission));
}

/** Every permission that unlocks at least one page under /dashboard. A role
 * holding none of these has no reason to land on the dashboard (it should
 * go straight to La Caisse instead). */
export const DASHBOARD_ACCESS_PERMISSIONS: PermissionKey[] = [
  "DASHBOARD_VIEW",
  "PRODUCTS_VIEW",
  "ORDERS_VIEW",
  "CUSTOMERS_VIEW",
  "INVENTORY_VIEW",
  "PURCHASES_VIEW",
  "INVOICES_VIEW",
  "SUPPLIERS_VIEW",
  "EXPENSES_VIEW",
  "REPORTS_VIEW",
  "RETURNS_VIEW",
  "USERS_MANAGE",
  "SETTINGS_MANAGE",
  "POS_CONFIGURE",
];

export function canAccessDashboard(): Promise<boolean> {
  return hasAnyPermission(DASHBOARD_ACCESS_PERMISSIONS);
}

export async function requirePageAccess(
  permission: PermissionKey,
): Promise<void> {
  const allowed = await hasPermission(permission);
  if (!allowed) redirect("/dashboard/access-denied");
}

export async function getFirstAccessiblePath(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "/login";

  const effective = await getEffectivePermissions(session.user.id);
  const permissions = effective === "full" ? "full" : Array.from(effective);
  const t = await getDictionary();
  return getFirstAccessibleHref(t, permissions) ?? "/dashboard/access-denied";
}

export type PermissionCheck =
  | { ok: true; adminId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requirePermission(
  permission: PermissionKey,
): Promise<PermissionCheck> {
  const session = await auth();
  if (!session?.user) {
    const t = await getDictionary();
    return { ok: false, status: 401, error: t.common.loginRequiredError };
  }

  const effective = await getEffectivePermissions(session.user.id);
  if (effective !== "full" && !effective.has(permission)) {
    const t = await getDictionary();
    return {
      ok: false,
      status: 403,
      error: t.common.insufficientPermissionError,
    };
  }
  return { ok: true, adminId: session.user.id };
}

export async function requireApiPermission(
  permission: PermissionKey,
): Promise<
  { ok: true; adminId: string } | { ok: false; response: NextResponse }
> {
  const access = await requirePermission(permission);
  if (access.ok) return access;
  return {
    ok: false,
    response: NextResponse.json(
      { error: access.error },
      { status: access.status },
    ),
  };
}

export async function countOtherActiveFullAccessAdmins(
  excludeAdminId: string,
): Promise<number> {
  return prisma.admin.count({
    where: {
      id: { not: excludeAdminId },
      isActive: true,
      role: { isFullAccess: true },
    },
  });
}
