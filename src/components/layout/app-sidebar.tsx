"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsUpDown, LogOut, Calculator } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { BrandMark } from "@/components/shared/brand-mark";
import { getAdminNavGroups } from "@/components/layout/admin-nav-items";
import { useT, useLocale } from "@/i18n/locale-provider";
import { useDirection } from "@/components/ui/direction";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/lib/permission-modules";

const COLLAPSED_GROUPS_STORAGE_KEY = "dashboard-sidebar-collapsed-groups";
// The native "storage" event only fires in *other* tabs than the one that
// wrote the change, so a same-tab toggle dispatches this too — otherwise
// useSyncExternalStore would never see its own write.
const COLLAPSED_GROUPS_CHANGE_EVENT =
  "dashboard-sidebar-collapsed-groups-change";

function subscribeToCollapsedGroups(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSED_GROUPS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSED_GROUPS_CHANGE_EVENT, onChange);
  };
}

function getCollapsedGroupsSnapshot(): string {
  try {
    return localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getCollapsedGroupsServerSnapshot(): string {
  return "[]";
}

function useCollapsedGroups() {
  const raw = useSyncExternalStore(
    subscribeToCollapsedGroups,
    getCollapsedGroupsSnapshot,
    getCollapsedGroupsServerSnapshot,
  );

  let collapsed: string[];
  try {
    collapsed = JSON.parse(raw);
  } catch {
    collapsed = [];
  }

  function setGroupCollapsed(label: string, isCollapsed: boolean) {
    const next = isCollapsed
      ? [...collapsed.filter((l) => l !== label), label]
      : collapsed.filter((l) => l !== label);
    try {
      localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore — the toggle still applies visually via the dispatched event
      // below, it just won't be remembered next time.
    }
    window.dispatchEvent(new Event(COLLAPSED_GROUPS_CHANGE_EVENT));
  }

  return [collapsed, setGroupCollapsed] as const;
}

export function AppSidebar({
  adminName,
  appName,
  logoUrl,
  permissions,
  pendingOrders,
  lowStock,
  unpaidInvoices,
}: {
  adminName: string;
  appName: string;
  logoUrl: string | null;
  permissions: PermissionKey[] | "full";
  pendingOrders: number;
  lowStock: number;
  unpaidInvoices: number;
}) {
  const pathname = usePathname();
  const { state: sidebarState, setOpenMobile } = useSidebar();
  const t = useT();
  const { locale } = useLocale();
  const direction = useDirection();
  const adminNavGroups = getAdminNavGroups(t, permissions);
  const canPos = permissions === "full" || permissions.includes("POS_VIEW");
  const [collapsedGroups, setGroupCollapsed] = useCollapsedGroups();
  const badgeValues: Record<string, number> = {
    pendingOrders,
    lowStock,
    unpaidInvoices,
  };

  function isItemActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  return (
    <Sidebar side={direction === "rtl" ? "right" : "left"} collapsible="icon">
      {/* Decorative dot-grid texture behind the sidebar content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--sidebar-foreground) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <SidebarHeader>
        <Link
          href="/dashboard"
          onClick={() => setOpenMobile(false)}
          className="flex items-center justify-between gap-2.5 rounded-lg px-2 py-2 outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-base font-bold tracking-tight">
              {appName}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {t.sidebar.subtitle}
            </span>
          </div>
          <BrandMark size="lg" logoUrl={logoUrl} />
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-1">
        {adminNavGroups.map((group, groupIndex) => {
          const menu = (
            <SidebarMenu className="gap-1.5">
              {group.items.map((item) => {
                const isActive = isItemActive(item.href);
                const badgeValue = item.badgeKey
                  ? badgeValues[item.badgeKey]
                  : undefined;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "rounded-lg data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:shadow-sm data-active:hover:bg-primary data-active:hover:text-primary-foreground",
                      )}
                      render={
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                    {!!badgeValue && badgeValue > 0 && (
                      <SidebarMenuBadge
                        className={cn(
                          isActive &&
                            "peer-data-active/menu-button:text-primary-foreground",
                          item.badgeKey === "lowStock" ||
                            item.badgeKey === "unpaidInvoices"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {badgeValue.toLocaleString(locale)}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          );

          // The first group (dashboard overview link) has no label — nothing
          // to collapse, just render it plainly.
          if (!group.label) {
            return (
              <SidebarGroup key={groupIndex}>
                <SidebarGroupContent>{menu}</SidebarGroupContent>
              </SidebarGroup>
            );
          }

          const isActiveGroup = group.items.some((item) =>
            isItemActive(item.href),
          );
          const isOpen =
            sidebarState === "collapsed" ||
            isActiveGroup ||
            !collapsedGroups.includes(group.label);

          return (
            <SidebarGroup key={group.label}>
              <Collapsible
                open={isOpen}
                onOpenChange={(open) => setGroupCollapsed(group.label!, !open)}
              >
                <CollapsibleTrigger
                  nativeButton={false}
                  render={
                    <SidebarGroupLabel className="group/collapsible-trigger flex w-full cursor-pointer items-center justify-between gap-2 select-none hover:bg-sidebar-accent/60 hover:text-sidebar-foreground" />
                  }
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-data-panel-open/collapsible-trigger:rotate-180" />
                </CollapsibleTrigger>
                <CollapsiblePanel>
                  <SidebarGroupContent>{menu}</SidebarGroupContent>
                </CollapsiblePanel>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LocaleSwitcher variant="sidebar" className="w-full" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="text-sidebar-foreground/70 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-7 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
                        {adminName ? adminName.charAt(0) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col overflow-hidden text-start">
                      <span className="truncate text-sm font-medium text-sidebar-foreground">
                        {adminName}
                      </span>
                    </div>
                    <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-150 group-data-popup-open/menu-button:rotate-180" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {adminName}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {canPos && (
                  <>
                    <DropdownMenuItem
                      render={
                        <Link
                          href="/caisse"
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <Calculator />
                      {t.admin.caisse}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <form action={logout}>
                  <DropdownMenuItem
                    variant="destructive"
                    nativeButton
                    render={<button type="submit" className="w-full" />}
                  >
                    <LogOut />
                    {t.admin.logout}
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
