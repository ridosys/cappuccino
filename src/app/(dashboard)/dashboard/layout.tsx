import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UnsavedChangesProvider } from "@/components/shared/unsaved-changes";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/features/dashboard/queries";
import { getSystemSettings } from "@/features/settings/queries";
import { getEffectivePermissions } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, stats, settings] = await Promise.all([
    auth(),
    getDashboardStats(),
    getSystemSettings(),
  ]);

  // Defense in depth: proxy.ts already guards /dashboard/**, but this
  // layout re-checks auth close to the render so any route added under
  // (admin) is protected even if the proxy matcher is ever misconfigured.
  if (!session?.user) {
    redirect("/login");
  }

  const effectivePermissions = await getEffectivePermissions(session.user.id);
  const permissions =
    effectivePermissions === "full"
      ? ("full" as const)
      : Array.from(effectivePermissions);

  return (
    <SidebarProvider>
      <AppSidebar
        adminName={session?.user?.name ?? ""}
        appName={settings.appName}
        logoUrl={settings.logoUrl}
        permissions={permissions}
        pendingOrders={stats.pendingOrders}
        lowStock={stats.lowStockCount}
        unpaidInvoices={stats.unpaidInvoicesCount}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-header/80 px-4 backdrop-blur-sm print:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 print:p-0">
          <div className="w-full min-w-0 lg:mx-auto lg:max-w-350">
            <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
