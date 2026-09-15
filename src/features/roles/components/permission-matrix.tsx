"use client";

import { useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSION_MODULE_KEYS,
  DASHBOARD_TAB_PERMISSIONS,
  moduleViewPermission,
  moduleManagePermission,
  PermissionKey,
} from "@/lib/permission-modules";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type Tab = "dashboard" | "pos";

function AccessToggle({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        on ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          on ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

export function PermissionMatrix({
  value,
  onChange,
  fullAccess = false,
  dashboardOpen,
  onDashboardOpenChange,
}: {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  /** When the role has full access every permission is implied — the whole
   * matrix is shown ticked and locked. */
  fullAccess?: boolean;
  /** "Can access the Dashboard" toggle — controlled by the form so it can
   * enforce "pick at least one dashboard permission" on submit. */
  dashboardOpen: boolean;
  onDashboardOpenChange: (next: boolean) => void;
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("dashboard");
  const selected = new Set(value);

  const dashOpen = fullAccess || dashboardOpen;
  const posOn = fullAccess || selected.has("POS_VIEW");

  const dashboardCount = value.filter((p) =>
    DASHBOARD_TAB_PERMISSIONS.includes(p),
  ).length;
  const showDashboardError = !fullAccess && dashboardOpen && dashboardCount === 0;

  function toggle(permission: PermissionKey, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(permission);
    else next.delete(permission);

    if (permission === "POS_VIEW" && !checked) next.delete("POS_MANAGE");

    onChange(Array.from(next));
  }

  function toggleDashboard(next: boolean) {
    onDashboardOpenChange(next);
    if (!next) {
      onChange(value.filter((p) => !DASHBOARD_TAB_PERMISSIONS.includes(p)));
    }
  }

  const isChecked = (permission: PermissionKey) =>
    fullAccess || selected.has(permission);

  return (
    <div className="space-y-3">
      {fullAccess && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          <ShieldCheck className="size-4 shrink-0" />
          {t.roles.fullAccessNote}
        </p>
      )}

      {/* Dashboard / POS filter — grouping only, switching never clears
          selected permissions. A role can hold both sets. */}
      <div className="inline-flex rounded-lg border p-0.5 text-sm">
        {(["dashboard", "pos"] as const).map((key) => (
          <button
            key={key}
            type="button"
            disabled={fullAccess}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.roles.permissionTabs[key]}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <>
          <AccessToggle
            label={t.roles.dashboardAccessLabel}
            hint={t.roles.dashboardGateHint}
            on={dashOpen}
            disabled={fullAccess}
            onToggle={toggleDashboard}
          />

          {showDashboardError && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              {t.roles.dashboardNeedsOneError}
            </p>
          )}

          {dashOpen && (
            <div
              className={cn(
                "overflow-x-auto rounded-lg border",
                fullAccess && "opacity-70",
              )}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-start font-medium">
                      {t.roles.moduleColumn}
                    </th>
                    <th className="p-2 text-center font-medium">
                      {t.roles.viewColumn}
                    </th>
                    <th className="p-2 text-center font-medium">
                      {t.roles.manageColumn}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t bg-muted/30">
                    <td className="p-2 font-medium">
                      {t.roles.dashboardViewPermission}
                    </td>
                    <td className="p-2 text-center">
                      <Checkbox
                        disabled={fullAccess}
                        checked={isChecked("DASHBOARD_VIEW")}
                        onCheckedChange={(checked) =>
                          toggle("DASHBOARD_VIEW", checked)
                        }
                        aria-label={t.roles.dashboardViewPermission}
                      />
                    </td>
                    <td className="p-2 text-center text-muted-foreground">—</td>
                  </tr>
                  {PERMISSION_MODULE_KEYS.map((moduleKey) => {
                    const viewPermission = moduleViewPermission(moduleKey);
                    const managePermission = moduleManagePermission(moduleKey);
                    const moduleLabel = t.roles.modules[moduleKey];
                    return (
                      <tr key={moduleKey} className="border-t">
                        <td className="p-2">{moduleLabel}</td>
                        <td className="p-2 text-center">
                          <Checkbox
                            disabled={fullAccess}
                            checked={isChecked(viewPermission)}
                            onCheckedChange={(checked) =>
                              toggle(viewPermission, checked)
                            }
                            aria-label={`${moduleLabel} — ${t.roles.viewColumn}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            disabled={fullAccess}
                            checked={isChecked(managePermission)}
                            onCheckedChange={(checked) =>
                              toggle(managePermission, checked)
                            }
                            aria-label={`${moduleLabel} — ${t.roles.manageColumn}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t bg-muted/30">
                    <td className="p-2 font-medium">
                      {t.roles.usersManagePermission}
                    </td>
                    <td className="p-2 text-center text-muted-foreground">—</td>
                    <td className="p-2 text-center">
                      <Checkbox
                        disabled={fullAccess}
                        checked={isChecked("USERS_MANAGE")}
                        onCheckedChange={(checked) =>
                          toggle("USERS_MANAGE", checked)
                        }
                        aria-label={t.roles.usersManagePermission}
                      />
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="p-2 font-medium">
                      {t.roles.settingsManagePermission}
                    </td>
                    <td className="p-2 text-center text-muted-foreground">—</td>
                    <td className="p-2 text-center">
                      <Checkbox
                        disabled={fullAccess}
                        checked={isChecked("SETTINGS_MANAGE")}
                        onCheckedChange={(checked) =>
                          toggle("SETTINGS_MANAGE", checked)
                        }
                        aria-label={t.roles.settingsManagePermission}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <AccessToggle
            label={t.roles.posAccessLabel}
            hint={t.roles.posGateHint}
            on={posOn}
            disabled={fullAccess}
            onToggle={(next) => toggle("POS_VIEW", next)}
          />

          {posOn && (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm",
                fullAccess && "opacity-70",
              )}
            >
              <Checkbox
                disabled={fullAccess}
                checked={isChecked("POS_MANAGE")}
                onCheckedChange={(checked) => toggle("POS_MANAGE", checked)}
                aria-label={t.roles.posManageLabel}
              />
              <span className="font-medium">{t.roles.posManageLabel}</span>
            </label>
          )}
        </>
      )}
    </div>
  );
}
