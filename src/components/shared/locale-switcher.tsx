"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { locales, localeCodes, localeLabels } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

function LocaleBadge({ active, code }: { active?: boolean; code: string }) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-8 shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-bold tracking-wide tabular-nums",
        active
          ? "bg-primary text-primary-foreground!"
          : "bg-muted text-muted-foreground!",
      )}
    >
      {code}
    </span>
  );
}

export function LocaleSwitcher({
  variant = "button",
  className,
}: {
  variant?: "button" | "sidebar";
  className?: string;
}) {
  const { locale, setLocale, isPending, t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "sidebar" ? (
            <SidebarMenuButton
              tooltip={t.sidebar.language}
              disabled={isPending}
              className={cn(
                "text-sidebar-foreground/70 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground",
                className,
              )}
            >
              <Globe className="size-4 shrink-0" />
              <span className="flex-1 truncate">{localeLabels[locale]}</span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-sidebar-foreground/80 tabular-nums">
                  {localeCodes[locale]}
                </span>
                <ChevronDown className="size-3.5 text-sidebar-foreground/40 transition-transform duration-150 group-data-popup-open/menu-button:rotate-180" />
              </span>
            </SidebarMenuButton>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              className={cn("gap-2", className)}
            >
              <Globe className="size-4" />
              {localeLabels[locale]}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          )
        }
      />
      <DropdownMenuContent align="start" className="w-52 p-1.5">
        {locales.map((option) => {
          const isActive = option === locale;
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => setLocale(option)}
              className={cn(
                "gap-2.5 rounded-md py-2 cursor-pointer ",
                isActive && "bg-accent text-accent-foreground ",
              )}
            >
              <LocaleBadge code={localeCodes[option]} active={isActive} />
              <span className="flex-1 truncate font-medium">
                {localeLabels[option]}
              </span>
              {isActive && <Check className="size-4 shrink-0 text-primary!" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
