import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/server";

export default async function DashboardNotFound() {
  const t = await getDictionary();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="text-6xl font-bold tracking-tight">404</p>
        <h1 className="text-xl font-semibold">{t.notFound.title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t.notFound.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          <Home className="size-4" />
          {t.notFound.backHome}
        </Button>
      </div>
    </div>
  );
}
