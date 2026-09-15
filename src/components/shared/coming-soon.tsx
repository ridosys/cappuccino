"use client";

import { Construction } from "lucide-react";
import { useT } from "@/i18n/locale-provider";

export function ComingSoon({ title }: { title: string }) {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center text-muted-foreground">
        <Construction className="size-8" />
        <p>{t.common.comingSoon}</p>
      </div>
    </div>
  );
}
