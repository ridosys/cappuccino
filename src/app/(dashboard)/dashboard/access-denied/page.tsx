import Link from "next/link";
import { Home, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFirstAccessiblePath } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const [t, backHref] = await Promise.all([
    getDictionary(),
    getFirstAccessiblePath(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldX className="size-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t.accessDenied.title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t.accessDenied.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href={backHref} />}>
          <Home className="size-4" />
          {t.accessDenied.backHome}
        </Button>
      </div>
    </div>
  );
}
