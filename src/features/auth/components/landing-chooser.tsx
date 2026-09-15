"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ScanLine, ArrowRight, ShieldX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type Area = "dashboard" | "caisse";

const STORAGE_KEY = "pos:lastArea";

export function LandingChooser({
  canDashboard,
  canPos,
}: {
  canDashboard: boolean;
  canPos: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [lastArea, setLastArea] = useState<Area | null>(null);
  const [denied, setDenied] = useState<Area | null>(null);
  const [navigating, setNavigating] = useState<Area | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "dashboard" || stored === "caisse") setLastArea(stored);
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function go(area: Area) {
    const allowed = area === "dashboard" ? canDashboard : canPos;
    if (!allowed) {
      setDenied(area);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, area);
    } catch {
      // ignore
    }
    setNavigating(area);
    router.push(area === "dashboard" ? "/dashboard" : "/caisse");
  }

  const cards: {
    area: Area;
    label: string;
    description: string;
    icon: typeof LayoutDashboard;
  }[] = [
    {
      area: "dashboard",
      label: t.auth.chooser.dashboard,
      description: t.auth.chooser.dashboardDescription,
      icon: LayoutDashboard,
    },
    {
      area: "caisse",
      label: t.auth.chooser.caisse,
      description: t.auth.chooser.caisseDescription,
      icon: ScanLine,
    },
  ];

  return (
    <>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        {cards.map(({ area, label, description, icon: Icon }) => (
          <button
            key={area}
            type="button"
            onClick={() => go(area)}
            disabled={navigating !== null}
            className={cn(
              "group relative flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-60",
              lastArea === area && "border-primary ring-2 ring-primary/30",
            )}
          >
            {lastArea === area && (
              <span className="absolute end-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {t.auth.chooser.lastChoiceBadge}
              </span>
            )}
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5.5" />
            </span>
            <span className="text-base font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {navigating === area
                ? t.auth.loggingIn
                : area === "dashboard"
                  ? t.auth.chooser.goToDashboard
                  : t.auth.chooser.goToCaisse}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>

      <Dialog open={denied !== null} onOpenChange={(next) => !next && setDenied(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-destructive/10">
              <ShieldX className="size-5.5 text-destructive" />
            </div>
            <DialogTitle>
              {denied === "dashboard"
                ? t.auth.chooser.noDashboardAccessTitle
                : t.auth.chooser.noCaisseAccessTitle}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {denied === "dashboard"
              ? t.auth.chooser.noDashboardAccessBody
              : t.auth.chooser.noCaisseAccessBody}
          </p>
          <div className="flex flex-wrap gap-2">
            {denied === "dashboard" && canPos && (
              <Button type="button" onClick={() => go("caisse")}>
                <ScanLine className="size-4" />
                {t.auth.chooser.goToCaisse}
              </Button>
            )}
            {denied === "caisse" && canDashboard && (
              <Button type="button" onClick={() => go("dashboard")}>
                <LayoutDashboard className="size-4" />
                {t.auth.chooser.goToDashboard}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDenied(null)}>
              {t.auth.chooser.dismiss}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
